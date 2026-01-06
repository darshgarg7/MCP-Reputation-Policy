import os
from typing import List, Dict, Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import AsyncAzureOpenAI

from config import ToolType, RepScoreConfig
from repservice import RepScoreService
from mcp import MCP_Client

app = FastAPI(title="MCP Reputation Policy API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 1. INITIALIZE SINGLETONS ---
print("Initializing RepScoreService and MCP_Client for FastAPI...")
rep_service = RepScoreService()
mcp_client = MCP_Client(rep_service)

# --- 2. AZURE OPENAI SETUP ---
from dotenv import load_dotenv
load_dotenv()

AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2025-01-01-preview")
AZURE_OPENAI_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4.1")

oai_client = AsyncAzureOpenAI(
    api_key=AZURE_OPENAI_API_KEY,
    api_version=AZURE_OPENAI_API_VERSION,
    azure_endpoint=AZURE_OPENAI_ENDPOINT
)

# --- 3. PYDANTIC MODELS ---
class AgentGoal(BaseModel):
    goal_type: str
    risk_tolerance: str
    latency_priority: str
    accuracy_priority: str

class ExecuteRequest(BaseModel):
    prompt: str
    tool_type: str
    goal: AgentGoal

# --- 4. ENDPOINTS ---

@app.get("/api/v1/servers")
async def get_servers():
    """Returns all registered servers, their current scores, and historical data."""
    servers_list = []
    for s_id, s_data in rep_service.server_catalog.items():
        # Get live decayed score
        base_rep = rep_service.get_reputation(s_id)
        
        # Determine status
        status = "TRUSTED" if base_rep >= RepScoreConfig.MIN_REPUTATION_THRESHOLD else "BLOCKED"
        
        # Get history for graphing
        history = rep_service.reputations.get(s_id, {}).get("history", [base_rep])
        interactions = rep_service.reputations.get(s_id, {}).get("interaction_count", 0)
        
        servers_list.append({
            "server_id": s_id,
            "tool_type": s_data["tool_type"].name,
            "base_reputation": round(base_rep, 4),
            "policy_score": round(base_rep, 4), # Conceptual proxy for now
            "status": status,
            "interactions": interactions,
            "cost_per_unit": s_data["cost_per_unit"],
            "history": [round(h, 4) for h in history]
        })
    return {"servers": servers_list}

@app.post("/api/v1/execute")
async def execute_task(req: ExecuteRequest):
    """Executes a task and generates reasoning via Azure OpenAI."""
    try:
        tool_type_enum = ToolType[req.tool_type]
    except KeyError:
        raise HTTPException(status_code=400, detail=f"Invalid tool_type: {req.tool_type}")

    # --- STEP 1: ROUTING (Using MCP Client Logic) ---
    server_id = mcp_client._select_best_server(tool_type_enum)
    if not server_id:
        raise HTTPException(status_code=400, detail=f"Task failed: No trustworthy server found for {tool_type_enum.name}.")
        
    # --- STEP 2: EXECUTION ---
    server = mcp_client.servers[server_id]
    # Note: server.execute_tool uses time.sleep, which blocks the event loop.
    # In a full prod app this would be async, but fine for local demo.
    response = server.execute_tool(req.prompt)
    
    # --- STEP 3: TELEMETRY & FEEDBACK ---
    log_entry = mcp_client._create_log_entry(server_id, req.prompt, response)
    mcp_client.rep_service.submit_feedback(log_entry)
    new_rep_score = mcp_client.rep_service.get_reputation(server_id)
    
    # --- STEP 4: LLM REASONING (Azure OpenAI) ---
    reasoning_prompt = f"""
You are the 'Agentic Reputation Policy Layer'. Explain why you routed the following task to a specific data server.

Task: "{req.prompt}"
Required Tool: {req.tool_type}

Agent Goals:
- Task Type: {req.goal.goal_type}
- Risk Tolerance: {req.goal.risk_tolerance}
- Latency Priority: {req.goal.latency_priority}
- Accuracy Priority: {req.goal.accuracy_priority}

Decision Made:
- Selected Server: {server_id}
- Server Reputation: {new_rep_score:.4f}
- Outcome: {log_entry['outcome_status']}
- Latency: {log_entry['latency_sec']:.4f}s

Write a short 2-3 sentence narrative explaining this decision from the perspective of an intelligent proxy. Emphasize how the agent's goals (e.g., risk tolerance, accuracy priority) influenced trusting this server. Be concise, professional, and slightly cyberpunk in tone.
"""
    
    try:
        completion = await oai_client.chat.completions.create(
            model=AZURE_OPENAI_DEPLOYMENT,
            messages=[
                {"role": "system", "content": "You are a cutting-edge AI routing policy agent controlling the Model Context Protocol layer."},
                {"role": "user", "content": reasoning_prompt}
            ],
            temperature=0.7,
            max_tokens=150
        )
        reasoning = completion.choices[0].message.content.strip()
    except Exception as e:
        reasoning = f"Reasoning generation skipped/failed: {str(e)}"
        print(f"Azure OpenAI Error: {str(e)}")
        
    return {
        "transaction_id": log_entry["transaction_id"],
        "server_id": server_id,
        "outcome_status": log_entry["outcome_status"],
        "latency_sec": round(log_entry["latency_sec"], 4),
        "compute_cost": round(log_entry["compute_cost_units"], 4),
        "client_satisfaction": round(log_entry["client_satisfaction"], 4),
        "result": response["result"],
        "new_reputation_score": round(new_rep_score, 4),
        "reasoning": reasoning
    }

if __name__ == "__main__":
    import uvicorn
    # Allow running directly via `python api.py`
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
