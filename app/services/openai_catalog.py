"""OpenAI model id lists for the admin UI."""

MODEL_PROVIDER_OPTIONS: tuple[str, ...] = ("openai",)

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

OPENAI_EMBED_MODEL_OPTIONS: tuple[str, ...] = (
    "text-embedding-3-small",
    "text-embedding-3-large",
    "text-embedding-ada-002",
)
