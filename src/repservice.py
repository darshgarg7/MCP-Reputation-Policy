import asyncio
from collections import deque
from datastore import RepDataStore
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
        self.store = RepDataStore()  # Initialize the persistence layer
        self.reputations: Dict[str, Dict[str, Any]] = {}
        self.telemetry_queue: asyncio.Queue[Dict[str, Any]] = asyncio.Queue()
        self._initialize_reputations()
        print("✅ RepScore Service (Persistent Trust Fabric) initialized.")

    async def initialize(self):
        """Async startup hook used by the FastAPI app."""
        await self.store.initialize()
        await self._hydrate_from_disk()

    def ensure_servers(self, routes: List[Dict[str, Any]]) -> None:
        """Seed reputation rows for dynamically discovered MCP server IDs."""
        current_time = time.time()
        for route in routes:
            server_id = route["server_id"]
            initial_score = float(route.get('initial_score', RepScoreConfig.DEFAULT_INITIAL_SCORE))
            if server_id not in self.reputations:
                self.reputations[server_id] = {
                    'score': initial_score,
                    'last_update': current_time,
                    'interaction_count': 0,
                    'history': deque([initial_score], maxlen=100),
                }
            elif route.get('initial_score') is not None and self._should_reset_demo_seed(server_id, current_time):
                self.reputations[server_id]['score'] = initial_score
                self.reputations[server_id]['last_update'] = current_time
                self.reputations[server_id]['interaction_count'] = 0
                self.reputations[server_id]['history'] = deque([initial_score], maxlen=100)

            if server_id not in self.server_catalog:
                self.server_catalog[server_id] = {
                    'tool_type': route.get('tool_type'),
                    'cost_per_unit': route.get('cost_per_unit', RepScoreConfig.COST_BENCHMARK),
                    'error_rate': 0.0,
                    'avg_latency': 0.0,
                }

    async def reset_demo_state(self, routes: List[Dict[str, Any]]) -> None:
        """Restore dynamically discovered demo servers to their seeded scores."""
        await self.store.reset_demo_state()
        current_time = time.time()
        for route in routes:
            server_id = route["server_id"]
            initial_score = float(route.get('initial_score', RepScoreConfig.DEFAULT_INITIAL_SCORE))
            self.reputations[server_id] = {
                'score': initial_score,
                'last_update': current_time,
                'interaction_count': 0,
                'history': deque([initial_score], maxlen=100),
            }
            self.server_catalog[server_id] = {
                'tool_type': route.get('tool_type'),
                'cost_per_unit': route.get('cost_per_unit', RepScoreConfig.COST_BENCHMARK),
                'error_rate': 0.0,
                'avg_latency': 0.0,
            }

        while not self.telemetry_queue.empty():
            try:
                self.telemetry_queue.get_nowait()
                self.telemetry_queue.task_done()
            except asyncio.QueueEmpty:
                break

    def _should_reset_demo_seed(self, server_id: str, current_time: float) -> bool:
        rep_data = self.reputations[server_id]
        if rep_data.get('interaction_count', 0) == 0:
            return True

        half_life_seconds = RepScoreConfig.REPUTATION_DECAY_HALF_LIFE_HOURS * 3600
        last_update = rep_data.get('last_update', current_time)
        return current_time - last_update > half_life_seconds

    async def _hydrate_from_disk(self):
        persisted_rows = await self.store.get_all_server_metadata()
        for s_id, persisted in persisted_rows.items():
            if s_id not in self.reputations:
                self.reputations[s_id] = {
                    'score': persisted['score'],
                    'last_update': persisted['last_update'],
                    'interaction_count': persisted.get('interaction_count', 0),
                    'history': deque(persisted.get('history', [persisted['score']]), maxlen=100),
                }
                continue

            self.reputations[s_id]['score'] = persisted['score']
            self.reputations[s_id]['last_update'] = persisted['last_update']
            self.reputations[s_id]['interaction_count'] = persisted.get('interaction_count', 0)
            self.reputations[s_id]['history'] = deque(
                persisted.get('history', [persisted['score']]),
                maxlen=100,
            )

    def _initialize_reputations(self):
        current_time = time.time()
        for s_id in self.server_catalog:
            self.reputations[s_id] = {
                'score': RepScoreConfig.DEFAULT_INITIAL_SCORE,
                'last_update': current_time,
                'interaction_count': 0,
                'history': deque([RepScoreConfig.DEFAULT_INITIAL_SCORE], maxlen=100),
            }
        
        # Custom starting scores for verified/competitive servers
        self.reputations["compute_server_1"]['score'] = 0.85
        self.reputations["data_server_2"]['score'] = 0.95
        
        # NEW servers added to the ecosystem (Give them starting scores to be selectable/competitive)
        if "image_fast_4" in self.reputations:
            self.reputations["image_fast_4"]['score'] = 0.88 # High initial trust
        if "image_cheap_5" in self.reputations:
            self.reputations["image_cheap_5"]['score'] = 0.65 # Intentionally low trust (will be blocked)
        if "semantic_db_6" in self.reputations:
            self.reputations["semantic_db_6"]['score'] = 0.92 # High initial trust

        for rep_data in self.reputations.values():
            rep_data['history'] = deque([rep_data['score']], maxlen=100)


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

    async def get_all_reputations(self) -> Dict[str, Dict[str, Any]]:
        """Return a serializable snapshot of all live reputation state."""
        snapshot: Dict[str, Dict[str, Any]] = {}
        for server_id, rep_data in self.reputations.items():
            score = self.get_reputation(server_id)
            history = rep_data.get('history', deque([score], maxlen=100))
            snapshot[server_id] = {
                'score': score,
                'history': list(history),
                'interaction_count': rep_data.get('interaction_count', 0),
                'last_update': rep_data.get('last_update'),
            }
        return snapshot

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
        Uses normalized unit-cost comparisons and clamped satisfaction scores.
        """
        outcome = log_entry['outcome_status']
        latency = log_entry['latency_sec']
        satisfaction = log_entry['client_satisfaction']
        server_id = log_entry['server_id']
        tool_type = self.server_catalog[server_id]['tool_type']
        actual_unit_price = self.server_catalog[server_id]['cost_per_unit']
        avg_market_unit_price = self._get_avg_cost_for_tool(tool_type)
        reliability_factor = 1.0 if outcome == "SUCCESS" else 0.0

        # if latency == benchmark, factor is 0. If latency is 0, factor is 1.
        latency_ratio = min(1.0, latency / RepScoreConfig.MAX_ACCEPTABLE_LATENCY)
        latency_factor = 1.0 - latency_ratio
        # Reward servers that are cheaper than the market average
        if actual_unit_price <= avg_market_unit_price:
            # High reward for being cheaper than average
            cost_factor = 1.0 
        else:
            # Penalty for being more expensive than market average
            cost_factor = max(0.0, 1.0 - (actual_unit_price - avg_market_unit_price) / avg_market_unit_price)

        # We clamp satisfaction here too just in case it overflowed
        clamped_satisfaction = max(0.0, min(1.0, satisfaction))
        
        WCS = (
            RepScoreConfig.WEIGHT_SATISFACTION * clamped_satisfaction + 
            RepScoreConfig.WEIGHT_RELIABILITY * reliability_factor + 
            RepScoreConfig.WEIGHT_LATENCY_PENALTY * latency_factor +
            RepScoreConfig.WEIGHT_COST_EFFICIENCY * cost_factor
        )

        # Exponential Moving Average (EMA) Update
        new_score = (RepScoreConfig.ALPHA_SMOOTHING * WCS + (1 - RepScoreConfig.ALPHA_SMOOTHING) * current_score)
        return round(max(0.0, min(1.0, new_score)), 4)

    def submit_feedback(self, log_entry: Dict[str, Any]):
        server_id = log_entry['server_id']
        if server_id not in self.reputations:
            self.ensure_servers([{
                'server_id': server_id,
                'tool_type': log_entry.get('tool_type'),
                'cost_per_unit': RepScoreConfig.COST_BENCHMARK,
            }])
        
        # 1. Get current state
        current_score = self.get_reputation(server_id)
        count = self.reputations[server_id].get('interaction_count', 0) + 1
        
        # 2. Compute new score
        new_score = self.calculate_new_score(current_score, log_entry)
        
        # 3. Update Memory
        self.reputations[server_id]['score'] = new_score
        self.reputations[server_id]['last_update'] = time.time()
        self.reputations[server_id]['interaction_count'] = count
        self.reputations[server_id].setdefault('history', deque(maxlen=100)).append(new_score)
        
        print(f"   [RepScore Update] {server_id}: {current_score:.4f} -> **{new_score:.4f}** (Saved)")

    async def record_feedback(self, log_entry: Dict[str, Any]) -> None:
        maybe_result = self.submit_feedback(log_entry)
        if asyncio.iscoroutine(maybe_result):
            await maybe_result
        if log_entry['server_id'] in self.reputations:
            await self._persist_feedback(log_entry)

    async def enqueue_feedback(self, log_entry: Dict[str, Any]) -> None:
        await self.telemetry_queue.put(log_entry)

    async def process_telemetry_worker(self) -> None:
        while True:
            log_entry = await self.telemetry_queue.get()
            try:
                self.submit_feedback(log_entry)
                await self._persist_feedback(log_entry)
            finally:
                self.telemetry_queue.task_done()

    async def _persist_feedback(self, log_entry: Dict[str, Any]) -> None:
        server_id = log_entry['server_id']
        rep_data = self.reputations[server_id]
        await self.store.update_server_metadata(
            server_id=server_id,
            score=rep_data['score'],
            last_update=rep_data['last_update'],
            interaction_count=rep_data.get('interaction_count', 0),
            history=list(rep_data.get('history', [])),
        )
        await self.store.insert_telemetry(
            log_id=log_entry.get('id') or log_entry.get('transaction_id'),
            server_id=server_id,
            client_request=log_entry.get('client_request', ''),
            response=log_entry,
            timestamp=log_entry.get('timestamp', time.time()),
        )
