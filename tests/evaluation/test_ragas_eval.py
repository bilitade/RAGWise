"""app.evaluation.ragas_eval"""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.evaluation.ragas_eval import (
    build_ragas_rows,
    hits_to_contexts,
    load_questions_json,
    mean_scores,
    run_ragas,
)
from app.retrieval.retrieval import SearchResult


def test_hits_to_contexts_omits_blank_chunks() -> None:
    hits = [
        SearchResult(node_id="1", score=1.0, text="hello", metadata={}, source="vector"),
        SearchResult(node_id="2", score=0.5, text="   ", metadata={}, source="vector"),
    ]
    assert hits_to_contexts(hits) == ["hello"]


def test_load_questions_json_gold_fixture(fixtures_dir: Path) -> None:
    rows = load_questions_json(fixtures_dir / "kb_eval_gold.json")
    assert len(rows) == 1
    assert rows[0]["question"] == "Minimal example question"


def test_load_questions_json_aifoundary_fixture(fixtures_dir: Path) -> None:
    rows = load_questions_json(fixtures_dir / "kb_eval_aifoundary.json")
    assert len(rows) >= 4
    assert all("reference" in r and r["reference"] for r in rows)
    joined = " ".join(r["reference"] or "" for r in rows).lower()
    assert "coopbank" in joined
    assert "diagnose" in joined


def test_build_ragas_rows_requires_response_when_not_generating() -> None:
    def stub_fetch(_q: str, **_: object) -> list[str]:
        return ["chunk"]

    base = [{"question": "Q?", "reference": "ref"}]
    with pytest.raises(ValueError, match="needs 'response'"):
        build_ragas_rows(base, retrieve=stub_fetch, generate_answers=False)

    ok = [
        {"question": "Q?", "reference": "ref", "response": " fixed answer "},
    ]
    rows = build_ragas_rows(ok, retrieve=stub_fetch, generate_answers=False)
    assert rows[0]["user_input"] == "Q?"
    assert rows[0]["response"] == "fixed answer"
    assert rows[0]["reference"] == "ref"


def test_run_ragas_mean_scores_from_aevaluate() -> None:
    rows = [{"user_input": "q", "retrieved_contexts": ["c"], "response": "a"}]
    fake = SimpleNamespace(
        scores=[{"faithfulness": 1.0, "context_utilization": 0.5}],
    )
    with patch("app.evaluation.ragas_eval.aevaluate", new_callable=AsyncMock, return_value=fake):
        out = run_ragas(rows, show_progress=False)
    m = mean_scores(out)
    assert m["faithfulness"] == 1.0
    assert pytest.approx(m["context_utilization"]) == 0.5


def test_run_ragas_requires_reference_on_all_rows() -> None:
    rows = [
        {"user_input": "a", "retrieved_contexts": [], "response": "x", "reference": "r"},
        {"user_input": "b", "retrieved_contexts": [], "response": "y"},
    ]
    with pytest.raises(ValueError, match="every row"):
        run_ragas(rows)


def test_mean_scores_empty_scores() -> None:
    class Empty:
        scores: list[dict[str, float]] = []

    assert mean_scores(Empty()) == {}  # type: ignore[arg-type]
