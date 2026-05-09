import aiosqlite
import json
import os

class RepDataStore:
    """
    Asynchronous persistence layer simulating a DynamoDB Single-Table Design.
    """
    def __init__(self, filename: str | None = None):
        self.filename = filename or os.getenv("RPL_STORE_PATH", ".local/mcp_trust_store.db")
        dirname = os.path.dirname(self.filename)
        if dirname:
            os.makedirs(dirname, exist_ok=True)

    async def initialize(self):
        async with aiosqlite.connect(self.filename) as db:
            await db.execute('''
                CREATE TABLE IF NOT EXISTS server_reputation (
                    server_id TEXT PRIMARY KEY,
                    score REAL,
                    last_update REAL,
                    interaction_count INTEGER,
                    history TEXT
                )
            ''')
            await db.execute('''
                CREATE TABLE IF NOT EXISTS telemetry_logs (
                    id TEXT PRIMARY KEY,
                    server_id TEXT,
                    client_request TEXT,
                    response TEXT,
                    timestamp REAL
                )
            ''')
            await db.commit()

    async def get_server_metadata(self, server_id: str) -> dict:
        async with aiosqlite.connect(self.filename) as db:
            async with db.execute(
                'SELECT score, last_update, interaction_count, history FROM server_reputation WHERE server_id = ?',
                (server_id,)
            ) as cursor:
                row = await cursor.fetchone()
                if row:
                    return {
                        'score': row[0],
                        'last_update': row[1],
                        'interaction_count': row[2],
                        'history': json.loads(row[3])
                    }
                return None

    async def get_all_server_metadata(self) -> dict:
        async with aiosqlite.connect(self.filename) as db:
            async with db.execute('SELECT server_id, score, last_update, interaction_count, history FROM server_reputation') as cursor:
                rows = await cursor.fetchall()
                result = {}
                for row in rows:
                    result[row[0]] = {
                        'score': row[1],
                        'last_update': row[2],
                        'interaction_count': row[3],
                        'history': json.loads(row[4])
                    }
                return result

    async def update_server_metadata(self, server_id: str, score: float, last_update: float, interaction_count: int, history: list):
        history_str = json.dumps(history)
        async with aiosqlite.connect(self.filename) as db:
            await db.execute('''
                INSERT INTO server_reputation (server_id, score, last_update, interaction_count, history)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(server_id) DO UPDATE SET
                    score=excluded.score,
                    last_update=excluded.last_update,
                    interaction_count=excluded.interaction_count,
                    history=excluded.history
            ''', (server_id, score, last_update, interaction_count, history_str))
            await db.commit()

    async def insert_telemetry(self, log_id: str, server_id: str, client_request: str, response: dict, timestamp: float):
        resp_str = json.dumps(response)
        async with aiosqlite.connect(self.filename) as db:
            await db.execute('''
                INSERT INTO telemetry_logs (id, server_id, client_request, response, timestamp)
                VALUES (?, ?, ?, ?, ?)
            ''', (log_id, server_id, client_request, resp_str, timestamp))
            await db.commit()

    async def reset_demo_state(self):
        async with aiosqlite.connect(self.filename) as db:
            await db.execute('DELETE FROM telemetry_logs')
            await db.execute('DELETE FROM server_reputation')
            await db.commit()
