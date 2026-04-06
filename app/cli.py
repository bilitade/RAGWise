import argparse
import json

from app.config import BM25_CACHE_PATH, QDRANT_COLLECTION, QDRANT_URL, UPLOAD_DIR
from app.db.qdrant import QdrantStore
from app.ingestion.loader import ingest_documents
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
        help="Use dense retrieval fused with BM25.",
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
        help="Candidate pool size for BM25 retrieval in hybrid mode.",
    )

    subparsers.add_parser(
        "status",
        help="Show Qdrant collection and BM25 cache status.",
    )
    return parser


def _run_ingest(args: argparse.Namespace) -> None:
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
        )
    else:
        results = similarity_search(query=args.query, top_k=args.top_k)

    print(json.dumps([result.model_dump() for result in results], indent=2))


def _run_status() -> None:
    qdrant = QdrantStore()
    collection_exists = qdrant.collection_exists()
    status = {
        "qdrant_url": QDRANT_URL,
        "collection_name": QDRANT_COLLECTION,
        "collection_exists": collection_exists,
        "qdrant_points": qdrant.count() if collection_exists else 0,
        "bm25_cache_path": str(BM25_CACHE_PATH),
        "bm25_cache_exists": BM25_CACHE_PATH.exists(),
    }
    print(json.dumps(status, indent=2))


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

    parser.error(f"Unknown command: {args.command}")


if __name__ == "__main__":
    main()
