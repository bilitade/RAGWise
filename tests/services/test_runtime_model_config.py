"""RuntimeModelConfig serialization."""

from __future__ import annotations

from app.services.runtime_config import RuntimeModelConfig


def test_from_task_payload_includes_qdrant_and_provider_keys() -> None:
    cfg = RuntimeModelConfig.from_task_payload(
        {
            "provider": "groq",
            "chat_model": "llama-3.3-70b-versatile",
            "embed_model": "text-embedding-3-small",
            "eval_model": "gpt-4.1-mini",
            "openai_api_key": "sk-test",
            "groq_api_key": "gsk-test",
            "openrouter_api_key": None,
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
    assert cfg.resolved_chat_api_key() == "gsk-test"
    assert cfg.chat_llm_base_url() == "https://api.groq.com/openai/v1"
    assert cfg.qdrant_url == "http://qdrant:6333"
    assert cfg.qdrant_collection == "kb"
    assert cfg.default_chunk_size == 1024
    assert cfg.default_chunk_overlap == 128
    payload = cfg.as_task_payload()
    assert payload["groq_api_key"] == "gsk-test"
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
    cfg = RuntimeModelConfig(
        provider="openrouter",
        chat_model="openai/gpt-4.1-mini",
        embed_model="text-embedding-3-small",
        eval_model="openai/gpt-4.1-mini",
        openai_api_key="sk",
        groq_api_key=None,
        openrouter_api_key="or-key",
        huggingface_api_key=None,
        nvidia_api_key=None,
        groq_openai_base_url="https://api.groq.com/openai/v1",
        openrouter_openai_base_url="https://openrouter.ai/api/v1",
        huggingface_openai_base_url="https://router.huggingface.co/v1",
        nvidia_openai_base_url="https://integrate.api.nvidia.com/v1",
        openai_chat_base_url="",
        qdrant_url="http://localhost:6333",
        qdrant_collection="knowledge_base",
        default_chunk_size=512,
        default_chunk_overlap=64,
    )
    assert cfg.chat_llm_base_url() == "https://openrouter.ai/api/v1"
    assert cfg.resolved_chat_api_key() == "or-key"


def test_huggingface_uses_token_and_custom_base() -> None:
    cfg = RuntimeModelConfig(
        provider="huggingface",
        chat_model="meta-llama/Meta-Llama-3.1-8B-Instruct",
        embed_model="text-embedding-3-small",
        eval_model="gpt-4.1-mini",
        openai_api_key="sk",
        groq_api_key=None,
        openrouter_api_key=None,
        huggingface_api_key="hf_xxx",
        nvidia_api_key=None,
        groq_openai_base_url="https://api.groq.com/openai/v1",
        openrouter_openai_base_url="https://openrouter.ai/api/v1",
        huggingface_openai_base_url="https://router.huggingface.co/v1",
        nvidia_openai_base_url="https://integrate.api.nvidia.com/v1",
        openai_chat_base_url="",
        qdrant_url="http://localhost:6333",
        qdrant_collection="knowledge_base",
        default_chunk_size=512,
        default_chunk_overlap=64,
    )
    assert cfg.resolved_chat_api_key() == "hf_xxx"
    assert cfg.chat_llm_base_url() == "https://router.huggingface.co/v1"


def test_nvidia_uses_key_and_base() -> None:
    cfg = RuntimeModelConfig(
        provider="nvidia",
        chat_model="meta/llama-3.1-8b-instruct",
        embed_model="text-embedding-3-small",
        eval_model="gpt-4.1-mini",
        openai_api_key="sk",
        groq_api_key=None,
        openrouter_api_key=None,
        huggingface_api_key=None,
        nvidia_api_key="nvapi-test",
        groq_openai_base_url="https://api.groq.com/openai/v1",
        openrouter_openai_base_url="https://openrouter.ai/api/v1",
        huggingface_openai_base_url="https://router.huggingface.co/v1",
        nvidia_openai_base_url="https://integrate.api.nvidia.com/v1",
        openai_chat_base_url="",
        qdrant_url="http://localhost:6333",
        qdrant_collection="knowledge_base",
        default_chunk_size=512,
        default_chunk_overlap=64,
    )
    assert cfg.resolved_chat_api_key() == "nvapi-test"
    assert cfg.chat_llm_base_url() == "https://integrate.api.nvidia.com/v1"


def test_openai_provider_uses_optional_base_url() -> None:
    cfg = RuntimeModelConfig(
        provider="openai",
        chat_model="gpt-4.1-mini",
        embed_model="text-embedding-3-small",
        eval_model="gpt-4.1-mini",
        openai_api_key="sk-test",
        groq_api_key=None,
        openrouter_api_key=None,
        huggingface_api_key=None,
        nvidia_api_key=None,
        groq_openai_base_url="https://api.groq.com/openai/v1",
        openrouter_openai_base_url="https://openrouter.ai/api/v1",
        huggingface_openai_base_url="https://router.huggingface.co/v1",
        nvidia_openai_base_url="https://integrate.api.nvidia.com/v1",
        openai_chat_base_url="https://example.openai.azure.com/openai/deployments/my-deployment",
        qdrant_url="http://localhost:6333",
        qdrant_collection="knowledge_base",
        default_chunk_size=512,
        default_chunk_overlap=64,
    )
    assert cfg.chat_llm_base_url() == "https://example.openai.azure.com/openai/deployments/my-deployment"


def test_openai_provider_empty_base_uses_sdk_default() -> None:
    cfg = RuntimeModelConfig(
        provider="openai",
        chat_model="gpt-4.1-mini",
        embed_model="text-embedding-3-small",
        eval_model="gpt-4.1-mini",
        openai_api_key="sk-test",
        groq_api_key=None,
        openrouter_api_key=None,
        huggingface_api_key=None,
        nvidia_api_key=None,
        groq_openai_base_url="https://api.groq.com/openai/v1",
        openrouter_openai_base_url="https://openrouter.ai/api/v1",
        huggingface_openai_base_url="https://router.huggingface.co/v1",
        nvidia_openai_base_url="https://integrate.api.nvidia.com/v1",
        openai_chat_base_url="",
        qdrant_url="http://localhost:6333",
        qdrant_collection="knowledge_base",
        default_chunk_size=512,
        default_chunk_overlap=64,
    )
    assert cfg.chat_llm_base_url() is None
