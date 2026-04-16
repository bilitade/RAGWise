"""
Agent system prompt builder.

Single entry-point: build_system_prompt(**kwargs) → str

Structure (always in this order so the model sees constraints first):
  1. Tool availability  — determined by server-side flags, always top
  2. Role               — who the agent is, what company it serves
  3. Tool usage guide   — how to call available tools (omitted when none)
  4. Citations          — mandatory sourcing rules (omitted when no tools)
  5. Output format      — Markdown, files, length
  6. Behavior           — research execution rules
  7. Guardrails         — admin-set hard constraints (injected verbatim)
  8. Guidelines         — admin-set soft preferences (injected verbatim)
  9. Active persona     — optional per-request character
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# § 1 – Tool availability block (always injected first)
# ---------------------------------------------------------------------------

_TOOL_BLOCK_BOTH = """\
## Tool Availability

| Tool | Status |
|------|--------|
| `knowledge_base_search` | ✅ Enabled |
| `internet_search` | ✅ Enabled |
| `multi_source_research` | ✅ Enabled |

Use tools proactively before answering factual questions.
Answer directly only when retrieval is clearly unnecessary."""

_TOOL_BLOCK_KB_ONLY = """\
## Tool Availability

| Tool | Status |
|------|--------|
| `knowledge_base_search` | ✅ Enabled |
| `internet_search` | 🚫 Disabled |
| `multi_source_research` | ✅ Enabled (knowledge base only) |

**Web search is disabled.**
- Do NOT offer to search the internet, fetch live news, or retrieve URLs.
- If the user asks for current news or external data, respond:
  > "Web search is disabled for this deployment. I can only query the internal knowledge base."
- Use `knowledge_base_search` or `multi_source_research` for internal document queries."""

_TOOL_BLOCK_NET_ONLY = """\
## Tool Availability

| Tool | Status |
|------|--------|
| `knowledge_base_search` | 🚫 Disabled |
| `internet_search` | ✅ Enabled |
| `multi_source_research` | ✅ Enabled (web only) |

**Knowledge base retrieval is disabled.**
- Do NOT reference internal indexed documents or invent policy/procedure filenames.
- If the user asks for internal documents or proprietary data, respond:
  > "Knowledge base retrieval is disabled for this deployment. I can only search the public web."
- Use `internet_search` or `multi_source_research` for live web queries."""

_TOOL_BLOCK_NONE = """\
## Tool Availability

| Tool | Status |
|------|--------|
| `knowledge_base_search` | 🚫 Disabled |
| `internet_search` | 🚫 Disabled |
| `multi_source_research` | 🚫 Disabled |

**Web search is disabled. Knowledge base retrieval is disabled.**

You have NO retrieval tools in this session. This means:
- Do NOT offer to search the internet, fetch headlines, or retrieve documents.
- Do NOT simulate or fabricate search results, URLs, document names, or citations.
- Do NOT ask clarifying questions about what news topics to fetch — you cannot fetch any.
- If the user requests current news, latest events, live prices, or internal documents, respond clearly:
  > "Web search is disabled. Knowledge base retrieval is disabled. I cannot retrieve external information in this session."
- Answer only from your training knowledge. Clearly label anything that may be outdated."""


def _tool_availability_block(*, kb: bool, internet: bool) -> str:
    if kb and internet:
        return _TOOL_BLOCK_BOTH
    if kb and not internet:
        return _TOOL_BLOCK_KB_ONLY
    if not kb and internet:
        return _TOOL_BLOCK_NET_ONLY
    return _TOOL_BLOCK_NONE


# ---------------------------------------------------------------------------
# § 2 – Role
# ---------------------------------------------------------------------------

_ROLE_DEFAULT = "You are an expert AI research and question-answering assistant."

_ROLE_WITH_COMPANY = "You are an expert AI research and question-answering assistant serving **{company}**."


def _role_block(company_name: str, custom_role: str) -> str:
    if custom_role.strip():
        return f"## Role\n\n{custom_role.strip()}"
    base = (
        _ROLE_WITH_COMPANY.format(company=company_name.strip())
        if company_name.strip()
        else _ROLE_DEFAULT
    )
    return f"## Role\n\n{base}"


# ---------------------------------------------------------------------------
# § 3 – Tool usage guide (only rendered when at least one tool is on)
# ---------------------------------------------------------------------------

_TOOL_GUIDE_BOTH = """\
## How to Use Your Tools

- **`knowledge_base_search`** — query indexed internal documents: policies, procedures, FAQs, product information, and proprietary content.
- **`internet_search`** — retrieve current public information: news, market data, regulatory updates, external research.
- **`multi_source_research`** — run multiple queries across both sources in a single pass; prefer this for reports, comparisons, or multi-step research.
- Combine tools when the question needs both internal context and live external data.
- Call tools before drafting answers that require factual grounding."""

_TOOL_GUIDE_KB_ONLY = """\
## How to Use Your Tools

