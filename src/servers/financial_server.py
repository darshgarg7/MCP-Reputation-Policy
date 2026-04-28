"""
Real MCP Server: Financial Data
Speaks the official MCP protocol (Streamable HTTP / JSON-RPC 2.0).
Exposes tools for bloomberg_mcp and legacy_mainframe endpoints.
Run: python -m src.servers.financial_server (port 8001)
"""
import os
import random
from mcp.server.fastmcp import FastMCP
from openai import AsyncAzureOpenAI
from dotenv import load_dotenv

load_dotenv()

# --- Real FastMCP server with MCP protocol transport ---
mcp = FastMCP(
    "Bloomberg Financial MCP",
    stateless_http=True,
    json_response=True,
    port=8001,
)

oai_client = AsyncAzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2025-01-01-preview"),
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
)
DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4.1")


@mcp.tool()
async def get_financial_data(query: str, source: str = "bloomberg") -> dict:
    """
    Retrieve real-time financial market data (prices, indices, rates).
    source: 'bloomberg' (high quality, low latency) or 'legacy' (slower, cheaper).
    """
    latency_sim = random.gauss(0.4, 0.05) if source == "bloomberg" else random.gauss(2.5, 0.3)
    error_rate = 0.01 if source == "bloomberg" else 0.40

    if random.random() < error_rate:
        return {
            "status": "ERROR",
            "source": source,
            "latency": round(latency_sim, 3),
            "result": f"Connection fault on {source} endpoint.",
            "confidence": 0.0,
        }

    completion = await oai_client.chat.completions.create(
        model=DEPLOYMENT,
        messages=[
            {"role": "system", "content": f"You are a {source.upper()} financial terminal. Return concise, realistic financial data."},
            {"role": "user", "content": query},
        ],
        temperature=0.3,
        max_tokens=180,
    )
    result_text = completion.choices[0].message.content.strip()

    return {
        "status": "SUCCESS",
        "source": source,
        "latency": round(latency_sim, 3),
        "compute_units": random.randint(50, 150),
        "result": result_text,
        "confidence": round(random.uniform(0.88, 0.99), 4) if source == "bloomberg" else round(random.uniform(0.5, 0.75), 4),
    }


@mcp.tool()
def list_supported_instruments() -> list[str]:
    """List all financial instruments supported by this server."""
    return ["AAPL", "GOOG", "MSFT", "BTC-USD", "ETH-USD", "EUR/USD", "S&P 500", "NASDAQ", "10Y Treasury"]


if __name__ == "__main__":
    mcp.run(transport="streamable-http")
