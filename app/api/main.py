from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from app.api.routers import auth, chat, documents, health, me, personas, settings
from app.config import API_CORS_ORIGINS, API_HOST, API_PORT, API_RELOAD
from app.db.session import SessionLocal
from app.logging_config import setup_file_logging


setup_file_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.bootstrap import ensure_initial_admin

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
app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(me.router, prefix="/api")
app.include_router(personas.router, prefix="/api")
app.include_router(settings.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(chat.router, prefix="/api")


def main() -> None:
    uvicorn.run("app.api.main:app", host=API_HOST, port=API_PORT, reload=API_RELOAD)


if __name__ == "__main__":
    main()
