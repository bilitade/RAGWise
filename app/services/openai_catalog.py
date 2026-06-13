"""Model id lists and provider registry for the admin UI (OpenAI-compatible chat)."""

MODEL_PROVIDER_OPTIONS: tuple[str, ...] = ("openai", "groq", "openrouter", "huggingface", "nvidia", "tenstorrent")

OPENAI_CHAT_MODEL_OPTIONS: tuple[str, ...] = (
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "gpt-4-turbo-preview",
    "gpt-3.5-turbo",
    "o1",
    "o1-mini",
    "o3-mini",
)

# Groq OpenAI-compatible API — curated ids (see https://console.groq.com/docs/models); any id can be typed in Admin UI.
GROQ_CHAT_MODEL_OPTIONS: tuple[str, ...] = (
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "llama-3.1-70b-versatile",
    "llama-3.1-8b-instant",
    "llama3-70b-8192",
    "llama3-8b-8192",
    "llama-guard-3-8b",
    "mixtral-8x7b-32768",
    "gemma2-9b-it",
    "qwen/qwen-2.5-32b-instruct",
    "qwen/qwen-2.5-72b-instruct",
    "deepseek-r1-distill-llama-70b",
)

OPENROUTER_CHAT_MODEL_OPTIONS: tuple[str, ...] = (
    "openai/gpt-4.1-mini",
    "openai/gpt-4.1",
    "openai/gpt-4o-mini",
    "openai/gpt-4o",
    "openai/o3-mini",
    "anthropic/claude-3.5-sonnet",
    "anthropic/claude-3.5-haiku",
    "anthropic/claude-3-opus",
    "google/gemini-2.0-flash-001",
    "google/gemini-flash-1.5",
    "google/gemini-pro-1.5",
    "meta-llama/llama-3.3-70b-instruct",
    "meta-llama/llama-3.1-70b-instruct",
    "meta-llama/llama-3.1-8b-instruct",
    "mistralai/mistral-large",
    "mistralai/mixtral-8x7b-instruct",
    "mistralai/mixtral-8x22b-instruct",
    "deepseek/deepseek-chat",
    "deepseek/deepseek-r1",
    "qwen/qwen-2.5-72b-instruct",
    "cohere/command-r-plus",
    "perplexity/llama-3.1-sonar-large-128k-online",
)

# Hugging Face Inference Providers (OpenAI-compatible router). Model strings are HF repo ids or id:policy.
HUGGINGFACE_CHAT_MODEL_OPTIONS: tuple[str, ...] = (
    "meta-llama/Meta-Llama-3.1-8B-Instruct",
    "meta-llama/Meta-Llama-3.1-70B-Instruct",
    "meta-llama/Meta-Llama-3.1-405B-Instruct",
    "Qwen/Qwen2.5-72B-Instruct",
    "Qwen/Qwen2.5-32B-Instruct",
    "Qwen/Qwen2.5-7B-Instruct",
    "mistralai/Mistral-Small-24B-Instruct-2501",
    "mistralai/Mistral-Nemo-Instruct-2407",
    "deepseek-ai/DeepSeek-V3",
    "deepseek-ai/DeepSeek-R1",
    "deepseek-ai/DeepSeek-R1-Distill-Llama-70B",
    "google/gemma-2-27b-it",
    "google/gemma-2-9b-it",
    "microsoft/Phi-3.5-mini-instruct",
    "HuggingFaceH4/zephyr-7b-beta",
    "meta-llama/Llama-3.2-3B-Instruct",
    "meta-llama/Llama-3.2-11B-Vision-Instruct",
    "meta-llama/Llama-3.2-90B-Vision-Instruct",
    "Qwen/Qwen2.5-Coder-32B-Instruct",
    "mistralai/Mixtral-8x7B-Instruct-v0.1",
    "mistralai/Mixtral-8x22B-Instruct-v0.1",
    "deepseek-ai/DeepSeek-R1:fastest",
    "meta-llama/Meta-Llama-3.1-8B-Instruct:fastest",
)

