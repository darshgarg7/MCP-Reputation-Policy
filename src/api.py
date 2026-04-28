"""
MCP Reputation Policy Layer - FastAPI Orchestrator
Architecture:
  Agent (this file)
    → RPL Policy (src/rpl/policy.py)  — decides WHERE to route
    → Real MCP Client (src/mcp_client.py) — speaks the MCP protocol
    → MCP Servers (src/servers/*.py)  — separate HTTP processes
    → Background RepScore Worker      — updates DynamoDB asynchronously
"""
import os
import asyncio
import uuid
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import AsyncAzureOpenAI
import structlog
from dotenv import load_dotenv

from config import ToolType, RepScoreConfig
from repservice import RepScoreService
from mcp_client import RealMCPClient
from rpl.policy import RoutingPolicy

load_dotenv()

# --- STRUCTLOG (Distributed Tracing) ---
structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
)
logger = structlog.get_logger()

app = FastAPI(
    title="MCP Reputation Policy Layer API",
    description="Real MCP protocol routing with dynamic trust fabric.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- LAYER SINGLETONS ---
rep_service = RepScoreService()          # Layer 2a: Reputation State
routing_policy = RoutingPolicy()         # Layer 2b: Routing Decision
mcp_client = RealMCPClient()             # Layer 1: Real MCP Transport

# --- AZURE OPENAI (for reasoning narrative only) ---
oai_client = AsyncAzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2025-01-01-preview"),
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
)
DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4.1")

# --- STARTUP ---
background_tasks = set()

@app.on_event("startup")
async def startup_event():
    await rep_service.initialize()
    task = asyncio.create_task(rep_service.process_telemetry_worker())
    background_tasks.add(task)
    task.add_done_callback(background_tasks.discard)
    logger.info("api_started", message="RPL API (Real MCP Protocol Edition) online.")

# --- TRACING MIDDLEWARE ---
@app.middleware("http")
async def add_trace_id(request: Request, call_next):
    trace_id = request.headers.get("X-Request-Id", f"req_{str(uuid.uuid4())[:8]}")
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(trace_id=trace_id)
    response = await call_next(request)
    response.headers["X-Trace-Id"] = trace_id
    return response

# --- REQUEST MODELS ---
class AgentGoal(BaseModel):
    goal_type: str
    risk_tolerance: str
    latency_priority: str
    accuracy_priority: str

class AgentRequest(BaseModel):
    prompt: str
    tool_type: str
    goal: AgentGoal

# --- ENDPOINTS ---

@app.get("/api/v1/servers")
async def get_servers():
    """
    Returns the live ecosystem: all registered MCP servers,
    their current reputation scores, status, and score history.
    """
    logger.info("fetch_servers_request")

    from rpl.policy import TOOL_SERVER_REGISTRY

    all_reps = await rep_service.get_all_reputations()

    # Flatten server registry into a deduplicated list
    seen = set()
    servers = []
    for tool_type, candidates in TOOL_SERVER_REGISTRY.items():
        for candidate in candidates:
            s_id = candidate["server_id"]
            if s_id in seen:
                continue
            seen.add(s_id)

            db_data = all_reps.get(s_id, {})
            score = db_data.get("score", RepScoreConfig.DEFAULT_INITIAL_SCORE)
            status = "TRUSTED" if score >= RepScoreConfig.MIN_REPUTATION_THRESHOLD else "CIRCUIT_BROKEN"
            history = db_data.get("history", [score])

            servers.append({
                "server_id": s_id,
                "tool_type": tool_type,
                "base_reputation": round(score, 4),
                "policy_score": round(score, 4),
                "status": status,
                "interactions": db_data.get("interaction_count", 0),
                "cost_per_unit": 0.005,  # fetched from server capabilities in prod
                "history": [round(h, 4) for h in history],
                "mcp_url": candidate["url"],
            })

    return {"servers": servers}


