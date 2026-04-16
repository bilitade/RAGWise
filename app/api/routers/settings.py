"""Admin settings API (requires admin JWT)."""

from __future__ import annotations

import json
import os
from collections import deque
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import (
    APP_LOG_FILE,
    CHUNK_SIZE_MAX,
    CHUNK_SIZE_MIN,
    LANGCHAIN_API_KEY,
    LANGCHAIN_ENDPOINT,
    LANGCHAIN_PROJECT,
    LANGCHAIN_TRACING_V2,
    LANGSMITH_WORKSPACE_ID,
)
from app.core.crypto import encrypt_secret, mask_last4
from app.core.deps import require_admin
from app.core.security import hash_password
from app.db.models import AgentPersona, AppSetting, User, UserRole
from app.db.session import get_db
from app.ingestion.tasks import get_task_result
from app.services.job_status import effective_celery_status, effective_successful_optional
from app.services.chat_model_settings import normalize_aliases_for_storage
from app.services.jobs_repo import list_jobs
from app.services.langsmith_metrics import fetch_langsmith_project_metrics
from app.services.agent_settings import (
    load_agent_config_dict,
    resolve_full_system_prompt,
    save_agent_config_dict,
)
from app.services.openai_catalog import (
    GROQ_CHAT_MODEL_OPTIONS,
    HUGGINGFACE_CHAT_MODEL_OPTIONS,
    MODEL_PROVIDER_OPTIONS,
    NVIDIA_CHAT_MODEL_OPTIONS,
    OPENAI_CHAT_MODEL_OPTIONS,
    OPENAI_EMBED_MODEL_OPTIONS,
    OPENROUTER_CHAT_MODEL_OPTIONS,
)
from app.services.runtime_config import (
    KEY_CHAT_MODEL_ALIASES,
    KEY_DEFAULT_CHAT_MODEL,
    KEY_DEFAULT_EMBED_MODEL,
    KEY_GROQ_API_KEY,
    KEY_GROQ_OPENAI_BASE_URL,
    KEY_HUGGINGFACE_API_KEY,
    KEY_HUGGINGFACE_OPENAI_BASE_URL,
    KEY_INGEST_CHUNK_OVERLAP,
    KEY_INGEST_CHUNK_SIZE,
    KEY_MODEL_PROVIDER,
    KEY_NVIDIA_API_KEY,
    KEY_NVIDIA_OPENAI_BASE_URL,
    KEY_OPENAI_API_KEY,
    KEY_OPENAI_CHAT_BASE_URL,
    KEY_OPENROUTER_API_KEY,
    KEY_OPENROUTER_OPENAI_BASE_URL,
    KEY_QDRANT_COLLECTION,
    KEY_QDRANT_URL,
    load_chat_model_aliases,
    load_default_chat_model,
    load_default_chunk_overlap,
    load_default_chunk_size,
    load_default_embed_model,
    load_groq_api_key,
    load_groq_openai_base_url,
    load_huggingface_api_key,
    load_huggingface_openai_base_url,
    load_model_provider,
    load_nvidia_api_key,
    load_nvidia_openai_base_url,
    load_openai_api_key,
    load_openai_chat_base_url,
    load_openrouter_api_key,
    load_openrouter_openai_base_url,
    load_qdrant_collection,
    load_qdrant_url,
)
from app.services.smtp_settings import (
    KEY_SMTP_FROM_EMAIL,
    KEY_SMTP_HOST,
    KEY_SMTP_PASSWORD,
    KEY_SMTP_PORT,
    KEY_SMTP_USE_TLS,
    KEY_SMTP_USERNAME,
    load_smtp_settings,
)

router = APIRouter(prefix="/settings", tags=["settings"])


class SmtpConfigOut(BaseModel):
    host: str
    port: int
    username: str
    from_email: str
    use_tls: bool
    password_configured: bool
    password_last4: str | None = None


class SmtpConfigPatch(BaseModel):
    host: str | None = None
    port: int | None = Field(default=None, ge=1, le=65535)
    username: str | None = None
    from_email: EmailStr | None = None
    use_tls: bool | None = None
    password: str | None = None


