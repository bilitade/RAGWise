from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from app.api.schemas import (
    AdvancedRetrievalRequest,
    DocumentDeleteResponse,
    DocumentJobResponse,
    DocumentListResponse,
    IngestAllRequest,
    IngestionJobStatusResponse,
    RetrievalRequest,
    RetrievalResponse,
)
from app.config import CHUNK_SIZE_MAX, CHUNK_SIZE_MIN, UPLOAD_DIR
from app.core.deps import get_request_user_optional, require_active_user
from app.core.rbac import SearchMode, user_can_use_search_mode
from app.db.models import JobType, User
from app.db.session import get_db
from app.documents.service import delete_document, get_document_by_id, list_documents, save_uploaded_file
from app.ingestion.tasks import (
    get_task_result,
    ingest_documents_task,
    reindex_document_task,
    sync_stale_documents_task,
)
from app.retrieval.retrieval import advanced_search, bm25_search, similarity_search
from app.services.jobs_repo import record_job
from app.services.runtime_config import load_runtime_model_config
from app.services.usage_events import record_usage
from app.services.usage_limits import enforce_monthly_limit, record_billable_request
from sqlalchemy.orm import Session

router = APIRouter(prefix="/documents", tags=["documents"])


def _quota_check(user: User | None, db: Session) -> None:
    if user is None:
        return
    enforce_monthly_limit(user, db)


def _quota_commit(user: User | None, db: Session, route: str) -> None:
    if user is None:
        return
    record_billable_request(user, db)
    record_usage(db, user_id=user.id, route=route)


def _validate_chunk_params(
    chunk_size: int | None,
    chunk_overlap: int | None,
    user: User | None,
) -> None:
    from app.core.rbac import user_can_use_advanced_split

    if chunk_size is not None and (chunk_size < CHUNK_SIZE_MIN or chunk_size > CHUNK_SIZE_MAX):
        raise HTTPException(
            status_code=400,
            detail=f"chunk_size must be between {CHUNK_SIZE_MIN} and {CHUNK_SIZE_MAX}",
        )
    if chunk_overlap is not None and (chunk_overlap < 0 or chunk_overlap > CHUNK_SIZE_MAX):
        raise HTTPException(status_code=400, detail="chunk_overlap out of range")
    if chunk_size is not None or chunk_overlap is not None:
        if not user_can_use_advanced_split(user):
            raise HTTPException(status_code=403, detail="Custom chunk settings require pro or admin role")


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
def get_documents(
    user: User | None = Depends(require_active_user),
    db: Session = Depends(get_db),
) -> DocumentListResponse:
    _ = user
    return DocumentListResponse(documents=list_documents(db))


@router.post("/upload", response_model=DocumentListResponse)
async def upload_documents(
    files: list[UploadFile] = File(...),
    user: User | None = Depends(require_active_user),
    db: Session = Depends(get_db),
) -> DocumentListResponse:
    _ = user
    uploaded_documents = []
    for file in files:
        uploaded_documents.append(await save_uploaded_file(db, file))
    return DocumentListResponse(documents=uploaded_documents)


@router.post("/upload-and-ingest", response_model=DocumentJobResponse)
async def upload_and_ingest_document(
    file: UploadFile = File(...),
    chunk_size: int | None = Form(None),
    chunk_overlap: int | None = Form(None),
    user: User | None = Depends(require_active_user),
    db: Session = Depends(get_db),
) -> DocumentJobResponse:
    _validate_chunk_params(chunk_size, chunk_overlap, user)
    _quota_check(user, db)
    document = await save_uploaded_file(db, file)
    runtime_config = load_runtime_model_config(db)
    task = ingest_documents_task.delay(
        input_dir=document.absolute_path,
        recreate_collection=False,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        runtime_config=runtime_config.as_task_payload(),
    )
    uid = user.id if user else None
    record_job(
        db,
        celery_task_id=task.id,
        job_type=JobType.ingest,
        created_by_user_id=uid,
        meta={"path": document.absolute_path, "chunk_size": chunk_size, "chunk_overlap": chunk_overlap},
    )
    _quota_commit(user, db, "POST /api/documents/upload-and-ingest")
    return DocumentJobResponse(task_id=task.id, status=task.status, document=document)


@router.post("/ingest-all", response_model=DocumentJobResponse)
def ingest_all_documents_route(
    body: IngestAllRequest | None = None,
    user: User | None = Depends(require_active_user),
    db: Session = Depends(get_db),
) -> DocumentJobResponse:
    body = body or IngestAllRequest()
    _validate_chunk_params(body.chunk_size, body.chunk_overlap, user)
    _quota_check(user, db)
    runtime_config = load_runtime_model_config(db)
    task = ingest_documents_task.delay(
        input_dir=None,
        recreate_collection=True,
        chunk_size=body.chunk_size,
        chunk_overlap=body.chunk_overlap,
        runtime_config=runtime_config.as_task_payload(),
    )
    uid = user.id if user else None
    record_job(
        db,
        celery_task_id=task.id,
        job_type=JobType.ingest,
        created_by_user_id=uid,
        meta={"mode": "ingest-all", "chunk_size": body.chunk_size, "chunk_overlap": body.chunk_overlap},
    )
    _quota_commit(user, db, "POST /api/documents/ingest-all")
    return DocumentJobResponse(task_id=task.id, status=task.status, document=None)


