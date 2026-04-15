"""Platform-wide agent behavior: single JSON config in DB (with legacy key migration)."""

from __future__ import annotations

import json
import os
from typing import Any

from sqlalchemy.orm import Session

from app.agent.prompts import compose_default_agent_body, default_agent_config_prompt_fields
from app.config import COMPANY_NAME
from app.db.models import AppSetting

KEY_AGENT_CONFIG_JSON = "agent_config_json"

# Legacy row keys (migrated into JSON once, then removed)
_LEGACY_KEYS = (
    "agent_base_system_prompt",
    "agent_tool_knowledge_base",
    "agent_tool_internet",
    "default_persona_id",
    "company_display_name",
    "agent_guardrails_text",
    "agent_guidelines_text",
)


def default_agent_config() -> dict[str, Any]:
    """Default agent configuration (versioned JSON document). Core prompt text comes from `app.agent.prompts`."""
    return {
        "version": 1,
        "company_display_name": "",
        "guardrails_text": "",
        "guidelines_text": "",
        "tool_knowledge_base": True,
        "tool_internet": True,
        **default_agent_config_prompt_fields(),
    }


def _read_row(db: Session, key: str) -> AppSetting | None:
    return db.get(AppSetting, key)


def _legacy_flag(row: AppSetting | None, *, default: bool) -> bool:
    if not row or not row.value or not str(row.value).strip():
        return default
    v = str(row.value).strip().lower()
    if v in ("0", "false", "no", "off"):
        return False
    if v in ("1", "true", "yes", "on"):
        return True
    return default


def _migrate_legacy_to_json(db: Session) -> dict[str, Any]:
    """Build config from legacy AppSetting rows, persist JSON, drop legacy keys."""
    cfg = default_agent_config()

    row_base = _read_row(db, "agent_base_system_prompt")
    if row_base and row_base.value:
        cfg["base_system_prompt"] = str(row_base.value).strip()

    cfg["tool_knowledge_base"] = _legacy_flag(_read_row(db, "agent_tool_knowledge_base"), default=True)
    cfg["tool_internet"] = _legacy_flag(_read_row(db, "agent_tool_internet"), default=True)

    row_co = _read_row(db, "company_display_name")
    if row_co and str(row_co.value).strip():
        cfg["company_display_name"] = str(row_co.value).strip()

    row_gr = _read_row(db, "agent_guardrails_text")
    if row_gr and row_gr.value:
        cfg["guardrails_text"] = str(row_gr.value).strip()

    row_gl = _read_row(db, "agent_guidelines_text")
    if row_gl and row_gl.value:
        cfg["guidelines_text"] = str(row_gl.value).strip()

    save_agent_config_dict(db, cfg, commit=False)
    for key in _LEGACY_KEYS:
        legacy = db.get(AppSetting, key)
        if legacy:
            db.delete(legacy)
    db.commit()
    return load_agent_config_dict(db)


def _parse_json_config(raw: str) -> dict[str, Any] | None:
    raw = raw.strip()
    if not raw:
        return None
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict):
        return None
    return data


def load_agent_config_dict(db: Session) -> dict[str, Any]:
    """Merged agent config (defaults + DB JSON, migrating legacy rows if needed)."""
    row = _read_row(db, KEY_AGENT_CONFIG_JSON)
    if row and row.value and str(row.value).strip():
        parsed = _parse_json_config(str(row.value))
        if parsed is not None:
            merged = default_agent_config()
            merged.update(parsed)
            merged["version"] = int(merged.get("version") or 1)
            # Drop unknown keys from stored JSON (older clients may have written extras)
            sanitized = default_agent_config()
            for k in sanitized:
                if k in merged:
                    sanitized[k] = merged[k]
            sanitized["version"] = merged["version"]
            return sanitized

    # No valid JSON: migrate legacy keys into one document
    return _migrate_legacy_to_json(db)


def save_agent_config_dict(db: Session, cfg: dict[str, Any], *, commit: bool = True) -> None:
    """Persist config as one JSON string (only known keys; avoids arbitrary injection)."""
    base = default_agent_config()
    for k in base:
        if k in cfg:
            base[k] = cfg[k]
    base["version"] = int(base.get("version") or 1)
    raw = json.dumps(base, ensure_ascii=False)
    row = db.get(AppSetting, KEY_AGENT_CONFIG_JSON)
    if row:
        row.value = raw
    else:
        db.add(AppSetting(key=KEY_AGENT_CONFIG_JSON, value=raw, is_secret=False))
    if commit:
        db.commit()


def load_stored_agent_base_prompt(db: Session) -> str:
    cfg = load_agent_config_dict(db)
    return str(cfg.get("base_system_prompt") or "").strip()


def load_agent_base_system_prompt(db: Session) -> str:
    raw = load_stored_agent_base_prompt(db)
    if raw:
        return raw
    env = (os.environ.get("AGENT_BASE_SYSTEM_PROMPT") or "").strip()
    if env:
        return env
    return compose_default_agent_body()


def load_tool_knowledge_base_enabled(db: Session) -> bool:
    return bool(load_agent_config_dict(db).get("tool_knowledge_base", True))


def load_tool_internet_enabled(db: Session) -> bool:
    return bool(load_agent_config_dict(db).get("tool_internet", True))


def build_agent_tools_list(db: Session):
    from app.agent.tools import internet_search, knowledge_base_search

    tools: list = []
    if load_tool_knowledge_base_enabled(db):
        tools.append(knowledge_base_search)
    if load_tool_internet_enabled(db):
        tools.append(internet_search)
    return tools


def load_company_display_name(db: Session) -> str:
    cfg = load_agent_config_dict(db)
    v = str(cfg.get("company_display_name") or "").strip()
    if v:
        return v
    return COMPANY_NAME or ""


def load_guardrails_text(db: Session) -> str:
    return str(load_agent_config_dict(db).get("guardrails_text") or "").strip()


def load_guidelines_text(db: Session) -> str:
    return str(load_agent_config_dict(db).get("guidelines_text") or "").strip()


def build_organization_block(db: Session) -> str:
    company = load_company_display_name(db)
    if not company:
        return ""
    return (
        "### Organization\n\n"
        f"You assist users in the context of **{company}**. When it helps, refer to the organization by name.\n\n"
    )


def build_dynamic_prefix(db: Session) -> str:
    blocks: list[str] = []
    org = build_organization_block(db).strip()
    if org:
        blocks.append(org)
    gr = load_guardrails_text(db).strip()
    if gr:
        blocks.append("### Guardrails\n\n" + gr)
    gl = load_guidelines_text(db).strip()
    if gl:
        blocks.append("### Guidelines\n\n" + gl)
    if not blocks:
        return ""
    return "\n\n".join(blocks) + "\n\n"


def resolve_chat_system_prompt(db: Session) -> str:
    """Core behavior text from admin agent settings + optional env override; tool-selection rules remain in `app.agent.prompts`."""
    return load_agent_base_system_prompt(db)


def resolve_full_system_prompt(db: Session) -> str:
    """Organization / guardrails / guidelines prefix + core. No per-user or per-chat persona overrides."""
    core = resolve_chat_system_prompt(db)
    prefix = build_dynamic_prefix(db)
    if not prefix.strip():
        return core
    return f"{prefix}---\n\n{core}"
