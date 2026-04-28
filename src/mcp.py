import time
import asyncio
import random
import uuid
from typing import Dict, Any, Optional, List
from config import RepScoreConfig, ServerCatalog, ToolType, Status 
from repservice import RepScoreService 
import structlog

logger = structlog.get_logger()

# --- MCP SERVER SIMULATION (Tool Provider) ---

class MCP_Server:
    """The specialized computation/data server."""
    def __init__(self, server_id: str, tool_type: ToolType, error_rate: float, avg_latency: float, cost_per_unit: float):
        self.server_id = server_id
        self.tool_type = tool_type
        self.error_rate = error_rate
        self.avg_latency = avg_latency
        self.cost_per_unit = cost_per_unit

    async def execute_tool(self, client_request: str) -> Dict[str, Any]:
        """Simulates tool execution asynchronously without blocking the event loop."""
        latency = abs(random.gauss(self.avg_latency, 0.05))
        # Non-blocking async sleep simulates network I/O
        await asyncio.sleep(latency * 0.1) 
        
        compute_units = random.randint(50, 150)
        cost = compute_units * self.cost_per_unit
        
        if random.random() < self.error_rate:
            return {
                "status": Status.ERROR.value,
                "result": f"Execution failed: {self.server_id} fault.", 
                "latency": latency, "compute_cost": cost, "server_confidence": 0.2
            }
        
        return {
            "status": Status.SUCCESS.value,
            "result": f"Result for '{client_request}'. Used {compute_units} units.",
            "latency": latency, "compute_cost": cost, 
            "server_confidence": round(random.uniform(0.75, 0.99), 4)
        }


# --- MCP CLIENT (AI Agent with Policy Layer) ---

class MCP_Client:
    """
    The orchestrator simulating the LLM Agent utilizing the tools.
    """
    def __init__(self, rep_service: RepScoreService):
        self.rep_service = rep_service
        self.servers: Dict[str, MCP_Server] = {}
        self._discover_servers()
        logger.info("mcp_client_initialized", total_servers=len(self.servers))

    def _discover_servers(self):
        for s_id, metadata in ServerCatalog.CATALOG.items():
            self.servers[s_id] = MCP_Server(
                server_id=s_id,
                tool_type=metadata['tool_type'],
                error_rate=metadata['error_rate'],
                avg_latency=metadata['avg_latency'],
                cost_per_unit=metadata['cost_per_unit']
            )

    async def _select_best_server(self, task_type: ToolType, required_confidence: float = 0.8) -> Optional[str]:
        candidates = [s_id for s_id, s in self.servers.items() if s.tool_type == task_type]
        if not candidates:
            return None

        trusted = []
        probationary = []

        for c_id in candidates:
            rep_score = await self.rep_service.get_reputation(c_id)
            if rep_score >= RepScoreConfig.MIN_REPUTATION_THRESHOLD:
                trusted.append((c_id, rep_score))
            else:
                probationary.append((c_id, rep_score))

        trusted.sort(key=lambda x: x[1], reverse=True)
        probationary.sort(key=lambda x: x[1], reverse=True)

        if trusted:
            return trusted[0][0]
        
        if probationary:
            return probationary[0][0]

        return candidates[0]

    def _create_log_entry(self, server_id: str, request: str, response: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "id": str(uuid.uuid4()),
            "server_id": server_id,
            "client_request": request,
            "response": response,
            "timestamp": time.time()
        }
