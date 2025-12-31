import collections
import time
from typing import Dict, Any, List
from config import RepScoreConfig, ServerCatalog, ToolType 

class RepScoreService:
    """
    Centralized, trusted service for reputation management (RP Layer).
    Models the distributed architecture: DynamoDB (storage) and Lambda (logic).
    """
    
    def __init__(self):
        self.server_catalog = ServerCatalog.CATALOG
        self.reputations: Dict[str, Dict[str, Any]] = {}
        self._initialize_reputations()
        print("✅ RepScore Service (Central Trust Fabric) initialized.")

    def _initialize_reputations(self):
        """
        Sets initial reputation scores and last_update timestamp for ALL servers.
        This includes custom scores for new, selectable servers.
        """
        current_time = time.time()
        for s_id in self.server_catalog:
            self.reputations[s_id] = {
                'score': RepScoreConfig.DEFAULT_INITIAL_SCORE, 
                'last_update': current_time,
                'history': collections.deque(maxlen=100)
            }
        
        # Apply custom starting scores for verified or competitive servers
        self.reputations["compute_server_1"]['score'] = 0.85
        self.reputations["data_server_2"]['score'] = 0.95
        
        # NEW servers added to the ecosystem (Give them starting scores to be selectable/competitive)
        if "image_fast_4" in self.reputations:
            self.reputations["image_fast_4"]['score'] = 0.88      # High initial trust
        if "image_cheap_5" in self.reputations:
            self.reputations["image_cheap_5"]['score'] = 0.65     # Intentionally low trust (will be blocked)
        if "semantic_db_6" in self.reputations:
            self.reputations["semantic_db_6"]['score'] = 0.92     # High initial trust


    # --- New Logic: Time-Based Decay ---

    def _apply_decay(self, server_id: str, current_rep: float, last_update_time: float) -> float:
        """Applies reputation decay based on time elapsed since the last transaction (Model Drift penalty)."""
        time_elapsed = time.time() - last_update_time
        
        # Reference constant correctly from RepScoreConfig
        half_life_seconds = RepScoreConfig.REPUTATION_DECAY_HALF_LIFE_HOURS * 3600
        
        if time_elapsed < 1: 
            return current_rep

        # Calculate decay factor
        decay_periods = time_elapsed / half_life_seconds
        decay_factor = pow(0.5, decay_periods)
        
        score_differential = current_rep - RepScoreConfig.DEFAULT_INITIAL_SCORE
        decayed_score = RepScoreConfig.DEFAULT_INITIAL_SCORE + (score_differential * decay_factor)
        
        if decayed_score < current_rep - 0.001:
            print(f"   [DECAY WARNING] {server_id}: Score decayed from {current_rep:.4f} to {decayed_score:.4f}.")

        return max(RepScoreConfig.DEFAULT_INITIAL_SCORE, decayed_score)

    def get_reputation(self, server_id: str) -> float:
        """API for clients to query the live Reputation Index, including decay check."""
        rep_data = self.reputations.get(server_id)
        if not rep_data:
            return RepScoreConfig.DEFAULT_INITIAL_SCORE

        current_score = rep_data['score']
        last_update = rep_data['last_update']
        
        decayed_score = self._apply_decay(server_id, current_score, last_update)
        
        if decayed_score < current_score:
            self.reputations[server_id]['score'] = decayed_score
            self.reputations[server_id]['last_update'] = time.time() # Reset update time on read after decay

        return decayed_score

    # --- Utility for Relative Cost Calculation (Defensive) ---

    def _get_avg_cost_for_tool(self, tool_type: ToolType) -> float:
        """Calculates the average declared cost for all available servers of a specific tool type."""
        total_cost = 0.0
        count = 0
        for data in self.server_catalog.values():
            if data["tool_type"] == tool_type:
                total_cost += data.get("cost_per_unit", RepScoreConfig.COST_BENCHMARK) # Safer access
                count += 1
        
        # Defensive Division Check (FAANG level robustness)
        if count == 0:
             return RepScoreConfig.COST_BENCHMARK
        
        return total_cost / count

    def discover_servers(self, tool_type: ToolType) -> List[Dict[str, Any]]:
        """Provides the client with all compatible servers and their current reputation."""
        available_servers = []
        for s_id, data in self.server_catalog.items():
            if data["tool_type"] == tool_type:
                score = self.get_reputation(s_id)
                available_servers.append({
                    "server_id": s_id, "score": score, "cost": data["cost_per_unit"], "tool_type": tool_type
                })
        return sorted(available_servers, key=lambda x: x["score"], reverse=True)

    def calculate_new_score(self, current_score: float, log_entry: Dict[str, Any]) -> float:
        """
        Calculates the Multi-Factor Reputation Index update (RS).
        FIXED: Uses RELATIVE Cost Efficiency.
        """
        outcome, latency, satisfaction, cost_used = (
            log_entry['outcome_status'], log_entry['latency_sec'], 
            log_entry['client_satisfaction'], log_entry['compute_cost_units']
        )
        server_id = log_entry['server_id']
        tool_type = self.server_catalog[server_id]['tool_type']
        
        # 1. Calculate Relative Cost Benchmark for this transaction
        avg_tool_cost = self._get_avg_cost_for_tool(tool_type)
        
        # Factor Calculation
        reliability_factor = 1.0 if outcome == "SUCCESS" else 0.0
        latency_penalty = min(1.0, latency / RepScoreConfig.MAX_ACCEPTABLE_LATENCY)
        latency_factor = 1.0 - latency_penalty
        
        # --- RELATIVE Cost Factor (F_C) ---
        if cost_used <= avg_tool_cost:
             cost_factor = 1.0 - (cost_used / (2 * avg_tool_cost)) 
        else:
             # Penalty logic: the greater the difference (cost_used - avg_tool_cost), the higher the penalty
             cost_factor = max(0.0, 1.0 - ((cost_used - avg_tool_cost) / avg_tool_cost))
        # ----------------------------------------
        
        # Weighted Composite Score (WCS) & EMA Update
        WCS = max(0.0, min(1.0, (
            RepScoreConfig.WEIGHT_SATISFACTION * satisfaction + 
            RepScoreConfig.WEIGHT_RELIABILITY * reliability_factor + 
            RepScoreConfig.WEIGHT_LATENCY_PENALTY * latency_factor +
            RepScoreConfig.WEIGHT_COST_EFFICIENCY * cost_factor
        )))
        
        new_score = (RepScoreConfig.ALPHA_SMOOTHING * WCS + (1 - RepScoreConfig.ALPHA_SMOOTHING) * current_score)
        
        return round(new_score, 4)

    def submit_feedback(self, log_entry: Dict[str, Any]):
        """API endpoint to receive and process telemetry (Pillar 1: Logging & Auditing)."""
        server_id = log_entry['server_id']
        if server_id not in self.reputations:
            print(f"   [ERROR] Server {server_id} not found. Skipping update.")
            return

        current_score = self.get_reputation(server_id)
        new_score = self.calculate_new_score(current_score, log_entry)
        
        self.reputations[server_id]['score'] = new_score
        self.reputations[server_id]['last_update'] = time.time()
        
        print(f"   [RepScore Update] {server_id}: Score updated from {current_score:.4f} to **{new_score:.4f}**")
