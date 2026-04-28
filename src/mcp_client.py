"""
Real MCP Client
Uses the official Anthropic MCP Python SDK to connect to real MCP servers
over Streamable HTTP transport (JSON-RPC 2.0).

This is NOT in-process simulation. This establishes actual HTTP connections
to separate server processes and calls tools via the MCP protocol.
"""
import time
import uuid
from typing import Any

from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client
import structlog

logger = structlog.get_logger()


class RealMCPClient:
    """
    A thin, stateless transport adapter that speaks the official MCP protocol.
    It connects to remote MCP servers via Streamable HTTP, initializes a
    JSON-RPC session, and invokes tools by name.

    This client has NO routing logic, NO reputation awareness.
    It simply executes what it is told.
    """

    async def call_tool(
        self,
        server_url: str,
        tool_name: str,
        arguments: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Connect to a real MCP server, perform capability negotiation,
        and call a specific tool via the MCP protocol.

        Returns a standardized response dict compatible with the RPL telemetry format.
        """
        mcp_endpoint = f"{server_url}/mcp"
        start_time = time.time()

        logger.info("mcp_transport_connect", server_url=mcp_endpoint, tool=tool_name)

        try:
            async with streamable_http_client(mcp_endpoint) as (read, write, _):
                async with ClientSession(read, write) as session:
                    # Real MCP protocol: capability negotiation handshake
                    await session.initialize()

                    # Real MCP protocol: tools/call JSON-RPC message
                    result = await session.call_tool(tool_name, arguments=arguments)

            elapsed = round(time.time() - start_time, 4)

            # Parse the MCP protocol response
            if result.isError:
                logger.warning("mcp_tool_call_error", tool=tool_name, elapsed=elapsed)
                return {
                    "status": "ERROR",
                    "result": f"MCP protocol error calling {tool_name}.",
                    "latency": elapsed,
                    "compute_cost": 0.0,
                    "server_confidence": 0.0,
                }

            # Extract text content from the MCP response
            raw_content = result.content[0].text if result.content else "{}"
            import json
            try:
                parsed = json.loads(raw_content)
            except (json.JSONDecodeError, AttributeError):
                parsed = {"result": str(raw_content)}

            # Normalize to RPL telemetry format
            status = parsed.get("status", "SUCCESS")
            compute_units = parsed.get("compute_units", 100)
            cost_per_unit = parsed.get("cost", compute_units * 0.005) / max(compute_units, 1)

            logger.info("mcp_tool_call_success", tool=tool_name, status=status, latency=elapsed)
            return {
                "status": status,
                "result": parsed.get("result", ""),
                "latency": parsed.get("latency", elapsed),
                "compute_cost": parsed.get("cost", round(compute_units * 0.005, 4)),
                "server_confidence": parsed.get("confidence", 0.85),
            }

        except Exception as e:
            elapsed = round(time.time() - start_time, 4)
            logger.error("mcp_transport_failed", tool=tool_name, error=str(e), latency=elapsed)
            return {
                "status": "ERROR",
                "result": f"MCP transport failure: {str(e)}",
                "latency": elapsed,
                "compute_cost": 0.0,
                "server_confidence": 0.0,
            }

    def create_log_entry(self, server_id: str, request: str, response: dict) -> dict:
        """Create a standardized telemetry log entry for the RPL background worker."""
        return {
            "id": str(uuid.uuid4()),
            "server_id": server_id,
            "client_request": request,
            "response": response,
            "timestamp": time.time(),
        }
