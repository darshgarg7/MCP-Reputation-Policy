"""
Real MCP Server: Financial Data.

Run: python -m src.servers.financial_server
Port: 8001
"""

import os
import random

from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP
from openai import AsyncAzureOpenAI


load_dotenv()

mcp = FastMCP("Financial Data MCP", stateless_http=True, json_response=True, port=8001)
oai_client = AsyncAzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY", "missing"),
    api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2025-01-01-preview"),
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT", "https://example.openai.azure.com"),
)
DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4.1")


@mcp.tool()
async def get_financial_data(query: str, source: str = "bloomberg") -> dict:
    """Retrieve market data, prices, indices, rates, and financial snapshots."""
    latency = round(abs(random.gauss(0.4 if source == "bloomberg" else 2.5, 0.05)), 3)
    error_rate = 0.05 if source == "bloomberg" else 0.30
    if random.random() < error_rate:
        return {
            "status": "ERROR",
            "source": source,
            "latency": latency,
            "result": f"Connection fault on {source} endpoint.",
            "confidence": 0.0,
        }

    result_text = await _llm_or_fallback(
        system=f"You are a {source} financial terminal. Return concise, realistic financial data.",
        prompt=query,
    )
    return {
        "status": "SUCCESS",
        "source": source,
        "latency": latency,
        "result": result_text,
        "compute_units": random.randint(50, 140),
        "cost": round(random.uniform(0.20, 0.75), 4),
        "confidence": round(random.uniform(0.86, 0.98), 4),
    }


@mcp.tool()
async def list_supported_instruments() -> list[str]:
    """List financial instruments supported by this server."""
    return ["AAPL", "GOOG", "MSFT", "BTC-USD", "ETH-USD", "EUR/USD", "S&P 500", "NASDAQ", "10Y Treasury"]


async def _llm_or_fallback(system: str, prompt: str) -> str:
    try:
        completion = await oai_client.chat.completions.create(
            model=DEPLOYMENT,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=180,
        )
        return completion.choices[0].message.content.strip()
    except Exception:
        return f"{prompt}: synthetic market snapshot unavailable from live provider."


if __name__ == "__main__":
    mcp.run(transport="streamable-http")
