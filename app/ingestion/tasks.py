from pathlib import Path

from celery.result import AsyncResult

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


@celery_app.task(bind=True, name="app.ingestion.tasks.ingest_documents_task")
def ingest_documents_task(
    self,
    input_dir: str | None = None,
    recreate_collection: bool = True,
) -> dict:
    stage_history = [
        IngestionStage(
            name="queued",
            status="running",
            progress=0,
            message="Ingestion task accepted by worker.",
            details={
                "input_dir": input_dir,
                "recreate_collection": recreate_collection,
            },
        )
    ]
    self.update_state(
        state="STARTED",
        meta=_build_task_meta(
            self.request.id,
            stage_history[-1],
            stage_history,
        ),
    )

    def progress_callback(stage: IngestionStage) -> None:
        stage_history.append(stage)
        state = "FAILURE" if stage.status == "failed" else "STARTED"
        self.update_state(
            state=state,
            meta=_build_task_meta(self.request.id, stage, stage_history),
        )

    result = ingest_documents(
        input_dir=Path(input_dir) if input_dir else None,
        recreate_collection=recreate_collection,
        progress_callback=progress_callback,
    )
    return result.model_dump()


def get_task_result(task_id: str) -> AsyncResult:
    return AsyncResult(task_id, app=celery_app)
