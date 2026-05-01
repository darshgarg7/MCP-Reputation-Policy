"""
Integration tests: FastAPI endpoints.
Uses httpx AsyncClient against the live app with the MCP call layer fully mocked.
Tests verify API contract shape, HTTP status codes, and error handling.
"""
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient, ASGITransport


# Patch the expensive external dependencies before api.py is imported
MOCK_REP_DATA = {
    "bloomberg_mcp":    {"score": 0.95, "history": [0.95], "interaction_count": 42},
    "legacy_mainframe": {"score": 0.65, "history": [0.65], "interaction_count": 10},
    "aws_lambda_compute":{"score": 0.85, "history": [0.85], "interaction_count": 20},
    "public_web_search": {"score": 0.88, "history": [0.88], "interaction_count": 15},
    "reuters_news_api":  {"score": 0.50, "history": [0.50], "interaction_count": 5},
    "internal_research_db":{"score": 0.92, "history": [0.92], "interaction_count": 30},
    "general_reasoning_node":{"score": 0.50, "history": [0.50], "interaction_count": 8},
}

MOCK_EXECUTE_RESPONSE = {
    "status": "SUCCESS",
    "result": "AAPL is trading at $213.07.",
    "latency": 0.35,
    "compute_cost": 0.40,
    "server_confidence": 0.95,
}

MOCK_REGISTRY_SERVERS = [
    {"server_id": "bloomberg_mcp", "url": "http://localhost:8001", "tool": "get_financial_data", "tool_kwargs": {}, "tool_type": "FINANCIAL_DATA"},
    {"server_id": "aws_lambda_compute", "url": "http://localhost:8003", "tool": "execute_computation", "tool_kwargs": {}, "tool_type": "MATH_COMPUTE"},
]

MOCK_REGISTRY_CANDIDATES = {
    "FINANCIAL_DATA": [MOCK_REGISTRY_SERVERS[0]],
    "MATH_COMPUTE":   [MOCK_REGISTRY_SERVERS[1]],
}


@pytest.fixture(scope="module")
def mock_patches():
    with patch("repservice.RepScoreService.initialize", new_callable=AsyncMock), \
         patch("repservice.RepScoreService.get_all_reputations", new_callable=AsyncMock, return_value=MOCK_REP_DATA), \
         patch("repservice.RepScoreService.get_reputation", new_callable=AsyncMock, return_value=0.95), \
         patch("repservice.RepScoreService.submit_feedback", new_callable=AsyncMock), \
         patch("repservice.RepScoreService.process_telemetry_worker", new_callable=AsyncMock), \
         patch("rpl.registry.ServerRegistry.discover", new_callable=AsyncMock), \
         patch("rpl.registry.ServerRegistry.all_servers", return_value=MOCK_REGISTRY_SERVERS), \
         patch("rpl.registry.ServerRegistry.get_candidates", side_effect=lambda t: MOCK_REGISTRY_CANDIDATES.get(t, [])), \
         patch("rpl.registry.ServerRegistry._initialized", new=True), \
         patch("mcp_client.RealMCPClient.call_tool", new_callable=AsyncMock, return_value=MOCK_EXECUTE_RESPONSE), \
         patch("openai.AsyncAzureOpenAI") as mock_oai:
        # Mock the LLM reasoning response
        mock_completion = MagicMock()
        mock_completion.choices[0].message.content = "RPL selected bloomberg_mcp due to its high reputation score."
        mock_oai.return_value.chat.completions.create = AsyncMock(return_value=mock_completion)
        yield


@pytest_asyncio.fixture(scope="module")
async def async_client(mock_patches):
    from api import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client


class TestHealthEndpoint:
    @pytest.mark.asyncio
    async def test_health_returns_200(self, async_client):
        resp = await async_client.get("/api/v1/health")
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_health_response_shape(self, async_client):
        resp = await async_client.get("/api/v1/health")
        data = resp.json()
        assert "status" in data
        assert "version" in data
        assert data["status"] == "ok"


class TestGetServersEndpoint:
    @pytest.mark.asyncio
    async def test_servers_returns_200(self, async_client):
        resp = await async_client.get("/api/v1/servers")
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_servers_response_has_servers_key(self, async_client):
        resp = await async_client.get("/api/v1/servers")
        data = resp.json()
        assert "servers" in data
        assert isinstance(data["servers"], list)

    @pytest.mark.asyncio
    async def test_server_entry_has_required_fields(self, async_client):
        resp = await async_client.get("/api/v1/servers")
        server = resp.json()["servers"][0]
        required = {"server_id", "tool_type", "base_reputation", "status", "history", "mcp_url"}
        assert required.issubset(server.keys())

    @pytest.mark.asyncio
    async def test_reputation_scores_bounded(self, async_client):
        resp = await async_client.get("/api/v1/servers")
        for server in resp.json()["servers"]:
            assert 0.0 <= server["base_reputation"] <= 1.0


class TestExecuteEndpoint:
    VALID_PAYLOAD = {
        "prompt": "What is the current stock price of AAPL?",
        "tool_type": "FINANCIAL_DATA",
        "goal": {
            "goal_type": "trading",
            "risk_tolerance": "low",
            "latency_priority": "high",
            "accuracy_priority": "high",
        },
    }

    @pytest.mark.asyncio
    async def test_execute_returns_200(self, async_client):
        resp = await async_client.post("/api/v1/execute", json=self.VALID_PAYLOAD)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_execute_response_has_required_fields(self, async_client):
        resp = await async_client.post("/api/v1/execute", json=self.VALID_PAYLOAD)
        data = resp.json()
        required = {
            "transaction_id", "server_id", "mcp_server_url", "mcp_tool_called",
            "outcome_status", "latency_sec", "compute_cost", "result",
            "new_reputation_score", "reasoning",
        }
        assert required.issubset(data.keys())

    @pytest.mark.asyncio
    async def test_execute_routes_to_correct_server(self, async_client):
        resp = await async_client.post("/api/v1/execute", json=self.VALID_PAYLOAD)
        data = resp.json()
        assert data["server_id"] == "bloomberg_mcp"
        assert data["mcp_server_url"] == "http://localhost:8001"

    @pytest.mark.asyncio
    async def test_execute_returns_transaction_id(self, async_client):
        resp = await async_client.post("/api/v1/execute", json=self.VALID_PAYLOAD)
        data = resp.json()
        # transaction_id should be a valid UUID-like string
        assert len(data["transaction_id"]) == 36

    @pytest.mark.asyncio
    async def test_execute_invalid_tool_type_returns_400(self, async_client):
        payload = {**self.VALID_PAYLOAD, "tool_type": "NONEXISTENT_TOOL"}
        resp = await async_client.post("/api/v1/execute", json=payload)
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_execute_no_candidates_returns_503(self, async_client):
        payload = {**self.VALID_PAYLOAD, "tool_type": "GENERAL"}  # No candidates in mock
        resp = await async_client.post("/api/v1/execute", json=payload)
        assert resp.status_code == 503

    @pytest.mark.asyncio
    async def test_execute_missing_prompt_returns_422(self, async_client):
        resp = await async_client.post("/api/v1/execute", json={"tool_type": "FINANCIAL_DATA"})
        assert resp.status_code == 422