def _smtp_config_out(db: Session) -> SmtpConfigOut:
    s = load_smtp_settings(db)
    last4 = mask_last4(s.password) if s.password else None
    return SmtpConfigOut(
        host=s.host,
        port=s.port,
        username=s.username,
        from_email=s.from_email,
        use_tls=s.use_tls,
        password_configured=bool(s.password),
        password_last4=last4,
    )


def _chat_catalog_for_provider(provider: str) -> list[str]:
    p = (provider or "openai").strip().lower()
    if p == "groq":
        return list(GROQ_CHAT_MODEL_OPTIONS)
    if p == "openrouter":
        return list(OPENROUTER_CHAT_MODEL_OPTIONS)
    if p == "huggingface":
        return list(HUGGINGFACE_CHAT_MODEL_OPTIONS)
    if p == "nvidia":
        return list(NVIDIA_CHAT_MODEL_OPTIONS)
    return list(OPENAI_CHAT_MODEL_OPTIONS)


class ChatModelAliasOut(BaseModel):
    alias: str
    provider: str
    model_id: str


def _config_response(db: Session) -> "SettingsConfigResponse":
    openai_plain = load_openai_api_key(db)
    groq_plain = load_groq_api_key(db)
    or_plain = load_openrouter_api_key(db)
    hf_plain = load_huggingface_api_key(db)
    nv_plain = load_nvidia_api_key(db)
    provider = load_model_provider(db)
    return SettingsConfigResponse(
        model_provider=provider,
        default_chat_model=load_default_chat_model(db),
        default_embed_model=load_default_embed_model(db),
        openai_api_key_configured=bool(openai_plain),
        openai_api_key_last4=mask_last4(openai_plain) if openai_plain else None,
        groq_api_key_configured=bool(groq_plain),
        groq_api_key_last4=mask_last4(groq_plain) if groq_plain else None,
        openrouter_api_key_configured=bool(or_plain),
        openrouter_api_key_last4=mask_last4(or_plain) if or_plain else None,
        huggingface_api_key_configured=bool(hf_plain),
        huggingface_api_key_last4=mask_last4(hf_plain) if hf_plain else None,
        nvidia_api_key_configured=bool(nv_plain),
        nvidia_api_key_last4=mask_last4(nv_plain) if nv_plain else None,
        groq_openai_base_url=load_groq_openai_base_url(db),
        openrouter_openai_base_url=load_openrouter_openai_base_url(db),
        huggingface_openai_base_url=load_huggingface_openai_base_url(db),
        nvidia_openai_base_url=load_nvidia_openai_base_url(db),
        openai_chat_base_url=load_openai_chat_base_url(db),
        qdrant_url=load_qdrant_url(db),
        qdrant_collection=load_qdrant_collection(db),
        ingest_chunk_size=load_default_chunk_size(db),
        ingest_chunk_overlap=load_default_chunk_overlap(db),
        model_provider_options=list(MODEL_PROVIDER_OPTIONS),
        chat_model_options=_chat_catalog_for_provider(provider),
        openai_chat_model_options=list(OPENAI_CHAT_MODEL_OPTIONS),
        groq_chat_model_options=list(GROQ_CHAT_MODEL_OPTIONS),
        openrouter_chat_model_options=list(OPENROUTER_CHAT_MODEL_OPTIONS),
        huggingface_chat_model_options=list(HUGGINGFACE_CHAT_MODEL_OPTIONS),
        nvidia_chat_model_options=list(NVIDIA_CHAT_MODEL_OPTIONS),
        openai_embed_model_options=list(OPENAI_EMBED_MODEL_OPTIONS),
        chat_model_aliases=[
            ChatModelAliasOut(alias=a["alias"], provider=a["provider"], model_id=a["model_id"])
            for a in load_chat_model_aliases(db)
        ],
        smtp=_smtp_config_out(db),
    )


