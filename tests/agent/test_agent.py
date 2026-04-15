"""app.agent.agent"""

from __future__ import annotations

from app.agent.agent import filter_agent_chat_messages
from app.agent.file_artifacts import ensure_file_artifact_response, wants_file_artifact


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


def test_wants_file_artifact_detects_report_request() -> None:
    assert wants_file_artifact("Generate a downloadable markdown report about AI Foundry")


def test_ensure_file_artifact_wraps_plain_text_for_report_requests() -> None:
    wrapped = ensure_file_artifact_response(
        "Generate a downloadable markdown report about AI Foundry",
        "## AI Foundry\n\nOverview content.",
    )
    assert wrapped.startswith("[DOWNLOAD_FILE: ")
    assert "```md" in wrapped
    assert "Overview content." in wrapped


def test_ensure_file_artifact_adds_heading_when_missing() -> None:
    wrapped = ensure_file_artifact_response(
        "Create a downloadable analysis for customer churn",
        "This is the analysis body.",
    )
    assert "# Customer Churn" in wrapped or "# Analysis" in wrapped