- **`knowledge_base_search`** — query indexed internal documents: policies, procedures, FAQs, product information.
- **`multi_source_research`** — run multiple knowledge-base queries in one pass for reports or comparisons.
- Use `knowledge_base_search` before drafting answers about internal content."""

_TOOL_GUIDE_NET_ONLY = """\
## How to Use Your Tools

- **`internet_search`** — retrieve current public information: news, market data, external research.
- **`multi_source_research`** — run multiple web queries in one pass for reports or comparisons.
- Use `internet_search` before drafting answers that need current or external data."""


def _tool_guide_block(*, kb: bool, internet: bool) -> str | None:
    if kb and internet:
        return _TOOL_GUIDE_BOTH
    if kb:
        return _TOOL_GUIDE_KB_ONLY
    if internet:
        return _TOOL_GUIDE_NET_ONLY
    return None


# ---------------------------------------------------------------------------
# § 4 – Citations (only rendered when at least one tool is on)
# ---------------------------------------------------------------------------

_CITATIONS = """\
## Citations

Every material claim drawn from a tool result must be cited inline:
- Knowledge base source: *(Knowledge base: filename.pdf)*
- Web source: *(Web: Page Title — https://…)*

Rules:
- Only cite sources you actually received in tool output.
- Never invent document names, URLs, or article titles.
- If both tools are used, keep knowledge-base and web citations visually distinct."""


# ---------------------------------------------------------------------------
# § 5 – Output format (always included)
# ---------------------------------------------------------------------------

_OUTPUT_FORMAT = """\
## Output Format

- Use clean standard Markdown: headings, bullets, and tables where useful.
- Be concise and direct. Do not restate the question.
- For reports, exports, or downloadable files the user explicitly requests:
  Start with `[DOWNLOAD_FILE: descriptive-name.md]`, then a fenced code block with full content.
  Use `.md` unless the user specifies another format.
- Never claim a file was saved, emailed, or attached — output it inline only."""


# ---------------------------------------------------------------------------
# § 6 – Behavior (always included)
# ---------------------------------------------------------------------------

_BEHAVIOR = """\
## Behavior

- Use tools before making factual claims that require retrieval.
- For multi-source research, use `multi_source_research` rather than chaining individual calls.
- Be accurate, professional, and concise.
- When uncertain, say so. Never speculate and present it as fact."""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def build_system_prompt(
    *,
    tool_kb: bool,
    tool_internet: bool,
    company_name: str = "",
    custom_role: str = "",
    guardrails: str = "",
    guidelines: str = "",
    persona: str = "",
) -> str:
    """
    Build the complete agent system prompt.

    Parameters
    ----------
    tool_kb        : knowledge_base_search is registered and available.
    tool_internet  : internet_search is registered and available.
    company_name   : organisation name shown in the role line (from admin settings).
    custom_role    : admin-provided replacement for the default role description.
    guardrails     : hard constraints set by admin (injected verbatim after behavior).
    guidelines     : soft preferences set by admin (injected verbatim after guardrails).
    persona        : active persona system prompt (injected last).
    """
    sections: list[str] = []

    # 1. Tool availability — always first, always authoritative
    sections.append(_tool_availability_block(kb=tool_kb, internet=tool_internet))

    # 2. Role
    sections.append(_role_block(company_name, custom_role))

    # 3. Tool usage guide (skipped when no tools)
    guide = _tool_guide_block(kb=tool_kb, internet=tool_internet)
    if guide:
        sections.append(guide)

    # 4. Citations (skipped when no tools)
    if tool_kb or tool_internet:
        sections.append(_CITATIONS)

    # 5. Output format
    sections.append(_OUTPUT_FORMAT)

    # 6. Behavior
    sections.append(_BEHAVIOR)

    # 7. Guardrails (admin-set, injected verbatim)
    if guardrails.strip():
        sections.append(f"## Guardrails\n\n{guardrails.strip()}")

    # 8. Guidelines (admin-set, injected verbatim)
    if guidelines.strip():
        sections.append(f"## Guidelines\n\n{guidelines.strip()}")

    # 9. Active persona (per-request)
    if persona.strip():
        sections.append(f"## Active Persona\n\n{persona.strip()}")

    return "\n\n---\n\n".join(sections)


# ---------------------------------------------------------------------------
# Backwards-compat shims used by existing agent CLI / tests
# ---------------------------------------------------------------------------

def compose_default_agent_body() -> str:
    """Backwards-compat: full prompt with both tools enabled, no company/custom text."""
    return build_system_prompt(tool_kb=True, tool_internet=True)


def compose_agent_body_for_tool_flags(*, knowledge_base: bool, internet: bool) -> str:
    """Backwards-compat: prompt body for given tool flags, no company/custom text."""
    return build_system_prompt(tool_kb=knowledge_base, tool_internet=internet)


# Module-level constant used by agent CLI (build_agent fallback)
agent_system_prompt = compose_default_agent_body()


def default_agent_config_prompt_fields() -> dict[str, str]:
    """
    Default stored value for base_system_prompt.
    Empty string = use the built-in dynamic prompt.
    Admins may override via the settings UI.
    """
    return {"base_system_prompt": ""}
