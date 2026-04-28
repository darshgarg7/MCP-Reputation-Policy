from datastore import RepDataStore
import time
import asyncio
from typing import Dict, Any, List
from config import RepScoreConfig, ServerCatalog, ToolType 
import structlog

logger = structlog.get_logger()

class RepScoreService:
    """
    Stateless, asynchronous reputation service mimicking AWS Lambda/Flink architecture.
    """
    def __init__(self):
        self.server_catalog = ServerCatalog.CATALOG
        self.store = RepDataStore()
        self.telemetry_queue = asyncio.Queue()

    async def initialize(self):
        await self.store.initialize()
        await self._initialize_reputations()
        logger.info("rep_service_initialized", message="Persistent Trust Fabric DB initialized")

    async def _initialize_reputations(self):
        current_time = time.time()
        for s_id in self.server_catalog:
            persisted = await self.store.get_server_metadata(s_id)
            if not persisted:
                # Fallback to default
                score = RepScoreConfig.DEFAULT_INITIAL_SCORE
                # Custom overrides
                if s_id == "aws_lambda_compute": score = 0.85
                if s_id == "bloomberg_mcp": score = 0.95
                if s_id == "legacy_mainframe": score = 0.65
                if s_id == "public_web_search": score = 0.88
                if s_id == "internal_research_db": score = 0.92

                await self.store.update_server_metadata(
                    server_id=s_id,
                    score=score,
                    last_update=current_time,
                    interaction_count=0,
                    history=[score]
                )

    async def get_reputation(self, server_id: str) -> float:
        data = await self.store.get_server_metadata(server_id)
        if data:
            return data['score']
        return RepScoreConfig.DEFAULT_INITIAL_SCORE

    async def get_all_reputations(self) -> Dict[str, Any]:
        return await self.store.get_all_server_metadata()

    async def submit_feedback(self, log_entry: Dict[str, Any]):
        await self.telemetry_queue.put(log_entry)
        logger.info("telemetry_queued", log_id=log_entry['id'], server_id=log_entry['server_id'])

    async def process_telemetry_worker(self):
        logger.info("telemetry_worker_started", message="Consuming telemetry from background queue")
        while True:
            log_entry = await self.telemetry_queue.get()
            try:
                await self._process_feedback_sync(log_entry)
            except Exception as e:
                logger.error("telemetry_processing_failed", error=str(e), log_id=log_entry.get('id'))
            finally:
                self.telemetry_queue.task_done()

    async def _process_feedback_sync(self, log_entry: Dict[str, Any]):
        s_id = log_entry['server_id']
        current_time = time.time()
        
        data = await self.store.get_server_metadata(s_id)
        if not data:
            return

        old_score = data['score']
        last_update = data['last_update']
        
        # Apply Time-Based Decay
        time_elapsed_hours = (current_time - last_update) / 3600.0
        decay_factor = min(time_elapsed_hours * 0.01, 0.2)
        decayed_score = max(0.0, old_score - decay_factor)

        # Calculate new interaction satisfaction
        response = log_entry['response']
        if response['status'] == 'SUCCESS':
            alpha = RepScoreConfig.WEIGHT_SATISFACTION + RepScoreConfig.WEIGHT_RELIABILITY
            beta = RepScoreConfig.WEIGHT_LATENCY_PENALTY
            gamma = RepScoreConfig.WEIGHT_COST_EFFICIENCY
            
            lat_score = max(0.0, 1.0 - (response['latency'] / 2.0))
            cost_score = max(0.0, 1.0 - (response['compute_cost'] / 100.0))
            
            satisfaction = (alpha * 1.0) + (beta * lat_score) + (gamma * cost_score)
            satisfaction *= response.get('server_confidence', 1.0)
        else:
            satisfaction = 0.0

        # EMA Smoothing
        smoothing = RepScoreConfig.ALPHA_SMOOTHING
        new_score = (smoothing * satisfaction) + ((1 - smoothing) * decayed_score)
        new_score = round(max(0.0, min(1.0, new_score)), 4)
        
        # Update Data
        interactions = data['interaction_count'] + 1
        history = data['history']
        history.append(new_score)
        if len(history) > 50:
            history.pop(0)

        await self.store.update_server_metadata(
            server_id=s_id,
            score=new_score,
            last_update=current_time,
            interaction_count=interactions,
            history=history
        )
        
        await self.store.insert_telemetry(
            log_id=log_entry['id'],
            server_id=s_id,
            client_request=log_entry['client_request'],
            response=response,
            timestamp=log_entry['timestamp']
        )
        logger.info("reputation_updated", server_id=s_id, old_score=old_score, new_score=new_score)
