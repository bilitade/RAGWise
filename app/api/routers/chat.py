import json
from collections.abc import Iterator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.agent.agent import stream_agent_text
from app.api.schemas import ChatStreamRequest

router = APIRouter(prefix="/chat", tags=["chat"])


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _stream_chat(messages: list[dict[str, str]]) -> Iterator[str]:
    try:
        for chunk in stream_agent_text(messages=messages):
            yield _sse("token", {"text": chunk})
        yield _sse("done", {"status": "completed"})
    except Exception as exc:
        yield _sse("error", {"error": str(exc)})


@router.post("")
@router.post("/stream")
def stream_chat(payload: ChatStreamRequest) -> StreamingResponse:
    return StreamingResponse(
        _stream_chat([message.model_dump() for message in payload.messages]),
        media_type="text/event-stream",
    )
