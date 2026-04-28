"""
RPL Policy Layer: Pure routing logic.
The RPL sits ABOVE the MCP client. It makes the routing decision
and returns the target server URL — it does NOT communicate with servers.
"""
from typing import Optional
from config import RepScoreConfig, ToolType
import structlog

logger = structlog.get_logger()

# Maps ToolType → MCP server URLs (the real external HTTP servers)
TOOL_SERVER_REGISTRY: dict[str, list[dict]] = {
    ToolType.FINANCIAL_DATA.value: [
        {"server_id": "bloomberg_mcp",   "url": "http://localhost:8001", "tool": "get_financial_data", "tool_kwargs": {"source": "bloomberg"}},
        {"server_id": "legacy_mainframe","url": "http://localhost:8001", "tool": "get_financial_data", "tool_kwargs": {"source": "legacy"}},
    ],
    ToolType.WEB_SEARCH.value: [
        {"server_id": "public_web_search","url": "http://localhost:8002", "tool": "web_search", "tool_kwargs": {}},
    ],
    ToolType.NEWS_FEED.value: [
        {"server_id": "reuters_news_api", "url": "http://localhost:8002", "tool": "get_news_feed", "tool_kwargs": {}},
    ],
    ToolType.MATH_COMPUTE.value: [
        {"server_id": "aws_lambda_compute","url": "http://localhost:8003", "tool": "execute_computation", "tool_kwargs": {}},
    ],
    ToolType.RESEARCH_DB.value: [
        {"server_id": "internal_research_db","url": "http://localhost:8004", "tool": "query_research_db", "tool_kwargs": {}},
    ],
    ToolType.GENERAL.value: [
        {"server_id": "general_reasoning_node","url": "http://localhost:8004", "tool": "general_reasoning", "tool_kwargs": {}},
    ],
}


class RoutingPolicy:
    """
    Pure policy logic: given a ToolType and live reputation scores,
    decide which MCP server endpoint to route to.

    This class has NO network I/O, NO database access.
    It is a pure function of reputation data → routing decision.
    """

    def select_server(
        self,
        tool_type: str,
        reputations: dict[str, float],
        goal_risk_tolerance: str = "medium",
    ) -> Optional[dict]:
        """
        Returns the server registry entry for the best server, or None if
        no servers are available for this tool type.
        """
        candidates = TOOL_SERVER_REGISTRY.get(tool_type, [])
        if not candidates:
            logger.warning("rpl_no_candidates", tool_type=tool_type)
            return None

        # Adjust threshold based on goal risk tolerance
        threshold = RepScoreConfig.MIN_REPUTATION_THRESHOLD
        if goal_risk_tolerance == "low":
            threshold = 0.85   # Mission critical: only accept highly trusted
        elif goal_risk_tolerance == "high":
            threshold = 0.50   # Experimental: accept any available server

        trusted = []
        probationary = []

        for candidate in candidates:
            s_id = candidate["server_id"]
            score = reputations.get(s_id, RepScoreConfig.DEFAULT_INITIAL_SCORE)
            if score >= threshold:
                trusted.append((candidate, score))
            else:
                probationary.append((candidate, score))

        trusted.sort(key=lambda x: x[1], reverse=True)
        probationary.sort(key=lambda x: x[1], reverse=True)

        if trusted:
            selected, score = trusted[0]
            logger.info("rpl_routed_trusted", server_id=selected["server_id"], score=score, tool_type=tool_type)
            return selected

        if probationary:
            selected, score = probationary[0]
            logger.warning("rpl_routed_probationary", server_id=selected["server_id"], score=score, tool_type=tool_type)
            return selected

        logger.error("rpl_all_circuit_broken", tool_type=tool_type)
        return None
