from __future__ import annotations

import uuid
from typing import Any

from llama_index.core.schema import BaseNode, MetadataMode
from llama_index.core.utils import iter_batch
from llama_index.core.vector_stores.utils import node_to_metadata_dict
from llama_index.vector_stores.qdrant import QdrantVectorStore as _LlamaIndexQdrantVectorStore
from pydantic import BaseModel, ConfigDict
from qdrant_client import QdrantClient
from qdrant_client.http import models

from app.config import (
    QDRANT_COLLECTION,
    QDRANT_DENSE_DATATYPE,
    QDRANT_DENSE_ON_DISK,
    QDRANT_DENSE_VECTOR_NAME,
    QDRANT_HNSW_EF_CONSTRUCT,
    QDRANT_HNSW_FULL_SCAN_THRESHOLD_KB,
    QDRANT_HNSW_M,
    QDRANT_HNSW_PAYLOAD_M,
    QDRANT_QUERY_HNSW_EF,
    QDRANT_SPARSE_FULL_SCAN_THRESHOLD,
    QDRANT_SPARSE_MODEL,
    QDRANT_SPARSE_ON_DISK,
    QDRANT_SPARSE_USE_IDF,
    QDRANT_SPARSE_VECTOR_NAME,
    QDRANT_TIMEOUT,
    QDRANT_URL,
)


def _qdrant_rest_point_id(node_id: str) -> str:
    """REST-safe point id (UUID string)."""
    s = str(node_id).strip()
    try:
        return str(uuid.UUID(s))
    except ValueError:
        return str(uuid.uuid5(uuid.NAMESPACE_URL, f"ragwise:node:{s}"))


def _sanitize_sparse_vector_for_upsert(
    indices: list[int], values: list[float]
) -> tuple[list[int], list[float]]:
    """Sparse upsert: unique sorted indices; duplicate index → max weight."""
    if not indices:
        return [], []
    merged: dict[int, float] = {}
    for i, v in zip(indices, values):
        if i in merged:
            merged[i] = max(merged[i], v)
        else:
            merged[i] = v
    ordered = sorted(merged.items(), key=lambda kv: kv[0])
    return [k for k, _ in ordered], [v for _, v in ordered]


class LlamaIndexQdrantVectorStore(_LlamaIndexQdrantVectorStore):
    def _build_points(
        self, nodes: list[BaseNode], sparse_vector_name: str
    ) -> tuple[list[Any], list[str]]:
        ids: list[str] = []
        points: list[Any] = []

        for node_batch in iter_batch(nodes, self.batch_size):
            node_ids: list[str] = []
            vectors: list[Any] = []
            sparse_vectors: list[list[float]] = []
            sparse_indices: list[list[int]] = []
            payloads: list[Any] = []

            if self.enable_hybrid and self._sparse_doc_fn is not None:
                sparse_indices, sparse_vectors = self._sparse_doc_fn(
                    [
                        node.get_content(metadata_mode=MetadataMode.EMBED)
                        for node in node_batch
                    ],
                )

            for i, node in enumerate(node_batch):
                assert isinstance(node, BaseNode)
                pid = _qdrant_rest_point_id(node.node_id)
                node_ids.append(pid)

                if self.enable_hybrid:
                    if (
                        len(sparse_vectors) > 0
                        and len(sparse_indices) > 0
                        and len(sparse_vectors) == len(sparse_indices)
                    ):
                        si, sv = _sanitize_sparse_vector_for_upsert(
                            list(sparse_indices[i]),
                            list(sparse_vectors[i]),
                        )
                        vectors.append(
                            {
                                sparse_vector_name: models.SparseVector(indices=si, values=sv),
                                self.dense_vector_name: node.get_embedding(),
                            }
                        )
                    else:
                        vectors.append(
                            {
                                self.dense_vector_name: node.get_embedding(),
                            }
                        )
                else:
                    vectors.append({self.dense_vector_name: node.get_embedding()})

                metadata = node_to_metadata_dict(
                    node, remove_text=False, flat_metadata=self.flat_metadata
                )
                payloads.append(metadata)

            points.extend(
                [
                    models.PointStruct(id=nid, payload=payload, vector=vector)
                    for nid, payload, vector in zip(node_ids, payloads, vectors)
                ]
            )

            ids.extend(node_ids)

        return points, ids


def _dense_datatype() -> models.Datatype:
    key = QDRANT_DENSE_DATATYPE.strip().lower()
    mapping = {
        "float32": models.Datatype.FLOAT32,
        "float16": models.Datatype.FLOAT16,
        "uint8": models.Datatype.UINT8,
    }
    return mapping.get(key, models.Datatype.FLOAT32)


