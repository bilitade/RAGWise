"""RuntimeModelConfig serialization."""

from __future__ import annotations

from app.services.runtime_config import RuntimeModelConfig


def _base_config_kwargs(**overrides: object) -> dict:
    defaults = {
        "provider": "openai",
        "embed_provider": "openai",
        "chat_model": "gpt-4.1-mini",
        "embed_model": "text-embedding-3-small",
        "eval_model": "gpt-4.1-mini",
        "openai_api_key": "sk-test",
        "groq_api_key": None,
        "openrouter_api_key": None,
        "huggingface_api_key": None,
        "nvidia_api_key": None,
        "tenstorrent_api_key": None,
        "groq_openai_base_url": "https://api.groq.com/openai/v1",
        "openrouter_openai_base_url": "https://openrouter.ai/api/v1",
        "huggingface_openai_base_url": "https://router.huggingface.co/v1",
        "nvidia_openai_base_url": "https://integrate.api.nvidia.com/v1",
        "tenstorrent_openai_base_url": "http://localhost:8000/v1",
        "openai_chat_base_url": "",
        "openai_embed_base_url": "",
        "qdrant_url": "http://localhost:6333",
        "qdrant_collection": "knowledge_base",
        "default_chunk_size": 512,
        "default_chunk_overlap": 64,
    }
    defaults.update(overrides)
    return defaults


def test_from_task_payload_includes_qdrant_and_provider_keys() -> None:
    cfg = RuntimeModelConfig.from_task_payload(
        {
            "provider": "groq",
            "embed_provider": "openrouter",
            "chat_model": "llama-3.3-70b-versatile",
            "embed_model": "openai/text-embedding-3-small",
            "eval_model": "gpt-4.1-mini",
            "openai_api_key": "sk-test",
            "groq_api_key": "gsk-test",
            "openrouter_api_key": "or-key",
            "huggingface_api_key": None,
            "nvidia_api_key": None,
            "groq_openai_base_url": "https://api.groq.com/openai/v1",
            "openrouter_openai_base_url": "https://openrouter.ai/api/v1",
            "huggingface_openai_base_url": "https://router.huggingface.co/v1",
            "nvidia_openai_base_url": "https://integrate.api.nvidia.com/v1",
            "openai_chat_base_url": "",
            "qdrant_url": "http://qdrant:6333",
            "qdrant_collection": "kb",
            "default_chunk_size": 1024,
            "default_chunk_overlap": 128,
            "embed_dimensions": None,
        }
    )
    assert cfg is not None
    assert cfg.provider == "groq"
    assert cfg.embed_provider == "openrouter"
    assert cfg.resolved_chat_api_key() == "gsk-test"
    assert cfg.chat_llm_base_url() == "https://api.groq.com/openai/v1"
    assert cfg.qdrant_url == "http://qdrant:6333"
    assert cfg.qdrant_collection == "kb"
    assert cfg.default_chunk_size == 1024
    assert cfg.default_chunk_overlap == 128
    payload = cfg.as_task_payload()
    assert payload["groq_api_key"] == "gsk-test"
    assert payload["embed_provider"] == "openrouter"
    assert payload["groq_openai_base_url"] == "https://api.groq.com/openai/v1"
    assert payload["openrouter_openai_base_url"] == "https://openrouter.ai/api/v1"
    assert payload["qdrant_collection"] == "kb"
    assert payload.get("openai_chat_base_url") == ""


def test_legacy_grok_payload_maps_to_groq() -> None:
    cfg = RuntimeModelConfig.from_task_payload(
        {
            "provider": "grok",
            "chat_model": "grok-3",
            "embed_model": "text-embedding-3-small",
            "eval_model": "gpt-4.1-mini",
            "openai_api_key": "sk-test",
            "grok_api_key": "legacy",
            "openrouter_api_key": None,
        }
    )
    assert cfg is not None
    assert cfg.provider == "groq"
    assert cfg.resolved_chat_api_key() == "legacy"


def test_openrouter_base_url() -> None:
    cfg = RuntimeModelConfig(**_base_config_kwargs(provider="openrouter", openrouter_api_key="or-key"))
    assert cfg.chat_llm_base_url() == "https://openrouter.ai/api/v1"
    assert cfg.resolved_chat_api_key() == "or-key"


def test_openrouter_embed_model_kwargs() -> None:
    cfg = RuntimeModelConfig(
        **_base_config_kwargs(
            embed_provider="openrouter",
            embed_model="text-embedding-3-small",
            openrouter_api_key="or-key",
        )
    )
    kwargs = cfg.embed_model_kwargs()
    assert kwargs["api_key"] == "or-key"
    assert kwargs["api_base"] == "https://openrouter.ai/api/v1"
    assert kwargs["model"] == "openai/text-embedding-3-small"


def test_openai_embed_model_kwargs_use_sdk_default() -> None:
    cfg = RuntimeModelConfig(**_base_config_kwargs(embed_provider="openai", embed_model="text-embedding-3-small"))
    kwargs = cfg.embed_model_kwargs()
    assert kwargs["api_key"] == "sk-test"
    assert "api_base" not in kwargs
    assert kwargs["model"] == "text-embedding-3-small"


def test_openrouter_embed_resolves_prefixed_model_id() -> None:
    cfg = RuntimeModelConfig(
        **_base_config_kwargs(
            embed_provider="openrouter",
            embed_model="openai/text-embedding-3-large",
            openrouter_api_key="or-key",
        )
    )
    assert cfg.embed_model_kwargs()["model"] == "openai/text-embedding-3-large"


def test_huggingface_uses_token_and_custom_base() -> None:
    cfg = RuntimeModelConfig(
        **_base_config_kwargs(
            provider="huggingface",
            chat_model="meta-llama/Meta-Llama-3.1-8B-Instruct",
            huggingface_api_key="hf_xxx",
        )
    )
    assert cfg.resolved_chat_api_key() == "hf_xxx"
    assert cfg.chat_llm_base_url() == "https://router.huggingface.co/v1"


def test_nvidia_uses_key_and_base() -> None:
    cfg = RuntimeModelConfig(
        **_base_config_kwargs(
            provider="nvidia",
            chat_model="meta/llama-3.1-8b-instruct",
            nvidia_api_key="nvapi-test",
        )
    )
    assert cfg.resolved_chat_api_key() == "nvapi-test"
    assert cfg.chat_llm_base_url() == "https://integrate.api.nvidia.com/v1"


def test_openai_provider_uses_optional_base_url() -> None:
    cfg = RuntimeModelConfig(
        **_base_config_kwargs(
            openai_chat_base_url="https://example.openai.azure.com/openai/deployments/my-deployment",
        )
    )
    assert cfg.chat_llm_base_url() == "https://example.openai.azure.com/openai/deployments/my-deployment"


def test_openai_provider_empty_base_uses_sdk_default() -> None:
    cfg = RuntimeModelConfig(**_base_config_kwargs())
    assert cfg.chat_llm_base_url() is None


def test_openai_embed_optional_base_url() -> None:
    cfg = RuntimeModelConfig(
        **_base_config_kwargs(
            embed_provider="openai",
            openai_embed_base_url="https://embed-proxy.example.com/v1",
        )
    )
    kwargs = cfg.embed_model_kwargs()
    assert kwargs["api_base"] == "https://embed-proxy.example.com/v1"
