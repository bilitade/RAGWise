"""Runtime model settings loaded from DB with env/config fallbacks."""

from __future__ import annotations

from dataclasses import dataclass
import os
from typing import Any

from sqlalchemy.orm import Session

from app.config import (
    MODEL_PROVIDER,
    OPENAI_EMBED_DIMENSIONS,
    OPENAI_EMBED_MODEL,
    OPENAI_MODEL,
    RAGAS_EVAL_MODEL,
)
from app.core.crypto import decrypt_secret
from app.db.models import AppSetting

KEY_OPENAI_API_KEY = "openai_api_key"
KEY_DEFAULT_CHAT_MODEL = "default_chat_model"
KEY_DEFAULT_EMBED_MODEL = "default_embed_model"
KEY_MODEL_PROVIDER = "model_provider"


@dataclass(frozen=True)
class RuntimeModelConfig:
    provider: str
    chat_model: str
    embed_model: str
    eval_model: str
    openai_api_key: str | None
    embed_dimensions: int | None = None

    def chat_openai_kwargs(
        self,
        *,
        model: str | None = None,
        streaming: bool | None = None,
        temperature: float | None = None,
    ) -> dict[str, Any]:
        kwargs: dict[str, Any] = {"model": model or self.chat_model}
        if self.openai_api_key:
            kwargs["api_key"] = self.openai_api_key
        if streaming is not None:
            kwargs["streaming"] = streaming
        if temperature is not None:
            kwargs["temperature"] = temperature
        return kwargs

    def embed_model_kwargs(self) -> dict[str, Any]:
        kwargs: dict[str, Any] = {"model": self.embed_model}
        if self.openai_api_key:
            kwargs["api_key"] = self.openai_api_key
        if self.embed_dimensions is not None:
            kwargs["dimensions"] = self.embed_dimensions
        return kwargs

    def as_task_payload(self) -> dict[str, Any]:
        return {
            "provider": self.provider,
            "chat_model": self.chat_model,
            "embed_model": self.embed_model,
            "eval_model": self.eval_model,
            "openai_api_key": self.openai_api_key,
            "embed_dimensions": self.embed_dimensions,
        }

    @classmethod
    def from_task_payload(cls, payload: dict[str, Any] | None) -> RuntimeModelConfig | None:
        if not payload:
            return None
        return cls(
            provider=str(payload.get("provider") or MODEL_PROVIDER or "openai").strip(),
            chat_model=str(payload.get("chat_model") or OPENAI_MODEL or "gpt-4.1-mini").strip(),
            embed_model=str(payload.get("embed_model") or OPENAI_EMBED_MODEL or "text-embedding-3-small").strip(),
            eval_model=str(payload.get("eval_model") or RAGAS_EVAL_MODEL or OPENAI_MODEL).strip(),
            openai_api_key=_normalize_optional_string(payload.get("openai_api_key")),
            embed_dimensions=_coerce_optional_int(payload.get("embed_dimensions")),
        )


def _normalize_optional_string(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _coerce_optional_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _read_row(db: Session, key: str) -> AppSetting | None:
    return db.get(AppSetting, key)


def load_openai_api_key(db: Session | None = None) -> str | None:
    """DB secret, else process env/config."""
    if db is not None:
        row = _read_row(db, KEY_OPENAI_API_KEY)
        if row and row.value:
            try:
                plain = decrypt_secret(row.value).strip()
            except Exception:
                plain = ""
            if plain:
                return plain
    return _normalize_optional_string(os.environ.get("OPENAI_API_KEY"))


def load_default_chat_model(db: Session | None = None) -> str:
    if db is not None:
        row = _read_row(db, KEY_DEFAULT_CHAT_MODEL)
        if row and row.value.strip():
            return row.value.strip()
    return (os.environ.get("OPENAI_MODEL") or OPENAI_MODEL or "gpt-4.1-mini").strip()


def load_default_embed_model(db: Session | None = None) -> str:
    if db is not None:
        row = _read_row(db, KEY_DEFAULT_EMBED_MODEL)
        if row and row.value.strip():
            return row.value.strip()
    return (os.environ.get("OPENAI_EMBED_MODEL") or OPENAI_EMBED_MODEL or "text-embedding-3-small").strip()


def load_model_provider(db: Session | None = None) -> str:
    if db is not None:
        row = _read_row(db, KEY_MODEL_PROVIDER)
        if row and row.value.strip():
            return row.value.strip()
    return (os.environ.get("MODEL_PROVIDER") or MODEL_PROVIDER or "openai").strip()


def load_runtime_model_config(db: Session | None = None) -> RuntimeModelConfig:
    chat_model = load_default_chat_model(db)
    return RuntimeModelConfig(
        provider=load_model_provider(db),
        chat_model=chat_model,
        embed_model=load_default_embed_model(db),
        eval_model=(RAGAS_EVAL_MODEL or chat_model).strip(),
        openai_api_key=load_openai_api_key(db),
        embed_dimensions=OPENAI_EMBED_DIMENSIONS,
    )
