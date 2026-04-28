"""
Real MCP Server: Web Search & News Feed
Speaks the official MCP protocol (Streamable HTTP / JSON-RPC 2.0).
Exposes tools for public_web_search and reuters_news_api endpoints.
Run: python -m src.servers.search_server (port 8002)
"""
import os
import random
from mcp.server.fastmcp import FastMCP
from openai import AsyncAzureOpenAI
from dotenv import load_dotenv

load_dotenv()

mcp = FastMCP(
    "Web Search & News MCP",
    stateless_http=True,
    json_response=True,
    port=8002,
)

oai_client = AsyncAzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2025-01-01-preview"),
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
)
DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4.1")


@mcp.tool()
async def web_search(query: str) -> dict:
    """
    Perform a broad web search and return summarized results.
    High recall, moderate precision.
    """
    latency = random.gauss(1.2, 0.15)
    error_rate = 0.20

    if random.random() < error_rate:
        return {"status": "ERROR", "source": "web_search", "latency": round(latency, 3), "result": "Rate limit exceeded.", "confidence": 0.0}

    completion = await oai_client.chat.completions.create(
        model=DEPLOYMENT,
        messages=[
            {"role": "system", "content": "You are a web search engine. Provide concise, realistic search result summaries for the given query. Include 2-3 key facts."},
            {"role": "user", "content": query},
        ],
        temperature=0.6,
        max_tokens=200,
    )
    return {
        "status": "SUCCESS",
        "source": "web_search",
        "latency": round(latency, 3),
        "compute_units": random.randint(30, 100),
        "result": completion.choices[0].message.content.strip(),
        "confidence": round(random.uniform(0.70, 0.90), 4),
    }


@mcp.tool()
async def get_news_feed(topic: str, max_articles: int = 3) -> dict:
    """
    Retrieve the latest news articles on a topic from Reuters News API.
    High recency, curated editorial content.
    """
    latency = random.gauss(0.5, 0.08)
    error_rate = 0.05

    if random.random() < error_rate:
        return {"status": "ERROR", "source": "reuters", "latency": round(latency, 3), "result": "Reuters upstream timeout.", "confidence": 0.0}

    completion = await oai_client.chat.completions.create(
        model=DEPLOYMENT,
        messages=[
            {"role": "system", "content": f"You are the Reuters News API. Generate {max_articles} realistic, recent news headlines and one-sentence summaries on the given topic."},
            {"role": "user", "content": topic},
        ],
        temperature=0.5,
        max_tokens=220,
    )
    return {
        "status": "SUCCESS",
        "source": "reuters",
        "latency": round(latency, 3),
        "compute_units": random.randint(20, 80),
        "result": completion.choices[0].message.content.strip(),
        "confidence": round(random.uniform(0.80, 0.96), 4),
    }


if __name__ == "__main__":
    mcp.run(transport="streamable-http")
