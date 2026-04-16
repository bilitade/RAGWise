import json
from typing import Literal

from langchain.tools import tool
from tavily import TavilyClient

from app.config import get_required_env
from app.retrieval.retrieval import hybrid_search
from app.retrieval.similarity_search import similarity_search
from app.services.runtime_config import RuntimeModelConfig


def _get_tavily_client() -> TavilyClient:
    return TavilyClient(api_key=get_required_env("TAVILY_API_KEY"))


def make_internet_search_tool():
    @tool("internet_search")
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
            include_raw_content=include_raw_content,
        )

    return internet_search


def make_knowledge_base_search_tool(runtime_config: RuntimeModelConfig | None = None):
    @tool("knowledge_base_search")
    def knowledge_base_search(
        query: str,
        top_k: int = 5,
        strategy: Literal["similarity", "hybrid"] = "hybrid",
    ):
        """Search the local banking knowledge base for company, policy, product, FAQ, and procedure information."""
        if strategy == "hybrid":
            results = hybrid_search(query=query, top_k=top_k, runtime_config=runtime_config)
        else:
            results = similarity_search(query=query, top_k=top_k, runtime_config=runtime_config)

        payload = {
            "query": query,
            "strategy": strategy,
            "results": [result.model_dump() for result in results],
        }
        return json.dumps(payload, indent=2)

    return knowledge_base_search


def make_multi_source_research_tool(
    runtime_config: RuntimeModelConfig | None = None,
    *,
    allow_knowledge_base: bool = True,
    allow_web: bool = True,
):
    @tool("multi_source_research")
    def multi_source_research(
        topic: str,
        include_web: bool = True,
        include_knowledge_base: bool = True,
        max_queries: int = 3,
        results_per_query: int = 3,
    ):
        """Research a topic across multiple source types with small, deduplicated result sets."""
        queries: list[str] = []
        cleaned = topic.strip()
        if cleaned:
            queries.append(cleaned)
        lower = cleaned.lower()
        if len(queries) < max_queries and "overview" not in lower:
            queries.append(f"{cleaned} overview")
        if len(queries) < max_queries and "analysis" not in lower:
            queries.append(f"{cleaned} analysis")
        queries = queries[: max(1, min(max_queries, 3))]

        payload: dict[str, object] = {
            "topic": cleaned,
            "queries": queries,
            "knowledge_base_results": [],
            "web_results": [],
        }

        use_kb = include_knowledge_base and allow_knowledge_base
        use_web = include_web and allow_web

        if use_kb:
            seen_kb: set[tuple[str, str]] = set()
            kb_results: list[dict[str, object]] = []
            for query in queries:
                hits = hybrid_search(
                    query=query,
                    top_k=max(1, min(results_per_query, 5)),
                    runtime_config=runtime_config,
                )
                for hit in hits:
                    filename = str(hit.metadata.get("filename") or hit.metadata.get("source") or "Knowledge base")
                    key = (hit.node_id, filename)
                    if key in seen_kb:
                        continue
                    seen_kb.add(key)
                    kb_results.append(
                        {
                            "query": query,
                            "node_id": hit.node_id,
                            "label": filename,
                            "text": hit.text,
                            "metadata": hit.metadata,
                        }
                    )
            payload["knowledge_base_results"] = kb_results

        if use_web:
            client = _get_tavily_client()
            seen_web: set[str] = set()
            web_results: list[dict[str, object]] = []
            for query in queries:
                result = client.search(
                    query=query,
                    max_results=max(1, min(results_per_query, 5)),
                    topic="general",
                    include_raw_content=False,
                )
                for item in result.get("results", []):
                    url = str(item.get("url") or "").strip()
                    if not url or url in seen_web:
                        continue
                    seen_web.add(url)
                    web_results.append(
                        {
                            "query": query,
                            "title": item.get("title") or url,
                            "url": url,
                            "content": item.get("content") or "",
                        }
                    )
            payload["web_results"] = web_results

        return json.dumps(payload, indent=2)

    return multi_source_research
