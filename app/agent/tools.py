from langchain.tools import tool
from typing import Literal
from tavily import TavilyClient

from app.config import get_required_env


def _get_tavily_client() -> TavilyClient:
    return TavilyClient(api_key=get_required_env("TAVILY_API_KEY"))


@tool
def internet_search(
    query: str,
    max_results: int = 5,
    topic: Literal["general", "news", "finance"] = "general",
    include_raw_content: bool = False,
):
    """Run a web search using Tavily"""
    tavily_client = _get_tavily_client()
    return tavily_client.search(
        query=query,
        max_results=max_results,
        topic=topic,
        include_raw_content=include_raw_content
    )
