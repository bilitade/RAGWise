"""
Agent system prompt correctly reflects tool availability flags.

Tests verify that build_system_prompt / compose_agent_body_for_tool_flags
produce prompts that are honest about which tools are on or off so the model
cannot hallucinate capabilities it does not have.
"""

from __future__ import annotations

from app.agent.prompts import (
    build_system_prompt,
    compose_agent_body_for_tool_flags,
    compose_default_agent_body,
)


# ---------------------------------------------------------------------------
# Full-tools (both enabled)
# ---------------------------------------------------------------------------

def test_full_tools_prompt_includes_both_tools() -> None:
    body = compose_default_agent_body()
    assert "knowledge_base_search" in body
    assert "internet_search" in body


def test_full_tools_shows_enabled_status() -> None:
    body = build_system_prompt(tool_kb=True, tool_internet=True)
    assert "✅ Enabled" in body
    assert "🚫" not in body


# ---------------------------------------------------------------------------
# No tools (both disabled)
# ---------------------------------------------------------------------------

def test_no_tools_prompt_declares_both_disabled() -> None:
    body = build_system_prompt(tool_kb=False, tool_internet=False)
    assert "Web search is disabled" in body
    assert "Knowledge base retrieval is disabled" in body


def test_no_tools_prompt_forbids_fetching_headlines() -> None:
    body = build_system_prompt(tool_kb=False, tool_internet=False)
    lower = body.lower()
    assert "headlines" in lower
    assert "cannot" in lower


def test_no_tools_prompt_has_no_tool_guide() -> None:
    body = build_system_prompt(tool_kb=False, tool_internet=False)
    assert "How to Use Your Tools" not in body


def test_no_tools_prompt_has_no_citations_section() -> None:
    body = build_system_prompt(tool_kb=False, tool_internet=False)
    assert "## Citations" not in body


# ---------------------------------------------------------------------------
# KB only (internet disabled)
# ---------------------------------------------------------------------------

def test_kb_only_disables_internet_search() -> None:
    body = compose_agent_body_for_tool_flags(knowledge_base=True, internet=False)
    assert "Web search is disabled" in body
    assert "internet_search" in body          # mentioned as disabled
    assert "🚫 Disabled" in body


def test_kb_only_keeps_knowledge_base_search() -> None:
    body = compose_agent_body_for_tool_flags(knowledge_base=True, internet=False)
    assert "knowledge_base_search" in body
    assert "✅ Enabled" in body


# ---------------------------------------------------------------------------
# Internet only (KB disabled)
# ---------------------------------------------------------------------------

def test_net_only_disables_knowledge_base() -> None:
    body = compose_agent_body_for_tool_flags(knowledge_base=False, internet=True)
    assert "Knowledge base retrieval is disabled" in body
    assert "knowledge_base_search" in body    # mentioned as disabled


def test_net_only_keeps_internet_search() -> None:
    body = compose_agent_body_for_tool_flags(knowledge_base=False, internet=True)
    assert "internet_search" in body
    assert "✅ Enabled" in body


# ---------------------------------------------------------------------------
# Company name injection
# ---------------------------------------------------------------------------

def test_company_name_appears_in_role() -> None:
    body = build_system_prompt(tool_kb=True, tool_internet=True, company_name="Acme Corp")
    assert "Acme Corp" in body


def test_no_company_name_uses_generic_role() -> None:
    body = build_system_prompt(tool_kb=True, tool_internet=True, company_name="")
    assert "expert AI research" in body


# ---------------------------------------------------------------------------
# Guardrails and guidelines injection
# ---------------------------------------------------------------------------

def test_guardrails_injected() -> None:
    body = build_system_prompt(
        tool_kb=True, tool_internet=True, guardrails="Never discuss competitor X."
    )
    assert "Never discuss competitor X." in body
    assert "## Guardrails" in body


def test_guidelines_injected() -> None:
    body = build_system_prompt(
        tool_kb=True, tool_internet=True, guidelines="Always greet in Amharic."
    )
    assert "Always greet in Amharic." in body
    assert "## Guidelines" in body


def test_empty_guardrails_not_injected() -> None:
    body = build_system_prompt(tool_kb=True, tool_internet=True, guardrails="")
    assert "## Guardrails" not in body


# ---------------------------------------------------------------------------
# Tool availability block is ALWAYS first
# ---------------------------------------------------------------------------

def test_tool_availability_block_is_first_section() -> None:
    for kb, net in [(True, True), (True, False), (False, True), (False, False)]:
        body = build_system_prompt(tool_kb=kb, tool_internet=net)
        first_heading = body.split("##")[1].strip().split("\n")[0]
        assert first_heading == "Tool Availability", (
            f"Expected 'Tool Availability' first for kb={kb} net={net}, got '{first_heading}'"
        )


# ---------------------------------------------------------------------------
# Persona injection
# ---------------------------------------------------------------------------

def test_persona_injected_last() -> None:
    body = build_system_prompt(
        tool_kb=True, tool_internet=True, persona="Speak only in haiku."
    )
    assert "## Active Persona" in body
    assert body.rstrip().endswith("Speak only in haiku.")
