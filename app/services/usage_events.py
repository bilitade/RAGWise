from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.models import UsageEvent


def record_usage(
    db: Session,
    *,
    user_id: UUID | None,
    route: str,
    tokens_in: int | None = None,
    tokens_out: int | None = None,
    estimated_cost_usd: float | None = None,
    trace_id: str | None = None,
    extra: dict[str, Any] | None = None,
) -> UsageEvent:
    ev = UsageEvent(
        user_id=user_id,
        route=route,
        tokens_in=tokens_in,
        tokens_out=tokens_out,
        estimated_cost_usd=estimated_cost_usd,
        trace_id=trace_id,
        extra=extra,
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return ev
