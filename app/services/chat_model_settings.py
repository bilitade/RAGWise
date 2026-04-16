"""Chat default model + aliases: DB JSON, admin PATCH validation, runtime resolution.

``app_settings.chat_model_aliases`` is a JSON list of ``{alias, provider, model_id}``.
If ``default_chat_model`` equals an alias slug, runtime uses that row's provider and
model_id; else ``model_provider`` + ``default_chat_model`` as the API model id.

Invalid JSON rows are skipped on read; PATCH rejects unknown providers. Writes are
sorted by alias for stable storage. Admin UI mirrors this in
``frontend/src/lib/chatModelSettings.ts`` (PATCH body + dirty fingerprint + provider
for GET payloads). Valid providers: ``MODEL_PROVIDER_OPTIONS`` in ``openai_catalog``.
"""

from __future__ import annotations

import json
from collections.abc import Iterable
from typing import Any

from app.services.openai_catalog import MODEL_PROVIDER_OPTIONS

__all__ = [
    "aliases_from_json_value",
    "normalize_aliases_for_storage",
    "resolve_default_with_aliases",
]


def _coerce_one_row(item: Any) -> dict[str, str] | None:
    if not isinstance(item, dict):
        return None
    alias = str(item.get("alias", "")).strip()
    prov = str(item.get("provider", "")).strip().lower()
    mid = str(item.get("model_id", "")).strip()
    if not alias or not prov or not mid:
        return None
    if prov not in MODEL_PROVIDER_OPTIONS:
        return None
    return {"alias": alias, "provider": prov, "model_id": mid}


def aliases_from_json_value(raw: str | None) -> list[dict[str, str]]:
    if not raw or not str(raw).strip():
        return []
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(data, list):
        return []
    seen: set[str] = set()
    out: list[dict[str, str]] = []
    for item in data:
        row = _coerce_one_row(item)
        if not row:
            continue
        lk = row["alias"].lower()
        if lk in seen:
            continue
        seen.add(lk)
        out.append(row)
    out.sort(key=lambda r: r["alias"].lower())
    return out


def _triple_from_patch_item(item: Any) -> tuple[str, str, str]:
    if isinstance(item, dict):
        return (
            str(item.get("alias", "")).strip(),
            str(item.get("provider", "")).strip().lower(),
            str(item.get("model_id", "")).strip(),
        )
    alias = str(getattr(item, "alias", "") or "").strip()
    prov = str(getattr(item, "provider", "") or "").strip().lower()
    mid = str(getattr(item, "model_id", "") or "").strip()
    return alias, prov, mid


def normalize_aliases_for_storage(items: Iterable[Any]) -> list[dict[str, str]]:
    seen: set[str] = set()
    out: list[dict[str, str]] = []
    for item in items:
        alias, prov, mid = _triple_from_patch_item(item)
        if not alias or not mid:
            raise ValueError("Each alias needs a non-empty alias and model_id")
        if prov not in MODEL_PROVIDER_OPTIONS:
            raise ValueError(f"Invalid provider for alias {alias!r}: {prov!r}")
        lk = alias.lower()
        if lk in seen:
            continue
        seen.add(lk)
        out.append({"alias": alias, "provider": prov, "model_id": mid})
    out.sort(key=lambda r: r["alias"].lower())
    return out


def resolve_default_with_aliases(
    aliases: list[dict[str, str]],
    *,
    provider: str,
    stored_default_chat_model: str,
) -> tuple[str, str]:
    cm = stored_default_chat_model.strip()
    for a in aliases:
        if a.get("alias") == cm:
            prov = str(a.get("provider", "")).strip().lower()
            mid = str(a.get("model_id", "")).strip()
            if prov in MODEL_PROVIDER_OPTIONS and mid:
                return prov, mid
    p = (provider or "openai").strip()
    if p.lower() == "grok":
        p = "groq"
    return p, cm
