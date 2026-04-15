from __future__ import annotations

from app.db.qdrant import QdrantStore
from app.retrieval.helpers import (
    build_embed_model,
    get_vector_index,
    node_with_score_to_result,
    scored_point_to_search_result,
    use_qdrant_hybrid,
)
from app.retrieval.hybrid_search import query_dense
from app.retrieval.models import SearchResult


def similarity_search(query: str, top_k: int = 5) -> list[SearchResult]:
    if use_qdrant_hybrid():
        embed_model = build_embed_model()
        qvec = embed_model.get_query_embedding(query)
        store = QdrantStore()
        points = query_dense(store, list(qvec), limit=top_k)
        return [scored_point_to_search_result(p, "vector") for p in points]

    retriever = get_vector_index().as_retriever(similarity_top_k=top_k)
    results = retriever.retrieve(query)
    return [node_with_score_to_result(result, source="vector") for result in results]