@router.post("/sync-stale", response_model=DocumentJobResponse)
def sync_stale_documents_route(
    chunk_size: int | None = Query(None),
    chunk_overlap: int | None = Query(None),
    user: User | None = Depends(require_active_user),
    db: Session = Depends(get_db),
) -> DocumentJobResponse:
    """Queue re-ingest for files changed on disk since last index."""
    _validate_chunk_params(chunk_size, chunk_overlap, user)
    _quota_check(user, db)
    runtime_config = load_runtime_model_config(db)
    task = sync_stale_documents_task.delay(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        runtime_config=runtime_config.as_task_payload(),
    )
    uid = user.id if user else None
    record_job(
        db,
        celery_task_id=task.id,
        job_type=JobType.ingest,
        created_by_user_id=uid,
        meta={"mode": "sync-stale", "chunk_size": chunk_size, "chunk_overlap": chunk_overlap},
    )
    _quota_commit(user, db, "POST /api/documents/sync-stale")
    return DocumentJobResponse(task_id=task.id, status=task.status, document=None)


@router.get("/jobs/{task_id}", response_model=IngestionJobStatusResponse)
def get_document_job(
    task_id: str,
    user: User | None = Depends(require_active_user),
) -> IngestionJobStatusResponse:
    _ = user
    return _build_job_status(task_id)


@router.post("/{document_id}/reindex", response_model=DocumentJobResponse)
def reindex_single_document(
    document_id: str,
    chunk_size: int | None = Query(None),
    chunk_overlap: int | None = Query(None),
    user: User | None = Depends(require_active_user),
    db: Session = Depends(get_db),
) -> DocumentJobResponse:
    _validate_chunk_params(chunk_size, chunk_overlap, user)
    _quota_check(user, db)
    try:
        document = get_document_by_id(db, document_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    runtime_config = load_runtime_model_config(db)
    task = reindex_document_task.delay(
        document_id=document_id,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        runtime_config=runtime_config.as_task_payload(),
    )
    uid = user.id if user else None
    record_job(
        db,
        celery_task_id=task.id,
        job_type=JobType.reindex,
        created_by_user_id=uid,
        meta={"document_id": document_id, "chunk_size": chunk_size, "chunk_overlap": chunk_overlap},
    )
    _quota_commit(user, db, "POST /api/documents/{id}/reindex")
    return DocumentJobResponse(task_id=task.id, status=task.status, document=document)


@router.get("/{document_id}/download")
def download_document(
    document_id: str,
    user: User | None = Depends(require_active_user),
    db: Session = Depends(get_db),
) -> FileResponse:
    _ = user
    try:
        document = get_document_by_id(db, document_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    path = Path(document.absolute_path).resolve()
    base = UPLOAD_DIR.resolve()
    try:
        path.relative_to(base)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file path") from None
    if not path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, filename=document.filename, media_type="application/octet-stream")


@router.delete("/{document_id}", response_model=DocumentDeleteResponse)
def delete_single_document(
    document_id: str,
    user: User | None = Depends(require_active_user),
    db: Session = Depends(get_db),
) -> DocumentDeleteResponse:
    _ = user
    try:
        return DocumentDeleteResponse(document=delete_document(db, document_id))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/search/similarity", response_model=RetrievalResponse)
def similarity_document_search(
    payload: RetrievalRequest,
    user: User | None = Depends(get_request_user_optional),
    db: Session = Depends(get_db),
) -> RetrievalResponse:
    if not user_can_use_search_mode(user, SearchMode.similarity):
        raise HTTPException(status_code=403, detail="Not allowed")
    _quota_check(user, db)
    runtime_config = load_runtime_model_config(db)
    results = similarity_search(query=payload.query, top_k=payload.top_k, runtime_config=runtime_config)
    _quota_commit(user, db, "POST /api/documents/search/similarity")
    return RetrievalResponse(results=results)


@router.post("/search/bm25", response_model=RetrievalResponse)
def bm25_document_search(
    payload: RetrievalRequest,
    user: User | None = Depends(get_request_user_optional),
    db: Session = Depends(get_db),
) -> RetrievalResponse:
    if not user_can_use_search_mode(user, SearchMode.bm25):
        raise HTTPException(status_code=403, detail="BM25 search requires pro or admin")
    _quota_check(user, db)
    runtime_config = load_runtime_model_config(db)
    results = bm25_search(query=payload.query, top_k=payload.top_k, runtime_config=runtime_config)
    _quota_commit(user, db, "POST /api/documents/search/bm25")
    return RetrievalResponse(results=results)


@router.post("/search/advanced", response_model=RetrievalResponse)
def advanced_document_search(
    payload: AdvancedRetrievalRequest,
    user: User | None = Depends(get_request_user_optional),
    db: Session = Depends(get_db),
) -> RetrievalResponse:
    if not user_can_use_search_mode(user, SearchMode.advanced):
        raise HTTPException(status_code=403, detail="Hybrid search requires pro or admin")
    _quota_check(user, db)
    runtime_config = load_runtime_model_config(db)
    results = advanced_search(
        query=payload.query,
        top_k=payload.top_k,
        vector_top_k=payload.vector_top_k,
        bm25_top_k=payload.bm25_top_k,
        alpha=payload.hybrid_alpha,
        runtime_config=runtime_config,
    )
    _quota_commit(user, db, "POST /api/documents/search/advanced")
    return RetrievalResponse(results=results)
