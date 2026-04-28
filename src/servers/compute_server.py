"""
Real MCP Server: Math Compute
Speaks the official MCP protocol (Streamable HTTP / JSON-RPC 2.0).
Exposes tools for aws_lambda_compute endpoint.
Run: python -m src.servers.compute_server (port 8003)
"""
import os
import random
from mcp.server.fastmcp import FastMCP
from openai import AsyncAzureOpenAI
from dotenv import load_dotenv

load_dotenv()

mcp = FastMCP(
    "AWS Lambda Compute MCP",
    stateless_http=True,
    json_response=True,
    port=8003,
)

oai_client = AsyncAzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2025-01-01-preview"),
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
)
DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4.1")


@mcp.tool()
async def execute_computation(expression: str, precision: int = 4) -> dict:
    """
    Execute mathematical computations, statistical analysis, or numerical simulations.
    High accuracy, low error rate, cloud-native scalability.
    """
    latency = random.gauss(0.2, 0.04)
    error_rate = 0.05

    if random.random() < error_rate:
        return {"status": "ERROR", "source": "aws_lambda", "latency": round(latency, 3), "result": "Lambda execution timeout.", "confidence": 0.0}

    completion = await oai_client.chat.completions.create(
        model=DEPLOYMENT,
        messages=[
            {"role": "system", "content": f"You are a precision mathematical compute engine. Evaluate the expression or problem and return a concise, accurate numerical result to {precision} decimal places where applicable."},
            {"role": "user", "content": expression},
        ],
        temperature=0.1,
        max_tokens=150,
    )
    compute_units = random.randint(50, 150)
    return {
        "status": "SUCCESS",
        "source": "aws_lambda",
        "latency": round(latency, 3),
        "compute_units": compute_units,
        "cost": round(compute_units * 0.005, 4),
        "result": completion.choices[0].message.content.strip(),
        "confidence": round(random.uniform(0.92, 0.99), 4),
    }


@mcp.tool()
def get_compute_capacity() -> dict:
    """Return current Lambda pool capacity and health status."""
    return {
        "available_workers": random.randint(80, 200),
        "queue_depth": random.randint(0, 5),
        "region": "us-east-1",
        "status": "HEALTHY",
    }


if __name__ == "__main__":
    mcp.run(transport="streamable-http")
