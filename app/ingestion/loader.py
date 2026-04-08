import argparse
import hashlib
import json
from pathlib import Path
import re
from typing import Any, Callable, Literal

from llama_index.core import SimpleDirectoryReader, StorageContext, VectorStoreIndex
from llama_index.core.node_parser import SentenceSplitter
from llama_index.core.schema import Document
from llama_index.embeddings.openai import OpenAIEmbedding
from pydantic import BaseModel, ConfigDict, Field

from app.config import (
    BM25_CACHE_PATH,
    INGEST_CHUNK_OVERLAP,
    INGEST_CHUNK_SIZE,
    OPENAI_EMBED_MODEL,
    UPLOAD_DIR,
)
from app.db.qdrant import QdrantStore


IngestionStageName = Literal[
    "queued",
    "upload_received",
    "discovering_files",
    "loading_documents",
    "chunking_documents",
    "preparing_vector_store",
    "embedding_and_indexing",
    "persisting_bm25_cache",
    "completed",
    "failed",
]

IngestionStageStatus = Literal["pending", "running", "completed", "failed"]


class IngestionStage(BaseModel):
    model_config = ConfigDict(frozen=True)

    name: IngestionStageName
    status: IngestionStageStatus
    progress: int
    message: str
    details: dict[str, Any] = Field(default_factory=dict)


class IngestionResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    input_dir: str
    recreate_collection: bool
    documents_indexed: int
    nodes_indexed: int
    collection_name: str
    qdrant_points: int
    bm25_cache_path: str
    stages: list[IngestionStage]


ProgressCallback = Callable[[IngestionStage], None]


def _emit_progress(
    callback: ProgressCallback | None,
    *,
    name: IngestionStageName,
    status: IngestionStageStatus,
    progress: int,
    message: str,
    details: dict[str, Any] | None = None,
) -> IngestionStage:
    stage = IngestionStage(
        name=name,
        status=status,
        progress=progress,
        message=message,
        details=details or {},
    )
    if callback is not None:
        callback(stage)
    return stage


def _build_embed_model() -> OpenAIEmbedding:
    return OpenAIEmbedding(model=OPENAI_EMBED_MODEL)


def _extract_node_text(node: Any) -> str:
    text = getattr(node, "text", None)
    if text:
        return text
    return node.get_content()


def _normalize_document_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def build_document_id(file_path: str | Path) -> str:
    path = Path(file_path).resolve()
    try:
        normalized_path = path.relative_to(UPLOAD_DIR.resolve()).as_posix()
    except ValueError:
        normalized_path = path.as_posix()
    return hashlib.sha1(normalized_path.encode("utf-8")).hexdigest()


def _resolve_relative_path(file_path: Path) -> str:
    try:
        return file_path.resolve().relative_to(UPLOAD_DIR.resolve()).as_posix()
    except ValueError:
        return file_path.resolve().name


def list_source_files(input_dir: str | Path | None = None) -> list[Path]:
    source_dir = Path(input_dir) if input_dir else UPLOAD_DIR
    if not source_dir.exists():
        raise FileNotFoundError(f"Input directory does not exist: {source_dir}")
    return sorted(path for path in source_dir.rglob("*") if path.is_file())


def _build_file_extractors(file_paths: list[Path]) -> dict[str, Any]:
    suffixes = {path.suffix.lower() for path in file_paths}
    if not suffixes:
        return {}

    try:
        from llama_index.readers.file import DocxReader, EpubReader, MarkdownReader, PptxReader, PyMuPDFReader
    except ImportError as exc:
        raise RuntimeError(
            "Specialized file readers are not installed. "
            "Add `llama-index-readers-file` to enable PDF, EPUB, PPTX, DOCX, and Markdown parsing."
        ) from exc

    extractors: dict[str, Any] = {}

    if ".pdf" in suffixes:
        try:
            import fitz  # noqa: F401
        except ImportError as exc:
            raise RuntimeError(
                "PDF ingestion requires PyMuPDF. Install the `pymupdf` package so `fitz` is available."
            ) from exc
        extractors[".pdf"] = PyMuPDFReader()

    if ".md" in suffixes or ".markdown" in suffixes:
        markdown_reader = MarkdownReader()
        extractors[".md"] = markdown_reader
        extractors[".markdown"] = markdown_reader

    if ".epub" in suffixes:
        extractors[".epub"] = EpubReader()

    if ".pptx" in suffixes or ".ppt" in suffixes:
        pptx_reader = PptxReader()
        extractors[".pptx"] = pptx_reader
        extractors[".ppt"] = pptx_reader

    if ".docx" in suffixes:
        extractors[".docx"] = DocxReader()

    return extractors


