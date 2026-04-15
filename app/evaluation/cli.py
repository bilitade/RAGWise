"""CLI: RAGAS KB evaluation (requires ``OPENAI_API_KEY``)."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from app.config import RAGAS_EVAL_MODEL
from app.evaluation.ragas_eval import build_ragas_rows, load_questions_json, mean_scores, run_ragas


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        description="Run RAGAS on the indexed knowledge base.",
    )
    p.add_argument(
        "dataset",
        type=Path,
        help="JSON array of {question, reference?} — see tests/fixtures/kb_eval_aifoundary.json",
    )
    p.add_argument("--retrieval", choices=("hybrid", "vector"), default="hybrid")
    p.add_argument("--top-k", type=int, default=5, help="Chunks per query.")
    p.add_argument(
        "--no-generate",
        action="store_true",
        help="Do not call the chat model to write answers; each row must include response.",
    )
    p.add_argument("--eval-model", default=RAGAS_EVAL_MODEL, help="OpenAI model for RAGAS metrics.")
    p.add_argument("--output-json", type=Path, default=None, help="Write mean scores here.")
    args = p.parse_args(argv)

    questions = load_questions_json(args.dataset)
    rows = build_ragas_rows(
        questions,
        retrieval_mode="hybrid" if args.retrieval == "hybrid" else "vector",
        top_k=args.top_k,
        generate_answers=not args.no_generate,
    )
    result = run_ragas(rows, eval_model=args.eval_model, show_progress=True)
    scores = mean_scores(result)
    print(json.dumps(scores, indent=2))
    if args.output_json:
        args.output_json.write_text(json.dumps(scores, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
