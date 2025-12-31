import enum
from typing import Dict, Any, Final

# --- 1. CORE ENUMS (Expanded) ---

class ToolType(enum.Enum):
    """Defines standard tool functionalities in the Model Context Protocol (MCP) ecosystem."""
    MATH_COMPUTE = "MATH_COMPUTE"
    DATA_RETRIEVAL = "DATA_RETRIEVAL"
    REASONING = "REASONING"
    IMAGE_GEN = "IMAGE_GEN"
    SEMANTIC_SEARCH = "SEMANTIC_SEARCH"

class Status(enum.Enum):
    """Defines standard status codes for transaction logs."""
    SUCCESS = "SUCCESS"
    ERROR = "ERROR"
    TIMEOUT = "TIMEOUT"

# --- 2. REPUTATION POLICY CONFIGURATION (FIXED) ---

class RepScoreConfig:
    """
    Defines all configuration parameters and weights for the Reputation Policy Layer (RPL).
    Uses typing.Final for clarity that these values should not change at runtime.
    """
    
    # --- Multi-Factor Weights (Sum must equal 1.0) ---
    WEIGHT_SATISFACTION: Final[float] = 0.40      # Weight for Agentic Feedback (Trust)
    WEIGHT_RELIABILITY: Final[float] = 0.30       # Weight for Objective Uptime/Success Rate
    WEIGHT_LATENCY_PENALTY: Final[float] = 0.20   # Weight for Performance/Speed
    WEIGHT_COST_EFFICIENCY: Final[float] = 0.10   # Weight for Economic Value
    
    # --- Policy Thresholds & Benchmarks (FIXED: Added missing constants) ---
    MIN_REPUTATION_THRESHOLD: Final[float] = 0.70  # Score below which routing is blocked.
    ALPHA_SMOOTHING: Final[float] = 0.1            # Exponential Moving Average (EMA) factor.
    MAX_ACCEPTABLE_LATENCY: Final[float] = 0.8     # Latency benchmark (in seconds).
    COST_BENCHMARK: Final[float] = 0.005           # Baseline cost for comparison ($ per unit).
    
    # *** CRITICAL FIX: ADDED MISSING ATTRIBUTE ***
    DEFAULT_INITIAL_SCORE: Final[float] = 0.50     # Starting score for unverified endpoints. 
    
    # --- System Constants ---
    REPUTATION_DECAY_HALF_LIFE_HOURS: Final[int] = 24 # Time period after which reputation begins to decay.


# --- 3. STATIC SERVER METADATA CATALOG (Expanded) ---

class ServerCatalog:
    """Defines the static, non-reputational metadata for all registered MCP servers."""
    CATALOG: Final[Dict[str, Dict[str, Any]]] = {
        # Original Servers
        "compute_server_1": {"tool_type": ToolType.MATH_COMPUTE, "cost_per_unit": 0.005, 'error_rate': 0.15, 'avg_latency': 0.3},
        "data_server_2": {"tool_type": ToolType.DATA_RETRIEVAL, "cost_per_unit": 0.001, 'error_rate': 0.05, 'avg_latency': 0.2},
        "low_score_server_3": {"tool_type": ToolType.MATH_COMPUTE, "cost_per_unit": 0.0005, 'error_rate': 0.40, 'avg_latency': 0.1},
        
        # New Servers for expanded ecosystem
        "image_fast_4": { # New Tool: Image Generation (Fast but costly)
            "tool_type": ToolType.IMAGE_GEN, "cost_per_unit": 0.05, 'error_rate': 0.10, 'avg_latency': 0.5
        },
        "image_cheap_5": { # New Tool: Image Generation (Cheap but slow/unreliable)
            "tool_type": ToolType.IMAGE_GEN, "cost_per_unit": 0.008, 'error_rate': 0.30, 'avg_latency': 1.5
        },
        "semantic_db_6": { # New Tool: Semantic Search (High fidelity, low latency)
            "tool_type": ToolType.SEMANTIC_SEARCH, "cost_per_unit": 0.003, 'error_rate': 0.01, 'avg_latency': 0.15
        },
    }