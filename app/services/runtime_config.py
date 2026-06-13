"""Runtime model and infrastructure settings loaded from DB with env/config fallbacks."""

from __future__ import annotations

from dataclasses import dataclass
import os
from typing import Any

from sqlalchemy.orm import Session

from app.config import (
    EMBED_PROVIDER,
    GROQ_OPENAI_BASE_URL,
    HUGGINGFACE_OPENAI_BASE_URL,
    INGEST_CHUNK_OVERLAP,
    INGEST_CHUNK_SIZE,
    MODEL_PROVIDER,
    NVIDIA_OPENAI_BASE_URL,
    OPENAI_EMBED_BASE_URL,
    OPENAI_EMBED_DIMENSIONS,
    OPENAI_EMBED_MODEL,
    OPENAI_MODEL,
    OPENROUTER_OPENAI_BASE_URL,
    QDRANT_COLLECTION,
    QDRANT_URL,
    RAGAS_EVAL_MODEL,
    TENSTORRENT_OPENAI_BASE_URL,
)
from app.core.crypto import decrypt_secret
from app.db.models import AppSetting
from app.db.qdrant import QdrantConnectionConfig, QdrantStore
from app.services.chat_model_settings import aliases_from_json_value, resolve_default_with_aliases
from app.services.openai_catalog import resolve_embed_model_id

KEY_OPENAI_API_KEY = "openai_api_key"
KEY_DEFAULT_CHAT_MODEL = "default_chat_model"
KEY_DEFAULT_EMBED_MODEL = "default_embed_model"
KEY_MODEL_PROVIDER = "model_provider"
KEY_EMBED_PROVIDER = "embed_provider"
KEY_GROQ_API_KEY = "groq_api_key"
KEY_OPENROUTER_API_KEY = "openrouter_api_key"
KEY_HUGGINGFACE_API_KEY = "huggingface_api_key"
KEY_NVIDIA_API_KEY = "nvidia_api_key"
KEY_OPENAI_CHAT_BASE_URL = "openai_chat_base_url"
KEY_GROQ_OPENAI_BASE_URL = "groq_openai_base_url"
KEY_OPENROUTER_OPENAI_BASE_URL = "openrouter_openai_base_url"
KEY_HUGGINGFACE_OPENAI_BASE_URL = "huggingface_openai_base_url"
KEY_NVIDIA_OPENAI_BASE_URL = "nvidia_openai_base_url"
KEY_TENSTORRENT_API_KEY = "tenstorrent_api_key"
KEY_TENSTORRENT_OPENAI_BASE_URL = "tenstorrent_openai_base_url"
KEY_QDRANT_URL = "qdrant_url"
KEY_QDRANT_COLLECTION = "qdrant_collection"
KEY_INGEST_CHUNK_SIZE = "ingest_chunk_size"
KEY_INGEST_CHUNK_OVERLAP = "ingest_chunk_overlap"
KEY_CHAT_MODEL_ALIASES = "chat_model_aliases"

# Legacy xAI Grok key (pre–Groq migration); not written by new code.
KEY_GROK_API_KEY = "grok_api_key"


def _normalize_chat_base_url(url: str) -> str:
    u = (url or "").strip().rstrip("/")
    if not u:
        return ""
    if not u.startswith(("http://", "https://")):
        return u
    return u


