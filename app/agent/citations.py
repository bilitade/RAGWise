"""Parse retrieval / web tool outputs into structured citation items for the chat UI."""

from __future__ import annotations

import json
from typing import Any


def _trim(s: str, max_len: int) -> str:
    s = (s or "").strip()
    if len(s) <= max_len:
        return s
    return s[: max_len - 1] + "…"


def citations_from_tool_output(tool_name: str | None, output: Any) -> list[dict[str, Any]]:
    """Return normalized citation dicts: kind, label, detail?, url?, ref?."""
    name = (tool_name or "").lower()
    items: list[dict[str, Any]] = []

    if "knowledge" in name and "search" in name:
        payload: dict[str, Any] | None = None
        raw = output
        if isinstance(raw, dict) and "results" not in raw and "output" in raw:
            raw = raw.get("output")
        if isinstance(raw, str):
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                return items
        elif isinstance(raw, dict):
            payload = raw
        if not payload:
            return items
        for r in payload.get("results") or []:
            if not isinstance(r, dict):
                continue
            meta = r.get("metadata") or {}
            if not isinstance(meta, dict):
                meta = {}
            label = (
                meta.get("file_name")
                or meta.get("filename")
                or meta.get("file_path")
                or meta.get("source")
                or meta.get("document_id")
                or "Knowledge base"
            )
            if not isinstance(label, str):
                label = str(label)
            node_id = str(r.get("node_id") or "")
            text = r.get("text") or ""
            items.append(
                {
                    "kind": "knowledge_base",
                    "label": label.split("/")[-1].split("\\")[-1][:200],
                    "detail": _trim(str(text), 220),
                    "ref": node_id,
                }
            )
        return items

    if "internet" in name or name == "internet_search":
        data: dict[str, Any] | None = None
        raw = output
        if isinstance(raw, dict) and "results" not in raw and "output" in raw:
            raw = raw.get("output")
        if isinstance(raw, dict):
            data = raw
        elif isinstance(raw, str):
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                return items
        if not data:
            return items
        for r in data.get("results") or []:
            if not isinstance(r, dict):
                continue
            url = str(r.get("url") or "").strip()
            title = (r.get("title") or url or "Web").strip()
            content = r.get("content") or r.get("raw_content") or ""
            items.append(
                {
                    "kind": "web",
                    "label": str(title)[:300],
                    "url": url,
                    "detail": _trim(str(content), 240),
                }
            )
        return items

    return items


CITATIONS_BEGIN = "<!--RAG_CITATIONS\n"
CITATIONS_END = "\n-->"


def append_citations_footer(assistant_text: str, citations: list[dict[str, Any]]) -> str:
    """Persist citations in message text; stripped client-side for display."""
    text = assistant_text.strip()
    if not citations:
        return text
    blob = json.dumps({"items": citations}, ensure_ascii=False)
    return f"{text}\n\n{CITATIONS_BEGIN}{blob}{CITATIONS_END}"


def dedupe_citation_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[str, str, str]] = set()
    out: list[dict[str, Any]] = []
    for c in items:
        kind = str(c.get("kind") or "")
        label = str(c.get("label") or "")
        key_third = str(c.get("url") or c.get("ref") or "")
        k = (kind, label, key_third)
        if k in seen:
            continue
        seen.add(k)
        out.append(c)
    return out


def parse_citations_footer(content: str) -> tuple[str, list[dict[str, Any]]]:
    """Split assistant content into visible text and citation items."""
    if CITATIONS_BEGIN not in content or CITATIONS_END not in content:
        return content, []
    idx = content.rfind(CITATIONS_BEGIN)
    if idx < 0:
        return content, []
    head = content[:idx].rstrip()
    rest = content[idx + len(CITATIONS_BEGIN) :]
    end = rest.find(CITATIONS_END)
    if end < 0:
        return content, []
    raw = rest[:end].strip()
    try:
        data = json.loads(raw)
        items = data.get("items") if isinstance(data, dict) else []
        if not isinstance(items, list):
            return head, []
        return head, [i for i in items if isinstance(i, dict)]
    except json.JSONDecodeError:
        return head, []
