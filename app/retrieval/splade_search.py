from __future__ import annotations

from app.retrieval.helpers import scored_point_to_search_result, use_qdrant_hybrid
from app.retrieval.hybrid_search import query_sparse
from app.retrieval.models import SearchResult
from app.services.runtime_config import RuntimeModelConfig, qdrant_store_from_runtime


def splade_search(
    query: str,
    top_k: int = 5,
    *,
    runtime_config: RuntimeModelConfig | None = None,
) -> list[SearchResult]:
    if not use_qdrant_hybrid(runtime_config):
        return []
    store = qdrant_store_from_runtime(runtime_config)
    points = query_sparse(store, query, limit=top_k)
    return [scored_point_to_search_result(p, "splade") for p in points]