class SettingsConfigResponse(BaseModel):
    model_provider: str
    default_chat_model: str
    default_embed_model: str
    openai_api_key_configured: bool
    openai_api_key_last4: str | None = None
    groq_api_key_configured: bool
    groq_api_key_last4: str | None = None
    openrouter_api_key_configured: bool
    openrouter_api_key_last4: str | None = None
    huggingface_api_key_configured: bool
    huggingface_api_key_last4: str | None = None
    nvidia_api_key_configured: bool
    nvidia_api_key_last4: str | None = None
    groq_openai_base_url: str
    openrouter_openai_base_url: str
    huggingface_openai_base_url: str
    nvidia_openai_base_url: str
    openai_chat_base_url: str
    qdrant_url: str
    qdrant_collection: str
    ingest_chunk_size: int
    ingest_chunk_overlap: int
    model_provider_options: list[str]
    chat_model_options: list[str]
    openai_chat_model_options: list[str]
    groq_chat_model_options: list[str]
    openrouter_chat_model_options: list[str]
    huggingface_chat_model_options: list[str]
    nvidia_chat_model_options: list[str]
    openai_embed_model_options: list[str]
    chat_model_aliases: list[ChatModelAliasOut]
    smtp: SmtpConfigOut


class ChatModelAliasPatchItem(BaseModel):
    alias: str = Field(min_length=1, max_length=64, pattern=r"^[a-zA-Z0-9][a-zA-Z0-9._-]*$")
    provider: str
    model_id: str = Field(min_length=1, max_length=512)


class SettingsConfigPatch(BaseModel):
    model_provider: str | None = None
    default_chat_model: str | None = None
    default_embed_model: str | None = None
    openai_api_key: str | None = None
    groq_api_key: str | None = None
    openrouter_api_key: str | None = None
    huggingface_api_key: str | None = None
    nvidia_api_key: str | None = None
    groq_openai_base_url: str | None = None
    openrouter_openai_base_url: str | None = None
    huggingface_openai_base_url: str | None = None
    nvidia_openai_base_url: str | None = None
    openai_chat_base_url: str | None = None
    qdrant_url: str | None = None
    qdrant_collection: str | None = None
    ingest_chunk_size: int | None = Field(default=None, ge=CHUNK_SIZE_MIN, le=CHUNK_SIZE_MAX)
    ingest_chunk_overlap: int | None = Field(default=None, ge=0, le=CHUNK_SIZE_MAX)
    smtp: SmtpConfigPatch | None = None
    chat_model_aliases: list[ChatModelAliasPatchItem] | None = None


def _validate_openai_compatible_base_url(url: str) -> str:
    u = url.strip().rstrip("/")
    if not u.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Base URL must start with http:// or https://")
    if len(u) > 512:
        raise HTTPException(status_code=400, detail="Base URL is too long")
    return u


def _delete_setting(db: Session, key: str) -> None:
    row = db.get(AppSetting, key)
    if row:
        db.delete(row)


def _upsert(db: Session, key: str, value: str, *, is_secret: bool = False) -> None:
    row = db.get(AppSetting, key)
    if row:
        row.value = value
        row.is_secret = is_secret
    else:
        db.add(AppSetting(key=key, value=value, is_secret=is_secret))


@router.get("/config", response_model=SettingsConfigResponse)
def get_config(admin: User = Depends(require_admin), db: Session = Depends(get_db)) -> SettingsConfigResponse:
    _ = admin
    return _config_response(db)


