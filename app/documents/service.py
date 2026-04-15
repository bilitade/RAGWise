from datetime import UTC, datetime
from pathlib import Path
import secrets

from fastapi import UploadFile
from pydantic import BaseModel, ConfigDict
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.config import UPLOAD_DIR
from app.db.models import Document as DocumentRow
from app.db.qdrant import QdrantStore
from app.ingestion.loader import (
    IngestionResult,
    IngestionStage,
    ProgressCallback,
    build_document_id,
    ingest_documents,
    ingest_file_paths,
    list_source_files,
)
from app.services.documents_repo import (
    delete_document_row,
    ensure_migrated,
    upsert_document_row,
)
from app.services.runtime_config import RuntimeModelConfig


class ManagedDocument(BaseModel):
    model_config = ConfigDict(frozen=True)

    document_id: str
    filename: str
    relative_path: str
    absolute_path: str
    size_bytes: int
    modified_at: str
    indexed: bool
    needs_reindex: bool
    status: str
    indexed_at: str | None = None

def _build_managed_document(file_path: Path, row: DocumentRow | None) -> ManagedDocument:
    stat = file_path.stat()
    indexed = row is not None and row.status == "indexed"
    needs_reindex = bool(
        row
        and (
            row.size_bytes != stat.st_size
            or abs(row.file_mtime - stat.st_mtime) > 0.001
        )
    )
    status = "indexed" if indexed and not needs_reindex else "stale" if row and indexed else "uploaded"

    indexed_at = row.indexed_at.isoformat() if row and row.indexed_at else None

    return ManagedDocument(
        document_id=build_document_id(file_path),
        filename=file_path.name,
        relative_path=file_path.relative_to(UPLOAD_DIR).as_posix(),
        absolute_path=str(file_path.resolve()),
        size_bytes=stat.st_size,
        modified_at=datetime.fromtimestamp(stat.st_mtime, tz=UTC).isoformat(),
        indexed=indexed,
        needs_reindex=needs_reindex,
        status=status,
        indexed_at=indexed_at,
    )


def list_documents(db: Session) -> list[ManagedDocument]:
    ensure_migrated(db)
    rows = {r.document_id: r for r in db.scalars(select(DocumentRow)).all()}
    documents: list[ManagedDocument] = []
    if not UPLOAD_DIR.exists():
        return documents
    for file_path in list_source_files():
        documents.append(
            _build_managed_document(
                file_path=file_path,
                row=rows.get(build_document_id(file_path)),
            )
        )
    return documents


def get_document_by_id(db: Session, document_id: str) -> ManagedDocument:
    for document in list_documents(db):
        if document.document_id == document_id:
            return document
    raise FileNotFoundError(f"Document not found: {document_id}")


async def save_uploaded_file(db: Session, file: UploadFile) -> ManagedDocument:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    filename = Path(file.filename or "upload.bin").name
    destination = (UPLOAD_DIR / filename).resolve()
    tmp_destination = destination.with_suffix(destination.suffix + f".{secrets.token_hex(4)}.part")
    try:
        with tmp_destination.open("wb") as output_file:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                output_file.write(chunk)
        tmp_destination.replace(destination)
    finally:
        await file.close()
        if tmp_destination.exists():
            tmp_destination.unlink(missing_ok=True)
    doc_id = build_document_id(destination)
    stat = destination.stat()
    upsert_document_row(
        db,
        document_id=doc_id,
        filename=filename,
        relative_path=destination.relative_to(UPLOAD_DIR).as_posix(),
        size_bytes=stat.st_size,
        file_mtime=stat.st_mtime,
        status="uploaded",
        indexed_at=None,
    )
    db.commit()
    return get_document_by_id(db, doc_id)


def _sync_documents_for_paths(db: Session, file_paths: list[Path], *, replace_all: bool = False) -> None:
    if replace_all:
        db.execute(delete(DocumentRow))
        db.commit()
    now = datetime.now(tz=UTC)
    for file_path in file_paths:
        stat = file_path.stat()
        doc_id = build_document_id(file_path)
        upsert_document_row(
            db,
            document_id=doc_id,
            filename=file_path.name,
            relative_path=file_path.relative_to(UPLOAD_DIR).as_posix(),
            size_bytes=stat.st_size,
            file_mtime=stat.st_mtime,
            status="indexed",
            indexed_at=now,
        )
    db.commit()


def ingest_single_document(
    db: Session,
    file_path: str | Path,
    *,
    progress_callback: ProgressCallback | None = None,
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
    runtime_config: RuntimeModelConfig | None = None,
) -> IngestionResult:
    resolved_path = Path(file_path).resolve()
    result = ingest_file_paths(
        [resolved_path],
        recreate_collection=False,
        replace_existing_documents=True,
        progress_callback=progress_callback,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        runtime_config=runtime_config,
    )
    _sync_documents_for_paths(db, [resolved_path], replace_all=False)
    return result


def ingest_all_documents(
    db: Session,
    *,
    progress_callback: ProgressCallback | None = None,
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
    runtime_config: RuntimeModelConfig | None = None,
) -> IngestionResult:
    result = ingest_documents(
        recreate_collection=True,
        progress_callback=progress_callback,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        runtime_config=runtime_config,
    )
    file_paths = list_source_files()
    _sync_documents_for_paths(db, file_paths, replace_all=True)
    return result


def reindex_document(
    db: Session,
    document_id: str,
    *,
    progress_callback: ProgressCallback | None = None,
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
    runtime_config: RuntimeModelConfig | None = None,
) -> IngestionResult:
    document = get_document_by_id(db, document_id)
    return ingest_single_document(
        db,
        document.absolute_path,
        progress_callback=progress_callback,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        runtime_config=runtime_config,
    )


def reindex_stale_documents(
    db: Session,
    *,
    progress_callback: ProgressCallback | None = None,
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
    runtime_config: RuntimeModelConfig | None = None,
) -> IngestionResult:
    """Reindex every file whose content differs from the last successful index (vectors + BM25 in one run)."""
    stale_paths: list[Path] = []
    for doc in list_documents(db):
        if not doc.needs_reindex:
            continue
        path = Path(doc.absolute_path)
        if path.is_file():
            stale_paths.append(path)

    if not stale_paths:
        qdrant = QdrantStore()
        q_points = qdrant.count() if qdrant.collection_exists() else 0
        return IngestionResult(
            input_dir=str(UPLOAD_DIR),
            recreate_collection=False,
            documents_indexed=0,
            nodes_indexed=0,
            collection_name=qdrant.collection_name,
            qdrant_points=q_points,
            stages=[
                IngestionStage(
                    name="completed",
                    status="completed",
                    progress=100,
                    message="No stale documents; index unchanged.",
                    details={"stale_paths": 0},
                )
            ],
            bm25_cache_path="",
        )

    result = ingest_file_paths(
        stale_paths,
        recreate_collection=False,
        replace_existing_documents=True,
        progress_callback=progress_callback,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        runtime_config=runtime_config,
    )
    _sync_documents_for_paths(db, stale_paths, replace_all=False)
    return result


def delete_document(db: Session, document_id: str) -> ManagedDocument:
    document = get_document_by_id(db, document_id)
    file_path = Path(document.absolute_path)

    qdrant = QdrantStore()
    qdrant.delete_by_document_id(document_id)

    delete_document_row(db, document_id)
    db.commit()

    if file_path.exists():
        file_path.unlink()

    return document


def sync_document_rows_after_paths(db: Session, paths: list[Path]) -> None:
    """Update SQL document rows after a raw `ingest_documents` (loader) run."""
    _sync_documents_for_paths(db, paths, replace_all=False)
