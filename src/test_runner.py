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
FLOAT_TOLERANCE = 0.005 # Tolerance for score assertions

# Test Case Definitions

TEST_CASES = [
    {
        "name": "T1_Baseline_High_Reliability",
        "tool_type": ToolType.DATA_RETRIEVAL,
        "runs": 2,
        "server_id": "data_server_2",
        "assert_min_score": 0.93,
        "notes": "Verifies reliable server maintains high score and is never blocked."
    },
    {
        "name": "T2_Initial_Policy_Block",
        "tool_type": ToolType.MATH_COMPUTE, 
        "runs": 1,
        "server_id": "low_score_server_3",
        "expect_block_run": 1,
        "notes": "Verifies unverified server (low_score_server_3 @ 0.50) is blocked immediately."
    },
    {
        "name": "T3_Extreme_Latency_Penalty",
        "prompt": "Test latency penalty in isolation (should severely drop satisfaction).",
        "tool_type": ToolType.MATH_COMPUTE,
        "runs": 2,
        "server_id": "compute_server_1",
        "setup_changes": { # Latency > MAX_ACCEPTABLE_LATENCY (0.8)
            "error_rate": 0.0, # Force SUCCESS to isolate latency penalty
            "avg_latency": 1.5 
        },
        "assert_max_score": 0.78, # Expect score to drop significantly below initial 0.85
        "notes": "Verifies that extreme latency successfully penalizes the score, even on success."
    },
    {
        "name": "T4_Deterioration_Failover_Threshold",
        "prompt": "Stress test compute until policy block threshold is crossed.",
        "tool_type": ToolType.MATH_COMPUTE,
        "runs": 6, 
        "server_id": "compute_server_1",
        "setup_changes": {
            "error_rate": 0.45, # High failure rate
            "avg_latency": 0.75 # High latency
        },
        "expect_block_run": 3, # Expect block to occur between runs 3-5
        "notes": "Verifies score drops below threshold and the client blocks execution."
    },
    {
        "name": "T5_Decay_Half_Life_Verification",
        "prompt": "Check reputation after simulated inactivity.",
        "tool_type": ToolType.DATA_RETRIEVAL,
        "runs": 1,
        "server_id": "data_server_2",
        "setup_sleep_hours": RepScoreConfig.REPUTATION_DECAY_HALF_LIFE_HOURS, # 24 hours
        "assert_decay_score_target": 0.725, # Target: (0.95 - 0.50) / 2 + 0.50 = 0.725
        "notes": "Verifies the decay mechanism correctly drops the score halfway to the default 0.50."
    },
    {
        "name": "T6_Relative_Cost_Edge_Case",
        "prompt": "Test max reward for zero cost/max penalty for high cost.",
        "tool_type": ToolType.DATA_RETRIEVAL,
        "runs": 2,
        "server_id": "data_server_2",
        "setup_changes": {
            "error_rate": 0.0,
            "avg_latency": 0.1,
            # Temporarily modify the cost_per_unit for this specific instance
            "cost_per_unit": 0.0001, 
        },
        "assert_min_score": 0.96, # Expect significant score increase due to max cost reward
        "notes": "Verifies the relative cost factor (F_C) grants maximum reward for ultra-low cost."
    }
]

# Test Runner Core Functions

def setup_environment() -> Tuple[RepScoreService, MCP_Client]:
    """Initializes the RepScore Service and MCP Client from a clean state."""
    rep_service = RepScoreService()
    client = MCP_Client(rep_service)
    return rep_service, client

