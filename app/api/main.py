from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.api.routers import auth, chat, documents, health, me, personas, settings
from app.config import (
    API_CORS_ORIGINS,
    API_HOST,
    API_PORT,
    API_RELOAD,
    APP_ENV,
    JWT_SECRET,
    SETTINGS_SECRET_KEY,
)
from app.db.session import SessionLocal
from app.logging_config import setup_file_logging
from app.production import validate_production_environment
from app.rate_limit import limiter

setup_file_logging()


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.bootstrap import ensure_initial_admin

    validate_production_environment(
        app_env=APP_ENV,
        jwt_secret=JWT_SECRET,
        settings_secret_key=SETTINGS_SECRET_KEY or "",
    )
    db = SessionLocal()
    try:
        ensure_initial_admin(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="RagWise API",
    version="0.2.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=API_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    expose_headers=["Retry-After"],
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
