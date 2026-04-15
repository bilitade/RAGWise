"""app.agent.agent"""

from __future__ import annotations

from app.agent.agent import filter_agent_chat_messages


def test_filter_agent_chat_messages_drops_system_keeps_user_assistant() -> None:
    raw = [
        {"role": "User", "content": " Hello "},
        {"role": "system", "content": "no"},
        {"role": "assistant", "content": ""},
    ]
    out = filter_agent_chat_messages(raw)
    assert out == [
        {"role": "User", "content": " Hello "},
        {"role": "assistant", "content": ""},
    ]
