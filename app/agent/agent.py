import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.config import OPENAI_MODEL

from deepagents import create_deep_agent
from langchain_core.messages import HumanMessage
from langchain_core.messages import AIMessageChunk

from app.agent.prompts import agent_system_prompt as research_instructions
from app.agent.tools import internet_search, knowledge_base_search

agent = create_deep_agent(
    name="research_agent",
    model=OPENAI_MODEL,
    system_prompt=research_instructions,
    tools=[knowledge_base_search, internet_search],
)


if __name__ == "__main__":
    query = input("Enter your research topic: ")
    print("\n=== Streaming Response ===\n")

    streamed_text = False
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
