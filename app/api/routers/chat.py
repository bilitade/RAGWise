import json
from collections.abc import AsyncIterator
from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.agent.agent import astream_agent_events
from app.api.schemas import ChatStreamRequest
from app.config import LANGCHAIN_PROJECT, LANGCHAIN_TRACING_V2
from app.core.deps import require_active_user
from app.db.models import AgentPersona, User
from app.db.session import get_db
from app.services.runtime_config import apply_openai_env_from_db, load_default_chat_model
from app.services.usage_events import record_usage
from app.services.usage_limits import enforce_monthly_limit, record_billable_request

router = APIRouter(prefix="/chat", tags=["chat"])


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def _stream_chat(
    messages: list[dict[str, str]],
    *,
    system_prompt: str | None,
    model_name: str,
    db: Session,
    user: User | None,
) -> AsyncIterator[str]:
    trace_hint = None
    if LANGCHAIN_TRACING_V2:
        trace_hint = f"project={LANGCHAIN_PROJECT}"
    try:
        async for event in astream_agent_events(
            messages=messages,
            system_prompt=system_prompt,
            model_name=model_name,
        ):
            if event.get("type") == "token":
                yield _sse("token", {"text": event["text"]})
            elif event.get("type") == "status":
                yield _sse("status", {"label": event["label"]})
        yield _sse("done", {"status": "completed", "trace_hint": trace_hint})
    except Exception as exc:
        yield _sse("error", {"error": str(exc)})
    finally:
        if user:
            record_billable_request(user, db)
            record_usage(
                db,
                user_id=user.id,
                route="POST /api/chat/stream",
                extra={"model": model_name, "tracing": LANGCHAIN_TRACING_V2},
            )


@router.post("")
@router.post("/stream")
def stream_chat(
    payload: ChatStreamRequest,
    db: Session = Depends(get_db),
    user: User | None = Depends(require_active_user),
) -> StreamingResponse:
    apply_openai_env_from_db(db)
    if user:
        enforce_monthly_limit(user, db)

    model_name = load_default_chat_model(db)
    system_prompt: str | None = None
    if payload.persona_id:
        try:
            pid = UUID(payload.persona_id)
        except ValueError:
            pid = None
        if pid:
            persona = db.get(AgentPersona, pid)
            if persona and persona.is_active:
                system_prompt = persona.system_prompt

    return StreamingResponse(
        _stream_chat(
            [message.model_dump() for message in payload.messages],
            system_prompt=system_prompt,
            model_name=model_name,
            db=db,
            user=user,
        ),
        media_type="text/event-stream",
    )
