from fastapi import APIRouter, File, HTTPException, UploadFile

from app.api.schemas import (
    AdvancedRetrievalRequest,
    DocumentDeleteResponse,
    DocumentJobResponse,
    DocumentListResponse,
    IngestionJobStatusResponse,
    RetrievalRequest,
    RetrievalResponse,
)
from app.documents.service import delete_document, get_document_by_id, list_documents, save_uploaded_file
from app.ingestion.tasks import get_task_result, ingest_documents_task, reindex_document_task
from app.retrieval.retrieval import advanced_search, bm25_search, similarity_search

router = APIRouter(prefix="/documents", tags=["documents"])


def _default_stage(task_id: str, status: str) -> dict:
    normalized_status = status.upper()
    if normalized_status == "PENDING":
        return {
            "name": "queued",
            "status": "pending",
            "progress": 0,
            "message": "Job is queued and waiting for a worker.",
            "details": {"task_id": task_id},
        }
    if normalized_status == "STARTED":
        return {
            "name": "queued",
            "status": "running",
            "progress": 1,
            "message": "Worker accepted the job and is preparing ingestion.",
            "details": {"task_id": task_id},
        }
    if normalized_status == "SUCCESS":
        return {
            "name": "completed",
            "status": "completed",
            "progress": 100,
            "message": "Job completed successfully.",
            "details": {"task_id": task_id},
        }
    return {
        "name": "failed",
        "status": "failed",
        "progress": 100,
        "message": "Job failed.",
        "details": {"task_id": task_id},
    }


def _build_job_status(task_id: str) -> IngestionJobStatusResponse:
    task = get_task_result(task_id)
    stage = None
    stage_history: list[dict] = []
    if isinstance(task.info, dict):
        stage = task.info.get("stage")
        if isinstance(task.info.get("stage_history"), list):
            stage_history = task.info["stage_history"]
    else:
        stage = _default_stage(task.id, task.status)
        stage_history = [stage]

    if stage is None:
        stage = _default_stage(task.id, task.status)
    if not stage_history:
        stage_history = [stage]

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


@router.get("", response_model=DocumentListResponse)
def get_documents() -> DocumentListResponse:
    return DocumentListResponse(documents=list_documents())


@router.post("/upload", response_model=DocumentListResponse)
async def upload_documents(files: list[UploadFile] = File(...)) -> DocumentListResponse:
    uploaded_documents = []
    for file in files:
        uploaded_documents.append(await save_uploaded_file(file))
    return DocumentListResponse(documents=uploaded_documents)


@router.post("/upload-and-ingest", response_model=DocumentJobResponse)
async def upload_and_ingest_document(file: UploadFile = File(...)) -> DocumentJobResponse:
    document = await save_uploaded_file(file)
    task = ingest_documents_task.delay(input_dir=document.absolute_path, recreate_collection=False)
    return DocumentJobResponse(task_id=task.id, status=task.status, document=document)


@router.post("/ingest-all", response_model=DocumentJobResponse)
def ingest_all_documents() -> DocumentJobResponse:
    task = ingest_documents_task.delay(input_dir=None, recreate_collection=True)
    return DocumentJobResponse(task_id=task.id, status=task.status, document=None)


@router.get("/jobs/{task_id}", response_model=IngestionJobStatusResponse)
def get_document_job(task_id: str) -> IngestionJobStatusResponse:
    return _build_job_status(task_id)


@router.post("/{document_id}/reindex", response_model=DocumentJobResponse)
def reindex_single_document(document_id: str) -> DocumentJobResponse:
    try:
        document = get_document_by_id(document_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    task = reindex_document_task.delay(document_id=document_id)
    return DocumentJobResponse(task_id=task.id, status=task.status, document=document)


@router.delete("/{document_id}", response_model=DocumentDeleteResponse)
def delete_single_document(document_id: str) -> DocumentDeleteResponse:
    try:
        return DocumentDeleteResponse(document=delete_document(document_id))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/search/similarity", response_model=RetrievalResponse)
def similarity_document_search(payload: RetrievalRequest) -> RetrievalResponse:
    return RetrievalResponse(results=similarity_search(query=payload.query, top_k=payload.top_k))


@router.post("/search/bm25", response_model=RetrievalResponse)
def bm25_document_search(payload: RetrievalRequest) -> RetrievalResponse:
    return RetrievalResponse(results=bm25_search(query=payload.query, top_k=payload.top_k))


@router.post("/search/advanced", response_model=RetrievalResponse)
def advanced_document_search(payload: AdvancedRetrievalRequest) -> RetrievalResponse:
    return RetrievalResponse(
        results=advanced_search(
            query=payload.query,
            top_k=payload.top_k,
            vector_top_k=payload.vector_top_k,
            bm25_top_k=payload.bm25_top_k,
        )
    )
