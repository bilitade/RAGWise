import argparse
import json

from app.config import (
    CELERY_BROKER_URL,
    CELERY_RESULT_BACKEND,
    QDRANT_COLLECTION,
    QDRANT_DENSE_DATATYPE,
    QDRANT_DENSE_ON_DISK,
    QDRANT_DENSE_VECTOR_NAME,
    QDRANT_HYBRID_ALPHA,
    QDRANT_HYBRID_ENABLED,
    QDRANT_HNSW_EF_CONSTRUCT,
    QDRANT_HNSW_M,
    QDRANT_HNSW_PAYLOAD_M,
    QDRANT_QUERY_HNSW_EF,
    QDRANT_SPARSE_FULL_SCAN_THRESHOLD,
    QDRANT_SPARSE_ON_DISK,
    QDRANT_SPARSE_USE_IDF,
    QDRANT_SPARSE_VECTOR_NAME,
    QDRANT_URL,
    REDIS_URL,
    UPLOAD_DIR,
)
from app.db.qdrant import QdrantStore
from app.ingestion.loader import ingest_documents
from app.ingestion.tasks import get_task_result, ingest_documents_task
from app.retrieval.retrieval import hybrid_search, similarity_search


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="rag-cli",
        description="CLI for ingesting and searching the knowledge base.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    ingest_parser = subparsers.add_parser(
        "ingest",
        help="Load documents, chunk them, embed them, and index them in Qdrant.",
    )
    ingest_parser.add_argument(
        "--input-dir",
        default=str(UPLOAD_DIR),
        help="Directory containing documents to index.",
    )
    ingest_parser.add_argument(
        "--append",
        action="store_true",
        help="Append to the existing collection instead of recreating it.",
    )
    ingest_parser.add_argument(
        "--async",
        dest="run_async",
        action="store_true",
        help="Enqueue ingestion in Celery instead of running inline.",
    )

    search_parser = subparsers.add_parser(
        "search",
        help="Run retrieval against the indexed knowledge base.",
    )
    search_parser.add_argument("query", help="Search query.")
    search_parser.add_argument(
        "--top-k",
        type=int,
        default=5,
        help="Number of results to return.",
    )
    search_parser.add_argument(
        "--hybrid",
        action="store_true",
        help="Use dense retrieval fused with Qdrant sparse (lexical) search.",
    )
    search_parser.add_argument(
        "--vector-top-k",
        type=int,
        default=10,
        help="Candidate pool size for vector search in hybrid mode.",
    )
    search_parser.add_argument(
        "--bm25-top-k",
        type=int,
        default=10,
        help="Candidate pool size for sparse (lexical) retrieval in hybrid mode.",
    )
    search_parser.add_argument(
        "--hybrid-alpha",
        type=float,
        default=None,
        metavar="ALPHA",
        help="Dense weight in hybrid fusion (0–1); default from QDRANT_HYBRID_ALPHA (0.6).",
    )

    subparsers.add_parser(
        "status",
        help="Show Qdrant collection and hybrid retrieval status.",
    )

    task_status_parser = subparsers.add_parser(
        "task-status",
        help="Show the status of an ingestion task.",
    )
    task_status_parser.add_argument("task_id", help="Celery task id.")

    task_result_parser = subparsers.add_parser(
        "task-result",
        help="Fetch the result of a completed ingestion task.",
    )
    task_result_parser.add_argument("task_id", help="Celery task id.")
    return parser


def _run_ingest(args: argparse.Namespace) -> None:
    if args.run_async:
        async_result = ingest_documents_task.delay(
            input_dir=args.input_dir,
            recreate_collection=not args.append,
        )
        print(
            json.dumps(
                {
                    "task_id": async_result.id,
                    "status": async_result.status,
                    "broker_url": CELERY_BROKER_URL,
                },
                indent=2,
            )
        )
        return

    result = ingest_documents(
        input_dir=args.input_dir,
        recreate_collection=not args.append,
    )
    print(json.dumps(result.model_dump(), indent=2))


