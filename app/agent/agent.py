import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.config import get_env, load_env

load_env()

from deepagents import create_deep_agent
from langchain_core.messages import HumanMessage

from app.agent.prompts import agent_system_prompt as research_instructions
from app.agent.tools import internet_search

model_name = get_env("OPENAI_MODEL", "gpt-4.1-mini")

agent = create_deep_agent(
    name="research_agent",
    model=model_name,
    system_prompt=research_instructions,
    tools=[internet_search],
)


if __name__ == "__main__":
    query = input("Enter your research topic: ")
    result = agent.invoke({"messages": [HumanMessage(content=query)]})
    report = result["messages"][-1].content
    print("\n=== Research Report ===\n")
    print(report)
