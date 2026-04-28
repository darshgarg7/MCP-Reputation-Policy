import enum
from typing import Dict, Any, Final

# --- 1. CORE ENUMS (Expanded) ---

class ToolType(enum.Enum):
    """Defines standard tool functionalities in the Model Context Protocol (MCP) ecosystem."""
    MATH_COMPUTE = "MATH_COMPUTE"
    WEB_SEARCH = "WEB_SEARCH"
    FINANCIAL_DATA = "FINANCIAL_DATA"
    RESEARCH_DB = "RESEARCH_DB"
    NEWS_FEED = "NEWS_FEED"
    GENERAL = "GENERAL"

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
    ALPHA_SMOOTHING: Final[float] = 0.3            # Exponential Moving Average (EMA) factor.
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
        "aws_lambda_compute": {"tool_type": ToolType.MATH_COMPUTE, "cost_per_unit": 0.005, 'error_rate': 0.05, 'avg_latency': 0.2},
        "public_web_search": {"tool_type": ToolType.WEB_SEARCH, "cost_per_unit": 0.001, 'error_rate': 0.20, 'avg_latency': 1.2},
        "bloomberg_mcp": {"tool_type": ToolType.FINANCIAL_DATA, "cost_per_unit": 0.050, 'error_rate': 0.01, 'avg_latency': 0.4},
        "internal_research_db": {"tool_type": ToolType.RESEARCH_DB, "cost_per_unit": 0.002, 'error_rate': 0.02, 'avg_latency': 0.3},
        "reuters_news_api": {"tool_type": ToolType.NEWS_FEED, "cost_per_unit": 0.010, 'error_rate': 0.05, 'avg_latency': 0.5},
        "legacy_mainframe": {"tool_type": ToolType.FINANCIAL_DATA, "cost_per_unit": 0.001, 'error_rate': 0.40, 'avg_latency': 2.5},
        "general_reasoning_node": {"tool_type": ToolType.GENERAL, "cost_per_unit": 0.020, 'error_rate': 0.10, 'avg_latency': 1.0},
    }
