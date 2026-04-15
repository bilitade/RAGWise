from __future__ import annotations

from datetime import datetime, timezone
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


def get_job_by_celery_task_id(db: Session, celery_task_id: str) -> BackgroundJob | None:
    stmt = select(BackgroundJob).where(BackgroundJob.celery_task_id == celery_task_id)
    return db.scalar(stmt)


def mark_job_terminal(
    db: Session,
    *,
    celery_task_id: str,
    celery_state: str,
    error_message: str | None = None,
) -> None:
    job = get_job_by_celery_task_id(db, celery_task_id)
    if job is None or job.finished_at is not None:
        return
    job.celery_state = celery_state
    job.finished_at = datetime.now(timezone.utc)
    job.error_message = error_message
    db.commit()
