import time
import random
import uuid
from typing import Dict, Any, Optional, List
from config import RepScoreConfig, ServerCatalog, ToolType, Status 
from repservice import RepScoreService 

# --- MCP SERVER SIMULATION (Tool Provider) ---

class MCP_Server:
    """The specialized computation/data server."""
    def __init__(self, server_id: str, tool_type: ToolType, error_rate: float, avg_latency: float, cost_per_unit: float):
        self.server_id = server_id
        self.tool_type = tool_type
        self.error_rate = error_rate
        self.avg_latency = avg_latency
        self.cost_per_unit = cost_per_unit

    def execute_tool(self, client_request: str) -> Dict[str, Any]:
        """Simulates tool execution and returns rich metadata."""
        latency = abs(random.gauss(self.avg_latency, 0.05))
        time.sleep(latency * 0.1) 
        
        compute_units = random.randint(50, 150)
        cost = compute_units * self.cost_per_unit
        
        # Use Status enum for consistency
        if random.random() < self.error_rate:
            return {
                "status": Status.ERROR.value,
                "result": f"Execution failed: {self.server_id} fault.", 
                "latency": latency, "compute_cost": cost, "server_confidence": 0.2
            }
        
        return {
            "status": Status.SUCCESS.value,
            "result": f"Result for '{client_request}'. Used {compute_units} units.",
            "latency": latency, "compute_cost": cost, 
            "server_confidence": round(random.uniform(0.75, 0.99), 4)
        }


# --- MCP CLIENT (AI Agent with Policy Layer) ---

class MCP_Client:
    """
    The AI Agent implementing the Reputation Policy Layer (RPL) as smart tool-routing middleware.
    """
    def __init__(self, rep_service: RepScoreService):
        self.rep_service = rep_service
        self.servers: Dict[str, MCP_Server] = self._initialize_servers()
        print("🤖 MCP Client initialized. Agentic RPL is active.")

    def _initialize_servers(self) -> Dict[str, MCP_Server]:
        """Creates MCP_Server instances from the static catalog."""
        servers = {}
        for s_id, s_data in ServerCatalog.CATALOG.items():
            servers[s_id] = MCP_Server(server_id=s_id, **s_data)
        return servers

    def _interpret_policy_llm(self, candidates: List[Dict[str, Any]]) -> str:
        """Simulates the Natural-Language Policy Interface/LLM Layer."""
        if not candidates: return "Recommendation: No available servers for this task."
        best = candidates[0]
        summary = f"Recommendation: The best server is **{best['server_id']}** (Score: {best['score']:.4f}). "
        if best['score'] < RepScoreConfig.MIN_REPUTATION_THRESHOLD:
             summary += "WARNING: Reputation is too low; execution will be blocked."
        elif best['cost'] < RepScoreConfig.COST_BENCHMARK:
             summary += "It is highly cost-efficient and trustworthy."
        else:
             summary += "It meets reliability thresholds but has an average cost profile."
        return summary

    def _determine_satisfaction(self, outcome: str, latency: float, server_confidence: float) -> float:
        """Agentic mechanism to derive implicit client satisfaction (Pillar 2: Feedback Loop)."""
        # Check against the Status enum value for correctness
        if outcome == Status.SUCCESS.value:
            latency_penalty = min(0.5, latency * 1.5)
            confidence_bonus = server_confidence * 0.1
            satisfaction = max(0.2, 1.0 - latency_penalty + confidence_bonus) 
        else:
            satisfaction = 0.1
        return round(satisfaction, 4)
    
    def _create_log_entry(self, server_id: str, request: str, response: Dict[str, Any]) -> Dict[str, Any]:
        """Formats the transaction into the rich telemetry structure (Pillar 1)."""
        satisfaction = self._determine_satisfaction(response['status'], response['latency'], response['server_confidence'])
        
        return {
            'transaction_id': str(uuid.uuid4()),
            'timestamp_utc': time.time(),
            'server_id': server_id,
            'request_params_hash': hash(request),
            'outcome_status': response['status'],
            'latency_sec': response['latency'],
            'compute_cost_units': response['compute_cost'],
            'client_satisfaction': satisfaction,
            'server_confidence': response['server_confidence'],
        }

    def _select_best_server(self, tool_type: ToolType) -> Optional[str]:
        """Implements the core Reputation-Based Routing Policy."""
        candidates = self.rep_service.discover_servers(tool_type)
        
        # LLM Policy Interface Output (for observability)
        print(f"   [LLM Policy] {self._interpret_policy_llm(candidates)}")

        if not candidates: return None

        # Policy Block: Filter out servers below the MIN_REPUTATION_THRESHOLD
        selectable_servers = [
            c for c in candidates 
            if c['score'] >= RepScoreConfig.MIN_REPUTATION_THRESHOLD
        ]
        
        if not selectable_servers:
            print(f"   ❌ **Policy BLOCK**: All servers failed minimum reputation check.")
            return None
        
        # Select the highest-reputed server
        best_choice = selectable_servers[0]
        
        print(f"   ✅ **Policy SELECT**: Routing to **{best_choice['server_id']}** (Score: {best_choice['score']:.4f}, Cost: ${best_choice['cost']})")
        return best_choice['server_id']

    def execute_task(self, task_description: str, tool_type: ToolType):
        """The main execution loop: Discover -> Select -> Execute -> Log -> Feedback."""
        print(f"\n--- 🚀 Client Task: {task_description} (Tool: {tool_type.name}) ---")
        
        server_id = self._select_best_server(tool_type)
        
        if server_id is None:
            return f"Task failed: No trustworthy server found for {tool_type.name}."

        # Execute Tool Request
        server = self.servers[server_id]
        response = server.execute_tool(task_description)
        
        # Logging and Feedback Loop
        log_entry = self._create_log_entry(server_id, task_description, response)
        
        print(f"   [Telemetry] Status: **{log_entry['outcome_status']}** | Latency: {log_entry['latency_sec']:.4f}s | Cost: ${log_entry['compute_cost_units']:.4f}")
        print(f"   [Feedback] Satisfaction: {log_entry['client_satisfaction']:.4f} (Derived)")
        
        # Submit rich log to the Reputation Scoring Service
        self.rep_service.submit_feedback(log_entry)
        
        return response['result']

