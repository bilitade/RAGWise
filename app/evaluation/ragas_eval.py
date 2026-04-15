"""RAGAS evaluation for the knowledge base. https://docs.ragas.io/en/stable/getstarted/rag_eval/"""

from __future__ import annotations

import asyncio
import json
import math
import statistics
from collections.abc import Callable, Sequence
from pathlib import Path
from typing import Any, Literal

from langchain_openai import ChatOpenAI

from app.config import OPENAI_MODEL, RAGAS_EVAL_MODEL
from app.retrieval.retrieval import SearchResult, advanced_search, similarity_search

RetrievalMode = Literal["vector", "hybrid"]

try:
    from ragas import EvaluationDataset, aevaluate
    from ragas.dataset_schema import EvaluationResult
    from ragas.metrics._answer_correctness import answer_correctness
    from ragas.metrics._context_precision import context_utilization
    from ragas.metrics._context_recall import context_recall
    from ragas.metrics._faithfulness import faithfulness
except ImportError as exc:  # pragma: no cover
    raise ImportError(
        "Install RAGAS for evaluation: uv sync --group dev"
    ) from exc


def hits_to_contexts(hits: Sequence[SearchResult]) -> list[str]:
    """Retrieval hits → context strings."""
    return [h.text for h in hits if h.text.strip()]


def retrieve_contexts(
    question: str,
    *,
    top_k: int = 5,
    mode: RetrievalMode = "hybrid",
    vector_top_k: int = 10,
    bm25_top_k: int = 10,
) -> list[str]:
    """Vector or hybrid retrieval."""
    if mode == "vector":
        return hits_to_contexts(similarity_search(question, top_k=top_k))
    return hits_to_contexts(
        advanced_search(
            question,
            top_k=top_k,
            vector_top_k=vector_top_k,
            bm25_top_k=bm25_top_k,
        )
    )


def rag_answer(question: str, contexts: list[str], *, model: str | None = None) -> str:
    """Generate an answer from chunks (eval pipeline)."""
    if not contexts:
        return ""
    llm = ChatOpenAI(model=model or OPENAI_MODEL, temperature=0)
    numbered = "\n\n".join(f"[{i + 1}] {c}" for i, c in enumerate(contexts))
    prompt = (
        "Answer using only the numbered passages. "
        'If the answer is not in the passages, reply exactly: '
        '"I cannot find the answer in the provided context."\n\n'
        f"Passages:\n{numbered}\n\nQuestion: {question}\nAnswer:"
    )
    msg = llm.invoke(prompt)
    return (msg.content or "").strip()


def load_questions_json(path: Path) -> list[dict[str, Any]]:
    """Load JSON array: question (or user_input), optional reference and response."""
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError("File must be a JSON array")
    rows: list[dict[str, Any]] = []
    for i, item in enumerate(data):
        if not isinstance(item, dict):
            raise ValueError(f"Row {i} must be an object")
        q = item.get("question") or item.get("user_input")
        if not isinstance(q, str) or not q.strip():
            raise ValueError(f"Row {i}: set non-empty 'question' (or 'user_input')")
        ref = item.get("reference")
        if ref is not None and not isinstance(ref, str):
            raise ValueError(f"Row {i}: 'reference' must be a string when set")
        resp = item.get("response")
        rows.append(
            {
                "question": q.strip(),
                "reference": ref.strip() if isinstance(ref, str) else None,
                "response": resp.strip() if isinstance(resp, str) else None,
            }
        )
    return rows


def default_metrics(*, with_reference: bool) -> list[Any]:
    """RAGAS metric singletons (``ragas.metrics._*``)."""
    m: list[Any] = [faithfulness, context_utilization]
    if with_reference:
        m += [context_recall, answer_correctness]
    return m


def build_ragas_rows(
    questions: Sequence[dict[str, Any]],
    *,
    retrieval_mode: RetrievalMode = "hybrid",
    top_k: int = 5,
    vector_top_k: int = 10,
    bm25_top_k: int = 10,
    generate_answers: bool = True,
    answer_model: str | None = None,
    retrieve: Callable[..., list[str]] | None = None,
) -> list[dict[str, Any]]:
    """Build rows for ``EvaluationDataset.from_list``."""
    fetch = retrieve or retrieve_contexts
    out: list[dict[str, Any]] = []
    for row in questions:
        q = row["question"]
        contexts = fetch(
            q,
            top_k=top_k,
            mode=retrieval_mode,
            vector_top_k=vector_top_k,
            bm25_top_k=bm25_top_k,
        )
        if generate_answers:
            answer = rag_answer(q, contexts, model=answer_model or OPENAI_MODEL)
        else:
            raw = row.get("response")
            if not isinstance(raw, str) or not raw.strip():
                raise ValueError(
                    f"Row for {q!r} needs 'response' when generate_answers is False"
                )
            answer = raw.strip()

        sample: dict[str, Any] = {
            "user_input": q,
            "retrieved_contexts": contexts,
            "response": answer,
        }
        ref = row.get("reference")
        if isinstance(ref, str) and ref.strip():
            sample["reference"] = ref.strip()
        out.append(sample)
    return out


def run_ragas(
    rows: list[dict[str, Any]],
    *,
    eval_model: str | None = None,
    metrics: list[Any] | None = None,
    show_progress: bool = True,
) -> EvaluationResult:
    """Run ``aevaluate``."""
    if not rows:
        raise ValueError("No rows to evaluate")
    any_ref = any(isinstance(r.get("reference"), str) and r["reference"].strip() for r in rows)
    all_ref = all(isinstance(r.get("reference"), str) and r["reference"].strip() for r in rows)
    if any_ref and not all_ref:
        raise ValueError(
            "Use 'reference' on every row, or on none — mixed rows are not supported."
        )
    with_reference = bool(any_ref and all_ref)
    model = eval_model or RAGAS_EVAL_MODEL
    eval_llm = ChatOpenAI(model=model, temperature=0)
    to_run = metrics or default_metrics(with_reference=with_reference)
    dataset = EvaluationDataset.from_list(rows)

    async def _eval() -> EvaluationResult:
        return await aevaluate(
            dataset=dataset,
            metrics=to_run,
            llm=eval_llm,
            show_progress=show_progress,
            raise_exceptions=False,
        )

    return asyncio.run(_eval())


def mean_scores(result: EvaluationResult) -> dict[str, float]:
    """Mean per metric across rows."""
    if not result.scores:
        return {}
    keys = result.scores[0].keys()
    out: dict[str, float] = {}
    for name in keys:
        vals: list[float] = []
        for row in result.scores:
            if name not in row:
                continue
            v = row[name]
            if v is None:
                continue
            if isinstance(v, (int, float)):
                if isinstance(v, float) and math.isnan(v):
                    continue
                vals.append(float(v))
        if vals:
            out[name] = statistics.fmean(vals)
    return out
