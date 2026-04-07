import argparse
import asyncio
import sys
from collections.abc import AsyncIterator, Iterator
from pathlib import Path
from typing import Any

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


def _tool_status_label(tool_name: str | None) -> str:
    normalized = (tool_name or "").strip().lower().replace("_", " ")
    if "knowledge" in normalized:
        return "Searching the knowledge base"
    if "internet" in normalized or "web" in normalized or "search" in normalized:
        return "Searching the web"
    return f"Using {tool_name or 'a tool'}"


def _extract_text_from_chunk(chunk: Any) -> str:
    content = getattr(chunk, "content", None)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict) and item.get("type") == "text" and isinstance(item.get("text"), str):
                parts.append(item["text"])
        return "".join(parts)
    return ""


async def astream_agent_events(
    query: str | None = None,
    *,
    messages: list[dict[str, str]] | None = None,
) -> AsyncIterator[dict[str, str]]:
    compiled_query = _build_query_from_messages(messages, query)
    agent = build_agent()

    yield {"type": "status", "label": "Thinking"}
    yielded_token = False
    current_status = "Thinking"

    async for event in agent.astream_events(
        {"messages": [HumanMessage(content=compiled_query)]},
        version="v2",
    ):
        event_name = str(event.get("event", ""))
        runnable_name = str(event.get("name", ""))
        event_data = event.get("data", {}) or {}

        if event_name == "on_tool_start":
            current_status = _tool_status_label(runnable_name)
            yield {"type": "status", "label": current_status}
            continue

        if event_name == "on_tool_end":
            current_status = "Reasoning over results"
            yield {"type": "status", "label": current_status}
            continue

        if event_name == "on_chat_model_start" and not yielded_token:
            current_status = "Thinking"
            yield {"type": "status", "label": current_status}
            continue

        if event_name == "on_chat_model_stream":
            chunk = event_data.get("chunk")
            text = _extract_text_from_chunk(chunk)
            if text:
                if not yielded_token:
                    yielded_token = True
                    current_status = "Drafting answer"
                    yield {"type": "status", "label": current_status}
                yield {"type": "token", "text": text}
            continue

        if event_name == "on_chain_end" and yielded_token:
            yield {"type": "status", "label": "Finalizing"}


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


def stream_agent_events(
    query: str | None = None,
    *,
    messages: list[dict[str, str]] | None = None,
) -> Iterator[dict[str, str]]:
    async def _collect():
        events: list[dict[str, str]] = []
        async for event in astream_agent_events(query=query, messages=messages):
            events.append(event)
        return events

    for item in asyncio.run(_collect()):
        yield item


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
