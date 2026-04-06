import argparse
import json
from pathlib import Path
from typing import Any, Callable, Literal

from llama_index.core import SimpleDirectoryReader, StorageContext, VectorStoreIndex
from llama_index.core.node_parser import SentenceSplitter
from llama_index.embeddings.openai import OpenAIEmbedding
from pydantic import BaseModel, ConfigDict

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
    details: dict[str, Any] = {}


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


def _count_source_files(source_dir: Path) -> int:
    return sum(1 for path in source_dir.rglob("*") if path.is_file())


def load_documents(input_dir: str | Path | None = None):
    source_dir = Path(input_dir) if input_dir else UPLOAD_DIR
    if not source_dir.exists():
        raise FileNotFoundError(f"Input directory does not exist: {source_dir}")

    reader = SimpleDirectoryReader(
        input_dir=str(source_dir),
        recursive=True,
        filename_as_id=True,
    )
    documents = reader.load_data()
    if not documents:
        raise ValueError(f"No documents found in {source_dir}")
    return documents


def build_nodes(documents):
    splitter = SentenceSplitter(
        chunk_size=INGEST_CHUNK_SIZE,
        chunk_overlap=INGEST_CHUNK_OVERLAP,
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


def ingest_documents(
    input_dir: str | Path | None = None,
    recreate_collection: bool = True,
    progress_callback: ProgressCallback | None = None,
) -> IngestionResult:
    source_dir = Path(input_dir) if input_dir else UPLOAD_DIR
    stages: list[IngestionStage] = []

    try:
        file_count = _count_source_files(source_dir)
        stages.append(
            _emit_progress(
                progress_callback,
                name="upload_received",
                status="running",
                progress=2,
                message="Ingestion request received.",
                details={
                    "input_dir": str(source_dir),
                    "recreate_collection": recreate_collection,
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
                    "input_dir": str(source_dir),
                    "files_detected": file_count,
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
                details={"input_dir": str(source_dir)},
            )
        )
        documents = load_documents(input_dir=source_dir)

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
        nodes = build_nodes(documents)
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
        persist_bm25_cache(nodes)

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
            input_dir=str(source_dir),
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
                details={"error": str(exc), "input_dir": str(source_dir)},
            )
        )
        raise


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
