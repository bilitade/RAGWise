from __future__ import annotations

import re
from typing import Any


_ARTIFACT_REQUEST_RE = re.compile(
    r"\b("
    r"report|analysis|summary|overview|brief|memo|document|file|markdown|md\b|notes"
    r")\b",
    re.IGNORECASE,
)
_ARTIFACT_HINT_RE = re.compile(
    r"\b("
    r"generate|create|make|write|export|download|save|deliver|prepare|produce"
    r")\b",
    re.IGNORECASE,
)
_EXISTING_ARTIFACT_RE = re.compile(
    r"\[DOWNLOAD_FILE:\s*[^\]]+\]|```(?:md|markdown|txt|csv|json|html|xml|ya?ml)\b",
    re.IGNORECASE,
)


def wants_file_artifact(user_text: str) -> bool:
    text = (user_text or "").strip()
    if not text:
        return False
    if "downloadable" in text.lower():
        return True
    return bool(_ARTIFACT_REQUEST_RE.search(text) and (_ARTIFACT_HINT_RE.search(text) or "with the above content" in text.lower()))


def _slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug or "analysis"


def _guess_filename(user_text: str) -> str:
    text = re.sub(r"\s+", " ", (user_text or "").strip())
    match = re.search(r"\b(?:about|on|for|of)\s+([a-z0-9][a-z0-9\s-]{2,60})", text, re.IGNORECASE)
    if match:
        return f"{_slugify(match.group(1))}.md"
    return "analysis.md"


def ensure_file_artifact_response(user_text: str, assistant_text: str) -> str:
    body = (assistant_text or "").strip()
    if not body:
        return body
    if _EXISTING_ARTIFACT_RE.search(body):
        return body
    if not wants_file_artifact(user_text):
        return body

    filename = _guess_filename(user_text)
    normalized = body
    if normalized.startswith("Here is ") or normalized.startswith("I have "):
        normalized = normalized.split("\n", 1)[-1].strip()
    if not normalized.startswith("#"):
        title = filename.rsplit(".", 1)[0].replace("-", " ").title()
        normalized = f"# {title}\n\n{normalized}"
    return f"[DOWNLOAD_FILE: {filename}]\n```md\n{normalized}\n```"


def _has_visible_source_section(text: str) -> bool:
    lowered = text.lower()
    return "## sources" in lowered or "### sources" in lowered or "sources used" in lowered


def append_visible_citations(assistant_text: str, citations: list[dict[str, Any]]) -> str:
    text = (assistant_text or "").strip()
    if not text or not citations or _has_visible_source_section(text):
        return text

    lines = ["## Sources"]
    seen: set[tuple[str, str, str]] = set()
    for citation in citations:
        kind = str(citation.get("kind") or "")
        label = str(citation.get("label") or "").strip()
        url = str(citation.get("url") or "").strip()
        ref = str(citation.get("ref") or "").strip()
        key = (kind, label, url or ref)
        if not label or key in seen:
            continue
        seen.add(key)
        if kind == "web" and url:
            lines.append(f"- Web: [{label}]({url})")
        elif kind == "knowledge_base":
            suffix = f" (`{ref}`)" if ref else ""
            lines.append(f"- Knowledge base: `{label}`{suffix}")
    if len(lines) == 1:
        return text
    return f"{text}\n\n" + "\n".join(lines)
