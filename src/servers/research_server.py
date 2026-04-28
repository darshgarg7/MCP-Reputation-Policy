"""
Real MCP Server: Research Database
Speaks the official MCP protocol (Streamable HTTP / JSON-RPC 2.0).
Exposes tools for internal_research_db and general_reasoning_node endpoints.
Run: python -m src.servers.research_server (port 8004)
"""
import os
import random
from mcp.server.fastmcp import FastMCP
from openai import AsyncAzureOpenAI
from dotenv import load_dotenv

load_dotenv()

mcp = FastMCP(
    "Internal Research DB MCP",
    stateless_http=True,
    json_response=True,
    port=8004,
)

oai_client = AsyncAzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2025-01-01-preview"),
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
)
DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4.1")


@mcp.tool()
async def query_research_db(query: str, domain: str = "general") -> dict:
    """
    Query the internal research database for curated, peer-reviewed knowledge.
    High accuracy and citation quality. Domains: finance, science, technology, policy.
    """
    latency = random.gauss(0.3, 0.05)
    error_rate = 0.02

    if random.random() < error_rate:
        return {"status": "ERROR", "source": "research_db", "latency": round(latency, 3), "result": "Index rebuild in progress.", "confidence": 0.0}

    completion = await oai_client.chat.completions.create(
        model=DEPLOYMENT,
        messages=[
            {"role": "system", "content": f"You are an internal enterprise research database with access to curated, peer-reviewed papers and proprietary reports in the domain of '{domain}'. Provide precise, well-sourced answers."},
            {"role": "user", "content": query},
        ],
        temperature=0.2,
        max_tokens=220,
    )
    compute_units = random.randint(20, 80)
    return {
        "status": "SUCCESS",
        "source": "research_db",
        "latency": round(latency, 3),
        "compute_units": compute_units,
        "cost": round(compute_units * 0.002, 4),
        "result": completion.choices[0].message.content.strip(),
        "confidence": round(random.uniform(0.88, 0.98), 4),
    }


@mcp.tool()
async def general_reasoning(prompt: str) -> dict:
    """
    General-purpose reasoning node for open-ended queries.
    Moderate cost, broad coverage.
    """
    latency = random.gauss(1.0, 0.2)
    error_rate = 0.10

    if random.random() < error_rate:
        return {"status": "ERROR", "source": "reasoning_node", "latency": round(latency, 3), "result": "Node overloaded.", "confidence": 0.0}

    completion = await oai_client.chat.completions.create(
        model=DEPLOYMENT,
        messages=[
            {"role": "system", "content": "You are a general-purpose AI reasoning engine. Answer the query thoughtfully and concisely."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.7,
        max_tokens=200,
    )
    compute_units = random.randint(60, 140)
    return {
        "status": "SUCCESS",
        "source": "reasoning_node",
        "latency": round(latency, 3),
        "compute_units": compute_units,
        "cost": round(compute_units * 0.02, 4),
        "result": completion.choices[0].message.content.strip(),
        "confidence": round(random.uniform(0.65, 0.88), 4),
    }


if __name__ == "__main__":
    mcp.run(transport="streamable-http")
