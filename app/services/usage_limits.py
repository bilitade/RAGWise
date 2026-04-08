"""Monthly request limits (database-backed)."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.db.models import User


def ensure_monthly_period(user: User, db: Session) -> None:
    now = datetime.now(tz=UTC)
    start = user.period_started_at
    if start.month != now.month or start.year != now.year:
        user.requests_this_period = 0
        user.period_started_at = now
        db.add(user)
        db.commit()
        db.refresh(user)


def enforce_monthly_limit(user: User, db: Session) -> None:
    ensure_monthly_period(user, db)
    if user.monthly_request_limit is None:
        return
    if user.requests_this_period >= user.monthly_request_limit:
        raise HTTPException(status_code=429, detail="Monthly request limit exceeded")


def record_billable_request(user: User, db: Session) -> None:
    u = db.get(User, user.id)
    if u is None:
        return
    ensure_monthly_period(u, db)
    u.requests_this_period += 1
    db.add(u)
    db.commit()
