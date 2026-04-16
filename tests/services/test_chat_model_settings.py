"""Unit tests for ``app.services.chat_model_settings``."""

from __future__ import annotations

import pytest

from app.services.chat_model_settings import (
    aliases_from_json_value,
    normalize_aliases_for_storage,
    resolve_default_with_aliases,
)
from app.services.openai_catalog import MODEL_PROVIDER_OPTIONS


def test_model_provider_options_matches_admin_ui_contract() -> None:
    assert MODEL_PROVIDER_OPTIONS == ("openai", "groq", "openrouter", "huggingface", "nvidia")


def test_aliases_from_json_drops_invalid_and_dedupes() -> None:
    raw = """
    [
      {"alias": "b", "provider": "openai", "model_id": "gpt-4.1-mini"},
      {"alias": "B", "provider": "groq", "model_id": "x"},
      {"alias": "bad", "provider": "unknown", "model_id": "m"},
      "not-a-dict",
      {"alias": "", "provider": "openai", "model_id": "m"}
    ]
    """
    rows = aliases_from_json_value(raw)
    assert [r["alias"] for r in rows] == ["b"]
    assert rows[0]["provider"] == "openai"


def test_normalize_aliases_for_storage_sorts_and_dedupes() -> None:
    items = [
        {"alias": "z", "provider": "openai", "model_id": "m1"},
        {"alias": "a", "provider": "groq", "model_id": "m2"},
        {"alias": "A", "provider": "openai", "model_id": "ignored"},
    ]
    out = normalize_aliases_for_storage(items)
    assert [r["alias"] for r in out] == ["a", "z"]


def test_normalize_aliases_rejects_bad_provider() -> None:
    with pytest.raises(ValueError, match="Invalid provider"):
        normalize_aliases_for_storage([{"alias": "x", "provider": "acme", "model_id": "m"}])


def test_resolve_default_with_alias_slug() -> None:
    aliases = [{"alias": "fast", "provider": "groq", "model_id": "llama-3.3-70b-versatile"}]
    p, m = resolve_default_with_aliases(aliases, provider="openai", stored_default_chat_model="fast")
    assert p == "groq"
    assert m == "llama-3.3-70b-versatile"


def test_resolve_default_without_alias() -> None:
    aliases = [{"alias": "fast", "provider": "groq", "model_id": "x"}]
    p, m = resolve_default_with_aliases(aliases, provider="openai", stored_default_chat_model="gpt-4.1-mini")
    assert p == "openai"
    assert m == "gpt-4.1-mini"


def test_resolve_default_grok_maps_to_groq() -> None:
    p, m = resolve_default_with_aliases([], provider="grok", stored_default_chat_model="grok-3")
    assert p == "groq"
    assert m == "grok-3"
