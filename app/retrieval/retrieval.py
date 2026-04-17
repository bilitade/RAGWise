"""Retrieval: dense, sparse, and hybrid search."""

from __future__ import annotations

import argparse
import json

from app.config import QDRANT_HYBRID_ALPHA
from app.retrieval.splade_search import splade_search
from app.retrieval.helpers import (
    build_embed_model,
    get_vector_index,
    node_with_score_to_result,
    scored_point_to_search_result,
    use_qdrant_hybrid,
)
from app.retrieval.hybrid_search import query_hybrid_weighted
from app.retrieval.models import ScoreKind, SearchResult
from app.retrieval.similarity_search import similarity_search
from app.services.runtime_config import RuntimeModelConfig, qdrant_store_from_runtime

__all__ = [
    "ScoreKind",
    "SearchResult",
    "similarity_search",
    "splade_search",
    "hybrid_search",
    "advanced_search",
]


def hybrid_search(
    query: str,
    top_k: int = 5,
    vector_top_k: int = 10,
    sparse_top_k: int = 10,
    *,
    alpha: float | None = None,
    runtime_config: RuntimeModelConfig | None = None,
) -> list[SearchResult]:
    if use_qdrant_hybrid(runtime_config):
        embed_model = build_embed_model(runtime_config)
        qvec = embed_model.get_query_embedding(query)
        store = qdrant_store_from_runtime(runtime_config)
        dense_w = QDRANT_HYBRID_ALPHA if alpha is None else max(0.0, min(1.0, float(alpha)))
        points = query_hybrid_weighted(
            store,
            query,
            list(qvec),
            limit=top_k,
            dense_limit=vector_top_k,
            sparse_limit=sparse_top_k,
            dense_weight=dense_w,
        )
        return [
            scored_point_to_search_result(p, "hybrid", matched_by=("vector", "splade"))
            for p in points
        ]

    retriever = get_vector_index(runtime_config).as_retriever(similarity_top_k=top_k)
    results = retriever.retrieve(query)
    return [node_with_score_to_result(result, source="hybrid") for result in results]


def advanced_search(
    query: str,
    top_k: int = 5,
    vector_top_k: int = 10,
    sparse_top_k: int = 10,
    *,
    alpha: float | None = None,
    runtime_config: RuntimeModelConfig | None = None,
) -> list[SearchResult]:
    return hybrid_search(
        query=query,
        top_k=top_k,
        vector_top_k=vector_top_k,
        sparse_top_k=sparse_top_k,
        alpha=alpha,
        runtime_config=runtime_config,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Search the indexed knowledge base.")
    parser.add_argument("query", help="Search query.")
    parser.add_argument("--top-k", type=int, default=5)
    parser.add_argument(
        "--hybrid",
        action="store_true",
        help="Dense + sparse weighted fusion (hybrid collection).",
    )
    args = parser.parse_args()

    if args.hybrid:
        results = hybrid_search(query=args.query, top_k=args.top_k)
    else:
        results = similarity_search(query=args.query, top_k=args.top_k)

    print(json.dumps([result.model_dump() for result in results], indent=2))


if __name__ == "__main__":
    main()
