from fastapi import APIRouter

from app.api.schemas import HybridRetrievalRequest, RetrievalRequest, RetrievalResponse
from app.retrieval.retrieval import hybrid_search, similarity_search

router = APIRouter(prefix="/retrieval", tags=["retrieval"])


@router.post("/similarity", response_model=RetrievalResponse)
def similarity_retrieval(payload: RetrievalRequest) -> RetrievalResponse:
    return RetrievalResponse(
        results=similarity_search(query=payload.query, top_k=payload.top_k)
    )


@router.post("/hybrid", response_model=RetrievalResponse)
def hybrid_retrieval(payload: HybridRetrievalRequest) -> RetrievalResponse:
    return RetrievalResponse(
        results=hybrid_search(
            query=payload.query,
            top_k=payload.top_k,
            vector_top_k=payload.vector_top_k,
            bm25_top_k=payload.bm25_top_k,
        )
    )
