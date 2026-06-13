"""Embed model catalog helpers."""

from __future__ import annotations

from app.services.openai_catalog import resolve_embed_model_id


def test_resolve_embed_model_id_openai_route() -> None:
    assert resolve_embed_model_id("openai/text-embedding-3-small", "openai") == "text-embedding-3-small"
    assert resolve_embed_model_id("text-embedding-3-small", "openai") == "text-embedding-3-small"


def test_resolve_embed_model_id_openrouter_route() -> None:
    assert resolve_embed_model_id("text-embedding-3-small", "openrouter") == "openai/text-embedding-3-small"
    assert resolve_embed_model_id("openai/text-embedding-3-large", "openrouter") == "openai/text-embedding-3-large"
