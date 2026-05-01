"""
Shared test fixtures for the MCP Reputation Policy Layer test suite.
"""
import sys
import os
import asyncio
import pytest
import pytest_asyncio

# Make src/ importable without installing the package
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
os.environ.setdefault("AZURE_OPENAI_API_KEY",     "test-key")
os.environ.setdefault("AZURE_OPENAI_ENDPOINT",    "https://test.openai.azure.com")
os.environ.setdefault("AZURE_OPENAI_DEPLOYMENT",  "gpt-4.1")
os.environ.setdefault("AZURE_OPENAI_API_VERSION", "2025-01-01-preview")


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()
