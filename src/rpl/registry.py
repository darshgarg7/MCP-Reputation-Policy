"""
Dynamic MCP Server Registry.

Replaces the old hardcoded tool registry with startup-time discovery. Each
configured server URL is probed with session.list_tools(), then the API routes
against the discovered capability graph.
"""

import os
from typing import Any, Optional

import structlog

from config import ToolType
from mcp_client import RealMCPClient


logger = structlog.get_logger(__name__)


DEFAULT_MCP_SERVERS = [
    {
        "server_id": "bloomberg_mcp",
        "url": "http://localhost:8001",
        "tool": "get_financial_data",
        "tool_type": ToolType.FINANCIAL_DATA.value,
        "tool_kwargs": {"source": "bloomberg"},
        "initial_score": 0.95,
    },
    {
        "server_id": "legacy_mainframe",
        "url": "http://localhost:8001",
        "tool": "get_financial_data",
        "tool_type": ToolType.FINANCIAL_DATA.value,
        "tool_kwargs": {"source": "legacy"},
        "initial_score": 0.65,
    },
    {
        "server_id": "public_web_search",
        "url": "http://localhost:8002",
        "tool": "search_web",
        "tool_type": ToolType.WEB_SEARCH.value,
        "tool_kwargs": {"source": "public_web"},
        "initial_score": 0.88,
    },
    {
        "server_id": "reuters_news_api",
        "url": "http://localhost:8002",
        "tool": "get_news",
        "tool_type": ToolType.NEWS_FEED.value,
        "tool_kwargs": {"source": "reuters"},
        "initial_score": 0.74,
    },
    {
        "server_id": "aws_lambda_compute",
        "url": "http://localhost:8003",
        "tool": "execute_computation",
        "tool_type": ToolType.MATH_COMPUTE.value,
        "tool_kwargs": {},
        "initial_score": 0.85,
    },
    {
        "server_id": "internal_research_db",
        "url": "http://localhost:8004",
        "tool": "query_research_db",
        "tool_type": ToolType.RESEARCH_DB.value,
        "tool_kwargs": {"source": "internal"},
        "initial_score": 0.92,
    },
    {
        "server_id": "general_reasoning_node",
        "url": "http://localhost:8004",
        "tool": "general_reasoning",
        "tool_type": ToolType.GENERAL.value,
        "tool_kwargs": {},
        "initial_score": 0.72,
    },
]

_TOOL_TYPE_HINTS = {
    "financial": ToolType.FINANCIAL_DATA.value,
    "instrument": ToolType.FINANCIAL_DATA.value,
    "search": ToolType.WEB_SEARCH.value,
    "web": ToolType.WEB_SEARCH.value,
    "news": ToolType.NEWS_FEED.value,
    "compute": ToolType.MATH_COMPUTE.value,
    "computation": ToolType.MATH_COMPUTE.value,
    "math": ToolType.MATH_COMPUTE.value,
    "research": ToolType.RESEARCH_DB.value,
    "database": ToolType.RESEARCH_DB.value,
    "reasoning": ToolType.GENERAL.value,
}


def _configured_servers_from_env() -> Optional[list[dict[str, Any]]]:
    raw_urls = os.getenv("MCP_SERVER_URLS", "").strip()
    if not raw_urls:
        return None

    configured = []
    for index, url in enumerate(part.strip() for part in raw_urls.split(",") if part.strip()):
        configured.append({"server_id": f"mcp_server_{index + 1}", "url": url.rstrip("/"), "tool_kwargs": {}})
    return configured


CONFIGURED_MCP_SERVERS = _configured_servers_from_env() or DEFAULT_MCP_SERVERS


class ServerRegistry:
    """
    Dynamic registry populated from MCP list_tools responses.
    """

    _initialized = False

    def __init__(self, servers: list[dict[str, Any]] | None = None, client: RealMCPClient | None = None):
        self._configured_servers = servers or CONFIGURED_MCP_SERVERS
        self._client = client or RealMCPClient()
        self._registry: dict[str, list[dict[str, Any]]] = {}
        self._initialized = False

    async def discover(self) -> None:
        self._registry = {}
        for cfg in self._configured_servers:
            await self._probe_server(cfg)
        self._initialized = True
        logger.info("registry_discovery_complete", server_count=len(self.all_servers()))

    async def _probe_server(self, cfg: dict[str, Any]) -> None:
        server_id = cfg["server_id"]
        url = cfg["url"].rstrip("/")
        try:
            tools = await self._client.list_server_tools(url)
        except Exception as exc:
            logger.warning("server_probe_failed", server_id=server_id, url=url, error=str(exc))
            return

        if cfg.get("tool"):
            tool_names = {tool.get("name") for tool in tools}
            if cfg["tool"] not in tool_names:
                logger.warning(
                    "configured_tool_not_found",
                    server_id=server_id,
                    url=url,
                    tool=cfg["tool"],
                    available=sorted(name for name in tool_names if name),
                )
                return

            self._register_route(
                server_id=server_id,
                url=url,
                tool_name=cfg["tool"],
                tool_type=cfg.get("tool_type"),
                tool_kwargs=cfg.get("tool_kwargs", {}),
            )
            return

        for tool in tools:
            tool_name = tool.get("name")
            if not tool_name:
                continue

            tool_type = self._infer_tool_type(tool_name, tool.get("description", ""))
            if not tool_type:
                continue

            if self._already_registered(tool_type, server_id, tool_name):
                continue

            self._register_route(
                server_id=server_id,
                url=url,
                tool_name=tool_name,
                tool_type=tool_type,
                tool_kwargs=cfg.get("tool_kwargs", {}),
            )

    def _register_route(
        self,
        server_id: str,
        url: str,
        tool_name: str,
        tool_type: str | None,
        tool_kwargs: dict[str, Any],
    ) -> None:
        if not tool_type or self._already_registered(tool_type, server_id, tool_name):
            return

        self._registry.setdefault(tool_type, []).append(
            {
                "server_id": server_id,
                "url": url,
                "tool": tool_name,
                "tool_kwargs": dict(tool_kwargs),
                "initial_score": self._initial_score_for(server_id),
            }
        )
        logger.info("server_discovered", server_id=server_id, tool=tool_name, tool_type=tool_type)

    def _initial_score_for(self, server_id: str) -> float:
        for cfg in self._configured_servers:
            if cfg["server_id"] == server_id:
                return float(cfg.get("initial_score", 0.5))
        return 0.5

    def get_candidates(self, tool_type: str) -> list[dict[str, Any]]:
        if not self._initialized:
            logger.error("registry_not_initialized")
            return []
        return self._registry.get(tool_type, [])

    def all_servers(self) -> list[dict[str, Any]]:
        seen: set[tuple[str, str]] = set()
        result: list[dict[str, Any]] = []
        for tool_type, candidates in self._registry.items():
            for candidate in candidates:
                key = (candidate["server_id"], candidate["tool"])
                if key in seen:
                    continue
                seen.add(key)
                result.append({**candidate, "tool_type": tool_type})
        return result

    def _already_registered(self, tool_type: str, server_id: str, tool_name: str) -> bool:
        return any(
            route["server_id"] == server_id and route["tool"] == tool_name
            for route in self._registry.get(tool_type, [])
        )

    @staticmethod
    def _infer_tool_type(tool_name: str, description: str = "") -> Optional[str]:
        haystack = f"{tool_name} {description}".lower()
        for hint, tool_type in _TOOL_TYPE_HINTS.items():
            if hint in haystack:
                return tool_type
        return None