def run_tests(log_file):
    """Executes all defined test cases with full isolation."""
    
    log_file.write(f"--- Test Run Started: {datetime.now()} ---\n")
    log_file.write(f"Policy Threshold: {RepScoreConfig.MIN_REPUTATION_THRESHOLD}\n")
    log_file.write(f"Decay Half-Life: {RepScoreConfig.REPUTATION_DECAY_HALF_LIFE_HOURS} hours\n\n")
    
    # Run a fresh setup once to capture the initial server configuration for resetting.
    rep_service_template, client_template = setup_environment()
    initial_server_configs = {s_id: client_template.servers[s_id].__dict__.copy() for s_id in ServerCatalog.CATALOG}
    
    del rep_service_template
    del client_template # Clear the templates

    for i, case in enumerate(TEST_CASES):
        
        # 1. Reset environment to a clean state for every test case.
        rep_service, client = setup_environment() 
        
        # Ensure a server_id is available for score retrieval and setup changes
        target_server_id = case.get("server_id", "compute_server_1")

        # 2. Apply temporary changes needed for this specific test case.
        if "setup_changes" in case:
            changes = case["setup_changes"]
            
            # Reset server stats to initial state from the captured template (using target_server_id for safety)
            server = client.servers[target_server_id] 
            
            for k, v in initial_server_configs[target_server_id].items():
                 if hasattr(server, k):
                     setattr(server, k, v)
                 
            # Apply custom changes for the test
            server.error_rate = changes.get("error_rate", server.error_rate)
            server.avg_latency = changes.get("avg_latency", server.avg_latency)
            server.cost_per_unit = changes.get("cost_per_unit", server.cost_per_unit)
            log_file.write(f"[SETUP] Applied changes to {target_server_id}\n")

        # 3. SIMULATE INACTIVITY (for Decay Test)
        if "setup_sleep_hours" in case:
            sleep_sec = case["setup_sleep_hours"] * 3600
            log_file.write(f"[SETUP] Simulating {case['setup_sleep_hours']} hours of inactivity...\n")
            
            # Directly modify the last_update timestamp on the service's internal data
            for s_id, data in rep_service.reputations.items():
                data['last_update'] -= sleep_sec 
            log_file.write(f"[INFO] Timestamps advanced for decay check.\n")

        # Test Execution
        log_file.write(f"\n--- Running Test Case {i+1}: {case['name']} ---\n")
        
        block_count = 0
        final_score = 0.0
        
        for run_num in range(case['runs']):
            # Redirect stdout to capture the execution log
            old_stdout = sys.stdout
            sys.stdout = redirect_stdout = StringIO()

            # EXECUTE
            result = client.execute_task(case.get("prompt", "Default task"), case["tool_type"])

            # Capture log and check for warnings
            sys.stdout = old_stdout
            run_log = redirect_stdout.getvalue()
            log_file.write(run_log)
            
            if "Policy BLOCK" in result:
                block_count += 1

            # Get the current score after the run (for verification)
            final_score = rep_service.get_reputation(target_server_id) 
            
            # Specific assertion check for deterioration test
            if case.get("expect_block_run") and run_num + 1 == case["expect_block_run"]:
                if block_count == 0:
                    log_file.write(f"[FAIL] Block expected at Run {run_num + 1}, but did not occur.\n")
                else:
                    log_file.write(f"[PASS] Block threshold successfully crossed at Run {run_num + 1}.\n")
        
        # 4. VERIFICATION (Assertions)
        log_file.write(f"\n--- Verification for {case['name']} ---\n")
        log_file.write(f"Final Score ({target_server_id}): {final_score:.4f}\n")
        
        # General Pass/Fail Check
        if case.get("expect_block", False) and block_count > 0:
            log_file.write(f"[PASS] Policy Block: Expected block occurred (Blocked {block_count}/{case['runs']}).\n")
        elif case.get("expect_block", False) and block_count == 0:
             log_file.write(f"[FAIL] Policy Block: Expected block did NOT occur (Score: {final_score:.4f}).\n")
        elif not case.get("expect_block", False) and block_count > 0:
            log_file.write(f"[FAIL] Policy Block: Unexpected block occurred. Policy triggered prematurely.\n")
        else:
            log_file.write(f"[PASS] Policy Block: Policy behaved as expected (No unexpected block).\n")
            
        # Assertion Checks
        if "assert_min_score" in case and final_score < case["assert_min_score"] - FLOAT_TOLERANCE:
            log_file.write(f"[FAIL] Score Assert: Final score ({final_score:.4f}) below min target ({case['assert_min_score']:.4f}).\n")
        elif "assert_max_score" in case and final_score > case["assert_max_score"] + FLOAT_TOLERANCE:
            log_file.write(f"[FAIL] Score Assert: Final score ({final_score:.4f}) above max target ({case['assert_max_score']:.4f}).\n")
        elif "assert_decay_score_target" in case:
            target = case["assert_decay_score_target"]
            if abs(final_score - target) < FLOAT_TOLERANCE:
                log_file.write(f"[PASS] Decay Assert: Score {final_score:.4f} matched expected decay target {target:.4f}.\n")
            else:
                log_file.write(f"[FAIL] Decay Assert: Score {final_score:.4f} DID NOT match expected decay target {target:.4f}.\n")

        log_file.write(f"Notes: {case['notes']}\n")
        log_file.write("-" * 60 + "\n")

# Setup and Main Functions

def main():
    """Main execution entry point."""
    print(f"Starting MCP Test Runner (Production Grade)...")
    
    # Safely recreate the output directory
    if os.path.exists(OUTPUT_DIR):
        shutil.rmtree(OUTPUT_DIR)
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    log_path = os.path.join(OUTPUT_DIR, LOG_FILENAME)
    
    # Run the tests and write to file
    try:
        with open(log_path, 'w') as f:
            run_tests(f)
        
        print(f"\n✅ Testing Complete! Results saved to: {log_path}")
        print("Review the log file for detailed PASS/FAIL verification.")

    except Exception as e:
        print(f"\n❌ An unrecoverable error occurred during execution: {e}")
        import traceback
        traceback.print_exc()
        
if __name__ == "__main__":
    main()
