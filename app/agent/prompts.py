"""
Agent system prompt builder.

build_system_prompt(**kwargs) → str assembles the prompt in a fixed order so
the model always sees constraints before capabilities:
  1. Tool availability  — server-side flags, always injected first
  2. Role               — who the agent is and what company it serves
  3. Tool usage guide   — omitted when no tools are enabled
  4. Citations          — omitted when no tools are enabled
  5. Output format
  6. Behavior
  7. Guardrails         — admin-set hard constraints, injected verbatim
  8. Guidelines         — admin-set soft preferences, injected verbatim
  9. Active persona     — optional per-request character
"""

from __future__ import annotations

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


_CITATIONS = """\
## Citations

Every material claim drawn from a tool result must be cited inline:
- Knowledge base source: *(Knowledge base: filename.pdf)*
- Web source: *(Web: Page Title — https://…)*

Rules:
- Only cite sources you actually received in tool output.
- Never invent document names, URLs, or article titles.
- If both tools are used, keep knowledge-base and web citations visually distinct."""


_OUTPUT_FORMAT = """\
## Output Format

- Use clean standard Markdown: headings, bullets, and tables where useful.
- Be concise and direct. Do not restate the question.
- For reports, exports, or downloadable files the user explicitly requests:
  Start with `[DOWNLOAD_FILE: descriptive-name.md]`, then a fenced code block with full content.
  Use `.md` unless the user specifies another format.
- Never claim a file was saved, emailed, or attached — output it inline only."""


_BEHAVIOR = """\
## Behavior

- Use tools before making factual claims that require retrieval.
- For multi-source research, use `multi_source_research` rather than chaining individual calls.
- Be accurate, professional, and concise.
- When uncertain, say so. Never speculate and present it as fact."""


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

    sections.append(_tool_availability_block(kb=tool_kb, internet=tool_internet))
    sections.append(_role_block(company_name, custom_role))

    guide = _tool_guide_block(kb=tool_kb, internet=tool_internet)
    if guide:
        sections.append(guide)

    if tool_kb or tool_internet:
        sections.append(_CITATIONS)

    sections.append(_OUTPUT_FORMAT)
    sections.append(_BEHAVIOR)

    if guardrails.strip():
        sections.append(f"## Guardrails\n\n{guardrails.strip()}")

    if guidelines.strip():
        sections.append(f"## Guidelines\n\n{guidelines.strip()}")

    if persona.strip():
        sections.append(f"## Active Persona\n\n{persona.strip()}")

    return "\n\n---\n\n".join(sections)


def compose_default_agent_body() -> str:
    """Backwards-compat: full prompt with both tools enabled, no company/custom text."""
    return build_system_prompt(tool_kb=True, tool_internet=True)


def compose_agent_body_for_tool_flags(*, knowledge_base: bool, internet: bool) -> str:
    """Backwards-compat: prompt body for given tool flags, no company/custom text."""
    return build_system_prompt(tool_kb=knowledge_base, tool_internet=internet)


agent_system_prompt = compose_default_agent_body()


def default_agent_config_prompt_fields() -> dict[str, str]:
    """
    Default stored value for base_system_prompt.
    Empty string means use the built-in dynamic prompt.
    Admins may override via the settings UI.
    """
    return {"base_system_prompt": ""}
