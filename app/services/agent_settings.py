"""
Agent configuration loader.

Reads the single JSON config row (agent_config_json) from the database,
migrates legacy rows when present, and builds the system prompt via
app.agent.prompts.build_system_prompt.
"""

from __future__ import annotations

import json
import os
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.agent.prompts import build_system_prompt, compose_default_agent_body, default_agent_config_prompt_fields
from app.config import COMPANY_NAME
from app.db.models import AgentPersona, AppSetting
from app.services.runtime_config import RuntimeModelConfig

KEY_AGENT_CONFIG_JSON = "agent_config_json"

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
    """Return the default agent config document."""
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
    """One-time migration: read legacy individual rows into a single JSON row."""
    cfg = default_agent_config()

    row_base = _read_row(db, "agent_base_system_prompt")
    if row_base and row_base.value:
        stored = str(row_base.value).strip()
        if stored and stored != compose_default_agent_body():
            cfg["base_system_prompt"] = stored

    cfg["tool_knowledge_base"] = _legacy_flag(
        _read_row(db, "agent_tool_knowledge_base"), default=True
    )
    cfg["tool_internet"] = _legacy_flag(
        _read_row(db, "agent_tool_internet"), default=True
    )

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
    return data if isinstance(data, dict) else None


def load_agent_config_dict(db: Session) -> dict[str, Any]:
    """Load merged agent config; migrate legacy rows when not yet migrated."""
    row = _read_row(db, KEY_AGENT_CONFIG_JSON)
    if row and row.value and str(row.value).strip():
        parsed = _parse_json_config(str(row.value))
        if parsed is not None:
            base = default_agent_config()
            for k in base:
                if k in parsed:
                    base[k] = parsed[k]
            base["version"] = int(parsed.get("version") or 1)
            return base

    return _migrate_legacy_to_json(db)


def save_agent_config_dict(db: Session, cfg: dict[str, Any], *, commit: bool = True) -> None:
    """Persist known keys only (ignore unknown keys from callers)."""
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


def load_tool_knowledge_base_enabled(db: Session) -> bool:
    return bool(load_agent_config_dict(db).get("tool_knowledge_base", True))


def load_tool_internet_enabled(db: Session) -> bool:
    return bool(load_agent_config_dict(db).get("tool_internet", True))


def load_company_display_name(db: Session) -> str:
    cfg = load_agent_config_dict(db)
    v = str(cfg.get("company_display_name") or "").strip()
    return v or (COMPANY_NAME or "")


def load_guardrails_text(db: Session) -> str:
    return str(load_agent_config_dict(db).get("guardrails_text") or "").strip()


def load_guidelines_text(db: Session) -> str:
    return str(load_agent_config_dict(db).get("guidelines_text") or "").strip()


def _load_custom_role(db: Session) -> str:
    """
    Return admin-customised role text if it differs from the built-in default.
    An empty string means use the built-in role description.
    """
    cfg = load_agent_config_dict(db)
    stored = str(cfg.get("base_system_prompt") or "").strip()
    if not stored:
        env_val = (os.environ.get("AGENT_BASE_SYSTEM_PROMPT") or "").strip()
        if env_val and env_val != compose_default_agent_body():
            return env_val
        return ""
    if stored == compose_default_agent_body():
        return ""
    return stored


def build_agent_tools_list(
    db: Session,
    *,
    runtime_config: RuntimeModelConfig | None = None,
) -> list:
    from app.agent.tools import (
        make_internet_search_tool,
        make_knowledge_base_search_tool,
        make_multi_source_research_tool,
    )

    kb = load_tool_knowledge_base_enabled(db)
    net = load_tool_internet_enabled(db)
    tools: list = []
    if kb:
        tools.append(make_knowledge_base_search_tool(runtime_config))
    if net:
        tools.append(make_internet_search_tool())
    if kb or net:
        tools.append(
            make_multi_source_research_tool(
                runtime_config,
                allow_knowledge_base=kb,
                allow_web=net,
            )
        )
    return tools


def _load_persona_prompt(db: Session, persona_id: UUID | None) -> str:
    if persona_id is None:
        return ""
    persona = db.get(AgentPersona, persona_id)
    if persona is None or not persona.is_active:
        return ""
    return persona.system_prompt.strip()


def resolve_full_system_prompt(db: Session, *, persona_id: UUID | None = None) -> str:
    """Build the complete agent system prompt from persisted config."""
    cfg = load_agent_config_dict(db)

    return build_system_prompt(
        tool_kb=bool(cfg.get("tool_knowledge_base", True)),
        tool_internet=bool(cfg.get("tool_internet", True)),
        company_name=load_company_display_name(db),
        custom_role=_load_custom_role(db),
        guardrails=str(cfg.get("guardrails_text") or "").strip(),
        guidelines=str(cfg.get("guidelines_text") or "").strip(),
        persona=_load_persona_prompt(db, persona_id),
    )


def resolve_chat_system_prompt(db: Session) -> str:
    """Alias kept for backwards compatibility."""
    return resolve_full_system_prompt(db)


def load_agent_base_system_prompt(db: Session) -> str:
    """Alias kept for backwards compatibility."""
    return resolve_full_system_prompt(db)