def _dense_hnsw_config() -> models.HnswConfigDiff:
    kwargs: dict[str, Any] = {
        "m": QDRANT_HNSW_M,
        "ef_construct": QDRANT_HNSW_EF_CONSTRUCT,
        "payload_m": QDRANT_HNSW_PAYLOAD_M,
    }
    if QDRANT_HNSW_FULL_SCAN_THRESHOLD_KB > 0:
        kwargs["full_scan_threshold"] = QDRANT_HNSW_FULL_SCAN_THRESHOLD_KB
    return models.HnswConfigDiff(**kwargs)


def _sparse_index_params() -> models.SparseIndexParams:
    if QDRANT_SPARSE_FULL_SCAN_THRESHOLD > 0:
        return models.SparseIndexParams(
            full_scan_threshold=QDRANT_SPARSE_FULL_SCAN_THRESHOLD,
            on_disk=QDRANT_SPARSE_ON_DISK,
            datatype=models.Datatype.FLOAT32,
        )
    return models.SparseIndexParams(on_disk=QDRANT_SPARSE_ON_DISK)

DENSE_VECTOR_NAME = QDRANT_DENSE_VECTOR_NAME
SPARSE_VECTOR_NAME = QDRANT_SPARSE_VECTOR_NAME


class QdrantConnectionConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    url: str = QDRANT_URL
    collection_name: str = QDRANT_COLLECTION
    timeout: float = QDRANT_TIMEOUT


def dense_search_params() -> models.SearchParams:
    return models.SearchParams(hnsw_ef=QDRANT_QUERY_HNSW_EF)


