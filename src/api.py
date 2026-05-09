"""
MCP Reputation Policy Layer - FastAPI orchestrator.
"""

import asyncio
from contextlib import asynccontextmanager
import inspect
import os
import uuid
from typing import Any

import structlog
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncAzureOpenAI
from pydantic import BaseModel

from config import RepScoreConfig, ToolType
from mcp_client import RealMCPClient
from metrics import (
    prometheus_response,
    rpl_requests_total,
    rpl_routing_latency_seconds,
    rpl_telemetry_queue_size,
    update_reputation_gauges,
)
from repservice import RepScoreService
from rpl.policy import RoutingPolicy
from rpl.registry import ServerRegistry


load_dotenv()

REQUIRED_ENV_VARS = (
    "AZURE_OPENAI_API_KEY",
    "AZURE_OPENAI_ENDPOINT",
    "AZURE_OPENAI_DEPLOYMENT",
    "AZURE_OPENAI_API_VERSION",
)

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ]
)
logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    await startup_event()
    try:
        yield
    finally:
        for task in list(background_tasks):
            task.cancel()


app = FastAPI(
    title="MCP Reputation Policy Layer API",
    description="Real MCP protocol routing with dynamic trust fabric and Prometheus telemetry.",
    version="3.0.0",
    lifespan=lifespan,
)

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

rep_service = RepScoreService()
mcp_client = RealMCPClient()
routing_policy = RoutingPolicy()
server_registry = ServerRegistry()
background_tasks: set[asyncio.Task] = set()

oai_client = AsyncAzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY", "missing"),
    api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2025-01-01-preview"),
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT", "https://example.openai.azure.com"),
)
DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4.1")


class AgentGoal(BaseModel):
    goal_type: str
    risk_tolerance: str = "medium"
    latency_priority: str = "medium"
    accuracy_priority: str = "medium"


class AgentRequest(BaseModel):
    prompt: str
    tool_type: str
    goal: AgentGoal
    demo_event: str | None = None


async def startup_event() -> None:
    validate_required_env()
    await _maybe_await(rep_service.initialize())
    await server_registry.discover()
    rep_service.ensure_servers(server_registry.all_servers())

    task = asyncio.create_task(rep_service.process_telemetry_worker())
    background_tasks.add(task)
    task.add_done_callback(background_tasks.discard)

    all_reps = await _maybe_await(rep_service.get_all_reputations())
    update_reputation_gauges(all_reps, RepScoreConfig.MIN_REPUTATION_THRESHOLD)
    logger.info("api_started", version=app.version, cors_origins=ALLOWED_ORIGINS)


@app.middleware("http")
async def add_trace_id(request: Request, call_next):
    trace_id = request.headers.get("X-Request-Id", f"req_{uuid.uuid4().hex[:8]}")
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(trace_id=trace_id)
    response = await call_next(request)
    response.headers["X-Trace-Id"] = trace_id
    return response


@app.get("/metrics")
async def metrics():
    return prometheus_response()


@app.get("/api/v1/servers")
async def get_servers():
    all_reps = await _maybe_await(rep_service.get_all_reputations())
    update_reputation_gauges(all_reps, RepScoreConfig.MIN_REPUTATION_THRESHOLD)

    servers = []
    for route in server_registry.all_servers():
        server_id = route["server_id"]
        rep_data = all_reps.get(server_id, {})
        score = float(rep_data.get("score", RepScoreConfig.DEFAULT_INITIAL_SCORE))
        history = rep_data.get("history", [score])
        status = "TRUSTED" if score >= RepScoreConfig.MIN_REPUTATION_THRESHOLD else "CIRCUIT_BROKEN"

        servers.append(
            {
                "server_id": server_id,
                "tool_type": route.get("tool_type"),
                "base_reputation": round(score, 4),
                "policy_score": round(score, 4),
                "status": status,
                "interactions": rep_data.get("interaction_count", 0),
                "cost_per_unit": route.get("cost_per_unit", 0.005),
                "history": [round(float(value), 4) for value in history],
                "mcp_url": route.get("url"),
                "mcp_tool": route.get("tool"),
            }
        )

    return {"servers": servers}


