"""Shared pytest fixtures."""

from __future__ import annotations

import os
from pathlib import Path

# Apply before any ``app`` import so ``app.config`` / ``app.rate_limit`` see test-friendly values.
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("JWT_SECRET", "pytest-jwt-secret-value-minimum-thirty-two-chars")
os.environ.setdefault("SETTINGS_SECRET_KEY", "pytest-settings-secret-minimum-thirty-two-chars")
os.environ["RATE_LIMIT_DEFAULT_PER_MINUTE"] = "100000"
os.environ["RATE_LIMIT_LOGIN_PER_MINUTE"] = "100000"
os.environ["RATE_LIMIT_AUTH_PUBLIC_PER_MINUTE"] = "100000"
os.environ["RATE_LIMIT_CHAT_STREAM_PER_MINUTE"] = "100000"

import pytest


@pytest.fixture(scope="session")
def fixtures_dir() -> Path:
    return Path(__file__).resolve().parent / "fixtures"
