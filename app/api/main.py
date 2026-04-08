import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from app.api.routers import auth, chat, documents, health, me, personas, settings
from app.config import API_CORS_ORIGINS, API_HOST, API_PORT, APP_LOG_FILE
from app.db.models import Base
from app.db.session import SessionLocal, engine


def _setup_logging() -> None:
    path = Path(APP_LOG_FILE)
    path.parent.mkdir(parents=True, exist_ok=True)
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    if not any(getattr(h, "baseFilename", None) == str(path.resolve()) for h in root.handlers if hasattr(h, "baseFilename")):
        fh = logging.FileHandler(path, encoding="utf-8")
        fh.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
        root.addHandler(fh)


_setup_logging()
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.bootstrap import ensure_initial_admin

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        ensure_initial_admin(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="Banking RAG API",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=API_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def apply_runtime_openai(request: Request, call_next):
    if request.url.path.startswith("/api"):
        from app.services.runtime_config import apply_openai_env_from_db

        db = SessionLocal()
        try:
            apply_openai_env_from_db(db)
        except Exception as exc:
            log.warning("Could not apply runtime OpenAI settings: %s", exc)
        finally:
            db.close()
    return await call_next(request)


app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(me.router, prefix="/api")
app.include_router(personas.router, prefix="/api")
app.include_router(settings.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(chat.router, prefix="/api")


def main() -> None:
    uvicorn.run("app.api.main:app", host=API_HOST, port=API_PORT, reload=True)


if __name__ == "__main__":
    main()
