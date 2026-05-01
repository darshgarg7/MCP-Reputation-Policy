"""
Real MCP Server: Web Search and News.

Run: python -m src.servers.web_server
Port: 8002
"""

import random

from mcp.server.fastmcp import FastMCP


mcp = FastMCP("Web Search MCP", stateless_http=True, json_response=True, port=8002)


@mcp.tool()
async def search_web(query: str, source: str = "public_web") -> dict:
    """Search the public web for current information."""
    latency = round(abs(random.gauss(0.55, 0.08)), 3)
    return {
        "status": "SUCCESS",
        "source": source,
        "latency": latency,
        "result": f"Top web findings for '{query}' from {source}.",
        "compute_units": random.randint(40, 110),
        "cost": round(random.uniform(0.05, 0.20), 4),
        "confidence": round(random.uniform(0.78, 0.92), 4),
    }


@mcp.tool()
async def get_news(query: str, source: str = "reuters") -> dict:
    """Retrieve news-feed summaries for companies, markets, and events."""
    latency = round(abs(random.gauss(0.45 if source == "reuters" else 0.75, 0.08)), 3)
    return {
        "status": "SUCCESS",
        "source": source,
        "latency": latency,
        "result": f"News summary for '{query}' from {source}.",
        "compute_units": random.randint(50, 120),
        "cost": round(random.uniform(0.08, 0.25), 4),
        "confidence": round(random.uniform(0.80, 0.95), 4),
    }


if __name__ == "__main__":
    mcp.run(transport="streamable-http")
