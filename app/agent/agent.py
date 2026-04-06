import argparse
import sys
from collections.abc import Iterator
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from deepagents import create_deep_agent
from langchain_core.messages import AIMessageChunk, HumanMessage
from langchain_openai import ChatOpenAI

from app.agent.prompts import agent_system_prompt
from app.agent.tools import internet_search, knowledge_base_search
from app.config import OPENAI_MODEL


def _build_query_from_messages(messages: list[dict[str, str]] | None, query: str | None = None) -> str:
    if query:
        return query
    if not messages:
        raise ValueError("A query or chat messages are required.")

    transcript: list[str] = []
    for message in messages:
        role = message.get("role", "user").strip().capitalize()
        content = message.get("content", "").strip()
        if content:
            transcript.append(f"{role}: {content}")
    transcript.append("Answer the latest user request using the appropriate tools when needed.")
    return "\n".join(transcript)


def build_agent():
    model = ChatOpenAI(
        model=OPENAI_MODEL,
        streaming=True,
    )
    return create_deep_agent(
        name="research_agent",
        model=model,
        system_prompt=agent_system_prompt,
        tools=[knowledge_base_search, internet_search],
    )


def stream_agent_text(
    query: str | None = None,
    *,
    messages: list[dict[str, str]] | None = None,
) -> Iterator[str]:
    compiled_query = _build_query_from_messages(messages, query)
    agent = build_agent()
    for message_chunk, _metadata in agent.stream(
        {"messages": [HumanMessage(content=compiled_query)]},
        stream_mode="messages",
    ):
        if isinstance(message_chunk, AIMessageChunk) and message_chunk.content:
            yield str(message_chunk.content)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the banking deep agent.")
    parser.add_argument("--query", help="Question to ask the agent.")
    args = parser.parse_args()

    query = args.query or input("Enter your research topic: ")
    print("\n=== Streaming Response ===\n")
    streamed_text = False
    agent = build_agent()
    for message_chunk, _metadata in agent.stream(
        {"messages": [HumanMessage(content=query)]},
        stream_mode="messages",
        print_mode="updates",
    ):
        if isinstance(message_chunk, AIMessageChunk) and message_chunk.content:
            print(message_chunk.content, end="", flush=True)
            streamed_text = True

    if streamed_text:
        print()


if __name__ == "__main__":
    main()
