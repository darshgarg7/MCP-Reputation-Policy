"""
Pure RPL routing logic.

The policy layer receives already-discovered MCP server candidates and live
reputation scores, then returns a routing decision. It performs no I/O.
"""

from typing import Optional

import structlog

from config import RepScoreConfig


logger = structlog.get_logger(__name__)


class RoutingPolicy:
    """
    Pure function of (candidates, reputations, goal) -> routing decision.
    """

    def select_server_from_candidates(
        self,
        candidates: list[dict],
        reputations: dict[str, float],
        goal_risk_tolerance: str = "medium",
    ) -> Optional[dict]:
        if not candidates:
            logger.warning("rpl_no_candidates")
            return None

        threshold = self._threshold_for(goal_risk_tolerance)
        trusted: list[tuple[dict, float]] = []
        probationary: list[tuple[dict, float]] = []

        for candidate in candidates:
            server_id = candidate["server_id"]
            score = reputations.get(server_id, RepScoreConfig.DEFAULT_INITIAL_SCORE)
            if score >= threshold:
                trusted.append((candidate, score))
            else:
                probationary.append((candidate, score))

        trusted.sort(key=lambda item: item[1], reverse=True)
        probationary.sort(key=lambda item: item[1], reverse=True)

        if trusted:
            selected, score = trusted[0]
            logger.info("rpl_routed_trusted", server_id=selected["server_id"], score=score)
            return selected

        if probationary:
            selected, score = probationary[0]
            logger.warning("rpl_routed_probationary", server_id=selected["server_id"], score=score)
            return selected

        logger.error("rpl_all_circuit_broken")
        return None

    def select_server(
        self,
        tool_type: str = "",
        reputations: dict[str, float] | None = None,
        goal_risk_tolerance: str = "medium",
        candidates: list[dict] | None = None,
    ) -> Optional[dict]:
        return self.select_server_from_candidates(
            candidates or [],
            reputations or {},
            goal_risk_tolerance,
        )

    @staticmethod
    def _threshold_for(goal_risk_tolerance: str) -> float:
        if goal_risk_tolerance == "low":
            return 0.85
        if goal_risk_tolerance == "high":
            return 0.50
        return RepScoreConfig.MIN_REPUTATION_THRESHOLD
