"""Curated lists for admin UI. DB-stored values may be any string OpenAI supports."""

# Providers the app stack is wired for (LangChain OpenAI). Extend when adding Azure, etc.
MODEL_PROVIDER_OPTIONS: tuple[str, ...] = ("openai",)

# Common chat / reasoning models (IDs as used in OpenAI API)
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

# Embedding models for ingestion / retrieval
OPENAI_EMBED_MODEL_OPTIONS: tuple[str, ...] = (
    "text-embedding-3-small",
    "text-embedding-3-large",
    "text-embedding-ada-002",
)
