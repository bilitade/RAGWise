"""Load OpenAI / model settings from DB with env fallback; sync to os.environ for existing code paths."""

from __future__ import annotations

import os

from sqlalchemy.orm import Session

from app.config import OPENAI_EMBED_MODEL, OPENAI_MODEL
from app.core.crypto import decrypt_secret
from app.db.models import AppSetting

KEY_OPENAI_API_KEY = "openai_api_key"
KEY_DEFAULT_CHAT_MODEL = "default_chat_model"
KEY_DEFAULT_EMBED_MODEL = "default_embed_model"
KEY_MODEL_PROVIDER = "model_provider"


def _read_row(db: Session, key: str) -> AppSetting | None:
    return db.get(AppSetting, key)


def load_openai_api_key(db: Session) -> str | None:
    row = _read_row(db, KEY_OPENAI_API_KEY)
    if row and row.value:
        try:
            return decrypt_secret(row.value)
        except Exception:
            return None
    return os.environ.get("OPENAI_API_KEY")


def load_default_chat_model(db: Session) -> str:
    row = _read_row(db, KEY_DEFAULT_CHAT_MODEL)
    if row and row.value.strip():
        return row.value.strip()
    return OPENAI_MODEL or "gpt-4.1-mini"


def load_default_embed_model(db: Session) -> str:
    row = _read_row(db, KEY_DEFAULT_EMBED_MODEL)
    if row and row.value.strip():
        return row.value.strip()
    return OPENAI_EMBED_MODEL or "text-embedding-3-small"


def load_model_provider(db: Session) -> str:
    row = _read_row(db, KEY_MODEL_PROVIDER)
    if row and row.value.strip():
        return row.value.strip()
    return "openai"


def apply_openai_env_from_db(db: Session) -> None:
    """Set OPENAI_API_KEY and model env vars for LlamaIndex / LangChain in this process."""
    key = load_openai_api_key(db)
    if key:
        os.environ["OPENAI_API_KEY"] = key
    os.environ["OPENAI_MODEL"] = load_default_chat_model(db)
    os.environ["OPENAI_EMBED_MODEL"] = load_default_embed_model(db)