class QdrantStore:
    def __init__(self, config: QdrantConnectionConfig | None = None) -> None:
        self.config = config or QdrantConnectionConfig()
        self._client = QdrantClient(
            url=self.config.url,
            timeout=self.config.timeout,
        )

    @property
    def client(self) -> QdrantClient:
        return self._client

    @property
    def collection_name(self) -> str:
        return self.config.collection_name

    def collection_exists(self) -> bool:
        return self.client.collection_exists(collection_name=self.collection_name)

    def is_hybrid_collection(self) -> bool:
        if not self.collection_exists():
            return False
        params = self.client.get_collection(collection_name=self.collection_name).config.params
        sparse = getattr(params, "sparse_vectors", None)
        return bool(sparse)

    def collection_dense_vector_size(self) -> int | None:
        if not self.collection_exists():
            return None
        if self.is_hybrid_collection():
            return self._get_named_dense_vector_size()
        return self._get_vector_size()

    def _assert_hybrid_vector_names_match(self) -> None:
        info = self.get_collection()
        params = info.config.params
        vectors = params.vectors
        sparse = getattr(params, "sparse_vectors", None) or {}
        if not isinstance(vectors, dict):
            raise ValueError(
                f"Collection {self.collection_name!r} uses a single unnamed dense vector; "
                "hybrid ingestion expects named vectors. Recreate the collection with hybrid enabled."
            )
        if DENSE_VECTOR_NAME not in vectors:
            raise ValueError(
                f"Qdrant collection {self.collection_name!r} has no dense vector named {DENSE_VECTOR_NAME!r}. "
                f"Available dense vector names: {list(vectors.keys())!r}. "
                "Set QDRANT_DENSE_VECTOR_NAME to one of these, or delete the collection and reingest with "
                "recreate_collection=True."
            )
        if not isinstance(sparse, dict) or SPARSE_VECTOR_NAME not in sparse:
            avail = list(sparse.keys()) if isinstance(sparse, dict) else []
            raise ValueError(
                f"Qdrant collection {self.collection_name!r} has no sparse vector named {SPARSE_VECTOR_NAME!r}. "
                f"Available sparse vector names: {avail!r}. "
                "Set QDRANT_SPARSE_VECTOR_NAME accordingly, or recreate the collection."
            )

    def ensure_collection(self, vector_size: int, recreate: bool = False) -> None:
        if recreate:
            self.delete_collection()

        if self.collection_exists():
            if self.is_hybrid_collection():
                raise ValueError(
                    "Collection is hybrid (has sparse vectors). Use ensure_hybrid_collection() or recreate."
                )
            current_size = self._get_vector_size()
            if current_size is not None and current_size != vector_size:
                raise ValueError(
                    "Existing Qdrant collection has a different vector size. "
                    f"Expected {vector_size}, found {current_size}."
                )
            return

        self.client.create_collection(
            collection_name=self.collection_name,
            vectors_config=models.VectorParams(
                size=vector_size,
                distance=models.Distance.COSINE,
                hnsw_config=_dense_hnsw_config(),
                on_disk=QDRANT_DENSE_ON_DISK,
                datatype=_dense_datatype(),
            ),
        )
        self._ensure_payload_keyword_indexes()

    def ensure_hybrid_collection(self, vector_size: int, *, recreate: bool = False) -> None:
        if recreate:
            self.delete_collection()

        if self.collection_exists():
            if not self.is_hybrid_collection():
                raise ValueError(
                    "Existing collection has only dense vectors. Re-ingest with recreate_collection=True "
                    "to migrate to hybrid indexing, or set QDRANT_HYBRID_ENABLED=false to keep the legacy index."
                )
            self._assert_hybrid_vector_names_match()
            current = self._get_named_dense_vector_size()
            if current is not None and current != vector_size:
                raise ValueError(
                    "Existing hybrid Qdrant collection has a different dense vector size. "
                    f"Expected {vector_size}, found {current}."
                )
            return

        sparse_modifier = models.Modifier.IDF if QDRANT_SPARSE_USE_IDF else None
        self.client.create_collection(
            collection_name=self.collection_name,
            vectors_config={
                DENSE_VECTOR_NAME: models.VectorParams(
                    size=vector_size,
                    distance=models.Distance.COSINE,
                    hnsw_config=_dense_hnsw_config(),
                    on_disk=QDRANT_DENSE_ON_DISK,
                    datatype=_dense_datatype(),
                ),
            },
            sparse_vectors_config={
                SPARSE_VECTOR_NAME: models.SparseVectorParams(
                    index=_sparse_index_params(),
                    modifier=sparse_modifier,
                ),
            },
        )
        self._ensure_payload_keyword_indexes()

    def _ensure_payload_keyword_indexes(self) -> None:
        for field in ("document_id", "doc_id"):
            try:
                self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name=field,
                    field_schema=models.PayloadSchemaType.KEYWORD,
                )
            except Exception as exc:
                err = str(exc).lower()
                if "already exists" in err or "already exist" in err:
                    continue
                raise

    def delete_collection(self) -> None:
        if self.collection_exists():
            self.client.delete_collection(collection_name=self.collection_name)

    def delete_by_document_id(self, document_id: str) -> None:
        if not self.collection_exists():
            return

        self.client.delete(
            collection_name=self.collection_name,
            points_selector=models.FilterSelector(
                filter=models.Filter(
                    must=[
                        models.FieldCondition(
                            key="document_id",
                            match=models.MatchValue(value=document_id),
                        )
                    ]
                )
            ),
        )

    def count(self) -> int:
        response = self.client.count(
            collection_name=self.collection_name,
            exact=True,
        )
        return int(response.count)

    def get_collection(self):
        return self.client.get_collection(collection_name=self.collection_name)

    def _get_vector_size(self) -> int | None:
        collection = self.get_collection()
        vectors = collection.config.params.vectors

        if hasattr(vectors, "size"):
            return int(vectors.size)

        if isinstance(vectors, dict):
            if DENSE_VECTOR_NAME in vectors and hasattr(vectors[DENSE_VECTOR_NAME], "size"):
                return int(vectors[DENSE_VECTOR_NAME].size)
            first_vector = next(iter(vectors.values()), None)
            if first_vector and hasattr(first_vector, "size"):
                return int(first_vector.size)

        return None

    def _get_named_dense_vector_size(self) -> int | None:
        collection = self.get_collection()
        vectors = collection.config.params.vectors
        if isinstance(vectors, dict) and DENSE_VECTOR_NAME in vectors:
            v = vectors[DENSE_VECTOR_NAME]
            if hasattr(v, "size"):
                return int(v.size)
        return None

    def get_vector_store(self) -> LlamaIndexQdrantVectorStore:
        return LlamaIndexQdrantVectorStore(
            client=self.client,
            collection_name=self.collection_name,
        )

    def get_hybrid_vector_store(self) -> LlamaIndexQdrantVectorStore:
        return LlamaIndexQdrantVectorStore(
            collection_name=self.collection_name,
            client=self.client,
            enable_hybrid=True,
            fastembed_sparse_model=QDRANT_SPARSE_MODEL,
            dense_vector_name=DENSE_VECTOR_NAME,
            sparse_vector_name=SPARSE_VECTOR_NAME,
        )
