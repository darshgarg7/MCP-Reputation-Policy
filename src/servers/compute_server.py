"""
Real MCP Server: Math Compute.

Run: python -m src.servers.compute_server
Port: 8003
"""

import os
import random

from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP
from openai import AsyncAzureOpenAI


load_dotenv()

mcp = FastMCP("AWS Lambda Compute MCP", stateless_http=True, json_response=True, port=8003)
oai_client = AsyncAzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY", "missing"),
    api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2025-01-01-preview"),
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT", "https://example.openai.azure.com"),
)
DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4.1")


@mcp.tool()
async def execute_computation(expression: str, precision: int = 4) -> dict:
    """Execute mathematical computations, statistical analysis, or simulations."""
    latency = round(abs(random.gauss(0.2, 0.05)), 3)
    if random.random() < 0.04:
        return {
            "status": "ERROR",
            "source": "aws_lambda",
            "latency": latency,
            "result": "Lambda execution timeout.",
            "confidence": 0.0,
        }

    result = await _llm_or_fallback(expression, precision)
    compute_units = random.randint(30, 90)
    return {
        "status": "SUCCESS",
        "source": "aws_lambda",
        "latency": latency,
        "result": result,
        "compute_units": compute_units,
        "cost": round(compute_units * 0.003, 4),
        "confidence": round(random.uniform(0.90, 0.99), 4),
    }


@mcp.tool()
async def get_compute_capacity() -> dict:
    """Return current compute pool capacity and health status."""
    return {
        "available_workers": random.randint(80, 200),
        "queue_depth": random.randint(0, 5),
        "region": "us-east-1",
        "status": "HEALTHY",
    }


async def _llm_or_fallback(expression: str, precision: int) -> str:
    try:
        completion = await oai_client.chat.completions.create(
            model=DEPLOYMENT,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a precision mathematical compute engine. "
                        f"Return concise results to {precision} decimal places where applicable."
                    ),
                },
                {"role": "user", "content": expression},
            ],
            temperature=0.1,
            max_tokens=150,
        )
        return completion.choices[0].message.content.strip()
    except Exception:
        return f"Computation accepted: {expression}"


if __name__ == "__main__":
    mcp.run(transport="streamable-http")
