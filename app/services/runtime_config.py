"""Apply OpenAI settings from DB (with env fallback) to ``os.environ``."""

from __future__ import annotations

import os

from sqlalchemy.orm import Session

from app.config import MODEL_PROVIDER, OPENAI_EMBED_MODEL, OPENAI_MODEL
from app.core.crypto import decrypt_secret
from app.db.models import AppSetting

KEY_OPENAI_API_KEY = "openai_api_key"
KEY_DEFAULT_CHAT_MODEL = "default_chat_model"
KEY_DEFAULT_EMBED_MODEL = "default_embed_model"
KEY_MODEL_PROVIDER = "model_provider"


def _read_row(db: Session, key: str) -> AppSetting | None:
    return db.get(AppSetting, key)


def load_openai_api_key(db: Session) -> str | None:
    """DB secret, else env."""
    row = _read_row(db, KEY_OPENAI_API_KEY)
    if row and row.value:
        try:
            plain = decrypt_secret(row.value).strip()
            if plain:
                return plain
        except Exception:
            pass
    env_key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    return env_key or None


def load_default_chat_model(db: Session) -> str:
    """DB, then env, then config default."""
    row = _read_row(db, KEY_DEFAULT_CHAT_MODEL)
    if row and row.value.strip():
        return row.value.strip()
    return (os.environ.get("OPENAI_MODEL") or OPENAI_MODEL or "gpt-4.1-mini").strip()


def load_default_embed_model(db: Session) -> str:
    """DB, then env, then config default."""
    row = _read_row(db, KEY_DEFAULT_EMBED_MODEL)
    if row and row.value.strip():
        return row.value.strip()
    return (os.environ.get("OPENAI_EMBED_MODEL") or OPENAI_EMBED_MODEL or "text-embedding-3-small").strip()


def load_model_provider(db: Session) -> str:
    """DB, then env, then default."""
    row = _read_row(db, KEY_MODEL_PROVIDER)
    if row and row.value.strip():
        return row.value.strip()
    return (os.environ.get("MODEL_PROVIDER") or MODEL_PROVIDER or "openai").strip()


def apply_openai_env_from_db(db: Session) -> None:
    """Sync OpenAI key and model env vars from DB; drop key if unset."""
    key = load_openai_api_key(db)
    if key:
        os.environ["OPENAI_API_KEY"] = key
    else:
        os.environ.pop("OPENAI_API_KEY", None)
    os.environ["OPENAI_MODEL"] = load_default_chat_model(db)
    os.environ["OPENAI_EMBED_MODEL"] = load_default_embed_model(db)
    os.environ["MODEL_PROVIDER"] = load_model_provider(db)
