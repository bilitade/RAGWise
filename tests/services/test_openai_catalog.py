"""Embed model catalog helpers."""

from __future__ import annotations

from app.services.openai_catalog import openai_embedding_model_args, resolve_embed_model_id


def test_resolve_embed_model_id_openai_route() -> None:
    assert resolve_embed_model_id("openai/text-embedding-3-small", "openai") == "text-embedding-3-small"
    assert resolve_embed_model_id("text-embedding-3-small", "openai") == "text-embedding-3-small"


def test_resolve_embed_model_id_openrouter_route() -> None:
    assert resolve_embed_model_id("text-embedding-3-small", "openrouter") == "openai/text-embedding-3-small"
    assert resolve_embed_model_id("openai/text-embedding-3-large", "openrouter") == "openai/text-embedding-3-large"


def test_openai_embedding_model_args_openrouter() -> None:
    args = openai_embedding_model_args("text-embedding-3-small", "openrouter")
    assert args == {"model": "text-embedding-3-small", "model_name": "openai/text-embedding-3-small"}


def test_openai_embedding_model_args_openai() -> None:
    args = openai_embedding_model_args("text-embedding-3-small", "openai")
    assert args == {"model": "text-embedding-3-small"}


def test_openai_embedding_model_args_openrouter_only_model() -> None:
    args = openai_embedding_model_args("qwen/qwen3-embedding-0.6b", "openrouter")
    assert args == {"model": "text-embedding-3-small", "model_name": "qwen/qwen3-embedding-0.6b"}


def test_openai_embedding_constructible_for_openrouter() -> None:
    from llama_index.embeddings.openai import OpenAIEmbedding

    OpenAIEmbedding(
        api_key="test-key",
        api_base="https://openrouter.ai/api/v1",
        **openai_embedding_model_args("openai/text-embedding-3-small", "openrouter"),
    )
