import json
import time
import os

class RepDataStore:
    def __init__(self, filename: str = "mcp_trust_store.json"):
        self.filename = filename
        self._data = self._load_data()

    def _load_data(self) -> dict:
        if os.path.exists(self.filename):
            with open(self.filename, 'r') as f:
                return json.load(f)
        return {}

    def _save_data(self):
        with open(self.filename, 'w') as f:
            json.dump(self._data, f, indent=4)

    def get_server_metadata(self, server_id: str):
        key = f"SERVER#{server_id}"
        return self._data.get(key, {}).get("METADATA")

    def update_server_score(self, server_id: str, new_score: float, count: int):
        key = f"SERVER#{server_id}"
        if key not in self._data: self._data[key] = {}
        self._data[key]["METADATA"] = {
            'score': round(float(new_score), 4),
            'last_update': time.time(),
            'interaction_count': count
        }
        self._save_data()

    def log_telemetry(self, server_id: str, telemetry: dict):
        key = f"SERVER#{server_id}"
        if "LOGS" not in self._data[key]:
            self._data[key]["LOGS"] = []
        
        self._data[key]["LOGS"].append(telemetry)
        self._data[key]["LOGS"] = self._data[key]["LOGS"][-50:]
        self._save_data()
