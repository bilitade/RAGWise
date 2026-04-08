from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import UsageEvent, User


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


def usage_summary_since(db: Session, since: datetime | None = None) -> dict[str, Any]:
    since = since or datetime.min.replace(tzinfo=UTC)
    total_cost = db.scalar(
        select(func.coalesce(func.sum(UsageEvent.estimated_cost_usd), 0.0)).where(UsageEvent.created_at >= since)
    )
    total_tokens_in = db.scalar(
        select(func.coalesce(func.sum(UsageEvent.tokens_in), 0)).where(UsageEvent.created_at >= since)
    )
    total_tokens_out = db.scalar(
        select(func.coalesce(func.sum(UsageEvent.tokens_out), 0)).where(UsageEvent.created_at >= since)
    )
    count = db.scalar(select(func.count()).select_from(UsageEvent).where(UsageEvent.created_at >= since))
    return {
        "since": since.isoformat(),
        "event_count": int(count or 0),
        "total_estimated_cost_usd": float(total_cost or 0),
        "total_tokens_in": int(total_tokens_in or 0),
        "total_tokens_out": int(total_tokens_out or 0),
    }


def usage_by_user(db: Session, since: datetime | None = None) -> list[dict[str, Any]]:
    since = since or datetime.min.replace(tzinfo=UTC)
    stmt = (
        select(
            UsageEvent.user_id,
            func.coalesce(func.sum(UsageEvent.estimated_cost_usd), 0.0),
            func.coalesce(func.sum(UsageEvent.tokens_in), 0),
            func.coalesce(func.sum(UsageEvent.tokens_out), 0),
            func.count(UsageEvent.id),
        )
        .where(UsageEvent.created_at >= since)
        .group_by(UsageEvent.user_id)
    )
    rows = db.execute(stmt).all()
    out: list[dict[str, Any]] = []
    for uid, cost, tin, tout, cnt in rows:
        email = None
        if uid:
            u = db.get(User, uid)
            email = u.email if u else None
        out.append(
            {
                "user_id": str(uid) if uid else None,
                "email": email,
                "estimated_cost_usd": float(cost or 0),
                "tokens_in": int(tin or 0),
                "tokens_out": int(tout or 0),
                "events": int(cnt or 0),
            }
        )
    return out
