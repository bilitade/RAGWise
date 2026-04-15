from celery import Celery

from app.config import CELERY_BROKER_URL, CELERY_RESULT_BACKEND


celery_app = Celery(
    "rag_deep_agent",
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND,
    include=["app.ingestion.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    task_track_started=True,
    # Redis result TTL; DB stores terminal state for long-lived job history.
    result_expires=86400 * 7,
    timezone="UTC",
    enable_utc=True,
)

# Register signal handlers (persist SUCCESS/FAILURE to `background_jobs`).
import app.worker.job_signals  # noqa: E402, F401