# --- New Function: Interactive CLI ---

def get_tool_type_from_user() -> Optional[ToolType]:
    """Helper function to map user input to a ToolType enum."""
    print("\n--- Available Tool Types ---")
    tool_options = {
        '1': ToolType.MATH_COMPUTE,
        '2': ToolType.DATA_RETRIEVAL,
        '3': ToolType.REASONING,
        '4': ToolType.IMAGE_GEN,
        '5': ToolType.SEMANTIC_SEARCH
    }
    # Display options dynamically
    for key, tt in tool_options.items():
        print(f"  [{key}] {tt.name}")
    
    choice = input("Enter tool choice (1-5) or 'q' to quit: ").strip().lower()
    if choice == 'q':
        return None
    
    return tool_options.get(choice)

def interactive_agent_cli(client: MCP_Client):
    """
    Runs an interactive command-line interface simulating user input
    to the LLM Agent, which then calls the MCP Client middleware.
    """
    print("\n" + "#" * 90)
    print("           ✨ MCP REPUTATION POLICY INTERACTIVE AGENT (Ecosystem V2) ✨")
    print("#" * 90)
    print("Test autonomous routing: the MCP Client chooses the best server based on live reputation.")

    while True:
        tool_type = get_tool_type_from_user()
        
        if tool_type is None:
            break
            
        prompt = input(f"\n[{tool_type.name}] Enter the task prompt: ").strip()
        
        if not prompt:
            print("Task prompt cannot be empty. Try again.")
            continue

        print("\n" + "~"*90)
        print(f"🔥 **LLM AGENT**: Processing prompt: '{prompt}'")
        print(f"🔥 **LLM AGENT**: Decided tool type is **{tool_type.name}**.")
        print("~"*90)
        
        # The user's input now drives the core execution logic
        result = client.execute_task(prompt, tool_type)
        
        print(f"\n[LLM Agent Received] Result: {result}")
        
        # Display current status of all servers after the transaction
        print("\n--- Current Reputation Audit ---")
        for s_id, data in client.rep_service.reputations.items():
            score_data = client.rep_service.reputations.get(s_id, {'score': 0.50})
            selectable = score_data['score'] >= RepScoreConfig.MIN_REPUTATION_THRESHOLD
            print(f"  {s_id:20} | Score: {score_data['score']:.4f} | Selectable: {selectable}")
        print("-" * 30)

    print("\nInteractive session closed. Final audit completed.")


# --- EXECUTION DEMO ---

if __name__ == "__main__":
    # 1. Initialize the central RP Layer
    rep_service = RepScoreService()
    
    # 2. Initialize the MCP Client (the RPL middleware)
    client = MCP_Client(rep_service)

    # --- SETUP FOR INSTABILITY/COMPETITION ---
    # Worsen the performance of two existing servers to make routing competitive
    client.servers["compute_server_1"].error_rate = 0.40 
    client.servers["compute_server_1"].avg_latency = 0.70 
    
    print("[SETUP] System configured for competitive routing and instability tests.")

    # Execute the interactive CLI instead of the scripted demo
    interactive_agent_cli(client)

    # --- FINAL AUDIT upon quitting CLI ---
    print("\n" + "="*90)
    print("FINAL AUDIT: SERVICE STATUS AFTER INTERACTIVE SESSION")
    print("="*90)
    for s_id, data in rep_service.reputations.items():
        selectable = data['score'] >= RepScoreConfig.MIN_REPUTATION_THRESHOLD
        print(f"Server ID: {s_id:20} | Final Score: **{data['score']:.4f}** | Policy Selectable: {selectable}")