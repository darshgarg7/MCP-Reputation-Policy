import asyncio
from src.repservice import RepScoreService

async def main():
    service = RepScoreService()
    await service.initialize()
    await service._process_feedback_sync({
        "id": "123",
        "server_id": "bloomberg_mcp",
        "client_request": "test",
        "response": {"status": "SUCCESS", "latency": 0.5, "compute_cost": 50, "server_confidence": 0.9},
        "timestamp": 12345.0
    })
    data = await service.store.get_server_metadata("bloomberg_mcp")
    print("New data:", data)

asyncio.run(main())
