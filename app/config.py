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

UPLOAD_DIR = Path(get_env("DOCUMENTS_DIR", str(PROJECT_ROOT / "upload")))

QDRANT_URL = get_env("QDRANT_URL", "http://localhost:6333")
QDRANT_COLLECTION = get_env("QDRANT_COLLECTION", "knowledge_base")
QDRANT_TIMEOUT = get_float_env("QDRANT_TIMEOUT", 10.0)
BM25_CACHE_PATH = DB_DIR / f"{QDRANT_COLLECTION}_nodes.jsonl"
DOCUMENT_REGISTRY_PATH = DB_DIR / f"{QDRANT_COLLECTION}_documents.json"

REDIS_URL = get_env("REDIS_URL", "redis://localhost:6379/0")
CELERY_BROKER_URL = get_env("CELERY_BROKER_URL", REDIS_URL)
CELERY_RESULT_BACKEND = get_env("CELERY_RESULT_BACKEND", REDIS_URL)

OPENAI_MODEL = get_env("OPENAI_MODEL", "gpt-4.1-mini")
OPENAI_EMBED_MODEL = get_env("OPENAI_EMBED_MODEL", "text-embedding-3-small")
MODEL_PROVIDER = get_env("MODEL_PROVIDER", "openai")

# Optional default organization name (overridden by DB settings when set)
COMPANY_NAME = (get_env("COMPANY_NAME") or "").strip()

API_HOST = get_env("API_HOST", "0.0.0.0")
API_PORT = get_int_env("API_PORT", 8000)
# Uvicorn --reload (dev only; keep false in production)
API_RELOAD = get_bool_env("API_RELOAD", False)
API_CORS_ORIGINS = [
    origin.strip()
    for origin in get_env("API_CORS_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

INGEST_CHUNK_SIZE = get_int_env("INGEST_CHUNK_SIZE", 512)
INGEST_CHUNK_OVERLAP = get_int_env("INGEST_CHUNK_OVERLAP", 64)

# --- Production: PostgreSQL & auth ---
DATABASE_URL = get_env(
    "DATABASE_URL",
    "postgresql+psycopg2://rag:rag@localhost:5432/rag_deep_agent",
)
JWT_SECRET = get_env("JWT_SECRET", "change-me-in-production-use-long-random-string")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = get_int_env("JWT_EXPIRE_MINUTES", 60 * 24)

# Fernet key for encrypting API keys at rest (url-safe base64, 32 bytes)
SETTINGS_SECRET_KEY = get_env("SETTINGS_SECRET_KEY", "")

REQUIRE_AUTH = get_env("REQUIRE_AUTH", "false").lower() in ("1", "true", "yes")

INITIAL_ADMIN_EMAIL = get_env("INITIAL_ADMIN_EMAIL")
INITIAL_ADMIN_PASSWORD = get_env("INITIAL_ADMIN_PASSWORD")

# Rate limits (per calendar month, Redis-backed when REDIS available)
CHUNK_SIZE_MIN = get_int_env("CHUNK_SIZE_MIN", 128)
CHUNK_SIZE_MAX = get_int_env("CHUNK_SIZE_MAX", 4096)

# Structured app logs (optional path for admin tail endpoint)
APP_LOG_FILE = get_env("APP_LOG_FILE", str(PROJECT_ROOT / "logs" / "app.log"))

# LangSmith (optional tracing / cost in UI)
LANGCHAIN_TRACING_V2 = get_env("LANGCHAIN_TRACING_V2", "false").lower() in ("1", "true", "yes")
LANGCHAIN_API_KEY = get_env("LANGCHAIN_API_KEY")
LANGCHAIN_PROJECT = get_env("LANGCHAIN_PROJECT", "rag-deep-agent")
# Traces API host (LANGCHAIN_ENDPOINT); web dashboard is usually smith.langchain.com
LANGCHAIN_ENDPOINT = get_env("LANGCHAIN_ENDPOINT", "https://api.smith.langchain.com")
LANGSMITH_WORKSPACE_ID = get_env("LANGSMITH_WORKSPACE_ID")
