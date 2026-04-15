"""Persist terminal Celery outcomes to PostgreSQL so job history survives Redis expiry."""

from __future__ import annotations

import logging

from celery.signals import task_failure, task_success

from app.db.session import SessionLocal
from app.services.jobs_repo import mark_job_terminal

_log = logging.getLogger(__name__)


@task_success.connect
def _persist_success(sender=None, result=None, **kwargs) -> None:
    _ = result
    if sender is None:
        return
    req = getattr(sender, "request", None)
    task_id = getattr(req, "id", None) if req is not None else None
    if not task_id:
        return
    db = SessionLocal()
    try:
        mark_job_terminal(db, celery_task_id=task_id, celery_state="SUCCESS")
    except Exception:
        _log.exception("Failed to persist job success for task_id=%s", task_id)
    finally:
        db.close()


@task_failure.connect
def _persist_failure(sender=None, task_id=None, exception=None, **kwargs) -> None:
    _ = sender
    if not task_id:
        return
    err = str(exception) if exception is not None else None
    db = SessionLocal()
    try:
        mark_job_terminal(db, celery_task_id=task_id, celery_state="FAILURE", error_message=err)
    except Exception:
        _log.exception("Failed to persist job failure for task_id=%s", task_id)
    finally:
        db.close()
