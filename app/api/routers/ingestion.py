from fastapi import APIRouter

from app.api.schemas import IngestionJobCreateRequest, IngestionJobCreateResponse, IngestionJobStatusResponse
from app.ingestion.tasks import get_task_result, ingest_documents_task

router = APIRouter(prefix="/ingestion", tags=["ingestion"])


@router.post("/jobs", response_model=IngestionJobCreateResponse)
def create_ingestion_job(payload: IngestionJobCreateRequest) -> IngestionJobCreateResponse:
    task = ingest_documents_task.delay(
        input_dir=payload.input_dir,
        recreate_collection=payload.recreate_collection,
    )
    return IngestionJobCreateResponse(task_id=task.id, status=task.status)


@router.get("/jobs/{task_id}", response_model=IngestionJobStatusResponse)
def get_ingestion_job(task_id: str) -> IngestionJobStatusResponse:
    task = get_task_result(task_id)
    stage = None
    stage_history: list[dict] = []
    if isinstance(task.info, dict):
        stage = task.info.get("stage")
        if isinstance(task.info.get("stage_history"), list):
            stage_history = task.info["stage_history"]

    result = None
    error = None
    if task.successful() and isinstance(task.result, dict):
        result = task.result
    elif task.failed():
        error = str(task.result)

    return IngestionJobStatusResponse(
        task_id=task.id,
        status=task.status,
        successful=task.successful(),
        failed=task.failed(),
        stage=stage,
        stage_history=stage_history,
        result=result,
        error=error,
    )
