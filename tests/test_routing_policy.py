"""
Unit tests: RoutingPolicy — the pure RPL decision engine.
All tests use fake reputation data and pre-built candidate lists.
Zero network I/O, zero mocks needed.
"""
import pytest
from rpl.policy import RoutingPolicy
from config import RepScoreConfig


@pytest.fixture
def policy():
    return RoutingPolicy()


@pytest.fixture
def financial_candidates():
    return [
        {"server_id": "bloomberg_mcp",  "url": "http://localhost:8001", "tool": "get_financial_data", "tool_kwargs": {"source": "bloomberg"}},
        {"server_id": "legacy_mainframe","url": "http://localhost:8001", "tool": "get_financial_data", "tool_kwargs": {"source": "legacy"}},
    ]


class TestRoutingPolicyBasic:
    def test_returns_none_for_empty_candidates(self, policy):
        result = policy.select_server_from_candidates([], reputations={}, goal_risk_tolerance="medium")
        assert result is None

    def test_selects_highest_reputation_server(self, policy, financial_candidates):
        reputations = {"bloomberg_mcp": 0.95, "legacy_mainframe": 0.65}
        result = policy.select_server_from_candidates(financial_candidates, reputations, "medium")
        assert result["server_id"] == "bloomberg_mcp"

    def test_skips_circuit_broken_server(self, policy, financial_candidates):
        """bloomberg is circuit-broken, legacy is trusted — should route to legacy."""
        reputations = {"bloomberg_mcp": 0.50, "legacy_mainframe": 0.80}
        result = policy.select_server_from_candidates(financial_candidates, reputations, "medium")
        assert result["server_id"] == "legacy_mainframe"

    def test_returns_probationary_when_no_trusted(self, policy, financial_candidates):
        """All servers below threshold: should return best probationary, not None."""
        reputations = {"bloomberg_mcp": 0.60, "legacy_mainframe": 0.55}
        result = policy.select_server_from_candidates(financial_candidates, reputations, "medium")
        assert result is not None
        assert result["server_id"] == "bloomberg_mcp"  # Higher of the two

    def test_uses_default_score_for_unknown_server(self, policy, financial_candidates):
        """Server not in reputation dict should get DEFAULT_INITIAL_SCORE."""
        result = policy.select_server_from_candidates(financial_candidates, reputations={}, goal_risk_tolerance="high")
        assert result is not None


class TestRiskToleranceThresholds:
    def test_low_risk_raises_threshold_to_085(self, policy, financial_candidates):
        """Low risk: only servers with score >= 0.85 should be trusted."""
        reputations = {"bloomberg_mcp": 0.84, "legacy_mainframe": 0.84}
        # Both below 0.85 → probationary, but still routed
        result = policy.select_server_from_candidates(financial_candidates, reputations, "low")
        assert result is not None  # Falls through to probationary

    def test_low_risk_trusts_high_score_server(self, policy, financial_candidates):
        reputations = {"bloomberg_mcp": 0.95, "legacy_mainframe": 0.70}
        result = policy.select_server_from_candidates(financial_candidates, reputations, "low")
        assert result["server_id"] == "bloomberg_mcp"

    def test_high_risk_accepts_low_score_server(self, policy, financial_candidates):
        """High risk tolerance: threshold drops to 0.50, all servers trusted."""
        reputations = {"bloomberg_mcp": 0.55, "legacy_mainframe": 0.52}
        result = policy.select_server_from_candidates(financial_candidates, reputations, "high")
        assert result is not None
        assert result["server_id"] == "bloomberg_mcp"

    def test_medium_risk_uses_default_threshold(self, policy, financial_candidates):
        """Medium risk: standard 0.70 threshold applies."""
        reputations = {"bloomberg_mcp": 0.75, "legacy_mainframe": 0.65}
        result = policy.select_server_from_candidates(financial_candidates, reputations, "medium")
        assert result["server_id"] == "bloomberg_mcp"
        assert result["server_id"] != "legacy_mainframe"


class TestCircuitBreaker:
    def test_all_servers_circuit_broken_returns_best_probationary(self, policy):
        candidates = [
            {"server_id": "server_a", "url": "http://a", "tool": "tool_a", "tool_kwargs": {}},
            {"server_id": "server_b", "url": "http://b", "tool": "tool_b", "tool_kwargs": {}},
        ]
        reputations = {"server_a": 0.40, "server_b": 0.35}
        result = policy.select_server_from_candidates(candidates, reputations, "medium")
        # Should still route to server_a (better of the two bad options)
        assert result["server_id"] == "server_a"

    def test_single_server_always_returned_regardless_of_score(self, policy):
        candidates = [{"server_id": "only_server", "url": "http://x", "tool": "t", "tool_kwargs": {}}]
        reputations = {"only_server": 0.10}
        result = policy.select_server_from_candidates(candidates, reputations, "medium")
        assert result["server_id"] == "only_server"


class TestBackwardCompatAlias:
    def test_select_server_alias_works(self, policy):
        """The old select_server() signature must remain compatible."""
        result = policy.select_server(
            tool_type="FINANCIAL_DATA",
            reputations={"bloomberg_mcp": 0.90},
            goal_risk_tolerance="medium",
            candidates=[{"server_id": "bloomberg_mcp", "url": "http://x", "tool": "t", "tool_kwargs": {}}],
        )
        assert result["server_id"] == "bloomberg_mcp"
