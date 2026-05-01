"""
Unit tests: EMA math, time-decay, and confidence scoring.
These are pure mathematical unit tests — no I/O, no mocks needed.
"""
import math
import pytest
from config import RepScoreConfig


# ── EMA Formula ───────────────────────────────────────────────────────────────

def ema(new_value: float, old_value: float, alpha: float = RepScoreConfig.ALPHA_SMOOTHING) -> float:
    return alpha * new_value + (1 - alpha) * old_value


class TestEMAFormula:
    def test_ema_bounded_between_0_and_1(self):
        for new in [0.0, 0.5, 1.0]:
            for old in [0.0, 0.5, 1.0]:
                result = ema(new, old)
                assert 0.0 <= result <= 1.0

    def test_ema_moves_toward_new_value(self):
        result = ema(new_value=1.0, old_value=0.0)
        assert result == pytest.approx(RepScoreConfig.ALPHA_SMOOTHING)

    def test_ema_stable_when_equal(self):
        for val in [0.3, 0.7, 0.95]:
            result = ema(new_value=val, old_value=val)
            assert result == pytest.approx(val)

    def test_perfect_success_increases_score(self):
        old = 0.70
        new = ema(new_value=1.0, old_value=old)
        assert new > old

    def test_total_failure_decreases_score(self):
        old = 0.90
        new = ema(new_value=0.0, old_value=old)
        assert new < old

    def test_ema_alpha_weight(self):
        """Alpha=0.3 means 30% weight on new value, 70% on old."""
        result = ema(new_value=1.0, old_value=0.5, alpha=0.3)
        assert result == pytest.approx(0.3 * 1.0 + 0.7 * 0.5)


# ── Time Decay ────────────────────────────────────────────────────────────────

def time_decay(score: float, hours_elapsed: float, half_life_hours: float = RepScoreConfig.REPUTATION_DECAY_HALF_LIFE_HOURS) -> float:
    """Exponential decay: score * e^(-λt) where λ = ln(2) / half_life."""
    lambda_val = math.log(2) / half_life_hours
    return score * math.exp(-lambda_val * hours_elapsed)


class TestTimeDecay:
    def test_no_time_no_decay(self):
        score = 0.90
        assert time_decay(score, hours_elapsed=0) == pytest.approx(score)

    def test_half_life_halves_score(self):
        score = 0.80
        decayed = time_decay(score, hours_elapsed=RepScoreConfig.REPUTATION_DECAY_HALF_LIFE_HOURS)
        assert decayed == pytest.approx(score / 2.0, rel=1e-4)

    def test_decay_is_monotonically_decreasing(self):
        scores = [time_decay(0.9, t) for t in [0, 6, 12, 24, 48]]
        assert all(scores[i] > scores[i + 1] for i in range(len(scores) - 1))

    def test_decay_never_goes_below_zero(self):
        assert time_decay(1.0, hours_elapsed=10_000) >= 0.0


# ── Config Constants ──────────────────────────────────────────────────────────

class TestConfigConstants:
    def test_weights_sum_to_one(self):
        total = (
            RepScoreConfig.WEIGHT_SATISFACTION
            + RepScoreConfig.WEIGHT_RELIABILITY
            + RepScoreConfig.WEIGHT_LATENCY_PENALTY
            + RepScoreConfig.WEIGHT_COST_EFFICIENCY
        )
        assert total == pytest.approx(1.0)

    def test_threshold_in_valid_range(self):
        assert 0.0 < RepScoreConfig.MIN_REPUTATION_THRESHOLD < 1.0

    def test_alpha_in_valid_range(self):
        assert 0.0 < RepScoreConfig.ALPHA_SMOOTHING < 1.0

    def test_default_score_below_threshold(self):
        """New unverified servers should start below the trusted threshold."""
        assert RepScoreConfig.DEFAULT_INITIAL_SCORE < RepScoreConfig.MIN_REPUTATION_THRESHOLD
