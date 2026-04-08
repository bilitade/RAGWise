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
from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage
from langchain_openai import ChatOpenAI

from app.agent.citations import citations_from_tool_output
from app.agent.prompts import agent_system_prompt
from app.agent.tools import internet_search, knowledge_base_search
from app.config import OPENAI_MODEL


def dict_messages_to_langchain(messages: list[dict[str, str]]) -> list[HumanMessage | AIMessage]:
    """Multi-turn history for deep agents: alternating user / assistant LangChain messages."""
    lc: list[HumanMessage | AIMessage] = []
    for message in messages:
        role = (message.get("role") or "user").strip().lower()
        content = message.get("content") or ""
        if role == "assistant":
            lc.append(AIMessage(content=content))
        elif role == "user":
            lc.append(HumanMessage(content=content))
    if not lc:
        raise ValueError("No user or assistant messages to send to the agent.")
    return lc


def build_agent(
    *,
    system_prompt: str | None = None,
    model_name: str | None = None,
):
    model = ChatOpenAI(
        model=model_name or OPENAI_MODEL,
        streaming=True,
    )
    return create_deep_agent(
        name="research_agent",
        model=model,
        system_prompt=system_prompt or agent_system_prompt,
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
    system_prompt: str | None = None,
    model_name: str | None = None,
) -> AsyncIterator[dict[str, Any]]:
    agent = build_agent(system_prompt=system_prompt, model_name=model_name)

    if messages:
        filtered = [
            {"role": m["role"], "content": m.get("content") or ""}
            for m in messages
            if (m.get("role") or "").lower() in ("user", "assistant")
        ]
        lc_messages = dict_messages_to_langchain(filtered)
    elif query:
        lc_messages = [HumanMessage(content=query)]
    else:
        raise ValueError("A query or chat messages are required.")

    yield {"type": "status", "label": "Thinking"}
    yielded_token = False
    current_status = "Thinking"

    async for event in agent.astream_events(
        {"messages": lc_messages},
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
            raw_out = event_data.get("output")
            cite_items = citations_from_tool_output(runnable_name, raw_out)
            if cite_items:
                yield {"type": "citations", "items": cite_items}
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
    system_prompt: str | None = None,
    model_name: str | None = None,
) -> Iterator[str]:
    agent = build_agent(system_prompt=system_prompt, model_name=model_name)
    if messages:
        filtered = [
            {"role": m["role"], "content": m.get("content") or ""}
            for m in messages
            if (m.get("role") or "").lower() in ("user", "assistant")
        ]
        lc_messages = dict_messages_to_langchain(filtered)
    elif query:
        lc_messages = [HumanMessage(content=query)]
    else:
        raise ValueError("A query or chat messages are required.")
    for message_chunk, _metadata in agent.stream(
        {"messages": lc_messages},
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
