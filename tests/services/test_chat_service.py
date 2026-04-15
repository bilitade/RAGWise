"""app.services.chat_service"""

from __future__ import annotations

from unittest.mock import MagicMock

from app.db.models import ChatMessage as ChatMessageRow
from app.services.chat_service import (
    apply_sliding_window,
    ephemeral_messages_windowed,
    resolve_context_limit,
    rows_to_agent_messages,
)


def test_resolve_context_limit_defaults_and_aliases() -> None:
    assert resolve_context_limit(None) == 5
    assert resolve_context_limit("min") == 5
    assert resolve_context_limit("medium") == 10
    assert resolve_context_limit("max") == 15
    assert resolve_context_limit("unknown") == 5


def test_apply_sliding_window_trims_to_last_n() -> None:
    rows = [MagicMock(spec=ChatMessageRow) for _ in range(7)]
    out = apply_sliding_window(rows, limit=3)
    assert len(out) == 3
    assert out == rows[-3:]


def test_apply_sliding_window_empty_when_limit_zero() -> None:
    rows = [MagicMock()]
    assert apply_sliding_window(rows, limit=0) == []


def test_rows_to_agent_messages_excludes_system() -> None:
    u = MagicMock(spec=ChatMessageRow)
    u.role = "user"
    u.content = "hi"
    a = MagicMock(spec=ChatMessageRow)
    a.role = "assistant"
    a.content = "yo"
    sys = MagicMock(spec=ChatMessageRow)
    sys.role = "system"
    sys.content = "ignored"
    assert rows_to_agent_messages([u, sys, a]) == [
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": "yo"},
    ]


def test_ephemeral_messages_windowed_keeps_last_turns() -> None:
    turns = [
        {"role": "user", "content": "a"},
        {"role": "assistant", "content": "b"},
        {"role": "user", "content": "c"},
    ]
    assert ephemeral_messages_windowed(turns, limit=2) == [
        {"role": "assistant", "content": "b"},
        {"role": "user", "content": "c"},
    ]