# NVIDIA NIM cloud (integrate.api.nvidia.com) — common chat model ids
NVIDIA_CHAT_MODEL_OPTIONS: tuple[str, ...] = (
    "meta/llama-3.1-8b-instruct",
    "meta/llama-3.1-70b-instruct",
    "meta/llama3-8b",
    "meta/llama3-70b",
    "mistralai/mixtral-8x7b-instruct",
    "mistralai/mixtral-8x22b-instruct",
    "mistralai/mistral-large",
    "mistralai/mistral-7b-instruct",
    "deepseek-ai/deepseek-r1",
    "microsoft/phi-3-mini-128k-instruct",
    "microsoft/phi-3-medium-128k-instruct",
    "google/gemma-2-9b-it",
    "google/gemma-2-27b-it",
    "nvidia/llama3-chatqa-1.5-70b",
    "nvidia/nemotron-4-340b-instruct",
    "ibm/granite-8b-code-instruct",
    "snowflake/arctic",
)

# Tenstorrent tt-inference-server (local OpenAI-compatible endpoint).
# Model ids depend on what is loaded on the server; defaults below match the demo cluster.
TENSTORRENT_CHAT_MODEL_OPTIONS: tuple[str, ...] = (
    "Qwen/Qwen2.5-VL-72B-Instruct",
    "Qwen/Qwen2.5-72B-Instruct",
    "Qwen/Qwen2.5-32B-Instruct",
    "meta-llama/Llama-3.3-70B-Instruct",
    "meta-llama/Llama-3.1-70B-Instruct",
    "meta-llama/Llama-3.1-8B-Instruct",
    "mistralai/Mistral-7B-Instruct-v0.3",
    "deepseek-ai/DeepSeek-R1-Distill-Llama-70B",
)

EMBED_PROVIDER_OPTIONS: tuple[str, ...] = ("openai", "openrouter")

OPENAI_EMBED_MODEL_OPTIONS: tuple[str, ...] = (
    "text-embedding-3-small",
    "text-embedding-3-large",
    "text-embedding-ada-002",
)

OPENROUTER_EMBED_MODEL_OPTIONS: tuple[str, ...] = (
    "openai/text-embedding-3-small",
    "openai/text-embedding-3-large",
    "openai/text-embedding-ada-002",
    "qwen/qwen3-embedding-0.6b",
)

# Same underlying OpenAI embed models — different API route ids per provider.
_EMBED_MODEL_VARIANTS: dict[str, dict[str, str]] = {
    "text-embedding-3-small": {
        "openai": "text-embedding-3-small",
        "openrouter": "openai/text-embedding-3-small",
    },
    "text-embedding-3-large": {
        "openai": "text-embedding-3-large",
        "openrouter": "openai/text-embedding-3-large",
    },
    "text-embedding-ada-002": {
        "openai": "text-embedding-ada-002",
        "openrouter": "openai/text-embedding-ada-002",
    },
}


def _canonical_embed_slug(model: str) -> str | None:
    m = (model or "").strip()
    if not m:
        return None
    for slug, variants in _EMBED_MODEL_VARIANTS.items():
        if m == slug or m in variants.values():
            return slug
    return None


def resolve_embed_model_id(model: str, provider: str) -> str:
    """Map a stored embed model id to the correct id for the active embed provider."""
    p = (provider or "openai").strip().lower()
    m = (model or "").strip()
    if not m:
        return m
    slug = _canonical_embed_slug(m)
    if slug and slug in _EMBED_MODEL_VARIANTS:
        return _EMBED_MODEL_VARIANTS[slug].get(p, m)
    if p == "openrouter" and "/" not in m:
        return f"openai/{m}"
    if p == "openai" and m.startswith("openai/"):
        return m.split("/", 1)[1]
    return m


def embed_catalog_for_provider(provider: str) -> tuple[str, ...]:
    p = (provider or "openai").strip().lower()
    if p == "openrouter":
        return OPENROUTER_EMBED_MODEL_OPTIONS
    return OPENAI_EMBED_MODEL_OPTIONS


# LlamaIndex OpenAIEmbedding validates ``model`` against a fixed enum; non-OpenAI ids use ``model_name``.
_LLAMA_INDEX_EMBED_ENUM_FALLBACK = "text-embedding-3-small"


def openai_embedding_model_args(model: str, embed_provider: str) -> dict[str, str]:
    """Map stored embed config to OpenAIEmbedding constructor args."""
    api_model = resolve_embed_model_id(model, embed_provider)
    enum_model = resolve_embed_model_id(model, "openai")
    if _canonical_embed_slug(model) is None:
        enum_model = _LLAMA_INDEX_EMBED_ENUM_FALLBACK
    args: dict[str, str] = {"model": enum_model}
    if api_model != enum_model:
        args["model_name"] = api_model
    return args
