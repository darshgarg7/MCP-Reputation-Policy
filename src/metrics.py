"""
Prometheus instrumentation for the MCP Reputation Policy Layer API.
"""

import time

from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest, make_asgi_app
from starlette.responses import Response


rpl_requests_total = Counter(
    "rpl_requests_total",
    "Total number of agent task execution requests",
    ("tool_type", "status"),
)

rpl_routing_latency_seconds = Histogram(
    "rpl_routing_latency_seconds",
    "Latency of MCP tool calls routed through the RPL",
    ("server_id",),
    buckets=(0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0),
)

rpl_reputation_score = Gauge(
    "rpl_reputation_score",
    "Live reputation score for each registered MCP server",
    ("server_id",),
)

rpl_circuit_breaker_active = Gauge(
    "rpl_circuit_breaker_active",
    "1 if a server is below the active reputation threshold, 0 otherwise",
    ("server_id",),
)

rpl_telemetry_queue_size = Gauge(
    "rpl_telemetry_queue_size",
    "Current number of telemetry events waiting in the background queue",
)

metrics_app = make_asgi_app()


class MetricsTimer:
    """Context manager for recording histogram observations."""

    def __init__(self, histogram: Histogram, labels: dict[str, str]):
        self.histogram = histogram
        self.labels = labels
        self._start: float | None = None

    def __enter__(self):
        self._start = time.perf_counter()
        return self

    def __exit__(self, *_):
        if self._start is None:
            return
        elapsed = time.perf_counter() - self._start
        self.histogram.labels(**self.labels).observe(elapsed)


def update_reputation_gauges(all_reps: dict, threshold: float = 0.7) -> None:
    for server_id, data in all_reps.items():
        score = float(data.get("score", 0.5))
        rpl_reputation_score.labels(server_id=server_id).set(score)
        rpl_circuit_breaker_active.labels(server_id=server_id).set(1.0 if score < threshold else 0.0)


def prometheus_response() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