def load_documents_from_files(file_paths: list[Path]) -> list[Document]:
    if not file_paths:
        raise ValueError("No files were provided for ingestion.")

    reader = SimpleDirectoryReader(
        input_files=[str(path) for path in file_paths],
        filename_as_id=True,
        file_extractor=_build_file_extractors(file_paths),
    )
    documents = reader.load_data()
    if not documents:
        raise ValueError("No documents were loaded from the provided files.")

    enriched_documents: list[Document] = []
    for document in documents:
        metadata = dict(document.metadata or {})
        file_path_value = metadata.get("file_path") or metadata.get("filename") or document.doc_id
        source_path = Path(str(file_path_value)).resolve()
        normalized_text = _normalize_document_text(document.text or "")
        metadata.update(
            {
                "document_id": build_document_id(source_path),
                "filename": source_path.name,
                "source_path": str(source_path),
                "relative_path": _resolve_relative_path(source_path),
                "file_type": source_path.suffix.lower(),
            }
        )
        document.set_content(normalized_text)
        document.metadata = metadata
        document.doc_id = metadata["document_id"]
        enriched_documents.append(document)

    return enriched_documents


def build_nodes(
    documents: list[Document],
    *,
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
) -> list:
    cs = INGEST_CHUNK_SIZE if chunk_size is None else chunk_size
    co = INGEST_CHUNK_OVERLAP if chunk_overlap is None else chunk_overlap
    splitter = SentenceSplitter(
        chunk_size=cs,
        chunk_overlap=co,
    )
    return splitter.get_nodes_from_documents(documents)


def persist_bm25_cache(nodes, cache_path: Path = BM25_CACHE_PATH) -> None:
    cache_path.parent.mkdir(parents=True, exist_ok=True)

    with cache_path.open("w", encoding="utf-8") as cache_file:
        for node in nodes:
            payload = {
                "id": node.node_id,
                "text": _extract_node_text(node),
                "metadata": node.metadata,
            }
            cache_file.write(json.dumps(payload, ensure_ascii=True, default=str))
            cache_file.write("\n")


