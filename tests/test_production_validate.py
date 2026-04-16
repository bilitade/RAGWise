"""``app.production`` startup validation."""

from __future__ import annotations

import pytest

from app.production import validate_production_environment


def test_production_skipped_when_not_production() -> None:
    validate_production_environment(
        app_env="development",
        jwt_secret="short",
        settings_secret_key="",
    )


def test_production_rejects_short_jwt() -> None:
    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        validate_production_environment(
            app_env="production",
            jwt_secret="x" * 20,
            settings_secret_key="y" * 40,
        )


def test_production_rejects_placeholder_jwt() -> None:
    with pytest.raises(RuntimeError, match="placeholder"):
        validate_production_environment(
            app_env="production",
            jwt_secret="change-me-in-production-use-long-random-string-extra-padding-here",
            settings_secret_key="y" * 40,
        )


def test_production_requires_settings_secret() -> None:
    with pytest.raises(RuntimeError, match="SETTINGS_SECRET_KEY"):
        validate_production_environment(
            app_env="production",
            jwt_secret="a" * 40,
            settings_secret_key="short",
        )


def test_production_accepts_strong_secrets() -> None:
    validate_production_environment(
        app_env="production",
        jwt_secret="a" * 40,
        settings_secret_key="b" * 40,
    )
