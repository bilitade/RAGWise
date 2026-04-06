from pathlib import Path

from celery.result import AsyncResult

from app.documents.service import ingest_all_documents, ingest_single_document, reindex_document
from app.ingestion.loader import IngestionStage, ingest_documents
from app.worker.celery_app import celery_app


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
        state = "FAILURE" if stage.status == "failed" else "STARTED"
        task.update_state(
            state=state,
            meta=_build_task_meta(task.request.id, stage, stage_history),
        )

    result = runner(progress_callback)
    return result.model_dump()


@celery_app.task(bind=True, name="app.ingestion.tasks.ingest_documents_task")
def ingest_documents_task(
    self,
    input_dir: str | None = None,
    recreate_collection: bool = True,
) -> dict:
    def runner(progress_callback):
        if input_dir:
            input_path = Path(input_dir)
            if input_path.is_file():
                return ingest_single_document(
                    input_path,
                    progress_callback=progress_callback,
                )
            return ingest_documents(
                input_dir=input_path,
                recreate_collection=recreate_collection,
                progress_callback=progress_callback,
            )
        return ingest_all_documents(progress_callback=progress_callback)

    return _run_ingestion_task(
        self,
        task_name="Document ingestion task",
        runner=runner,
    )


@celery_app.task(bind=True, name="app.ingestion.tasks.reindex_document_task")
def reindex_document_task(self, document_id: str) -> dict:
    return _run_ingestion_task(
        self,
        task_name="Document reindex task",
        runner=lambda progress_callback: reindex_document(
            document_id,
            progress_callback=progress_callback,
        ),
    )


def get_task_result(task_id: str) -> AsyncResult:
    return AsyncResult(task_id, app=celery_app)


__all__ = ["get_task_result", "ingest_documents", "ingest_documents_task", "reindex_document_task"]
