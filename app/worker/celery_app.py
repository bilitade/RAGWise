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
    result_expires=3600,
    timezone="UTC",
    enable_utc=True,
)
