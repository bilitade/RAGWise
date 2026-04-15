from llama_index.vector_stores.qdrant import QdrantVectorStore
from pydantic import BaseModel, ConfigDict
from qdrant_client import QdrantClient
from qdrant_client.http import models

from app.config import QDRANT_COLLECTION, QDRANT_TIMEOUT, QDRANT_URL


class QdrantConnectionConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    url: str = QDRANT_URL
    collection_name: str = QDRANT_COLLECTION
    timeout: float = QDRANT_TIMEOUT


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

    def ensure_collection(self, vector_size: int, recreate: bool = False) -> None:
        if recreate:
            self.delete_collection()

        if self.collection_exists():
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
            ),
        )

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
            first_vector = next(iter(vectors.values()), None)
            if first_vector and hasattr(first_vector, "size"):
                return int(first_vector.size)

        return None

    def get_vector_store(self) -> QdrantVectorStore:
        return QdrantVectorStore(
            client=self.client,
            collection_name=self.collection_name,
        )