@app.post("/api/v1/execute")
async def execute_task(req: AgentRequest):
    if req.tool_type not in _valid_tool_types():
        raise HTTPException(status_code=400, detail=f"Unknown tool type: {req.tool_type}")

    all_reps_data = await _maybe_await(rep_service.get_all_reputations())
    rep_scores = {
        server_id: float(data.get("score", RepScoreConfig.DEFAULT_INITIAL_SCORE))
        for server_id, data in all_reps_data.items()
    }

    candidates = server_registry.get_candidates(req.tool_type)
    route = routing_policy.select_server_from_candidates(candidates, rep_scores, req.goal.risk_tolerance)
    if not route:
        rpl_requests_total.labels(tool_type=req.tool_type, status="NO_CANDIDATES").inc()
        raise HTTPException(status_code=503, detail="No trusted MCP servers available for this tool type.")

    server_id = route["server_id"]
    server_url = route["url"]
    tool_name = route["tool"]
    decision_score = rep_scores.get(server_id, RepScoreConfig.DEFAULT_INITIAL_SCORE)
    risk_threshold = routing_policy._threshold_for(req.goal.risk_tolerance)
    arguments = _build_arguments(tool_name, req.prompt, route.get("tool_kwargs", {}))

    with rpl_routing_latency_seconds.labels(server_id=server_id).time():
        response = await mcp_client.call_tool(server_url, tool_name, arguments)
    response = _apply_demo_event(req.demo_event, response)

    status = response.get("status", "ERROR")
    rpl_requests_total.labels(tool_type=req.tool_type, status=status).inc()

    log_entry = mcp_client.create_log_entry(server_id, req.prompt, response)
    log_entry["tool_type"] = req.tool_type
    log_entry["mcp_tool_called"] = tool_name
    await _maybe_await(rep_service.record_feedback(log_entry))
    rpl_telemetry_queue_size.set(rep_service.telemetry_queue.qsize())

    current_rep = await _maybe_await(rep_service.get_reputation(server_id))
    reasoning = await _generate_reasoning(server_id, req, response, current_rep)

    return {
        "transaction_id": log_entry["id"],
        "server_id": server_id,
        "mcp_server_url": server_url,
        "mcp_tool_called": tool_name,
        "outcome_status": status,
        "latency_sec": response.get("latency", 0.0),
        "compute_cost": response.get("compute_cost", 0.0),
        "client_satisfaction": log_entry["client_satisfaction"],
        "result": response.get("result", ""),
        "new_reputation_score": round(float(current_rep), 4),
        "decision_score": round(float(decision_score), 4),
        "risk_threshold": round(float(risk_threshold), 4),
        "reasoning": reasoning,
    }


@app.get("/api/v1/health")
async def health():
    return {
        "status": "ok",
        "version": app.version,
        "registry_initialized": server_registry._initialized,
        "registered_servers": len(server_registry.all_servers()),
        "mcp_server_count": len({route.get("url") for route in server_registry.all_servers()}),
        "telemetry_queue_depth": rep_service.telemetry_queue.qsize(),
    }


@app.post("/api/v1/demo/reset")
async def reset_demo_state():
    routes = server_registry.all_servers()
    await _maybe_await(rep_service.reset_demo_state(routes))
    all_reps = await _maybe_await(rep_service.get_all_reputations())
    update_reputation_gauges(all_reps, RepScoreConfig.MIN_REPUTATION_THRESHOLD)
    rpl_telemetry_queue_size.set(rep_service.telemetry_queue.qsize())
    return {
        "status": "reset",
        "server_count": len(routes),
        "mcp_server_count": len({route.get("url") for route in routes}),
    }


def validate_required_env() -> None:
    missing = [name for name in REQUIRED_ENV_VARS if not os.getenv(name)]
    if missing:
        raise RuntimeError(
            "Missing required environment variables: "
            + ", ".join(missing)
            + ". Create a .env file or set them before starting the API."
        )


def _build_arguments(tool_name: str, prompt: str, tool_kwargs: dict[str, Any]) -> dict[str, Any]:
    arguments = dict(tool_kwargs)
    if tool_name == "execute_computation":
        arguments.setdefault("expression", prompt)
    elif tool_name == "general_reasoning":
        arguments.setdefault("prompt", prompt)
    else:
        arguments.setdefault("query", prompt)
    return arguments


def _apply_demo_event(demo_event: str | None, response: dict[str, Any]) -> dict[str, Any]:
    if demo_event != "POISONED_SOURCE":
        return response

    poisoned = dict(response)
    poisoned["status"] = "ERROR"
    poisoned["latency"] = max(float(poisoned.get("latency", 0.0) or 0.0), 1.2)
    poisoned["compute_cost"] = float(poisoned.get("compute_cost", 0.0) or 0.0)
    poisoned["server_confidence"] = 0.05
    poisoned["result"] = "Demo injected poisoning signal: source returned a low-confidence payload."
    return poisoned


async def _generate_reasoning(
    server_id: str,
    req: AgentRequest,
    response: dict[str, Any],
    rep: float,
) -> str:
    try:
        completion = await oai_client.chat.completions.create(
            model=DEPLOYMENT,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"In 2 sentences, explain why the MCP Reputation Policy Layer chose '{server_id}' "
                        f"(reputation: {rep:.2f}) for a '{req.tool_type}' task. "
                        f"Agent risk tolerance: '{req.goal.risk_tolerance}', accuracy priority: "
                        f"'{req.goal.accuracy_priority}'. Outcome: {response.get('status', 'UNKNOWN')}."
                    ),
                }
            ],
            temperature=0.7,
            max_tokens=120,
        )
        return completion.choices[0].message.content.strip()
    except Exception as exc:
        logger.error("reasoning_failed", error=str(exc))
        return f"RPL routed to '{server_id}' because it had the best available reputation for this goal."


async def _maybe_await(value):
    if inspect.isawaitable(value):
        return await value
    return value


def _valid_tool_types() -> set[str]:
    return {tool_type.value for tool_type in ToolType}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
