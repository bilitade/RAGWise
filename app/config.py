import os
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = PROJECT_ROOT / ".env"
APP_DIR = PROJECT_ROOT / "app"
DB_DIR = APP_DIR / "db"


def load_env() -> None:
    if not ENV_FILE.exists():
        return

    with ENV_FILE.open() as dotenv_file:
        for line in dotenv_file:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue

            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


def get_env(name: str, default: str | None = None) -> str | None:
    return os.environ.get(name, default)


def get_required_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise ValueError(f"{name} is not set.")
    return value


def get_int_env(name: str, default: int) -> int:
    value = os.environ.get(name)
    return int(value) if value else default


def get_float_env(name: str, default: float) -> float:
    value = os.environ.get(name)
    return float(value) if value else default


def get_bool_env(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.lower() in ("1", "true", "yes")


load_env()


def _env_nonempty(name: str, default: str) -> str:
    """Treat empty/whitespace env values as unset (so ``KEY=`` in .env does not override defaults)."""
    raw = get_env(name, default)
    stripped = (raw or "").strip()
    return stripped if stripped else default


UPLOAD_DIR = Path(_env_nonempty("DOCUMENTS_DIR", str(PROJECT_ROOT / "upload")))

QDRANT_URL = get_env("QDRANT_URL", "http://localhost:6333")
QDRANT_COLLECTION = get_env("QDRANT_COLLECTION", "knowledge_base")
QDRANT_TIMEOUT = get_float_env("QDRANT_TIMEOUT", 10.0)
# Hybrid: Qdrant dense + sparse. False: dense-only LlamaIndex path.
QDRANT_HYBRID_ENABLED = get_bool_env("QDRANT_HYBRID_ENABLED", True)
QDRANT_SPARSE_MODEL = get_env("QDRANT_SPARSE_MODEL", "prithivida/Splade_PP_en_v1")
# Must match the collection’s named vectors.
QDRANT_DENSE_VECTOR_NAME = get_env("QDRANT_DENSE_VECTOR_NAME", "dense-vector")
QDRANT_SPARSE_VECTOR_NAME = get_env("QDRANT_SPARSE_VECTOR_NAME", "sparse-vector")
QDRANT_SPARSE_USE_IDF = get_bool_env("QDRANT_SPARSE_USE_IDF", True)

QDRANT_HNSW_M = get_int_env("QDRANT_HNSW_M", 24)
QDRANT_HNSW_PAYLOAD_M = get_int_env("QDRANT_HNSW_PAYLOAD_M", 24)
QDRANT_HNSW_EF_CONSTRUCT = get_int_env("QDRANT_HNSW_EF_CONSTRUCT", 256)
QDRANT_HNSW_FULL_SCAN_THRESHOLD_KB = get_int_env("QDRANT_HNSW_FULL_SCAN_THRESHOLD_KB", 0)
QDRANT_QUERY_HNSW_EF = get_int_env("QDRANT_QUERY_HNSW_EF", 128)
QDRANT_DENSE_ON_DISK = get_bool_env("QDRANT_DENSE_ON_DISK", False)
QDRANT_SPARSE_ON_DISK = get_bool_env("QDRANT_SPARSE_ON_DISK", True)
QDRANT_SPARSE_FULL_SCAN_THRESHOLD = get_int_env("QDRANT_SPARSE_FULL_SCAN_THRESHOLD", 0)
QDRANT_DENSE_DATATYPE = (get_env("QDRANT_DENSE_DATATYPE", "float32") or "float32").lower()
# Dense weight in hybrid fusion; sparse gets 1 - alpha.
QDRANT_HYBRID_ALPHA = max(0.0, min(1.0, get_float_env("QDRANT_HYBRID_ALPHA", 0.6)))

_document_registry_override = (get_env("DOCUMENT_REGISTRY_PATH") or "").strip()
DOCUMENT_REGISTRY_PATH = (
    Path(_document_registry_override) if _document_registry_override else DB_DIR / f"{QDRANT_COLLECTION}_documents.json"
)

REDIS_URL = get_env("REDIS_URL", "redis://localhost:6379/0")
CELERY_BROKER_URL = get_env("CELERY_BROKER_URL", REDIS_URL)
CELERY_RESULT_BACKEND = get_env("CELERY_RESULT_BACKEND", REDIS_URL)

OPENAI_MODEL = get_env("OPENAI_MODEL", "gpt-4.1-mini")
RAGAS_EVAL_MODEL = get_env("RAGAS_EVAL_MODEL") or OPENAI_MODEL
OPENAI_EMBED_MODEL = get_env("OPENAI_EMBED_MODEL", "text-embedding-3-small")
# Optional; must match the collection dense vector size.
_raw_embed_dim = get_env("OPENAI_EMBED_DIMENSIONS")
try:
    OPENAI_EMBED_DIMENSIONS: int | None = (
        int(_raw_embed_dim) if (_raw_embed_dim and _raw_embed_dim.strip()) else None
    )
except ValueError:
    OPENAI_EMBED_DIMENSIONS = None
MODEL_PROVIDER = get_env("MODEL_PROVIDER", "openai")

# OpenAI-compatible chat API roots: env defaults; Admin PATCH persists overrides in app_settings (same pattern for all four).
GROQ_OPENAI_BASE_URL = (get_env("GROQ_OPENAI_BASE_URL", "https://api.groq.com/openai/v1") or "https://api.groq.com/openai/v1").rstrip(
    "/"
)
OPENROUTER_OPENAI_BASE_URL = (
    get_env("OPENROUTER_OPENAI_BASE_URL", "https://openrouter.ai/api/v1") or "https://openrouter.ai/api/v1"
).rstrip("/")

# OpenAI-compatible chat base URLs (HF router + NVIDIA NIM cloud); overridable in Admin settings.
HUGGINGFACE_OPENAI_BASE_URL = (
    get_env("HUGGINGFACE_OPENAI_BASE_URL", "https://router.huggingface.co/v1") or "https://router.huggingface.co/v1"
).rstrip("/")
NVIDIA_OPENAI_BASE_URL = (
    get_env("NVIDIA_OPENAI_BASE_URL", "https://integrate.api.nvidia.com/v1") or "https://integrate.api.nvidia.com/v1"
).rstrip("/")

COMPANY_NAME = (get_env("COMPANY_NAME") or "").strip()

API_HOST = get_env("API_HOST", "0.0.0.0")
API_PORT = get_int_env("API_PORT", 8000)
API_RELOAD = get_bool_env("API_RELOAD", False)
API_CORS_ORIGINS = [
    origin.strip()
    for origin in get_env("API_CORS_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

INGEST_CHUNK_SIZE = get_int_env("INGEST_CHUNK_SIZE", 512)
INGEST_CHUNK_OVERLAP = get_int_env("INGEST_CHUNK_OVERLAP", 64)

DATABASE_URL = get_env(
    "DATABASE_URL",
    "postgresql+psycopg2://rag:rag@localhost:5432/rag_deep_agent",
)
JWT_SECRET = get_env("JWT_SECRET", "change-me-in-production-use-long-random-string")
JWT_ALGORITHM = (get_env("JWT_ALGORITHM", "HS256") or "HS256").strip()
JWT_EXPIRE_MINUTES = get_int_env("JWT_EXPIRE_MINUTES", 60 * 24)

SETTINGS_SECRET_KEY = get_env("SETTINGS_SECRET_KEY", "")

REQUIRE_AUTH = get_env("REQUIRE_AUTH", "false").lower() in ("1", "true", "yes")

INITIAL_ADMIN_EMAIL = get_env("INITIAL_ADMIN_EMAIL")
INITIAL_ADMIN_PASSWORD = get_env("INITIAL_ADMIN_PASSWORD")

# Base URL of the web app (for password-reset links in email). No trailing slash.
PUBLIC_APP_URL = (get_env("PUBLIC_APP_URL", "http://localhost:5173") or "http://localhost:5173").rstrip("/")

CHUNK_SIZE_MIN = get_int_env("CHUNK_SIZE_MIN", 128)
CHUNK_SIZE_MAX = get_int_env("CHUNK_SIZE_MAX", 4096)

APP_LOG_FILE = _env_nonempty("APP_LOG_FILE", str(PROJECT_ROOT / "logs" / "app.log"))

LANGCHAIN_TRACING_V2 = get_env("LANGCHAIN_TRACING_V2", "false").lower() in ("1", "true", "yes")
LANGCHAIN_API_KEY = get_env("LANGCHAIN_API_KEY")
LANGCHAIN_PROJECT = get_env("LANGCHAIN_PROJECT", "rag-deep-agent")
LANGCHAIN_ENDPOINT = get_env("LANGCHAIN_ENDPOINT", "https://api.smith.langchain.com")
LANGSMITH_WORKSPACE_ID = get_env("LANGSMITH_WORKSPACE_ID")

# --- Runtime mode (hardening) ---
# ``production`` enables strict startup checks (JWT / settings secrets). Anything else = non-production.
APP_ENV = (get_env("APP_ENV", "development") or "development").strip().lower()
# Ephemeral chat without a user (burns LLM quota). Off by default; enable only for local demos.
ALLOW_ANONYMOUS_CHAT = get_bool_env("ALLOW_ANONYMOUS_CHAT", False)

# Per-IP rate limits (slowapi; tune via env for your ingress / user base)
RATE_LIMIT_DEFAULT_PER_MINUTE = get_int_env("RATE_LIMIT_DEFAULT_PER_MINUTE", 120)
RATE_LIMIT_LOGIN_PER_MINUTE = get_int_env("RATE_LIMIT_LOGIN_PER_MINUTE", 30)
RATE_LIMIT_AUTH_PUBLIC_PER_MINUTE = get_int_env("RATE_LIMIT_AUTH_PUBLIC_PER_MINUTE", 12)
RATE_LIMIT_CHAT_STREAM_PER_MINUTE = get_int_env("RATE_LIMIT_CHAT_STREAM_PER_MINUTE", 40)
# Bucket for JWT role=admin; set very high so admins are not throttled in normal use.
RATE_LIMIT_ADMIN_PER_MINUTE = get_int_env("RATE_LIMIT_ADMIN_PER_MINUTE", 999_999)
