import logging
from pathlib import Path

from celery.result import AsyncResult

from app.documents.service import (
    ingest_all_documents,
    ingest_single_document,
    reindex_document,
    reindex_stale_documents,
    sync_document_rows_after_paths,
)
from app.db.session import SessionLocal
from app.ingestion.loader import IngestionStage, ingest_documents
from app.services.runtime_config import apply_openai_env_from_db
from app.worker.celery_app import celery_app

_log = logging.getLogger(__name__)


def _apply_runtime_env() -> None:
    try:
        db = SessionLocal()
        try:
            apply_openai_env_from_db(db)
        finally:
            db.close()
    except Exception as exc:
        _log.warning("Celery runtime OpenAI config skipped (using process env): %s", exc)


def _build_task_meta(
    task_id: str,
    stage: IngestionStage,
    stage_history: list[IngestionStage],
) -> dict:
    return {
        "task_id": task_id,
        "stage": stage.model_dump(),
        "stage_history": [item.model_dump() for item in stage_history],
    }


def _run_ingestion_task(
    task,
    *,
    task_name: str,
    runner,
) -> dict:
    stage_history = [
        IngestionStage(
            name="queued",
            status="running",
            progress=0,
            message=f"{task_name} accepted by worker.",
            details={},
        )
    ]
    task.update_state(
        state="STARTED",
        meta=_build_task_meta(
            task.request.id,
            stage_history[-1],
            stage_history,
        ),
    )

    def progress_callback(stage: IngestionStage) -> None:
        stage_history.append(stage)
        task.update_state(
            state="STARTED",
            meta=_build_task_meta(task.request.id, stage, stage_history),
        )

    result = runner(progress_callback)
    return result.model_dump()


@celery_app.task(bind=True, name="app.ingestion.tasks.ingest_documents_task")
def ingest_documents_task(
    self,
    input_dir: str | None = None,
    recreate_collection: bool = True,
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
) -> dict:
    _apply_runtime_env()

    def runner(progress_callback):
        db = SessionLocal()
        try:
            if input_dir:
                input_path = Path(input_dir)
                if input_path.is_file():
                    return ingest_single_document(
                        db,
                        input_path,
                        progress_callback=progress_callback,
                        chunk_size=chunk_size,
                        chunk_overlap=chunk_overlap,
                    )
                result = ingest_documents(
                    input_dir=input_path,
                    recreate_collection=recreate_collection,
                    progress_callback=progress_callback,
                    chunk_size=chunk_size,
                    chunk_overlap=chunk_overlap,
                )
                from app.ingestion.loader import list_source_files

                sync_document_rows_after_paths(db, list_source_files(input_path))
                return result
            return ingest_all_documents(
                db,
                progress_callback=progress_callback,
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
            )
        finally:
            db.close()

    return _run_ingestion_task(
        self,
        task_name="Document ingestion task",
        runner=runner,
    )


@celery_app.task(bind=True, name="app.ingestion.tasks.reindex_document_task")
def reindex_document_task(
    self,
    document_id: str,
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
) -> dict:
    _apply_runtime_env()

    def runner(progress_callback):
        db = SessionLocal()
        try:
            return reindex_document(
                db,
                document_id,
                progress_callback=progress_callback,
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
            )
        finally:
            db.close()

    return _run_ingestion_task(
        self,
        task_name="Document reindex task",
        runner=runner,
    )


@celery_app.task(bind=True, name="app.ingestion.tasks.sync_stale_documents_task")
def sync_stale_documents_task(
    self,
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
) -> dict:
    _apply_runtime_env()

    def runner(progress_callback):
        db = SessionLocal()
        try:
            return reindex_stale_documents(
                db,
                progress_callback=progress_callback,
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
            )
        finally:
            db.close()

    return _run_ingestion_task(
        self,
        task_name="Sync stale documents task",
        runner=runner,
    )


def get_task_result(task_id: str) -> AsyncResult:
    return AsyncResult(task_id, app=celery_app)


__all__ = [
    "get_task_result",
    "ingest_documents",
    "ingest_documents_task",
    "reindex_document_task",
    "sync_stale_documents_task",
]
