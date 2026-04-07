import json
from collections.abc import AsyncIterator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.agent.agent import astream_agent_events
from app.api.schemas import ChatStreamRequest

router = APIRouter(prefix="/chat", tags=["chat"])


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def _stream_chat(messages: list[dict[str, str]]) -> AsyncIterator[str]:
    try:
        async for event in astream_agent_events(messages=messages):
            if event.get("type") == "token":
                yield _sse("token", {"text": event["text"]})
            elif event.get("type") == "status":
                yield _sse("status", {"label": event["label"]})
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