def rebuild_bm25_cache_from_files(
    file_paths: list[Path],
    cache_path: Path = BM25_CACHE_PATH,
    *,
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
) -> None:
    if not file_paths:
        if cache_path.exists():
            cache_path.unlink()
        return

    documents = load_documents_from_files(file_paths)
    nodes = build_nodes(documents, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    persist_bm25_cache(nodes, cache_path=cache_path)


def ingest_file_paths(
    file_paths: list[Path],
    *,
    recreate_collection: bool = False,
    replace_existing_documents: bool = False,
    progress_callback: ProgressCallback | None = None,
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
) -> IngestionResult:
    if not file_paths:
        raise ValueError("No files were provided for ingestion.")

    normalized_file_paths = [path.resolve() for path in file_paths]
    stages: list[IngestionStage] = []

    try:
        stages.append(
            _emit_progress(
                progress_callback,
                name="upload_received",
                status="running",
                progress=2,
                message="Ingestion request received.",
                details={
                    "files_requested": len(normalized_file_paths),
                    "recreate_collection": recreate_collection,
                    "replace_existing_documents": replace_existing_documents,
                    "chunk_size": chunk_size,
                    "chunk_overlap": chunk_overlap,
                },
            )
        )

        stages.append(
            _emit_progress(
                progress_callback,
                name="discovering_files",
                status="running",
                progress=8,
                message="Discovering uploaded files.",
                details={
                    "files_detected": len(normalized_file_paths),
                    "file_paths": [str(path) for path in normalized_file_paths],
                },
            )
        )

        stages.append(
            _emit_progress(
                progress_callback,
                name="loading_documents",
                status="running",
                progress=20,
                message="Loading documents for parsing.",
                details={"files_detected": len(normalized_file_paths)},
            )
        )
        documents = load_documents_from_files(normalized_file_paths)

        stages.append(
            _emit_progress(
                progress_callback,
                name="chunking_documents",
                status="running",
                progress=40,
                message="Splitting documents into retrieval chunks.",
                details={"documents_loaded": len(documents)},
            )
        )
        nodes = build_nodes(documents, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
        if not nodes:
            raise ValueError("No nodes were generated from the loaded documents.")

        stages.append(
            _emit_progress(
                progress_callback,
                name="preparing_vector_store",
                status="running",
                progress=60,
                message="Preparing embedding model and Qdrant collection.",
                details={"nodes_generated": len(nodes)},
            )
        )
        embed_model = _build_embed_model()
        vector_size = len(embed_model.get_text_embedding("dimension probe"))
        qdrant = QdrantStore()
        qdrant.ensure_collection(vector_size=vector_size, recreate=recreate_collection)

        if replace_existing_documents:
            for file_path in normalized_file_paths:
                qdrant.delete_by_document_id(build_document_id(file_path))

        stages.append(
            _emit_progress(
                progress_callback,
                name="embedding_and_indexing",
                status="running",
                progress=80,
                message="Embedding chunks and storing vectors in Qdrant.",
                details={"vector_size": vector_size, "nodes_generated": len(nodes)},
            )
        )
        storage_context = StorageContext.from_defaults(
            vector_store=qdrant.get_vector_store(),
        )
        VectorStoreIndex(
            nodes=nodes,
            storage_context=storage_context,
            embed_model=embed_model,
        )

        stages.append(
            _emit_progress(
                progress_callback,
                name="persisting_bm25_cache",
                status="running",
                progress=92,
                message="Persisting lexical retrieval cache.",
                details={"bm25_cache_path": str(BM25_CACHE_PATH)},
            )
        )

        stages.append(
            _emit_progress(
                progress_callback,
                name="completed",
                status="completed",
                progress=100,
                message="Ingestion completed successfully.",
                details={
                    "documents_indexed": len(documents),
                    "nodes_indexed": len(nodes),
                },
            )
        )

        return IngestionResult(
            input_dir=str(UPLOAD_DIR),
            recreate_collection=recreate_collection,
            documents_indexed=len(documents),
            nodes_indexed=len(nodes),
            collection_name=qdrant.collection_name,
            qdrant_points=qdrant.count(),
            bm25_cache_path=str(BM25_CACHE_PATH),
            stages=stages,
        )
    except Exception as exc:
        stages.append(
            _emit_progress(
                progress_callback,
                name="failed",
                status="failed",
                progress=100,
                message="Ingestion failed.",
                details={"error": str(exc)},
            )
        )
        raise


def ingest_documents(
    input_dir: str | Path | None = None,
    recreate_collection: bool = True,
    progress_callback: ProgressCallback | None = None,
    *,
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
) -> IngestionResult:
    source_files = list_source_files(input_dir=input_dir)
    result = ingest_file_paths(
        source_files,
        recreate_collection=recreate_collection,
        replace_existing_documents=not recreate_collection,
        progress_callback=progress_callback,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )
    return result.model_copy(update={"input_dir": str(Path(input_dir) if input_dir else UPLOAD_DIR)})


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest documents into Qdrant.")
    parser.add_argument(
        "--input-dir",
        default=str(UPLOAD_DIR),
        help="Directory of source documents to index.",
    )
    parser.add_argument(
        "--append",
        action="store_true",
        help="Append to the existing collection instead of recreating it.",
    )
    args = parser.parse_args()

    result = ingest_documents(
        input_dir=args.input_dir,
        recreate_collection=not args.append,
    )
    print(json.dumps(result.model_dump(), indent=2))


if __name__ == "__main__":
    main()
