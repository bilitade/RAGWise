from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.ingestion.loader import IngestionResult
from app.retrieval.retrieval import SearchResult


class HealthResponse(BaseModel):
    status: str = "ok"


class FileUploadItem(BaseModel):
    model_config = ConfigDict(frozen=True)

    filename: str
    path: str
    size: int


class FileUploadResponse(BaseModel):
    files: list[FileUploadItem]


class IngestionJobCreateRequest(BaseModel):
    input_dir: str | None = None
    recreate_collection: bool = True


class IngestionJobCreateResponse(BaseModel):
    task_id: str
    status: str


class IngestionJobStatusResponse(BaseModel):
    task_id: str
    status: str
    successful: bool
    failed: bool
    stage: dict | None = None
    stage_history: list[dict] = Field(default_factory=list)
    result: IngestionResult | None = None
    error: str | None = None


class RetrievalRequest(BaseModel):
    query: str
    top_k: int = 5


class HybridRetrievalRequest(RetrievalRequest):
    vector_top_k: int = 10
    bm25_top_k: int = 10


class RetrievalResponse(BaseModel):
    results: list[SearchResult]


class ChatMessageRequest(BaseModel):
    message: str


class ChatMessageResponse(BaseModel):
    answer: str
    source: Literal["agent"] = "agent"
