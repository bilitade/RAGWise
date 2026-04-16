"""Startup checks when ``APP_ENV=production``."""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

_WEAK_JWT_MARKERS = (
    "change-me",
    "replace_with",
    "your_openai",
    "secret",
    "password",
    "admin@",
)


def validate_production_environment(
    *,
    app_env: str,
    jwt_secret: str,
    settings_secret_key: str,
) -> None:
    if (app_env or "").strip().lower() != "production":
        return
    if len(jwt_secret) < 32:
        raise RuntimeError(
            "APP_ENV=production requires JWT_SECRET to be at least 32 characters. "
            "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(32))\""
        )
    low = jwt_secret.lower()
    if any(m in low for m in _WEAK_JWT_MARKERS):
        raise RuntimeError(
            "APP_ENV=production: JWT_SECRET appears to use a placeholder or weak pattern. "
            "Set a long random secret."
        )
    sk = (settings_secret_key or "").strip()
    if len(sk) < 32:
        raise RuntimeError(
            "APP_ENV=production requires SETTINGS_SECRET_KEY (>= 32 chars) for encrypting API keys in the database. "
            "It must be separate from JWT_SECRET."
        )
