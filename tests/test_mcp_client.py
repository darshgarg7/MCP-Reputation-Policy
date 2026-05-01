"""
Unit tests: RealMCPClient — transport adapter.
Uses unittest.mock to patch the MCP SDK transport so no live server is needed.
Tests verify the client correctly normalizes MCP protocol responses to RPL format.
"""
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from mcp_client import RealMCPClient


@pytest.fixture
def client():
    return RealMCPClient()


def _make_mcp_result(text: str, is_error: bool = False):
    """Build a mock MCP CallToolResult."""
    result = MagicMock()
    result.isError = is_error
    content_block = MagicMock()
    content_block.text = text
    result.content = [content_block]
    return result


class TestRealMCPClientSuccess:
    @pytest.mark.asyncio
    async def test_successful_tool_call_returns_status_success(self, client):
        mock_result = _make_mcp_result(
            '{"status": "SUCCESS", "result": "AAPL: $213.07", "latency": 0.35, "compute_units": 80, "cost": 0.40, "confidence": 0.95}'
        )
        with patch("mcp_client.streamable_http_client") as mock_transport:
            mock_session = AsyncMock()
            mock_session.initialize = AsyncMock()
            mock_session.call_tool = AsyncMock(return_value=mock_result)
            mock_transport.return_value.__aenter__ = AsyncMock(return_value=(MagicMock(), MagicMock(), None))
            mock_transport.return_value.__aexit__ = AsyncMock(return_value=False)

            with patch("mcp_client.ClientSession") as mock_session_class:
                mock_session_class.return_value.__aenter__ = AsyncMock(return_value=mock_session)
                mock_session_class.return_value.__aexit__ = AsyncMock(return_value=False)

                response = await client.call_tool("http://localhost:8001", "get_financial_data", {"query": "AAPL"})

        assert response["status"] == "SUCCESS"
        assert "AAPL" in response["result"]
        assert response["server_confidence"] == pytest.approx(0.95)

    @pytest.mark.asyncio
    async def test_mcp_error_flag_returns_error_status(self, client):
        mock_result = _make_mcp_result("", is_error=True)
        with patch("mcp_client.streamable_http_client") as mock_transport:
            mock_session = AsyncMock()
            mock_session.initialize = AsyncMock()
            mock_session.call_tool = AsyncMock(return_value=mock_result)
            mock_transport.return_value.__aenter__ = AsyncMock(return_value=(MagicMock(), MagicMock(), None))
            mock_transport.return_value.__aexit__ = AsyncMock(return_value=False)

            with patch("mcp_client.ClientSession") as mock_session_class:
                mock_session_class.return_value.__aenter__ = AsyncMock(return_value=mock_session)
                mock_session_class.return_value.__aexit__ = AsyncMock(return_value=False)

                response = await client.call_tool("http://localhost:8001", "get_financial_data", {"query": "AAPL"})

        assert response["status"] == "ERROR"
        assert response["server_confidence"] == 0.0

    @pytest.mark.asyncio
    async def test_network_exception_returns_error_status(self, client):
        with patch("mcp_client.streamable_http_client", side_effect=ConnectionRefusedError("Server offline")):
            response = await client.call_tool("http://localhost:9999", "tool", {"query": "x"})

        assert response["status"] == "ERROR"
        assert "MCP transport failure" in response["result"]
        assert response["latency"] >= 0

    @pytest.mark.asyncio
    async def test_malformed_json_response_handled_gracefully(self, client):
        mock_result = _make_mcp_result("not valid JSON at all {{{{")
        with patch("mcp_client.streamable_http_client") as mock_transport:
            mock_session = AsyncMock()
            mock_session.initialize = AsyncMock()
            mock_session.call_tool = AsyncMock(return_value=mock_result)
            mock_transport.return_value.__aenter__ = AsyncMock(return_value=(MagicMock(), MagicMock(), None))
            mock_transport.return_value.__aexit__ = AsyncMock(return_value=False)

            with patch("mcp_client.ClientSession") as mock_session_class:
                mock_session_class.return_value.__aenter__ = AsyncMock(return_value=mock_session)
                mock_session_class.return_value.__aexit__ = AsyncMock(return_value=False)

                response = await client.call_tool("http://localhost:8001", "get_financial_data", {"query": "test"})

        # Should not raise — graceful fallback to string result
        assert response["status"] == "SUCCESS"
        assert "not valid JSON" in response["result"]


class TestCreateLogEntry:
    def test_log_entry_has_required_fields(self, client):
        response = {"status": "SUCCESS", "result": "ok", "latency": 0.1, "compute_cost": 0.05, "server_confidence": 0.9}
        entry = client.create_log_entry("bloomberg_mcp", "test query", response)
        assert "id" in entry
        assert entry["server_id"] == "bloomberg_mcp"
        assert entry["client_request"] == "test query"
        assert "timestamp" in entry

    def test_log_entry_id_is_unique(self, client):
        response = {"status": "SUCCESS", "result": "ok", "latency": 0.0, "compute_cost": 0.0, "server_confidence": 0.0}
        ids = {client.create_log_entry("s", "r", response)["id"] for _ in range(100)}
        assert len(ids) == 100  # All UUIDs are unique
