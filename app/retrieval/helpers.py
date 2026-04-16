from __future__ import annotations

from typing import Any, get_args

from llama_index.core import VectorStoreIndex
from llama_index.embeddings.openai import OpenAIEmbedding

from app.config import OPENAI_EMBED_MODEL, QDRANT_HYBRID_ENABLED
from app.retrieval.models import ScoreKind, ScoredPoint, SearchResult
from app.services.runtime_config import RuntimeModelConfig, qdrant_store_from_runtime


def build_embed_model(runtime_config: RuntimeModelConfig | None = None) -> OpenAIEmbedding:
    if runtime_config is None:
        return OpenAIEmbedding(model=OPENAI_EMBED_MODEL)
    return OpenAIEmbedding(**runtime_config.embed_model_kwargs())


def use_qdrant_hybrid(runtime_config: RuntimeModelConfig | None = None) -> bool:
    if not QDRANT_HYBRID_ENABLED:
        return False
    q = qdrant_store_from_runtime(runtime_config)
    return q.collection_exists() and q.is_hybrid_collection()


def get_vector_index(runtime_config: RuntimeModelConfig | None = None) -> VectorStoreIndex:
    qdrant = qdrant_store_from_runtime(runtime_config)
    return VectorStoreIndex.from_vector_store(
        vector_store=qdrant.get_vector_store(),
        embed_model=build_embed_model(runtime_config),
    )


def extract_node_text(node: Any) -> str:
    text = getattr(node, "text", None)
    if text:
        return text
    return node.get_content()


def node_with_score_to_result(node_with_score: Any, source: str) -> SearchResult:
    node = node_with_score.node
    return SearchResult(
        node_id=node.node_id,
        score=float(node_with_score.score or 0.0),
        text=extract_node_text(node),
        metadata=node.metadata,
        source=source,
        matched_by=(source,),
        score_kind="llamaindex_similarity",
    )


def scored_point_to_search_result(
    point: ScoredPoint,
    source: str,
    matched_by: tuple[str, ...] | None = None,
) -> SearchResult:
    allowed = get_args(ScoreKind)
    sk: ScoreKind = point.score_kind if point.score_kind in allowed else "unknown"  # type: ignore[assignment]
    return SearchResult(
        node_id=point.point_id,
        score=point.score,
        text=point.text,
        metadata=point.metadata,
        source=source,
        matched_by=matched_by if matched_by is not None else (source,),
        score_kind=sk,
    )
