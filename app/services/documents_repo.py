"""Persist document metadata in PostgreSQL (replaces JSON registry)."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import DOCUMENT_REGISTRY_PATH, UPLOAD_DIR
from app.db.models import Document as DocumentRow
from app.ingestion.loader import build_document_id, list_source_files


def _utc_now() -> datetime:
    return datetime.now(tz=UTC)


def migrate_json_registry_if_present(db: Session) -> int:
    """One-time import from legacy knowledge_base_*_documents.json into SQL."""
    if not DOCUMENT_REGISTRY_PATH.exists():
        return 0
    existing = db.scalar(select(DocumentRow.document_id).limit(1))
    if existing is not None:
        return 0
    payload = json.loads(DOCUMENT_REGISTRY_PATH.read_text(encoding="utf-8"))
    count = 0
    for item in payload.get("documents", []):
        doc_id = item.get("document_id")
        if not doc_id:
            continue
        stat_path = (UPLOAD_DIR / item.get("relative_path", "")).resolve()
        mtime = stat_path.stat().st_mtime if stat_path.is_file() else item.get("indexed_modified_at", 0.0)
        size = stat_path.stat().st_size if stat_path.is_file() else item.get("indexed_size_bytes", 0)
        row = DocumentRow(
            document_id=doc_id,
            filename=item.get("filename", ""),
            relative_path=item.get("relative_path", ""),
            size_bytes=int(size),
            file_mtime=float(mtime),
            status="indexed",
            indexed_at=_utc_now(),
            meta=None,
        )
        db.merge(row)
        count += 1
    if count:
        db.commit()
    return count


def upsert_document_row(
    db: Session,
    *,
    document_id: str,
    filename: str,
    relative_path: str,
    size_bytes: int,
    file_mtime: float,
    status: str,
    indexed_at: datetime | None,
) -> None:
    row = db.get(DocumentRow, document_id)
    if row is None:
        row = DocumentRow(document_id=document_id)
        db.add(row)
    row.filename = filename
    row.relative_path = relative_path
    row.size_bytes = size_bytes
    row.file_mtime = file_mtime
    row.status = status
    row.indexed_at = indexed_at
    row.updated_at = _utc_now()


def delete_document_row(db: Session, document_id: str) -> None:
    row = db.get(DocumentRow, document_id)
    if row:
        db.delete(row)


def list_document_rows(db: Session) -> dict[str, DocumentRow]:
    rows = db.scalars(select(DocumentRow)).all()
    return {r.document_id: r for r in rows}


def ensure_migrated(db: Session) -> None:
    migrate_json_registry_if_present(db)
