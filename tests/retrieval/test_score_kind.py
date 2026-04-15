from __future__ import annotations

from app.retrieval.models import ScoredPoint, SearchResult


def test_scored_point_default_score_kind() -> None:
    p = ScoredPoint(
        point_id="x",
        score=1.0,
        text="t",
        metadata={},
        score_kind="cosine_similarity",
    )
    assert p.score_kind == "cosine_similarity"


def test_search_result_accepts_score_kind() -> None:
    r = SearchResult(
        node_id="n",
        score=0.5,
        text="hi",
        metadata={},
        source="vector",
        score_kind="cosine_similarity",
    )
    assert r.score_kind == "cosine_similarity"
