"""Chat threads and sliding-window history for persisted conversations."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Literal, cast

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.db.models import ChatMessage as ChatMessageRow
from app.db.models import ChatThread as ChatThreadRow

ContextWindowMode = Literal["min", "medium", "max"]

CONTEXT_MESSAGE_LIMIT: dict[ContextWindowMode, int] = {
    "min": 5,
    "medium": 10,
    "max": 15,
}


def resolve_context_limit(mode: str | None) -> int:
    key = (mode or "min").lower()
    if key in ("min", "medium", "max"):
        return CONTEXT_MESSAGE_LIMIT[cast(ContextWindowMode, key)]
    return CONTEXT_MESSAGE_LIMIT["min"]


def get_thread_for_user(db: Session, thread_id: uuid.UUID, user_id: uuid.UUID) -> ChatThreadRow | None:
    row = db.get(ChatThreadRow, thread_id)
    if row is None or row.user_id != user_id:
        return None
    return row


def delete_thread_for_user(db: Session, thread_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    thread = get_thread_for_user(db, thread_id, user_id)
    if thread is None:
        return False
    db.delete(thread)
    db.flush()
    return True


def list_threads_for_user(db: Session, user_id: uuid.UUID) -> list[ChatThreadRow]:
    return list(
        db.scalars(
            select(ChatThreadRow)
            .where(ChatThreadRow.user_id == user_id)
            .order_by(ChatThreadRow.updated_at.desc())
        ).all()
    )


def create_thread(
    db: Session,
    *,
    user_id: uuid.UUID,
    title: str = "New chat",
    persona_id: uuid.UUID | None = None,
    context_window: str = "min",
) -> ChatThreadRow:
    thread = ChatThreadRow(
        user_id=user_id,
        title=title,
        persona_id=persona_id,
        context_window=context_window,
    )
    db.add(thread)
    db.flush()
    return thread


def append_message(db: Session, thread_id: uuid.UUID, *, role: str, content: str) -> ChatMessageRow:
    max_ord = db.scalar(select(func.max(ChatMessageRow.sort_order)).where(ChatMessageRow.thread_id == thread_id))
    next_ord = (max_ord or 0) + 1
    msg = ChatMessageRow(thread_id=thread_id, role=role, content=content, sort_order=next_ord)
    db.add(msg)
    db.execute(
        update(ChatThreadRow)
        .where(ChatThreadRow.id == thread_id)
        .values(updated_at=datetime.now(tz=UTC))
    )
    db.flush()
    return msg


def list_thread_messages(db: Session, thread_id: uuid.UUID) -> list[ChatMessageRow]:
    return list(
        db.scalars(
            select(ChatMessageRow)
            .where(ChatMessageRow.thread_id == thread_id)
            .order_by(ChatMessageRow.sort_order.asc(), ChatMessageRow.created_at.asc())
        ).all()
    )


def apply_sliding_window(rows: list[ChatMessageRow], *, limit: int) -> list[ChatMessageRow]:
    if limit <= 0:
        return []
    return rows[-limit:] if len(rows) > limit else rows


def rows_to_agent_messages(rows: list[ChatMessageRow]) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for r in rows:
        if r.role not in ("user", "assistant"):
            continue
        out.append({"role": r.role, "content": r.content})
    return out


def ephemeral_messages_windowed(turns: list[dict[str, str]], *, limit: int) -> list[dict[str, str]]:
    filtered = [t for t in turns if t.get("role") in ("user", "assistant")]
    if limit <= 0:
        return []
    return filtered[-limit:] if len(filtered) > limit else filtered
