import json
from typing import Literal

from langchain.tools import tool
from tavily import TavilyClient

from app.config import get_required_env
from app.retrieval.retrieval import hybrid_search, similarity_search


def _get_tavily_client() -> TavilyClient:
    return TavilyClient(api_key=get_required_env("TAVILY_API_KEY"))


@tool
def internet_search(
    query: str,
    max_results: int = 5,
    topic: Literal["general", "news", "finance"] = "general",
    include_raw_content: bool = False,
):
    """Search the public internet for current information, news, and external context."""
    tavily_client = _get_tavily_client()
    return tavily_client.search(
        query=query,
        max_results=max_results,
        topic=topic,
        include_raw_content=include_raw_content
    )


@tool
def knowledge_base_search(
    query: str,
    top_k: int = 5,
    strategy: Literal["similarity", "hybrid"] = "hybrid",
):
    """Search the local banking knowledge base for company, policy, product, FAQ, and procedure information."""
    if strategy == "hybrid":
        results = hybrid_search(query=query, top_k=top_k)
    else:
        results = similarity_search(query=query, top_k=top_k)

    payload = {
        "query": query,
        "strategy": strategy,
        "results": [result.model_dump() for result in results],
    }
    return json.dumps(payload, indent=2)