def _run_search(args: argparse.Namespace) -> None:
    if args.hybrid:
        results = hybrid_search(
            query=args.query,
            top_k=args.top_k,
            vector_top_k=args.vector_top_k,
            bm25_top_k=args.bm25_top_k,
            alpha=args.hybrid_alpha,
        )
    else:
        results = similarity_search(query=args.query, top_k=args.top_k)

    print(json.dumps([result.model_dump() for result in results], indent=2))


def _run_status() -> None:
    qdrant = QdrantStore()
    collection_exists = qdrant.collection_exists()
    hybrid = collection_exists and qdrant.is_hybrid_collection()
    status = {
        "qdrant_url": QDRANT_URL,
        "collection_name": QDRANT_COLLECTION,
        "collection_exists": collection_exists,
        "qdrant_points": qdrant.count() if collection_exists else 0,
        "qdrant_hybrid_enabled": QDRANT_HYBRID_ENABLED,
        "qdrant_hybrid_alpha": QDRANT_HYBRID_ALPHA,
        "qdrant_hybrid_collection": hybrid,
        "lexical_retrieval": "qdrant_sparse" if hybrid else "disabled_until_hybrid_collection",
        "dense_hnsw": {
            "m": QDRANT_HNSW_M,
            "payload_m": QDRANT_HNSW_PAYLOAD_M,
            "ef_construct": QDRANT_HNSW_EF_CONSTRUCT,
            "query_hnsw_ef": QDRANT_QUERY_HNSW_EF,
            "on_disk": QDRANT_DENSE_ON_DISK,
            "datatype": QDRANT_DENSE_DATATYPE,
        },
        "sparse_index": {
            "full_scan_threshold_vectors": QDRANT_SPARSE_FULL_SCAN_THRESHOLD,
            "on_disk": QDRANT_SPARSE_ON_DISK,
        },
        "vector_names": {
            "dense": QDRANT_DENSE_VECTOR_NAME,
            "sparse": QDRANT_SPARSE_VECTOR_NAME,
            "sparse_idf": QDRANT_SPARSE_USE_IDF,
        },
        "redis_url": REDIS_URL,
        "celery_broker_url": CELERY_BROKER_URL,
        "celery_result_backend": CELERY_RESULT_BACKEND,
    }
    print(json.dumps(status, indent=2))


def _default_task_stage(task_id: str, status: str) -> dict:
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


def _run_task_status(args: argparse.Namespace) -> None:
    task = get_task_result(args.task_id)
    stage = _default_task_stage(task.id, task.status)
    stage_history = [stage]
    if isinstance(task.info, dict):
        stage = task.info.get("stage") or stage
        stage_history = task.info.get("stage_history") or stage_history
    print(
        json.dumps(
            {
                "task_id": task.id,
                "status": task.status,
                "successful": task.successful(),
                "failed": task.failed(),
                "stage": stage,
                "stage_history": stage_history,
            },
            indent=2,
        )
    )


def _run_task_result(args: argparse.Namespace) -> None:
    task = get_task_result(args.task_id)
    payload = {
        "task_id": task.id,
        "status": task.status,
    }
    stage = _default_task_stage(task.id, task.status)
    stage_history = [stage]
    if isinstance(task.info, dict):
        stage = task.info.get("stage") or stage
        stage_history = task.info.get("stage_history") or stage_history
    payload["stage"] = stage
    payload["stage_history"] = stage_history
    if task.successful():
        payload["result"] = task.result
    elif task.failed():
        payload["error"] = str(task.result)
    print(json.dumps(payload, indent=2))


def main() -> None:
    parser = _build_parser()
    args = parser.parse_args()

    if args.command == "ingest":
        _run_ingest(args)
        return

    if args.command == "search":
        _run_search(args)
        return

    if args.command == "status":
        _run_status()
        return

    if args.command == "task-status":
        _run_task_status(args)
        return

    if args.command == "task-result":
        _run_task_result(args)
        return

    parser.error(f"Unknown command: {args.command}")


if __name__ == "__main__":
    main()
