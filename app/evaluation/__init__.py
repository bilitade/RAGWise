"""Knowledge-base evaluation (RAGAS)."""

from app.evaluation.ragas_eval import (
    build_ragas_rows,
    default_metrics,
    hits_to_contexts,
    load_questions_json,
    mean_scores,
    rag_answer,
    retrieve_contexts,
    run_ragas,
)

__all__ = [
    "build_ragas_rows",
    "default_metrics",
    "hits_to_contexts",
    "load_questions_json",
    "mean_scores",
    "rag_answer",
    "retrieve_contexts",
    "run_ragas",
]
