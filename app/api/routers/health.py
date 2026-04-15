from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from app.api.schemas import HealthResponse
from app.config import REDIS_URL
from app.db.qdrant import QdrantStore
from app.db.session import SessionLocal

router = APIRouter(prefix="/health", tags=["health"])


def _check_database() -> str:
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
    finally:
        db.close()
    return "ok"


def _check_redis() -> str:
    from redis import Redis

    client = Redis.from_url(REDIS_URL)
    client.ping()
    client.close()
    return "ok"


def _check_qdrant() -> str:
    store = QdrantStore()
    store.client.get_collections()
    return "ok"


@router.get("", response_model=HealthResponse)
def health_check() -> HealthResponse:
    checks: dict[str, str] = {}
    failures: list[str] = []

    for name, check in (
        ("database", _check_database),
        ("redis", _check_redis),
        ("qdrant", _check_qdrant),
    ):
        try:
            checks[name] = check()
        except Exception as exc:
            checks[name] = f"error: {exc}"
            failures.append(name)

    if failures:
        raise HTTPException(
            status_code=503,
            detail=HealthResponse(status="degraded", checks=checks).model_dump(),
        )
    return HealthResponse(status="ok", checks=checks)