@router.patch("/config", response_model=SettingsConfigResponse)
def patch_config(
    body: SettingsConfigPatch,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> SettingsConfigResponse:
    _ = admin
    if body.ingest_chunk_size is not None or body.ingest_chunk_overlap is not None:
        prospective_size = (
            int(body.ingest_chunk_size) if body.ingest_chunk_size is not None else load_default_chunk_size(db)
        )
        prospective_overlap = (
            int(body.ingest_chunk_overlap)
            if body.ingest_chunk_overlap is not None
            else load_default_chunk_overlap(db)
        )
        if prospective_overlap >= prospective_size:
            raise HTTPException(
                status_code=400,
                detail="ingest_chunk_overlap must be smaller than ingest_chunk_size",
            )

    if body.model_provider is not None:
        prov = body.model_provider.strip().lower()
        if prov not in MODEL_PROVIDER_OPTIONS:
            raise HTTPException(status_code=400, detail="Unsupported model_provider")
        _upsert(db, KEY_MODEL_PROVIDER, prov, is_secret=False)
    if body.default_chat_model is not None:
        _upsert(db, KEY_DEFAULT_CHAT_MODEL, body.default_chat_model.strip(), is_secret=False)
    if body.default_embed_model is not None:
        _upsert(db, KEY_DEFAULT_EMBED_MODEL, body.default_embed_model.strip(), is_secret=False)
    if body.openai_api_key is not None and body.openai_api_key.strip():
        enc = encrypt_secret(body.openai_api_key.strip())
        _upsert(db, KEY_OPENAI_API_KEY, enc, is_secret=True)
    if body.groq_api_key is not None and body.groq_api_key.strip():
        enc = encrypt_secret(body.groq_api_key.strip())
        _upsert(db, KEY_GROQ_API_KEY, enc, is_secret=True)
    if body.openrouter_api_key is not None and body.openrouter_api_key.strip():
        enc = encrypt_secret(body.openrouter_api_key.strip())
        _upsert(db, KEY_OPENROUTER_API_KEY, enc, is_secret=True)
    if body.huggingface_api_key is not None and body.huggingface_api_key.strip():
        enc = encrypt_secret(body.huggingface_api_key.strip())
        _upsert(db, KEY_HUGGINGFACE_API_KEY, enc, is_secret=True)
    if body.nvidia_api_key is not None and body.nvidia_api_key.strip():
        enc = encrypt_secret(body.nvidia_api_key.strip())
        _upsert(db, KEY_NVIDIA_API_KEY, enc, is_secret=True)
    if body.groq_openai_base_url is not None:
        gq_url = body.groq_openai_base_url.strip()
        if not gq_url:
            _delete_setting(db, KEY_GROQ_OPENAI_BASE_URL)
        else:
            _upsert(db, KEY_GROQ_OPENAI_BASE_URL, _validate_openai_compatible_base_url(gq_url), is_secret=False)
    if body.openrouter_openai_base_url is not None:
        openrouter_url = body.openrouter_openai_base_url.strip()
        if not openrouter_url:
            _delete_setting(db, KEY_OPENROUTER_OPENAI_BASE_URL)
        else:
            _upsert(
                db,
                KEY_OPENROUTER_OPENAI_BASE_URL,
                _validate_openai_compatible_base_url(openrouter_url),
                is_secret=False,
            )
    if body.huggingface_openai_base_url is not None:
        hf_url = body.huggingface_openai_base_url.strip()
        if not hf_url:
            _delete_setting(db, KEY_HUGGINGFACE_OPENAI_BASE_URL)
        else:
            _upsert(db, KEY_HUGGINGFACE_OPENAI_BASE_URL, _validate_openai_compatible_base_url(hf_url), is_secret=False)
    if body.nvidia_openai_base_url is not None:
        nv_url = body.nvidia_openai_base_url.strip()
        if not nv_url:
            _delete_setting(db, KEY_NVIDIA_OPENAI_BASE_URL)
        else:
            _upsert(db, KEY_NVIDIA_OPENAI_BASE_URL, _validate_openai_compatible_base_url(nv_url), is_secret=False)
    if body.openai_chat_base_url is not None:
        oai_url = body.openai_chat_base_url.strip()
        if not oai_url:
            _delete_setting(db, KEY_OPENAI_CHAT_BASE_URL)
        else:
            _upsert(db, KEY_OPENAI_CHAT_BASE_URL, _validate_openai_compatible_base_url(oai_url), is_secret=False)
    if body.qdrant_url is not None:
        url = body.qdrant_url.strip()
        if not url.startswith(("http://", "https://")):
            raise HTTPException(status_code=400, detail="qdrant_url must start with http:// or https://")
        _upsert(db, KEY_QDRANT_URL, url, is_secret=False)
    if body.qdrant_collection is not None:
        coll = body.qdrant_collection.strip()
        if not coll or len(coll) > 256:
            raise HTTPException(status_code=400, detail="Invalid qdrant_collection")
        _upsert(db, KEY_QDRANT_COLLECTION, coll, is_secret=False)
    if body.ingest_chunk_size is not None:
        _upsert(db, KEY_INGEST_CHUNK_SIZE, str(int(body.ingest_chunk_size)), is_secret=False)
    if body.ingest_chunk_overlap is not None:
        _upsert(db, KEY_INGEST_CHUNK_OVERLAP, str(int(body.ingest_chunk_overlap)), is_secret=False)
    if body.smtp is not None:
        sm = body.smtp
        if sm.host is not None:
            _upsert(db, KEY_SMTP_HOST, sm.host.strip(), is_secret=False)
        if sm.port is not None:
            _upsert(db, KEY_SMTP_PORT, str(int(sm.port)), is_secret=False)
        if sm.username is not None:
            _upsert(db, KEY_SMTP_USERNAME, sm.username.strip(), is_secret=False)
        if sm.from_email is not None:
            _upsert(db, KEY_SMTP_FROM_EMAIL, str(sm.from_email).strip(), is_secret=False)
        if sm.use_tls is not None:
            _upsert(db, KEY_SMTP_USE_TLS, "true" if sm.use_tls else "false", is_secret=False)
        if sm.password is not None and sm.password.strip():
            enc = encrypt_secret(sm.password.strip())
            _upsert(db, KEY_SMTP_PASSWORD, enc, is_secret=True)
    if body.chat_model_aliases is not None:
        try:
            normalized = normalize_aliases_for_storage(body.chat_model_aliases)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        _upsert(db, KEY_CHAT_MODEL_ALIASES, json.dumps(normalized), is_secret=False)
    db.commit()

    return _config_response(db)


class UserOut(BaseModel):
    id: str
    email: str
    first_name: str | None
    last_name: str | None
    role: UserRole
    is_active: bool
    monthly_request_limit: int | None
    requests_this_period: int


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    first_name: str | None = Field(None, max_length=120)
    last_name: str | None = Field(None, max_length=120)
    role: UserRole = UserRole.normal
    monthly_request_limit: int | None = None


class UserPatch(BaseModel):
    first_name: str | None = Field(None, max_length=120)
    last_name: str | None = Field(None, max_length=120)
    role: UserRole | None = None
    is_active: bool | None = None
    monthly_request_limit: int | None = None
    password: str | None = Field(None, min_length=8)


@router.get("/users", response_model=list[UserOut])
def list_users(admin: User = Depends(require_admin), db: Session = Depends(get_db)) -> list[UserOut]:
    _ = admin
    users = db.scalars(select(User).order_by(User.email)).all()
    return [
        UserOut(
            id=str(u.id),
            email=u.email,
            first_name=u.first_name,
            last_name=u.last_name,
            role=u.role,
            is_active=u.is_active,
            monthly_request_limit=u.monthly_request_limit,
            requests_this_period=u.requests_this_period,
        )
        for u in users
    ]


@router.post("/users", response_model=UserOut)
def create_user(
    body: UserCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> UserOut:
    _ = admin
    exists = db.scalar(select(User.id).where(User.email == body.email.strip().lower()))
    if exists:
        raise HTTPException(status_code=400, detail="Email already registered")
    u = User(
        email=body.email.strip().lower(),
        first_name=(body.first_name.strip() if body.first_name else None) or None,
        last_name=(body.last_name.strip() if body.last_name else None) or None,
        hashed_password=hash_password(body.password),
        role=body.role,
        is_active=True,
        monthly_request_limit=body.monthly_request_limit,
        requests_this_period=0,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return UserOut(
        id=str(u.id),
        email=u.email,
        first_name=u.first_name,
        last_name=u.last_name,
        role=u.role,
        is_active=u.is_active,
        monthly_request_limit=u.monthly_request_limit,
        requests_this_period=u.requests_this_period,
    )


@router.patch("/users/{user_id}", response_model=UserOut)
def patch_user(
    user_id: UUID,
    body: UserPatch,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> UserOut:
    if user_id == admin.id and body.is_active is False:
        raise HTTPException(status_code=400, detail="Cannot disable yourself")
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if body.first_name is not None:
        u.first_name = body.first_name.strip() or None
    if body.last_name is not None:
        u.last_name = body.last_name.strip() or None
    if body.role is not None:
        u.role = body.role
    if body.is_active is not None:
        u.is_active = body.is_active
    if body.monthly_request_limit is not None:
        u.monthly_request_limit = body.monthly_request_limit
    if body.password is not None:
        u.hashed_password = hash_password(body.password)
    db.add(u)
    db.commit()
    db.refresh(u)
    return UserOut(
        id=str(u.id),
        email=u.email,
        first_name=u.first_name,
        last_name=u.last_name,
        role=u.role,
        is_active=u.is_active,
        monthly_request_limit=u.monthly_request_limit,
        requests_this_period=u.requests_this_period,
    )


class PersonaOut(BaseModel):
    id: str
    name: str
    description: str
    system_prompt: str
    is_active: bool
    sort_order: int


class PersonaCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = ""
    system_prompt: str = Field(min_length=1, max_length=32000)
    is_active: bool = True
    sort_order: int = 0


class PersonaPatch(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    system_prompt: str | None = Field(None, max_length=32000)
    is_active: bool | None = None
    sort_order: int | None = None


@router.get("/agents", response_model=list[PersonaOut])
def list_personas(admin: User = Depends(require_admin), db: Session = Depends(get_db)) -> list[PersonaOut]:
    _ = admin
    rows = db.scalars(select(AgentPersona).order_by(AgentPersona.sort_order, AgentPersona.name)).all()
    return [
        PersonaOut(
            id=str(p.id),
            name=p.name,
            description=p.description,
            system_prompt=p.system_prompt,
            is_active=p.is_active,
            sort_order=p.sort_order,
        )
        for p in rows
    ]


@router.post("/agents", response_model=PersonaOut)
def create_persona(
    body: PersonaCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> PersonaOut:
    _ = admin
    p = AgentPersona(
        name=body.name.strip(),
        description=body.description or "",
        system_prompt=body.system_prompt,
        is_active=body.is_active,
        sort_order=body.sort_order,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return PersonaOut(
        id=str(p.id),
        name=p.name,
        description=p.description,
        system_prompt=p.system_prompt,
        is_active=p.is_active,
        sort_order=p.sort_order,
    )


@router.patch("/agents/{persona_id}", response_model=PersonaOut)
def patch_persona(
    persona_id: UUID,
    body: PersonaPatch,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> PersonaOut:
    _ = admin
    p = db.get(AgentPersona, persona_id)
    if not p:
        raise HTTPException(status_code=404, detail="Persona not found")
    if body.name is not None:
        p.name = body.name.strip()
    if body.description is not None:
        p.description = body.description
    if body.system_prompt is not None:
        p.system_prompt = body.system_prompt
    if body.is_active is not None:
        p.is_active = body.is_active
    if body.sort_order is not None:
        p.sort_order = body.sort_order
    db.add(p)
    db.commit()
    db.refresh(p)
    return PersonaOut(
        id=str(p.id),
        name=p.name,
        description=p.description,
        system_prompt=p.system_prompt,
        is_active=p.is_active,
        sort_order=p.sort_order,
    )


@router.delete("/agents/{persona_id}")
def delete_persona(
    persona_id: UUID,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    _ = admin
    p = db.get(AgentPersona, persona_id)
    if not p:
        raise HTTPException(status_code=404, detail="Persona not found")
    db.delete(p)
    db.commit()
    return {"deleted": True}



class AgentBehaviorOut(BaseModel):
    """Single JSON document (`agent_config`) stored in DB; preview is computed."""

    agent_config: dict[str, Any]
    base_system_prompt_effective_preview: str


class AgentBehaviorPatch(BaseModel):
    """Merge into stored JSON. Omitted keys keep previous values."""

    agent_config: dict[str, Any] | None = None


def _agent_behavior_response(db: Session) -> AgentBehaviorOut:
    full_no_persona = resolve_full_system_prompt(db)
    preview = full_no_persona if len(full_no_persona) <= 650 else full_no_persona[:650] + "…"
    return AgentBehaviorOut(
        agent_config=load_agent_config_dict(db),
        base_system_prompt_effective_preview=preview,
    )


@router.get("/agent-behavior", response_model=AgentBehaviorOut)
def get_agent_behavior(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AgentBehaviorOut:
    _ = admin
    return _agent_behavior_response(db)


@router.patch("/agent-behavior", response_model=AgentBehaviorOut)
def patch_agent_behavior(
    body: AgentBehaviorPatch,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AgentBehaviorOut:
    _ = admin
    if body.agent_config is None:
        return _agent_behavior_response(db)
    current = load_agent_config_dict(db)
    incoming = body.agent_config
    if not isinstance(incoming, dict):
        raise HTTPException(status_code=400, detail="agent_config must be an object")
    for k, v in incoming.items():
        current[k] = v
    for text_key in ("company_display_name", "base_system_prompt", "guardrails_text", "guidelines_text"):
        if text_key in current and current[text_key] is not None:
            current[text_key] = str(current[text_key]).strip()
    save_agent_config_dict(db, current)
    return _agent_behavior_response(db)



class JobRow(BaseModel):
    id: str
    celery_task_id: str
    job_type: str
    created_by_user_id: str | None
    meta: dict[str, Any] | None
    created_at: str
    celery_status: str | None = None
    celery_successful: bool | None = None


def _jobs_rows(db: Session, limit: int) -> list[JobRow]:
    rows = list_jobs(db, limit=limit)
    out: list[JobRow] = []
    for j in rows:
        tr = get_task_result(j.celery_task_id)
        status = effective_celery_status(j, tr)
        succ = effective_successful_optional(j, tr)
        out.append(
            JobRow(
                id=str(j.id),
                celery_task_id=j.celery_task_id,
                job_type=j.job_type.value,
                created_by_user_id=str(j.created_by_user_id) if j.created_by_user_id else None,
                meta=j.meta,
                created_at=j.created_at.isoformat(),
                celery_status=status,
                celery_successful=succ,
            )
        )
    return out


@router.get("/jobs", response_model=list[JobRow])
def jobs_list(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
) -> list[JobRow]:
    _ = admin
    return _jobs_rows(db, limit)


@router.get("/ingestion/jobs", response_model=list[JobRow])
def ingestion_jobs_alias(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
) -> list[JobRow]:
    _ = admin
    return _jobs_rows(db, limit)



def _langsmith_dashboard_url() -> str:
    """Browser URL for the LangSmith UI (LANGCHAIN_ENDPOINT is the tracing API host)."""
    ep = (LANGCHAIN_ENDPOINT or "").lower()
    if "eu.api.smith" in ep or "eu.smith" in ep:
        return "https://eu.smith.langchain.com"
    return "https://smith.langchain.com"


class UsageSummaryResponse(BaseModel):
    langsmith: dict[str, Any]


@router.get("/usage/summary", response_model=UsageSummaryResponse)
def usage_summary(
    admin: User = Depends(require_admin),
) -> UsageSummaryResponse:
    _ = admin
    langsmith = {
        "tracing_enabled": LANGCHAIN_TRACING_V2,
        "project": LANGCHAIN_PROJECT,
        "api_key_configured": bool(LANGCHAIN_API_KEY),
        "endpoint": LANGCHAIN_ENDPOINT,
        "dashboard_url": _langsmith_dashboard_url(),
        "workspace_id": LANGSMITH_WORKSPACE_ID,
        "metrics": fetch_langsmith_project_metrics(),
    }
    return UsageSummaryResponse(langsmith=langsmith)



class LogsResponse(BaseModel):
    path: str
    lines: list[str]


@router.get("/logs", response_model=LogsResponse)
def tail_logs(
    admin: User = Depends(require_admin),
    lines: int = Query(200, ge=1, le=5000),
) -> LogsResponse:
    _ = admin
    path = APP_LOG_FILE
    if not os.path.isfile(path):
        return LogsResponse(path=path, lines=[])
    with open(path, encoding="utf-8", errors="replace") as f:
        tail = [ln.rstrip("\n") for ln in deque(f, maxlen=lines)]
    return LogsResponse(path=path, lines=tail)
