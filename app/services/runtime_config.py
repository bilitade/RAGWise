"""Load OpenAI / model settings from DB with env fallback; sync to os.environ for existing code paths."""

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
    """Prefer DB secret; on decrypt failure fall back to process env. Always strip whitespace."""
    row = _read_row(db, KEY_OPENAI_API_KEY)
    if row and row.value:
        try:
            plain = decrypt_secret(row.value).strip()
            if plain:
                return plain
        except Exception:
            # Wrong SETTINGS_SECRET_KEY or corrupt row — allow env fallback for recovery
            pass
    env_key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    return env_key or None


def load_default_chat_model(db: Session) -> str:
    """Prefer DB; else current process env; else config default from initial .env load."""
    row = _read_row(db, KEY_DEFAULT_CHAT_MODEL)
    if row and row.value.strip():
        return row.value.strip()
    return (os.environ.get("OPENAI_MODEL") or OPENAI_MODEL or "gpt-4.1-mini").strip()


def load_default_embed_model(db: Session) -> str:
    """Prefer DB; else current process env; else config default from initial .env load."""
    row = _read_row(db, KEY_DEFAULT_EMBED_MODEL)
    if row and row.value.strip():
        return row.value.strip()
    return (os.environ.get("OPENAI_EMBED_MODEL") or OPENAI_EMBED_MODEL or "text-embedding-3-small").strip()


def load_model_provider(db: Session) -> str:
    """Prefer DB; else MODEL_PROVIDER env; else openai."""
    row = _read_row(db, KEY_MODEL_PROVIDER)
    if row and row.value.strip():
        return row.value.strip()
    return (os.environ.get("MODEL_PROVIDER") or MODEL_PROVIDER or "openai").strip()


def apply_openai_env_from_db(db: Session) -> None:
    """Set OPENAI_API_KEY and model env vars for LlamaIndex / LangChain in this process.

    When no valid key is resolved, remove OPENAI_API_KEY from the environment so a
    previously loaded (e.g. expired) key cannot keep being used after the DB is updated.
    """
    key = load_openai_api_key(db)
    if key:
        os.environ["OPENAI_API_KEY"] = key
    else:
        os.environ.pop("OPENAI_API_KEY", None)
    os.environ["OPENAI_MODEL"] = load_default_chat_model(db)
    os.environ["OPENAI_EMBED_MODEL"] = load_default_embed_model(db)
    os.environ["MODEL_PROVIDER"] = load_model_provider(db)
