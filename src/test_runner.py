import os
import sys
import shutil
from io import StringIO
from datetime import datetime
from typing import Tuple
from config import ToolType, RepScoreConfig, ServerCatalog 
from repservice import RepScoreService
from mcp import MCP_Client 

# Configuration
OUTPUT_DIR = "test_results"
LOG_FILENAME = f"test_run_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
FLOAT_TOLERANCE = 0.01 

# Test Case Definitions
TEST_CASES = [
    {
        "name": "T1_Baseline_High_Reliability",
        "tool_type": ToolType.DATA_RETRIEVAL,
        "runs": 2,
        "server_id": "data_server_2",
        "assert_min_score": 0.88,
        "notes": "Verifies reliable server maintains high score."
    },
    {
        "name": "T2_Initial_Policy_Block",
        "tool_type": ToolType.MATH_COMPUTE, 
        "runs": 1,
        "server_id": "low_score_server_3",
        "expect_block_run": 1,
        "notes": "Verifies unverified server (@ 0.50) is blocked or probed immediately."
    },
    {
        "name": "T3_Extreme_Latency_Penalty",
        "prompt": "Test latency penalty in isolation.",
        "tool_type": ToolType.MATH_COMPUTE,
        "runs": 2,
        "server_id": "compute_server_1",
        "setup_changes": { 
            "error_rate": 0.0, 
            "avg_latency": 1.5 
        },
        "assert_max_score": 0.75,
        "notes": "Verifies that extreme latency penalizes the score significantly."
    },
    {
        "name": "T4_Deterioration_Failover_Threshold",
        "prompt": "Stress test compute until policy block.",
        "tool_type": ToolType.MATH_COMPUTE,
        "runs": 4, 
        "server_id": "compute_server_1",
        "setup_changes": {
            "error_rate": 0.60,
            "avg_latency": 0.75 
        },
        "expect_block_run": 2,
        "notes": "Verifies rapid score drop below 0.70 threshold."
    },
    {
        "name": "T5_Decay_Half_Life_Verification",
        "prompt": "Check reputation after simulated inactivity.",
        "tool_type": ToolType.DATA_RETRIEVAL,
        "runs": 1,
        "server_id": "data_server_2",
        "setup_sleep_hours": 24,
        "assert_decay_score_target": 0.725,
        "notes": "Verifies the decay mechanism correctly drops the score halfway to 0.50."
    },
    {
        "name": "T6_Relative_Cost_Edge_Case",
        "prompt": "Test max reward for ultra-low unit cost.",
        "tool_type": ToolType.DATA_RETRIEVAL,
        "runs": 2,
        "server_id": "data_server_2",
        "setup_changes": {
            "error_rate": 0.0,
            "avg_latency": 0.05,
            "cost_per_unit": 0.0001,
        },
        "assert_min_score": 0.94,
        "notes": "Verifies unit-cost comparison rewards efficiency."
    },
    {
        "name": "T7_Redemption_Arc",
        "prompt": "Recover a server from the blocked state.",
        "tool_type": ToolType.MATH_COMPUTE,
        "runs": 15, # Increased runs to ensure probabilistic probes trigger
        "server_id": "compute_server_1",
        "setup_changes": {
            "error_rate": 0.0, 
            "avg_latency": 0.1, 
            "starting_score": 0.60 
        },
        "assert_min_score": 0.80, 
        "notes": "Verifies a penalized server can regain trust via probing."
    },
    {
        "name": "T8_Adversarial_Pivot",
        "prompt": "Sudden failure on high trust.",
        "tool_type": ToolType.DATA_RETRIEVAL,
        "runs": 1,
        "server_id": "data_server_2",
        "setup_changes": {
            "starting_score": 0.98,
            "error_rate": 1.0, 
        },
        "assert_max_score": 0.82, 
        "notes": "Ensures history doesn't fully shield from new failures."
    }
]

def setup_environment() -> Tuple[RepScoreService, MCP_Client]:
    rep_service = RepScoreService()
    client = MCP_Client(rep_service)
    return rep_service, client

