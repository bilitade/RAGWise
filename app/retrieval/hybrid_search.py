from __future__ import annotations

from typing import Any

from app.db.qdrant import DENSE_VECTOR_NAME, SPARSE_VECTOR_NAME, QdrantStore, dense_search_params
from app.retrieval.models import ScoredPoint, ScoreKind
from app.retrieval.sparse_encode import encode_sparse_query


def _payload_text_and_metadata(payload: dict[str, Any] | None) -> tuple[str, dict[str, Any]]:
    if not payload:
        return "", {}
    try:
        from llama_index.core.vector_stores.utils import metadata_dict_to_node

        node = metadata_dict_to_node(dict(payload))
        return (node.get_content() or "", dict(node.metadata or {}))
    except Exception:
        text = str(payload.get("text") or "")
        meta = {k: v for k, v in payload.items() if isinstance(k, str) and not k.startswith("_")}
        return text, meta


def _scored_point_from_record(
    point: Any,
    score: float | None = None,
    *,
    score_kind: ScoreKind,
) -> ScoredPoint | None:
    payload = getattr(point, "payload", None) or {}
    if not isinstance(payload, dict):
        payload = {}
    text, meta = _payload_text_and_metadata(payload)
    pid = getattr(point, "id", None)
    if pid is None:
        return None
    s = float(score if score is not None else getattr(point, "score", 0.0) or 0.0)
    return ScoredPoint(
        point_id=str(pid),
        score=s,
        text=text,
        metadata=meta,
        score_kind=score_kind,
    )


def query_dense(
    store: QdrantStore,
    query_vector: list[float],
    *,
    limit: int,
) -> list[ScoredPoint]:
    resp = store.client.query_points(
        collection_name=store.collection_name,
        query=query_vector,
        using=DENSE_VECTOR_NAME,
        limit=limit,
        with_payload=True,
        search_params=dense_search_params(),
    )
    out: list[ScoredPoint] = []
    for p in resp.points or []:
        sp = _scored_point_from_record(p, score_kind="cosine_similarity")
        if sp:
            out.append(sp)
    return out


def _min_max_normalize(scores: dict[str, float]) -> dict[str, float]:
    if not scores:
        return {}
    vals = list(scores.values())
    lo, hi = min(vals), max(vals)
    if hi - lo < 1e-12:
        return {k: 1.0 for k in scores}
    return {k: (v - lo) / (hi - lo) for k, v in scores.items()}


def query_sparse(
    store: QdrantStore,
    query_text: str,
    *,
    limit: int,
) -> list[ScoredPoint]:
    sparse = encode_sparse_query(query_text)
    if not sparse.indices:
        return []
    resp = store.client.query_points(
        collection_name=store.collection_name,
        query=sparse,
        using=SPARSE_VECTOR_NAME,
        limit=limit,
        with_payload=True,
    )
    out: list[ScoredPoint] = []
    for p in resp.points or []:
        sp = _scored_point_from_record(p, score_kind="sparse_similarity")
        if sp:
            out.append(sp)
    return out


def query_hybrid_weighted(
    store: QdrantStore,
    query_text: str,
    query_vector: list[float],
    *,
    limit: int,
    dense_limit: int,
    sparse_limit: int,
    dense_weight: float,
) -> list[ScoredPoint]:
    w = max(0.0, min(1.0, float(dense_weight)))
    sparse_vec = encode_sparse_query(query_text)
    if not sparse_vec.indices:
        return query_dense(store, query_vector, limit=limit)

    dense_hits = query_dense(store, query_vector, limit=max(1, dense_limit))
    sparse_hits = query_sparse(store, query_text, limit=max(1, sparse_limit))
    if not sparse_hits:
        return dense_hits[: max(1, limit)]

    dense_scores = {h.point_id: h.score for h in dense_hits}
    sparse_scores = {h.point_id: h.score for h in sparse_hits}
    nd = _min_max_normalize(dense_scores)
    ns = _min_max_normalize(sparse_scores)

    by_id: dict[str, ScoredPoint] = {}
    for h in dense_hits:
        by_id[h.point_id] = h
    for h in sparse_hits:
        if h.point_id not in by_id:
            by_id[h.point_id] = h

    combined: dict[str, float] = {}
    for pid in set(nd) | set(ns):
        combined[pid] = w * nd.get(pid, 0.0) + (1.0 - w) * ns.get(pid, 0.0)

    ordered = sorted(combined.keys(), key=lambda k: combined[k], reverse=True)[: max(1, limit)]
    result: list[ScoredPoint] = []
    for pid in ordered:
        base = by_id.get(pid)
        if base is None:
            continue
        result.append(
            ScoredPoint(
                point_id=pid,
                score=combined[pid],
                text=base.text,
                metadata=base.metadata,
                score_kind="weighted_hybrid",
            )
        )
    return result
