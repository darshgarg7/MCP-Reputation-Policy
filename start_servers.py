#!/usr/bin/env python3
"""
start_servers.py — Launches all real MCP tool servers as subprocesses.
Run this FIRST before starting the main API.

Usage:
    python start_servers.py
    # Then in another terminal:
    uvicorn src.api:app --reload  (from project root)
    # Or from src/:
    uvicorn api:app --reload
"""
import subprocess
import sys
import time
import os
import signal

SERVERS = [
    {"name": "Financial Server  (bloomberg_mcp, legacy_mainframe)", "module": "servers.financial_server",  "port": 8001},
    {"name": "Web/News Server   (public_web_search, reuters_news)", "module": "servers.web_server",        "port": 8002},
    {"name": "Compute Server    (aws_lambda_compute)",               "module": "servers.compute_server",    "port": 8003},
    {"name": "Research Server   (internal_research_db, general)",    "module": "servers.research_server",   "port": 8004},
]

processes = []

def start_servers():
    src_dir = os.path.join(os.path.dirname(__file__), "src")
    print("\n🚀 Starting MCP Tool Servers...\n")

    for server in SERVERS:
        proc = subprocess.Popen(
            [sys.executable, "-m", server["module"]],
            cwd=src_dir,
            env={**os.environ},
        )
        processes.append(proc)
        print(f"  ✅ {server['name']} → http://localhost:{server['port']}/mcp  (PID {proc.pid})")
        time.sleep(0.3)  # Stagger starts

    print(f"\n📡 All {len(SERVERS)} MCP servers running.")
    print("   Now start the API: uvicorn api:app --reload (from src/)")
    print("   Press Ctrl+C to stop all servers.\n")

    def shutdown(sig, frame):
        print("\n⏹  Shutting down MCP servers...")
        for p in processes:
            p.terminate()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # Keep alive
    for p in processes:
        p.wait()


if __name__ == "__main__":
    start_servers()