@dataclass(frozen=True)
class RuntimeModelConfig:
    provider: str
    embed_provider: str
    chat_model: str
    embed_model: str
    eval_model: str
    openai_api_key: str | None
    groq_api_key: str | None
    openrouter_api_key: str | None
    huggingface_api_key: str | None
    nvidia_api_key: str | None
    tenstorrent_api_key: str | None
    groq_openai_base_url: str
    openrouter_openai_base_url: str
    huggingface_openai_base_url: str
    nvidia_openai_base_url: str
    tenstorrent_openai_base_url: str
    openai_chat_base_url: str
    openai_embed_base_url: str
    qdrant_url: str
    qdrant_collection: str
    default_chunk_size: int
    default_chunk_overlap: int
    embed_dimensions: int | None = None

    def resolved_chat_api_key(self) -> str | None:
        p = (self.provider or "openai").strip().lower()
        if p == "groq":
            return self.groq_api_key or self.openai_api_key
        if p == "openrouter":
            return self.openrouter_api_key or self.openai_api_key
        if p == "huggingface":
            return self.huggingface_api_key
        if p == "nvidia":
            return self.nvidia_api_key
        if p == "tenstorrent":
            return self.tenstorrent_api_key
        return self.openai_api_key

    def resolved_embed_api_key(self) -> str | None:
        p = (self.embed_provider or "openai").strip().lower()
        if p == "openrouter":
            return self.openrouter_api_key or self.openai_api_key
        if p == "huggingface":
            return self.huggingface_api_key
        return self.openai_api_key

    def embed_llm_base_url(self) -> str | None:
        p = (self.embed_provider or "openai").strip().lower()
        if p == "openrouter":
            u = _normalize_chat_base_url(self.openrouter_openai_base_url)
            return u or None
        if p == "openai":
            u = _normalize_chat_base_url(self.openai_embed_base_url)
            return u or None
        return None

    def chat_llm_base_url(self) -> str | None:
        p = (self.provider or "openai").strip().lower()
        if p == "openai":
            u = _normalize_chat_base_url(self.openai_chat_base_url)
            return u or None
        if p == "groq":
            u = _normalize_chat_base_url(self.groq_openai_base_url)
            return u or None
        if p == "openrouter":
            u = _normalize_chat_base_url(self.openrouter_openai_base_url)
            return u or None
        if p == "huggingface":
            u = _normalize_chat_base_url(self.huggingface_openai_base_url)
            return u or None
        if p == "nvidia":
            u = _normalize_chat_base_url(self.nvidia_openai_base_url)
            return u or None
        if p == "tenstorrent":
            u = _normalize_chat_base_url(self.tenstorrent_openai_base_url)
            return u or None
        return None

    def qdrant_connection_config(self) -> QdrantConnectionConfig:
        return QdrantConnectionConfig(url=self.qdrant_url, collection_name=self.qdrant_collection)

    def qdrant_store(self) -> QdrantStore:
        return QdrantStore(self.qdrant_connection_config())

    def chat_openai_kwargs(
        self,
        *,
        model: str | None = None,
        streaming: bool | None = None,
        temperature: float | None = None,
    ) -> dict[str, Any]:
        kwargs: dict[str, Any] = {"model": model or self.chat_model}
        key = self.resolved_chat_api_key()
        if key:
            kwargs["api_key"] = key
        base = self.chat_llm_base_url()
        if base:
            kwargs["base_url"] = base
        if streaming is not None:
            kwargs["streaming"] = streaming
        if temperature is not None:
            kwargs["temperature"] = temperature
        return kwargs

    def embed_model_kwargs(self) -> dict[str, Any]:
        kwargs: dict[str, Any] = {
            "model": resolve_embed_model_id(self.embed_model, self.embed_provider),
        }
        key = self.resolved_embed_api_key()
        if key:
            kwargs["api_key"] = key
        base = self.embed_llm_base_url()
        if base:
            kwargs["api_base"] = base
        if self.embed_dimensions is not None:
            kwargs["dimensions"] = self.embed_dimensions
        return kwargs

    def as_task_payload(self) -> dict[str, Any]:
        return {
            "provider": self.provider,
            "embed_provider": self.embed_provider,
            "chat_model": self.chat_model,
            "embed_model": self.embed_model,
            "eval_model": self.eval_model,
            "openai_api_key": self.openai_api_key,
            "groq_api_key": self.groq_api_key,
            "openrouter_api_key": self.openrouter_api_key,
            "huggingface_api_key": self.huggingface_api_key,
            "nvidia_api_key": self.nvidia_api_key,
            "tenstorrent_api_key": self.tenstorrent_api_key,
            "groq_openai_base_url": self.groq_openai_base_url,
            "openrouter_openai_base_url": self.openrouter_openai_base_url,
            "huggingface_openai_base_url": self.huggingface_openai_base_url,
            "nvidia_openai_base_url": self.nvidia_openai_base_url,
            "tenstorrent_openai_base_url": self.tenstorrent_openai_base_url,
            "openai_chat_base_url": self.openai_chat_base_url,
            "openai_embed_base_url": self.openai_embed_base_url,
            "qdrant_url": self.qdrant_url,
            "qdrant_collection": self.qdrant_collection,
            "default_chunk_size": self.default_chunk_size,
            "default_chunk_overlap": self.default_chunk_overlap,
            "embed_dimensions": self.embed_dimensions,
        }

    @classmethod
    def from_task_payload(cls, payload: dict[str, Any] | None) -> RuntimeModelConfig | None:
        if not payload:
            return None
        raw_prov = str(payload.get("provider") or MODEL_PROVIDER or "openai").strip()
        prov = raw_prov.lower()
        if prov == "grok":
            prov = "groq"
        groq_key = _normalize_optional_string(payload.get("groq_api_key")) or _normalize_optional_string(
            payload.get("grok_api_key"),
        )
        embed_prov = str(payload.get("embed_provider") or EMBED_PROVIDER or "openai").strip().lower()
        return cls(
            provider=prov,
            embed_provider=embed_prov,
            chat_model=str(payload.get("chat_model") or OPENAI_MODEL or "gpt-4.1-mini").strip(),
            embed_model=str(payload.get("embed_model") or OPENAI_EMBED_MODEL or "text-embedding-3-small").strip(),
            eval_model=str(payload.get("eval_model") or RAGAS_EVAL_MODEL or OPENAI_MODEL).strip(),
            openai_api_key=_normalize_optional_string(payload.get("openai_api_key")),
            groq_api_key=groq_key,
            openrouter_api_key=_normalize_optional_string(payload.get("openrouter_api_key")),
            huggingface_api_key=_normalize_optional_string(payload.get("huggingface_api_key")),
            nvidia_api_key=_normalize_optional_string(payload.get("nvidia_api_key")),
            tenstorrent_api_key=_normalize_optional_string(payload.get("tenstorrent_api_key")),
            groq_openai_base_url=_normalize_chat_base_url(str(payload.get("groq_openai_base_url") or GROQ_OPENAI_BASE_URL))
            or GROQ_OPENAI_BASE_URL,
            openrouter_openai_base_url=_normalize_chat_base_url(
                str(payload.get("openrouter_openai_base_url") or OPENROUTER_OPENAI_BASE_URL),
            )
            or OPENROUTER_OPENAI_BASE_URL,
            huggingface_openai_base_url=_normalize_chat_base_url(
                str(payload.get("huggingface_openai_base_url") or HUGGINGFACE_OPENAI_BASE_URL),
            )
            or HUGGINGFACE_OPENAI_BASE_URL,
            nvidia_openai_base_url=_normalize_chat_base_url(
                str(payload.get("nvidia_openai_base_url") or NVIDIA_OPENAI_BASE_URL),
            )
            or NVIDIA_OPENAI_BASE_URL,
            tenstorrent_openai_base_url=_normalize_chat_base_url(
                str(payload.get("tenstorrent_openai_base_url") or TENSTORRENT_OPENAI_BASE_URL),
            )
            or TENSTORRENT_OPENAI_BASE_URL,
            openai_chat_base_url=_normalize_chat_base_url(str(payload.get("openai_chat_base_url") or "")),
            openai_embed_base_url=_normalize_chat_base_url(
                str(payload.get("openai_embed_base_url") or OPENAI_EMBED_BASE_URL or ""),
            ),
            qdrant_url=str(payload.get("qdrant_url") or QDRANT_URL or "http://localhost:6333").strip(),
            qdrant_collection=str(payload.get("qdrant_collection") or QDRANT_COLLECTION or "knowledge_base").strip(),
            default_chunk_size=int(payload.get("default_chunk_size") or INGEST_CHUNK_SIZE),
            default_chunk_overlap=int(payload.get("default_chunk_overlap") or INGEST_CHUNK_OVERLAP),
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


def _load_secret_key(db: Session | None, key: str, env_name: str) -> str | None:
    if db is not None:
        row = _read_row(db, key)
        if row and row.value:
            try:
                plain = decrypt_secret(row.value).strip()
            except Exception:
                plain = ""
            if plain:
                return plain
    return _normalize_optional_string(os.environ.get(env_name))


def _load_plain_setting(db: Session | None, key: str, env_name: str, default: str) -> str:
    if db is not None:
        row = _read_row(db, key)
        if row and row.value.strip():
            return _normalize_chat_base_url(row.value.strip()) or default
    env_val = os.environ.get(env_name)
    if env_val and env_val.strip():
        return _normalize_chat_base_url(env_val.strip()) or default
    return _normalize_chat_base_url(default) or default


def load_openai_api_key(db: Session | None = None) -> str | None:
    """OpenAI API key (chat when provider is OpenAI, embeddings for all paths that use OpenAIEmbedding)."""
    return _load_secret_key(db, KEY_OPENAI_API_KEY, "OPENAI_API_KEY")


def load_openai_chat_base_url(db: Session | None = None) -> str:
    """Optional OpenAI-compatible chat base URL (Azure OpenAI, proxies). Empty = SDK default."""
    if db is not None:
        row = _read_row(db, KEY_OPENAI_CHAT_BASE_URL)
        if row and row.value and str(row.value).strip():
            return _normalize_chat_base_url(str(row.value).strip()) or ""
    for env_name in ("OPENAI_API_BASE_URL", "OPENAI_BASE_URL"):
        env_val = os.environ.get(env_name)
        if env_val and env_val.strip():
            return _normalize_chat_base_url(env_val.strip()) or ""
    return ""


def load_groq_api_key(db: Session | None = None) -> str | None:
    key = _load_secret_key(db, KEY_GROQ_API_KEY, "GROQ_API_KEY")
    if key:
        return key
    # One-time read of legacy DB row if migration not applied yet.
    return _load_secret_key(db, KEY_GROK_API_KEY, "GROK_API_KEY")


def load_openrouter_api_key(db: Session | None = None) -> str | None:
    return _load_secret_key(db, KEY_OPENROUTER_API_KEY, "OPENROUTER_API_KEY")


def load_huggingface_api_key(db: Session | None = None) -> str | None:
    if db is not None:
        row = _read_row(db, KEY_HUGGINGFACE_API_KEY)
        if row and row.value:
            try:
                plain = decrypt_secret(row.value).strip()
            except Exception:
                plain = ""
            if plain:
                return plain
    return _normalize_optional_string(os.environ.get("HF_TOKEN")) or _normalize_optional_string(
        os.environ.get("HUGGINGFACE_API_KEY"),
    )


def load_nvidia_api_key(db: Session | None = None) -> str | None:
    return _load_secret_key(db, KEY_NVIDIA_API_KEY, "NVIDIA_API_KEY")


def load_huggingface_openai_base_url(db: Session | None = None) -> str:
    return _load_plain_setting(db, KEY_HUGGINGFACE_OPENAI_BASE_URL, "HUGGINGFACE_OPENAI_BASE_URL", HUGGINGFACE_OPENAI_BASE_URL)


def load_nvidia_openai_base_url(db: Session | None = None) -> str:
    return _load_plain_setting(db, KEY_NVIDIA_OPENAI_BASE_URL, "NVIDIA_OPENAI_BASE_URL", NVIDIA_OPENAI_BASE_URL)


def load_tenstorrent_api_key(db: Session | None = None) -> str | None:
    return _load_secret_key(db, KEY_TENSTORRENT_API_KEY, "TENSTORRENT_API_KEY")


def load_tenstorrent_openai_base_url(db: Session | None = None) -> str:
    return _load_plain_setting(
        db, KEY_TENSTORRENT_OPENAI_BASE_URL, "TENSTORRENT_OPENAI_BASE_URL", TENSTORRENT_OPENAI_BASE_URL
    )


def load_groq_openai_base_url(db: Session | None = None) -> str:
    return _load_plain_setting(db, KEY_GROQ_OPENAI_BASE_URL, "GROQ_OPENAI_BASE_URL", GROQ_OPENAI_BASE_URL)


def load_openrouter_openai_base_url(db: Session | None = None) -> str:
    return _load_plain_setting(db, KEY_OPENROUTER_OPENAI_BASE_URL, "OPENROUTER_OPENAI_BASE_URL", OPENROUTER_OPENAI_BASE_URL)


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


def load_embed_provider(db: Session | None = None) -> str:
    if db is not None:
        row = _read_row(db, KEY_EMBED_PROVIDER)
        if row and row.value.strip():
            return row.value.strip().lower()
    return (os.environ.get("EMBED_PROVIDER") or EMBED_PROVIDER or "openai").strip().lower()


def load_openai_embed_base_url(db: Session | None = None) -> str:
    """Optional OpenAI-compatible embeddings base URL (Azure, proxies). Empty = SDK default."""
    _ = db
    env_val = os.environ.get("OPENAI_EMBED_BASE_URL")
    if env_val and env_val.strip():
        return _normalize_chat_base_url(env_val.strip()) or ""
    if OPENAI_EMBED_BASE_URL:
        return OPENAI_EMBED_BASE_URL
    return ""


def load_model_provider(db: Session | None = None) -> str:
    if db is not None:
        row = _read_row(db, KEY_MODEL_PROVIDER)
        if row and row.value.strip():
            v = row.value.strip().lower()
            if v == "grok":
                return "groq"
            return row.value.strip()
    raw = (os.environ.get("MODEL_PROVIDER") or MODEL_PROVIDER or "openai").strip()
    return "groq" if raw.lower() == "grok" else raw


def load_qdrant_url(db: Session | None = None) -> str:
    if db is not None:
        row = _read_row(db, KEY_QDRANT_URL)
        if row and row.value.strip():
            return row.value.strip()
    return (os.environ.get("QDRANT_URL") or QDRANT_URL or "http://localhost:6333").strip()


def load_qdrant_collection(db: Session | None = None) -> str:
    if db is not None:
        row = _read_row(db, KEY_QDRANT_COLLECTION)
        if row and row.value.strip():
            return row.value.strip()
    return (os.environ.get("QDRANT_COLLECTION") or QDRANT_COLLECTION or "knowledge_base").strip()


def load_default_chunk_size(db: Session | None = None) -> int:
    if db is not None:
        row = _read_row(db, KEY_INGEST_CHUNK_SIZE)
        if row and row.value.strip():
            try:
                return int(row.value.strip())
            except ValueError:
                pass
    return INGEST_CHUNK_SIZE


def load_default_chunk_overlap(db: Session | None = None) -> int:
    if db is not None:
        row = _read_row(db, KEY_INGEST_CHUNK_OVERLAP)
        if row and row.value.strip():
            try:
                return int(row.value.strip())
            except ValueError:
                pass
    return INGEST_CHUNK_OVERLAP


def load_chat_model_aliases(db: Session | None) -> list[dict[str, str]]:
    if db is None:
        return []
    row = _read_row(db, KEY_CHAT_MODEL_ALIASES)
    if not row or not row.value.strip():
        return []
    return aliases_from_json_value(row.value)


def resolve_chat_via_aliases(
    aliases: list[dict[str, str]],
    *,
    provider: str,
    chat_model: str,
) -> tuple[str, str]:
    return resolve_default_with_aliases(aliases, provider=provider, stored_default_chat_model=chat_model)


def load_runtime_model_config(db: Session | None = None) -> RuntimeModelConfig:
    aliases = load_chat_model_aliases(db)
    provider = load_model_provider(db)
    chat_model = load_default_chat_model(db)
    provider, chat_model = resolve_chat_via_aliases(aliases, provider=provider, chat_model=chat_model)
    return RuntimeModelConfig(
        provider=provider,
        embed_provider=load_embed_provider(db),
        chat_model=chat_model,
        embed_model=load_default_embed_model(db),
        eval_model=(RAGAS_EVAL_MODEL or chat_model).strip(),
        openai_api_key=load_openai_api_key(db),
        groq_api_key=load_groq_api_key(db),
        openrouter_api_key=load_openrouter_api_key(db),
        huggingface_api_key=load_huggingface_api_key(db),
        nvidia_api_key=load_nvidia_api_key(db),
        tenstorrent_api_key=load_tenstorrent_api_key(db),
        groq_openai_base_url=load_groq_openai_base_url(db),
        openrouter_openai_base_url=load_openrouter_openai_base_url(db),
        huggingface_openai_base_url=load_huggingface_openai_base_url(db),
        nvidia_openai_base_url=load_nvidia_openai_base_url(db),
        tenstorrent_openai_base_url=load_tenstorrent_openai_base_url(db),
        openai_chat_base_url=load_openai_chat_base_url(db),
        openai_embed_base_url=load_openai_embed_base_url(db),
        qdrant_url=load_qdrant_url(db),
        qdrant_collection=load_qdrant_collection(db),
        default_chunk_size=load_default_chunk_size(db),
        default_chunk_overlap=load_default_chunk_overlap(db),
        embed_dimensions=OPENAI_EMBED_DIMENSIONS,
    )


def qdrant_store_from_runtime(runtime_config: RuntimeModelConfig | None) -> QdrantStore:
    if runtime_config is not None:
        return runtime_config.qdrant_store()
    return QdrantStore()
