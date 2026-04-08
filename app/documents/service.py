from datetime import UTC, datetime
import json
from pathlib import Path

from fastapi import UploadFile
from pydantic import BaseModel, ConfigDict

from app.config import BM25_CACHE_PATH, DOCUMENT_REGISTRY_PATH, UPLOAD_DIR
from app.db.qdrant import QdrantStore
from app.ingestion.loader import (
    IngestionResult,
    ProgressCallback,
    build_document_id,
    ingest_documents,
    ingest_file_paths,
    list_source_files,
    rebuild_bm25_cache_from_files,
)


class DocumentRegistryEntry(BaseModel):
    model_config = ConfigDict(frozen=True)

    document_id: str
    filename: str
    relative_path: str
    indexed_size_bytes: int
    indexed_modified_at: float
    indexed_at: str


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


def _utc_now() -> str:
    return datetime.now(tz=UTC).isoformat()


def _load_registry() -> dict[str, DocumentRegistryEntry]:
    if not DOCUMENT_REGISTRY_PATH.exists():
        return {}

    payload = json.loads(DOCUMENT_REGISTRY_PATH.read_text(encoding="utf-8"))
    entries = [
        DocumentRegistryEntry.model_validate(item)
        for item in payload.get("documents", [])
    ]
    return {entry.document_id: entry for entry in entries}


def _save_registry(entries: dict[str, DocumentRegistryEntry]) -> None:
    DOCUMENT_REGISTRY_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "documents": [
            entry.model_dump()
            for entry in sorted(entries.values(), key=lambda item: item.relative_path)
        ]
    }
    DOCUMENT_REGISTRY_PATH.write_text(
        json.dumps(payload, indent=2, ensure_ascii=True),
        encoding="utf-8",
    )


def _build_managed_document(file_path: Path, entry: DocumentRegistryEntry | None) -> ManagedDocument:
    stat = file_path.stat()
    indexed = entry is not None
    needs_reindex = bool(
        entry
        and (
            entry.indexed_size_bytes != stat.st_size
            or abs(entry.indexed_modified_at - stat.st_mtime) > 0.001
        )
    )
    status = "indexed" if indexed and not needs_reindex else "stale" if indexed else "uploaded"

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
        indexed_at=entry.indexed_at if entry else None,
    )


def _update_registry_for_paths(file_paths: list[Path], *, replace_all: bool = False) -> None:
    existing = {} if replace_all else _load_registry()
    for file_path in file_paths:
        stat = file_path.stat()
        entry = DocumentRegistryEntry(
            document_id=build_document_id(file_path),
            filename=file_path.name,
            relative_path=file_path.relative_to(UPLOAD_DIR).as_posix(),
            indexed_size_bytes=stat.st_size,
            indexed_modified_at=stat.st_mtime,
            indexed_at=_utc_now(),
        )
        existing[entry.document_id] = entry
    _save_registry(existing)


def list_documents() -> list[ManagedDocument]:
    registry = _load_registry()
    documents: list[ManagedDocument] = []
    if not UPLOAD_DIR.exists():
        return documents
    for file_path in list_source_files():
        documents.append(
            _build_managed_document(
                file_path=file_path,
                entry=registry.get(build_document_id(file_path)),
            )
        )
    return documents


def get_document_by_id(document_id: str) -> ManagedDocument:
    for document in list_documents():
        if document.document_id == document_id:
            return document
    raise FileNotFoundError(f"Document not found: {document_id}")


async def save_uploaded_file(file: UploadFile) -> ManagedDocument:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    filename = Path(file.filename or "upload.bin").name
    destination = (UPLOAD_DIR / filename).resolve()
    content = await file.read()
    destination.write_bytes(content)
    await file.close()
    return get_document_by_id(build_document_id(destination))


def ingest_single_document(
    file_path: str | Path,
    *,
    progress_callback: ProgressCallback | None = None,
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
) -> IngestionResult:
    resolved_path = Path(file_path).resolve()
    result = ingest_file_paths(
        [resolved_path],
        recreate_collection=False,
        replace_existing_documents=True,
        progress_callback=progress_callback,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )
    _update_registry_for_paths([resolved_path], replace_all=False)
    rebuild_bm25_cache_from_files(
        [Path(document.absolute_path) for document in list_documents() if document.indexed],
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )
    return result


def ingest_all_documents(
    *,
    progress_callback: ProgressCallback | None = None,
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
) -> IngestionResult:
    result = ingest_documents(
        recreate_collection=True,
        progress_callback=progress_callback,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )
    file_paths = list_source_files()
    _update_registry_for_paths(file_paths, replace_all=True)
    rebuild_bm25_cache_from_files(file_paths, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    return result


def reindex_document(
    document_id: str,
    *,
    progress_callback: ProgressCallback | None = None,
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
) -> IngestionResult:
    document = get_document_by_id(document_id)
    return ingest_single_document(
        document.absolute_path,
        progress_callback=progress_callback,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )


def delete_document(document_id: str) -> ManagedDocument:
    document = get_document_by_id(document_id)
    file_path = Path(document.absolute_path)

    qdrant = QdrantStore()
    qdrant.delete_by_document_id(document_id)

    registry = _load_registry()
    registry.pop(document_id, None)
    _save_registry(registry)

    if file_path.exists():
        file_path.unlink()

    indexed_file_paths = []
    for item in list_documents():
        if item.indexed:
            indexed_file_paths.append(Path(item.absolute_path))
    rebuild_bm25_cache_from_files(indexed_file_paths)

    if not indexed_file_paths and BM25_CACHE_PATH.exists():
        BM25_CACHE_PATH.unlink()

    return document
