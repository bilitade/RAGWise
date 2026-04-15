import json
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.agent.agent import astream_agent_events
from app.agent.citations import append_citations_footer, dedupe_citation_items
from app.api.schemas import (
    ChatMessagesListResponse,
    ChatMessageResponse,
    ChatStreamRequest,
    ChatThreadCreate,
    ChatThreadListResponse,
    ChatThreadResponse,
    ChatThreadUpdate,
)
from app.config import LANGCHAIN_PROJECT, LANGCHAIN_TRACING_V2
from app.core.deps import require_active_user
from app.db.models import User
from app.db.session import get_db
from app.services.chat_service import (
    append_message,
    apply_sliding_window,
    create_thread,
    delete_thread_for_user,
    ephemeral_messages_windowed,
    get_thread_for_user,
    list_thread_messages,
    list_threads_for_user,
    resolve_context_limit,
    rows_to_agent_messages,
)
from app.services.agent_settings import build_agent_tools_list, resolve_full_system_prompt
from app.services.runtime_config import apply_openai_env_from_db, load_default_chat_model
from app.services.usage_events import record_usage
from app.services.usage_limits import enforce_monthly_limit, record_billable_request

router = APIRouter(prefix="/chat", tags=["chat"])


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _friendly_stream_error(exc: BaseException) -> str:
    """Avoid dumping raw OpenAI 401 bodies into the chat UI."""
    text = str(exc)
    lower = text.lower()
    if (
        "401" in text
        or "invalid_api_key" in lower
        or "incorrect api key" in lower
        or "authenticationerror" in lower.replace(" ", "")
    ):
        return (
            "OpenAI rejected the API key (invalid or expired). "
            "Update it under Settings → Models & API, click Save, then send your message again. "
            "If you only use a key in the server .env file, restart the API after changing it."
        )
    return text


def _parse_uuid(value: str | None) -> UUID | None:
    if not value:
        return None
    try:
        return UUID(value)
    except ValueError:
        return None


def _iso(dt: datetime | None) -> str:
    if dt is None:
        return ""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC).isoformat()
    return dt.isoformat()


def _thread_to_response(row) -> ChatThreadResponse:
    return ChatThreadResponse(
        id=str(row.id),
        title=row.title,
        context_window=row.context_window,
        persona_id=str(row.persona_id) if row.persona_id else None,
        created_at=_iso(row.created_at),
        updated_at=_iso(row.updated_at),
    )


def _message_to_response(row) -> ChatMessageResponse:
    return ChatMessageResponse(
        id=str(row.id),
        role=row.role,
        content=row.content,
        sort_order=row.sort_order,
        created_at=_iso(row.created_at),
    )


def _title_from_user_text(text: str) -> str:
    t = text.strip()
    if not t:
        return "New chat"
    return (t[:48] + "…") if len(t) > 48 else t


async def _stream_chat(
    agent_messages: list[dict[str, str]],
    *,
    system_prompt: str,
    model_name: str,
    tools: list,
    db: Session,
    user: User | None,
    persist_thread_id: UUID | None,
) -> AsyncIterator[str]:
    trace_hint = None
    if LANGCHAIN_TRACING_V2:
        trace_hint = f"project={LANGCHAIN_PROJECT}"
    assistant_text: list[str] = []
    all_citations: list[dict] = []
    try:
        async for event in astream_agent_events(
            messages=agent_messages,
            system_prompt=system_prompt,
            model_name=model_name,
            tools=tools,
        ):
            if event.get("type") == "token":
                chunk = event.get("text") or ""
                assistant_text.append(chunk)
                yield _sse("token", {"text": chunk})
            elif event.get("type") == "status":
                yield _sse("status", {"label": event["label"]})
            elif event.get("type") == "citations":
                batch = event.get("items")
                if isinstance(batch, list) and batch:
                    all_citations.extend(batch)
                    yield _sse("citations", {"items": batch})
        extra: dict = {"status": "completed", "trace_hint": trace_hint}
        if persist_thread_id:
            text = "".join(assistant_text).strip()
            merged = dedupe_citation_items(all_citations)
            body = append_citations_footer(text, merged)
            if body:
                append_message(db, persist_thread_id, role="assistant", content=body)
                db.commit()
            extra["thread_id"] = str(persist_thread_id)
        yield _sse("done", extra)
    except Exception as exc:
        yield _sse("error", {"error": _friendly_stream_error(exc)})
    finally:
        if user:
            record_billable_request(user, db)
            record_usage(
                db,
                user_id=user.id,
                route="POST /api/chat/stream",
                extra={"model": model_name, "tracing": LANGCHAIN_TRACING_V2},
            )


@router.get("/threads", response_model=ChatThreadListResponse)
def list_chat_threads(
    db: Session = Depends(get_db),
    user: User | None = Depends(require_active_user),
) -> ChatThreadListResponse:
    if user is None:
        return ChatThreadListResponse(threads=[])
    rows = list_threads_for_user(db, user.id)
    return ChatThreadListResponse(threads=[_thread_to_response(r) for r in rows])


