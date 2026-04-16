from __future__ import annotations

from app.retrieval.helpers import (
    build_embed_model,
    get_vector_index,
    node_with_score_to_result,
    scored_point_to_search_result,
    use_qdrant_hybrid,
)
from app.retrieval.hybrid_search import query_dense
from app.retrieval.models import SearchResult
from app.services.runtime_config import RuntimeModelConfig, qdrant_store_from_runtime


def similarity_search(
    query: str,
    top_k: int = 5,
    *,
    runtime_config: RuntimeModelConfig | None = None,
) -> list[SearchResult]:
    if use_qdrant_hybrid(runtime_config):
        embed_model = build_embed_model(runtime_config)
        qvec = embed_model.get_query_embedding(query)
        store = qdrant_store_from_runtime(runtime_config)
        points = query_dense(store, list(qvec), limit=top_k)
        return [scored_point_to_search_result(p, "vector") for p in points]

    retriever = get_vector_index(runtime_config).as_retriever(similarity_top_k=top_k)
    results = retriever.retrieve(query)
    return [node_with_score_to_result(result, source="vector") for result in results]
