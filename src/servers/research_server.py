"""
Real MCP Server: Internal Research and General Reasoning.

Run: python -m src.servers.research_server
Port: 8004
"""

import random

from mcp.server.fastmcp import FastMCP


mcp = FastMCP("Research MCP", stateless_http=True, json_response=True, port=8004)


@mcp.tool()
async def query_research_db(query: str, source: str = "internal") -> dict:
    """Query an internal research database for high-confidence domain context."""
    latency = round(abs(random.gauss(0.35, 0.05)), 3)
    return {
        "status": "SUCCESS",
        "source": source,
        "latency": latency,
        "result": f"Internal research hit for '{query}'.",
        "compute_units": random.randint(35, 95),
        "cost": round(random.uniform(0.03, 0.12), 4),
        "confidence": round(random.uniform(0.88, 0.97), 4),
    }


@mcp.tool()
async def general_reasoning(prompt: str) -> dict:
    """Handle general reasoning prompts that do not require a specialized source."""
    latency = round(abs(random.gauss(0.60, 0.10)), 3)
    return {
        "status": "SUCCESS",
        "source": "general_reasoning",
        "latency": latency,
        "result": f"Reasoned response for '{prompt}'.",
        "compute_units": random.randint(80, 180),
        "cost": round(random.uniform(0.10, 0.45), 4),
        "confidence": round(random.uniform(0.75, 0.90), 4),
    }


if __name__ == "__main__":
    mcp.run(transport="streamable-http")
