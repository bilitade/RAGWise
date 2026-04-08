from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import BackgroundJob, JobType


def record_job(
    db: Session,
    *,
    celery_task_id: str,
    job_type: JobType,
    created_by_user_id: UUID | None,
    meta: dict[str, Any] | None = None,
) -> BackgroundJob:
    job = BackgroundJob(
        celery_task_id=celery_task_id,
        job_type=job_type,
        created_by_user_id=created_by_user_id,
        meta=meta or {},
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def list_jobs(db: Session, *, limit: int = 50) -> list[BackgroundJob]:
    stmt = select(BackgroundJob).order_by(BackgroundJob.created_at.desc()).limit(limit)
    return list(db.scalars(stmt).all())
