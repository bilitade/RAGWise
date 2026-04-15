from __future__ import annotations

from app.db.qdrant import QdrantStore
from app.retrieval.helpers import scored_point_to_search_result, use_qdrant_hybrid
from app.retrieval.hybrid_search import query_sparse
from app.retrieval.models import SearchResult
from app.services.runtime_config import RuntimeModelConfig


def bm25_search(
    query: str,
    top_k: int = 5,
    *,
    runtime_config: RuntimeModelConfig | None = None,
) -> list[SearchResult]:
    _ = runtime_config
    if not use_qdrant_hybrid():
        return []
    store = QdrantStore()
    points = query_sparse(store, query, limit=top_k)
    return [scored_point_to_search_result(p, "bm25") for p in points]
