from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.documents.service import ManagedDocument
from app.ingestion.loader import IngestionResult
from app.retrieval.retrieval import SearchResult


class HealthResponse(BaseModel):
    status: str = "ok"


class IngestionJobStatusResponse(BaseModel):
    task_id: str
    status: str
    successful: bool
    failed: bool
    stage: dict | None = None
    stage_history: list[dict] = Field(default_factory=list)
    result: IngestionResult | None = None
    error: str | None = None


class DocumentListResponse(BaseModel):
    documents: list[ManagedDocument]


class DocumentJobResponse(BaseModel):
    task_id: str
    status: str
    document: ManagedDocument | None = None


class DocumentDeleteResponse(BaseModel):
    document: ManagedDocument
    deleted: bool = True


class RetrievalRequest(BaseModel):
    query: str
    top_k: int = 5


class AdvancedRetrievalRequest(RetrievalRequest):
    vector_top_k: int = 10
    bm25_top_k: int = 10


class RetrievalResponse(BaseModel):
    results: list[SearchResult]


class ChatTurn(BaseModel):
    model_config = ConfigDict(frozen=True)

    role: Literal["user", "assistant", "system"]
    content: str


class ChatStreamRequest(BaseModel):
    messages: list[ChatTurn] = Field(default_factory=list)
    persona_id: str | None = None


class IngestAllRequest(BaseModel):
    chunk_size: int | None = None
    chunk_overlap: int | None = None
