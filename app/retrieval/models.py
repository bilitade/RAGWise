from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

ScoreKind = Literal[
    "unknown",
    "cosine_similarity",
    "sparse_similarity",
    "weighted_hybrid",
    "llamaindex_similarity",
]


class ScoredPoint(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    point_id: str
    score: float
    text: str = ""
    metadata: dict[str, Any] = Field(default_factory=dict)
    score_kind: ScoreKind = "unknown"


class SearchResult(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    node_id: str
    score: float
    text: str
    metadata: dict[str, Any]
    source: str
    matched_by: tuple[str, ...] = ()
    score_kind: ScoreKind = Field(default="unknown")
