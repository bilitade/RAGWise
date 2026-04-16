"""HTTP rate limits (slowapi). Admins use a separate bucket with a very high limit."""

from __future__ import annotations

from jose import JWTError
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

from app.config import (
    RATE_LIMIT_ADMIN_PER_MINUTE,
    RATE_LIMIT_AUTH_PUBLIC_PER_MINUTE,
    RATE_LIMIT_CHAT_STREAM_PER_MINUTE,
    RATE_LIMIT_DEFAULT_PER_MINUTE,
    RATE_LIMIT_LOGIN_PER_MINUTE,
)
from app.core.security import decode_token
from app.db.models import UserRole


def rate_limit_identity(request: Request) -> str:
    """Prefer per-admin buckets (no practical throttle); otherwise limit by client IP."""
    auth = (request.headers.get("authorization") or "").strip()
    if auth.lower().startswith("bearer "):
        raw = auth[7:].strip()
        if raw:
            try:
                claims = decode_token(raw)
                if claims.get("role") == UserRole.admin.value:
                    sub = (claims.get("sub") or "").strip()
                    return f"admin:{sub}" if sub else "admin:unknown"
            except JWTError:
                pass
    return get_remote_address(request)


def default_limit_for_key(key: str) -> str:
    if str(key).startswith("admin:"):
        return f"{RATE_LIMIT_ADMIN_PER_MINUTE}/minute"
    return f"{RATE_LIMIT_DEFAULT_PER_MINUTE}/minute"


def chat_stream_limit_for_key(key: str) -> str:
    if str(key).startswith("admin:"):
        return f"{RATE_LIMIT_ADMIN_PER_MINUTE}/minute"
    return f"{RATE_LIMIT_CHAT_STREAM_PER_MINUTE}/minute"


limiter = Limiter(
    key_func=rate_limit_identity,
    default_limits=[default_limit_for_key],
    headers_enabled=True,
)

LOGIN_LIMIT = f"{RATE_LIMIT_LOGIN_PER_MINUTE}/minute"
AUTH_PUBLIC_LIMIT = f"{RATE_LIMIT_AUTH_PUBLIC_PER_MINUTE}/minute"
