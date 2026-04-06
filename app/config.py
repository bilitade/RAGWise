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


load_env()

UPLOAD_DIR = Path(get_env("DOCUMENTS_DIR", str(PROJECT_ROOT / "upload")))

QDRANT_URL = get_env("QDRANT_URL", "http://localhost:6333")
QDRANT_COLLECTION = get_env("QDRANT_COLLECTION", "knowledge_base")
QDRANT_API_KEY = get_env("QDRANT_API_KEY")
QDRANT_TIMEOUT = get_float_env("QDRANT_TIMEOUT", 10.0)
BM25_CACHE_PATH = DB_DIR / f"{QDRANT_COLLECTION}_nodes.jsonl"

REDIS_URL = get_env("REDIS_URL", "redis://localhost:6379/0")
CELERY_BROKER_URL = get_env("CELERY_BROKER_URL", REDIS_URL)
CELERY_RESULT_BACKEND = get_env("CELERY_RESULT_BACKEND", REDIS_URL)

OPENAI_MODEL = get_env("OPENAI_MODEL", "gpt-4.1-mini")
OPENAI_EMBED_MODEL = get_env("OPENAI_EMBED_MODEL", "text-embedding-3-small")

API_HOST = get_env("API_HOST", "0.0.0.0")
API_PORT = get_int_env("API_PORT", 8000)
API_CORS_ORIGINS = [
    origin.strip()
    for origin in get_env("API_CORS_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

INGEST_CHUNK_SIZE = get_int_env("INGEST_CHUNK_SIZE", 512)
INGEST_CHUNK_OVERLAP = get_int_env("INGEST_CHUNK_OVERLAP", 64)
