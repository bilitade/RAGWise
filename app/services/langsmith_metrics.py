"""Fetch aggregate cost/run stats from LangSmith for the configured tracing project."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from app.config import LANGCHAIN_API_KEY, LANGCHAIN_ENDPOINT, LANGCHAIN_PROJECT


def _json_num(v: Decimal | int | float | None) -> float | int | None:
    if v is None:
        return None
    if isinstance(v, Decimal):
        return float(v)
    return v


def fetch_langsmith_project_metrics() -> dict[str, Any]:
    """
    Calls LangSmith `GET /sessions?name=...&include_stats=true` (via SDK `read_project`).

    Returns ``total_cost`` and ``run_count`` for the project — same figures shown in the
    LangSmith UI for that project (estimated LLM cost LangSmith attributes to traces).
    """
    if not LANGCHAIN_API_KEY:
        return {"ok": False, "error": "LANGCHAIN_API_KEY is not set"}

    api_url = (LANGCHAIN_ENDPOINT or "").strip() or "https://api.smith.langchain.com"

    try:
        from langsmith import Client
        from langsmith.utils import LangSmithNotFoundError

        client = Client(api_url=api_url, api_key=LANGCHAIN_API_KEY)
        p = client.read_project(project_name=LANGCHAIN_PROJECT, include_stats=True)
    except LangSmithNotFoundError:
        return {
            "ok": False,
            "error": f"Project “{LANGCHAIN_PROJECT}” was not found in LangSmith. Create it or update LANGCHAIN_PROJECT.",
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}

    return {
        "ok": True,
        "fetched_at": datetime.now(tz=UTC).isoformat(),
        "project_name": p.name,
        "run_count": p.run_count,
        "total_cost_usd": _json_num(p.total_cost),
        "prompt_cost_usd": _json_num(p.prompt_cost),
        "completion_cost_usd": _json_num(p.completion_cost),
        "total_tokens": p.total_tokens,
        "prompt_tokens": p.prompt_tokens,
        "completion_tokens": p.completion_tokens,
    }
