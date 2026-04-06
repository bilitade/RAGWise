import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.config import OPENAI_MODEL

from deepagents import create_deep_agent
from langchain_core.messages import HumanMessage

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
    result = agent.invoke({"messages": [HumanMessage(content=query)]})
    report = result["messages"][-1].content
    print("\n=== Research Report ===\n")
    print(report)
