import argparse
import json
from pathlib import Path
from typing import Any

from llama_index.core import VectorStoreIndex
from llama_index.core.schema import TextNode
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.retrievers.bm25 import BM25Retriever
from pydantic import BaseModel, ConfigDict

from app.config import BM25_CACHE_PATH, OPENAI_EMBED_MODEL
from app.db.qdrant import QdrantStore


class SearchResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    node_id: str
    score: float
    text: str
    metadata: dict[str, Any]
    source: str
    matched_by: tuple[str, ...] = ()


def _build_embed_model() -> OpenAIEmbedding:
    return OpenAIEmbedding(model=OPENAI_EMBED_MODEL)


def _extract_node_text(node: Any) -> str:
    text = getattr(node, "text", None)
    if text:
        return text
    return node.get_content()


def _load_bm25_nodes(cache_path: Path = BM25_CACHE_PATH) -> list[TextNode]:
    """Load lexical index nodes; empty if cache missing or empty (run ingestion to populate)."""
    if not cache_path.exists():
        return []

    nodes: list[TextNode] = []
    with cache_path.open(encoding="utf-8") as cache_file:
        for line in cache_file:
            line = line.strip()
            if not line:
                continue
            payload = json.loads(line)
            nodes.append(
                TextNode(
                    id_=payload["id"],
                    text=payload["text"],
                    metadata=payload.get("metadata") or {},
                )
            )

    return nodes


def _get_vector_index() -> VectorStoreIndex:
    qdrant = QdrantStore()
    return VectorStoreIndex.from_vector_store(
        vector_store=qdrant.get_vector_store(),
        embed_model=_build_embed_model(),
    )


def _to_search_result(node_with_score: Any, source: str) -> SearchResult:
    node = node_with_score.node
    return SearchResult(
        node_id=node.node_id,
        score=float(node_with_score.score or 0.0),
        text=_extract_node_text(node),
        metadata=node.metadata,
        source=source,
        matched_by=(source,),
    )


def similarity_search(query: str, top_k: int = 5) -> list[SearchResult]:
    retriever = _get_vector_index().as_retriever(similarity_top_k=top_k)
    results = retriever.retrieve(query)
    return [_to_search_result(result, source="vector") for result in results]


def bm25_search(query: str, top_k: int = 5) -> list[SearchResult]:
    nodes = _load_bm25_nodes()
    if not nodes:
        return []
    results = BM25Retriever.from_defaults(
        nodes=nodes,
        similarity_top_k=top_k,
    ).retrieve(query)
    return [_to_search_result(result, source="bm25") for result in results]


def hybrid_search(
    query: str,
    top_k: int = 5,
    vector_top_k: int = 10,
    bm25_top_k: int = 10,
    dense_weight: float = 0.6,
    bm25_weight: float = 0.4,
    rrf_k: int = 60,
) -> list[SearchResult]:
    dense_results = _get_vector_index().as_retriever(
        similarity_top_k=vector_top_k,
    ).retrieve(query)
    bm25_nodes = _load_bm25_nodes()
    if bm25_nodes:
        bm25_results = BM25Retriever.from_defaults(
            nodes=bm25_nodes,
            similarity_top_k=bm25_top_k,
        ).retrieve(query)
    else:
        bm25_results = []

    fused: dict[str, dict[str, Any]] = {}
    retrieval_sets = (
        ("vector", dense_results, dense_weight),
        ("bm25", bm25_results, bm25_weight),
    )
    for source, results, weight in retrieval_sets:
        for rank, node_with_score in enumerate(results, start=1):
            node = node_with_score.node
            entry = fused.setdefault(
                node.node_id,
                {
                    "node": node,
                    "score": 0.0,
                    "matched_by": set(),
                },
            )
            entry["score"] += weight * (1.0 / (rrf_k + rank))
            entry["matched_by"].add(source)

    ordered = sorted(
        fused.values(),
        key=lambda item: item["score"],
        reverse=True,
    )[:top_k]

    return [
        SearchResult(
            node_id=item["node"].node_id,
            score=float(item["score"]),
            text=_extract_node_text(item["node"]),
            metadata=item["node"].metadata,
            source="hybrid",
            matched_by=tuple(sorted(item["matched_by"])),
        )
        for item in ordered
    ]


def advanced_search(
    query: str,
    top_k: int = 5,
    vector_top_k: int = 10,
    bm25_top_k: int = 10,
) -> list[SearchResult]:
    return hybrid_search(
        query=query,
        top_k=top_k,
        vector_top_k=vector_top_k,
        bm25_top_k=bm25_top_k,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Search the indexed knowledge base.")
    parser.add_argument("query", help="Search query.")
    parser.add_argument(
        "--top-k",
        type=int,
        default=5,
        help="Number of results to return.",
    )
    parser.add_argument(
        "--hybrid",
        action="store_true",
        help="Use dense retrieval fused with BM25.",
    )
    args = parser.parse_args()

    if args.hybrid:
        results = hybrid_search(query=args.query, top_k=args.top_k)
    else:
        results = similarity_search(query=args.query, top_k=args.top_k)

    print(json.dumps([result.model_dump() for result in results], indent=2))


if __name__ == "__main__":
    main()