@app.post("/api/v1/execute")
async def execute_task(req: AgentRequest):
    """
    Execute an agent task via the full three-layer stack:
    1. RPL Policy selects the best server based on live reputation scores.
    2. Real MCP Client connects to that server via the MCP protocol (JSON-RPC over HTTP).
    3. Azure OpenAI generates a human-readable routing reasoning narrative.
    4. Telemetry is queued for asynchronous reputation score update.
    """
    logger.info("execute_task_started", tool_type=req.tool_type, prompt=req.prompt[:60])

    try:
        ToolType[req.tool_type]
    except KeyError:
        raise HTTPException(status_code=400, detail=f"Unknown tool type: {req.tool_type}")

    # ─── LAYER 2: RPL Policy Decision ───────────────────────────────────────
    all_reps_data = await rep_service.get_all_reputations()
    rep_scores = {s_id: d.get("score", 0.5) for s_id, d in all_reps_data.items()}

    route = routing_policy.select_server(
        tool_type=req.tool_type,
        reputations=rep_scores,
        goal_risk_tolerance=req.goal.risk_tolerance,
    )

    if not route:
        logger.error("rpl_no_route", tool_type=req.tool_type)
        raise HTTPException(status_code=503, detail="No trusted MCP servers available for this tool type.")

    server_id = route["server_id"]
    server_url = route["url"]
    tool_name = route["tool"]
    tool_kwargs = route.get("tool_kwargs", {})

    # ─── LAYER 1: Real MCP Protocol Execution ───────────────────────────────
    mcp_arguments = {"query": req.prompt, **tool_kwargs}
    # Research DB and general reasoning use different arg names
    if tool_name in ("query_research_db", "general_reasoning"):
        mcp_arguments = {"query": req.prompt, **tool_kwargs} if tool_name == "query_research_db" else {"prompt": req.prompt}

    response = await mcp_client.call_tool(
        server_url=server_url,
        tool_name=tool_name,
        arguments=mcp_arguments,
    )

    # ─── Enqueue Telemetry (Non-blocking → Background Worker) ───────────────
    log_entry = mcp_client.create_log_entry(server_id, req.prompt, response)
    await rep_service.submit_feedback(log_entry)

    # ─── LLM Reasoning Narrative ─────────────────────────────────────────────
    reasoning_str = ""
    current_rep = await rep_service.get_reputation(server_id)

    try:
        reasoning_prompt = (
            f"In 2 sentences, explain why the MCP Reputation Policy Layer chose '{server_id}' "
            f"(score: {current_rep:.2f}) for a '{req.tool_type}' task. "
            f"The agent's risk tolerance is '{req.goal.risk_tolerance}' and accuracy priority is '{req.goal.accuracy_priority}'. "
            f"The task outcome was: {response['status']}."
        )
        r = await oai_client.chat.completions.create(
            model=DEPLOYMENT,
            messages=[{"role": "user", "content": reasoning_prompt}],
            temperature=0.7,
            max_tokens=120,
        )
        reasoning_str = r.choices[0].message.content.strip()
    except Exception as e:
        logger.error("reasoning_failed", error=str(e))
        reasoning_str = f"RPL routed to '{server_id}' (reputation: {current_rep:.2f}) via goal-conditioned policy."

    logger.info("execute_task_completed", server_id=server_id, status=response["status"])

    return {
        "transaction_id": log_entry["id"],
        "server_id": server_id,
        "mcp_server_url": server_url,
        "mcp_tool_called": tool_name,
        "outcome_status": response["status"],
        "latency_sec": round(response.get("latency", 0.0), 4),
        "compute_cost": round(response.get("compute_cost", 0.0), 4),
        "client_satisfaction": round(response.get("server_confidence", 0.0), 4),
        "result": response.get("result", ""),
        "new_reputation_score": round(current_rep, 4),
        "reasoning": reasoning_str,
    }


@app.get("/api/v1/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "version": "2.0.0", "architecture": "real-mcp-protocol"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
