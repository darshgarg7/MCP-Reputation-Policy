"""
Real MCP Client.

Uses the official MCP Python SDK to connect to separate MCP server processes
over Streamable HTTP (JSON-RPC 2.0). This module intentionally contains no
routing or reputation logic; it is only the transport adapter.
"""

import json
import importlib.machinery
import importlib.util
import pathlib
import sys
import time
import uuid
from typing import Any

import structlog


def _load_mcp_sdk():
    """Load the installed MCP SDK even when src/mcp.py shadows it in tests."""
    src_dir = pathlib.Path(__file__).resolve().parent
    search_path = []
    for entry in sys.path:
        try:
            if pathlib.Path(entry or ".").resolve() == src_dir:
                continue
        except OSError:
            pass
        search_path.append(entry)

    spec = importlib.machinery.PathFinder.find_spec("mcp", search_path)
    if spec is None or spec.loader is None:
        raise ImportError("The official MCP Python SDK is not installed.")

    module = importlib.util.module_from_spec(spec)
    sys.modules["mcp"] = module
    spec.loader.exec_module(module)
    return module


try:
    from mcp import ClientSession
    from mcp.client.streamable_http import streamable_http_client
except (ImportError, ModuleNotFoundError):
    _load_mcp_sdk()
    from mcp import ClientSession
    from mcp.client.streamable_http import streamable_http_client


logger = structlog.get_logger(__name__)


class RealMCPClient:
    """
    Thin transport adapter for real MCP tool calls.

    The RPL chooses where to route; this client only initializes a JSON-RPC
    session, invokes a tool by name, and normalizes the response shape.
    """

    async def call_tool(
        self,
        server_url: str,
        tool_name: str,
        arguments: dict[str, Any],
    ) -> dict[str, Any]:
        mcp_endpoint = self._endpoint(server_url)
        start_time = time.time()
        logger.info("mcp_transport_connect", server_url=mcp_endpoint, tool=tool_name)

        try:
            async with streamable_http_client(mcp_endpoint) as (read, write, _):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    result = await session.call_tool(tool_name, arguments=arguments)

            elapsed = round(time.time() - start_time, 4)
            if getattr(result, "isError", False):
                logger.warning("mcp_tool_call_error", tool=tool_name, elapsed=elapsed)
                return {
                    "status": "ERROR",
                    "result": f"MCP protocol error calling {tool_name}.",
                    "latency": elapsed,
                    "compute_cost": 0.0,
                    "server_confidence": 0.0,
                }

            raw_content = self._extract_text(result)
            try:
                parsed = json.loads(raw_content)
            except (json.JSONDecodeError, TypeError):
                parsed = {"result": str(raw_content)}

            status = parsed.get("status", "SUCCESS")
            compute_units = parsed.get("compute_units", 100)

            logger.info("mcp_tool_call_success", tool=tool_name, status=status, latency=elapsed)
            return {
                "status": status,
                "result": parsed.get("result", ""),
                "latency": parsed.get("latency", elapsed),
                "compute_cost": parsed.get("cost", round(compute_units * 0.005, 4)),
                "server_confidence": parsed.get("confidence", 0.85),
            }
        except Exception as exc:
            elapsed = round(time.time() - start_time, 4)
            logger.error("mcp_transport_failed", tool=tool_name, error=str(exc), latency=elapsed)
            return {
                "status": "ERROR",
                "result": f"MCP transport failure: {exc}",
                "latency": elapsed,
                "compute_cost": 0.0,
                "server_confidence": 0.0,
            }

    async def list_server_tools(self, server_url: str) -> list[dict[str, Any]]:
        """
        Discover tools exposed by one MCP server via the MCP list_tools call.
        """
        mcp_endpoint = self._endpoint(server_url)
        async with streamable_http_client(mcp_endpoint) as (read, write, _):
            async with ClientSession(read, write) as session:
                await session.initialize()
                result = await session.list_tools()

        tools = getattr(result, "tools", result)
        normalized: list[dict[str, Any]] = []
        for tool in tools or []:
            normalized.append(
                {
                    "name": self._tool_field(tool, "name"),
                    "description": self._tool_field(tool, "description", ""),
                    "input_schema": self._tool_field(tool, "inputSchema", None)
                    or self._tool_field(tool, "input_schema", {}),
                }
            )
        return normalized

    def create_log_entry(self, server_id: str, request: str, response: dict[str, Any]) -> dict[str, Any]:
        status = response.get("status", "ERROR")
        latency = float(response.get("latency", 0.0) or 0.0)
        confidence = float(response.get("server_confidence", 0.0) or 0.0)
        satisfaction = self._derive_satisfaction(status, latency, confidence)

        return {
            "id": str(uuid.uuid4()),
            "timestamp": time.time(),
            "server_id": server_id,
            "client_request": request,
            "outcome_status": status,
            "latency_sec": latency,
            "compute_cost_units": float(response.get("compute_cost", 0.0) or 0.0),
            "client_satisfaction": satisfaction,
            "server_confidence": confidence,
        }

    @staticmethod
    def _endpoint(server_url: str) -> str:
        return server_url.rstrip("/") + "/mcp"

    @staticmethod
    def _extract_text(result: Any) -> str:
        content = getattr(result, "content", None)
        if not content:
            return "{}"
        first = content[0]
        return getattr(first, "text", str(first))

    @staticmethod
    def _tool_field(tool: Any, name: str, default: Any = None) -> Any:
        if isinstance(tool, dict):
            return tool.get(name, default)
        return getattr(tool, name, default)

    @staticmethod
    def _derive_satisfaction(status: str, latency: float, server_confidence: float) -> float:
        if status != "SUCCESS":
            return 0.1
        latency_penalty = min(0.5, latency * 1.5)
        confidence_bonus = server_confidence * 0.1
        return round(max(0.2, min(1.0, 1.0 - latency_penalty + confidence_bonus)), 4)
