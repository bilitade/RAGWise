import json
from collections.abc import Iterator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.agent.agent import stream_agent_text
from app.api.schemas import ChatMessageRequest

router = APIRouter(prefix="/chat", tags=["chat"])


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _stream_chat(message: str) -> Iterator[str]:
    try:
        for chunk in stream_agent_text(message):
            yield _sse("token", {"text": chunk})
        yield _sse("done", {"status": "completed"})
    except Exception as exc:
        yield _sse("error", {"error": str(exc)})


@router.post("/stream")
def stream_chat(payload: ChatMessageRequest) -> StreamingResponse:
    return StreamingResponse(
        _stream_chat(payload.message),
        media_type="text/event-stream",
    )
