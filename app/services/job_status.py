"""Merge persisted DB job state with live Celery AsyncResult (Redis may lose results)."""

from __future__ import annotations

from celery.result import AsyncResult

from app.db.models import BackgroundJob


def effective_celery_status(job: BackgroundJob | None, task: AsyncResult) -> str:
    if job is not None and job.finished_at is not None and job.celery_state:
        return job.celery_state
    return task.status


def effective_successful_bool(job: BackgroundJob | None, task: AsyncResult) -> bool:
    """Matches Celery semantics for in-flight tasks (PENDING → False)."""
    if job is not None and job.finished_at is not None and job.celery_state:
        return job.celery_state == "SUCCESS"
    return task.successful()


def effective_failed_bool(job: BackgroundJob | None, task: AsyncResult) -> bool:
    if job is not None and job.finished_at is not None and job.celery_state:
        return job.celery_state == "FAILURE"
    return task.failed()


def effective_ready(job: BackgroundJob | None, task: AsyncResult) -> bool:
    if job is not None and job.finished_at is not None and job.celery_state:
        return True
    return task.ready()


def effective_successful_optional(job: BackgroundJob | None, task: AsyncResult) -> bool | None:
    """For admin job tables: None while the task is still queued or running."""
    if job is not None and job.finished_at is not None and job.celery_state:
        return job.celery_state == "SUCCESS"
    if task.ready():
        return task.successful()
    return None