def run_tests(log_file):
    log_file.write(f"--- Test Run Started: {datetime.now()} ---\n")
    log_file.write(f"Policy Threshold: {RepScoreConfig.MIN_REPUTATION_THRESHOLD}\n")
    log_file.write(f"Alpha Smoothing: {RepScoreConfig.ALPHA_SMOOTHING}\n\n")
    
    rep_service_template, client_template = setup_environment()
    initial_server_configs = {s_id: client_template.servers[s_id].__dict__.copy() for s_id in ServerCatalog.CATALOG}

    for i, case in enumerate(TEST_CASES):
        rep_service, client = setup_environment() 
        target_server_id = case.get("server_id", "compute_server_1")
        decay_capture = None

        if "setup_changes" in case:
            changes = case["setup_changes"]
            server = client.servers[target_server_id] 
            
            for k, v in initial_server_configs[target_server_id].items():
                if hasattr(server, k): setattr(server, k, v)
                 
            server.error_rate = changes.get("error_rate", server.error_rate)
            server.avg_latency = changes.get("avg_latency", server.avg_latency)
            server.cost_per_unit = changes.get("cost_per_unit", server.cost_per_unit)
            
            if "starting_score" in changes:
                rep_service.reputations[target_server_id]['score'] = changes["starting_score"]
            
            log_file.write(f"[SETUP] Applied overrides to {target_server_id}\n")

        if "setup_sleep_hours" in case:
            sleep_sec = case["setup_sleep_hours"] * 3600
            for s_id, data in rep_service.reputations.items():
                data['last_update'] -= sleep_sec 
            
            # Capture decayed score BEFORE any tasks run
            decay_capture = rep_service.get_reputation(target_server_id)
            log_file.write(f"[DECAY CAPTURE] Score immediately after decay: {decay_capture:.4f}\n")

        log_file.write(f"\n--- Running Test Case {i+1}: {case['name']} ---\n")
        
        block_count = 0
        final_score = 0.0
        
        for run_num in range(case['runs']):
            old_stdout = sys.stdout
            sys.stdout = redirect_stdout = StringIO()

            result = client.execute_task(case.get("prompt", "Default task"), case["tool_type"])

            sys.stdout = old_stdout
            run_log = redirect_stdout.getvalue()
            log_file.write(run_log)
            
            # Count both hard blocks and probes as policy actions
            if "Policy BLOCK" in run_log or "RECOVERY PROBE" in run_log:
                block_count += 1

            final_score = rep_service.get_reputation(target_server_id) 
            
            if case.get("expect_block_run") and run_num + 1 == case["expect_block_run"]:
                if block_count == 0:
                    log_file.write(f"[FAIL] Block expected at Run {run_num + 1}, but did not occur.\n")
                else:
                    log_file.write(f"[PASS] Block/Probe policy triggered at Run {run_num + 1}.\n")
        
        log_file.write(f"\n--- Verification for {case['name']} ---\n")
        
        # Use decay_capture for T5 assertion, final_score for others
        verification_score = decay_capture if decay_capture is not None and "assert_decay" in str(case.keys()) else final_score
        log_file.write(f"Verification Score: {verification_score:.4f}\n")
        
        if "assert_min_score" in case and final_score < case["assert_min_score"] - FLOAT_TOLERANCE:
            log_file.write(f"[FAIL] Score Assert: {final_score:.4f} < {case['assert_min_score']:.4f}\n")
        elif "assert_max_score" in case and final_score > case["assert_max_score"] + FLOAT_TOLERANCE:
            log_file.write(f"[FAIL] Score Assert: {final_score:.4f} > {case['assert_max_score']:.4f}\n")
        elif "assert_decay_score_target" in case:
            target = case["assert_decay_score_target"]
            if abs(decay_capture - target) < FLOAT_TOLERANCE:
                log_file.write(f"[PASS] Decay matched target {target:.4f}\n")
            else:
                log_file.write(f"[FAIL] Decay mismatch. Got {decay_capture:.4f}, expected {target:.4f}\n")
        else:
            log_file.write(f"[PASS] Behavior matches expectations.\n")

        log_file.write("-" * 60 + "\n")

def main():
    if os.path.exists(OUTPUT_DIR): shutil.rmtree(OUTPUT_DIR)
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    log_path = os.path.join(OUTPUT_DIR, LOG_FILENAME)
    
    try:
        with open(log_path, 'w') as f:
            run_tests(f)
        print(f"\n✅ Testing Complete! Results saved to: {log_path}")
    except Exception as e:
        print(f"\n❌ Unrecoverable error: {e}")
        import traceback; traceback.print_exc()
        
if __name__ == "__main__":
    main()
    