@router.post("/threads", response_model=ChatThreadResponse)
def create_chat_thread(
    body: ChatThreadCreate,
    db: Session = Depends(get_db),
    user: User | None = Depends(require_active_user),
) -> ChatThreadResponse:
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    persona_uuid = _parse_uuid(body.persona_id)
    thread = create_thread(
        db,
        user_id=user.id,
        title=body.title or "New chat",
        persona_id=persona_uuid,
        context_window=body.context_window,
    )
    db.commit()
    db.refresh(thread)
    return _thread_to_response(thread)


@router.get("/threads/{thread_id}/messages", response_model=ChatMessagesListResponse)
def get_thread_messages(
    thread_id: str,
    db: Session = Depends(get_db),
    user: User | None = Depends(require_active_user),
) -> ChatMessagesListResponse:
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    tid = _parse_uuid(thread_id)
    if not tid:
        raise HTTPException(status_code=400, detail="Invalid thread id")
    thread = get_thread_for_user(db, tid, user.id)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    rows = list_thread_messages(db, tid)
    return ChatMessagesListResponse(messages=[_message_to_response(r) for r in rows])


@router.delete("/threads/{thread_id}", status_code=204)
def delete_chat_thread(
    thread_id: str,
    db: Session = Depends(get_db),
    user: User | None = Depends(require_active_user),
) -> Response:
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    tid = _parse_uuid(thread_id)
    if not tid:
        raise HTTPException(status_code=400, detail="Invalid thread id")
    if not delete_thread_for_user(db, tid, user.id):
        raise HTTPException(status_code=404, detail="Thread not found")
    db.commit()
    return Response(status_code=204)


@router.patch("/threads/{thread_id}", response_model=ChatThreadResponse)
def update_chat_thread(
    thread_id: str,
    body: ChatThreadUpdate,
    db: Session = Depends(get_db),
    user: User | None = Depends(require_active_user),
) -> ChatThreadResponse:
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    tid = _parse_uuid(thread_id)
    if not tid:
        raise HTTPException(status_code=400, detail="Invalid thread id")
    thread = get_thread_for_user(db, tid, user.id)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    if body.title is not None:
        thread.title = body.title
    if body.context_window is not None:
        thread.context_window = body.context_window
    if body.persona_id is not None:
        thread.persona_id = _parse_uuid(body.persona_id)
    db.commit()
    db.refresh(thread)
    return _thread_to_response(thread)


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

    persist = user is not None
    persist_thread_id: UUID | None = None
    agent_messages: list[dict[str, str]]
    agent_tools = build_agent_tools_list(db)

    if persist:
        ctx_mode = payload.context_window
        thread = None
        tid = _parse_uuid(payload.thread_id)

        if tid:
            thread = get_thread_for_user(db, tid, user.id)
            if not thread:
                raise HTTPException(status_code=404, detail="Thread not found")
            if len(payload.messages) != 1 or payload.messages[0].role != "user":
                raise HTTPException(
                    status_code=400,
                    detail="For an existing thread, send exactly one new user message in `messages`.",
                )
            user_content = payload.messages[0].content.strip()
        else:
            user_msgs = [m for m in payload.messages if m.role == "user"]
            if not user_msgs:
                raise HTTPException(status_code=400, detail="A user message is required")
            user_content = user_msgs[-1].content.strip()
            thread = create_thread(
                db,
                user_id=user.id,
                title=_title_from_user_text(user_content),
                persona_id=None,
                context_window=(payload.context_window or "min"),
            )
            db.flush()
            tid = thread.id

        if not user_content:
            raise HTTPException(status_code=400, detail="Message is empty")

        if payload.context_window is not None and thread:
            thread.context_window = payload.context_window

        if thread and thread.title == "New chat" and user_content:
            thread.title = _title_from_user_text(user_content)

        append_message(db, tid, role="user", content=user_content)
        db.commit()

        thread = get_thread_for_user(db, tid, user.id)
        if not thread:
            raise HTTPException(status_code=404, detail="Thread not found")

        effective_ctx = ctx_mode or thread.context_window
        limit = resolve_context_limit(effective_ctx)
        rows = list_thread_messages(db, tid)
        windowed = apply_sliding_window(rows, limit=limit)
        agent_messages = rows_to_agent_messages(windowed)
        persist_thread_id = tid

        system_prompt = resolve_full_system_prompt(db)
    else:
        turns = [t.model_dump() for t in payload.messages]
        turns = [{"role": t["role"], "content": t["content"]} for t in turns if t["role"] in ("user", "assistant")]
        limit = resolve_context_limit(payload.context_window)
        agent_messages = ephemeral_messages_windowed(turns, limit=limit)
        if not agent_messages:
            raise HTTPException(status_code=400, detail="At least one user or assistant message is required")
        system_prompt = resolve_full_system_prompt(db)

    return StreamingResponse(
        _stream_chat(
            agent_messages,
            system_prompt=system_prompt,
            model_name=model_name,
            tools=agent_tools,
            db=db,
            user=user,
            persist_thread_id=persist_thread_id,
        ),
        media_type="text/event-stream",
    )
