"""Admin settings API (requires admin JWT)."""

from __future__ import annotations

import os
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
from app.services.jobs_repo import list_jobs
from app.services.langsmith_metrics import fetch_langsmith_project_metrics
from app.services.runtime_config import (
    KEY_DEFAULT_CHAT_MODEL,
    KEY_DEFAULT_EMBED_MODEL,
    KEY_MODEL_PROVIDER,
    KEY_OPENAI_API_KEY,
    load_default_chat_model,
    load_default_embed_model,
    load_model_provider,
    load_openai_api_key,
)

router = APIRouter(prefix="/settings", tags=["settings"])


# --- Config ---


class SettingsConfigResponse(BaseModel):
    model_provider: str
    default_chat_model: str
    default_embed_model: str
    openai_api_key_configured: bool
    openai_api_key_last4: str | None = None


class SettingsConfigPatch(BaseModel):
    model_provider: str | None = None
    default_chat_model: str | None = None
    default_embed_model: str | None = None
    openai_api_key: str | None = None


def _upsert(db: Session, key: str, value: str, *, is_secret: bool = False) -> None:
    row = db.get(AppSetting, key)
    if row:
        row.value = value
        row.is_secret = is_secret
    else:
        db.add(AppSetting(key=key, value=value, is_secret=is_secret))
    db.commit()


@router.get("/config", response_model=SettingsConfigResponse)
def get_config(admin: User = Depends(require_admin), db: Session = Depends(get_db)) -> SettingsConfigResponse:
    _ = admin
    key_plain = load_openai_api_key(db)
    last4 = mask_last4(key_plain) if key_plain else None
    return SettingsConfigResponse(
        model_provider=load_model_provider(db),
        default_chat_model=load_default_chat_model(db),
        default_embed_model=load_default_embed_model(db),
        openai_api_key_configured=bool(key_plain),
        openai_api_key_last4=last4,
    )


@router.patch("/config", response_model=SettingsConfigResponse)
def patch_config(
    body: SettingsConfigPatch,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> SettingsConfigResponse:
    _ = admin
    if body.model_provider is not None:
        _upsert(db, KEY_MODEL_PROVIDER, body.model_provider.strip(), is_secret=False)
    if body.default_chat_model is not None:
        _upsert(db, KEY_DEFAULT_CHAT_MODEL, body.default_chat_model.strip(), is_secret=False)
    if body.default_embed_model is not None:
        _upsert(db, KEY_DEFAULT_EMBED_MODEL, body.default_embed_model.strip(), is_secret=False)
    if body.openai_api_key is not None and body.openai_api_key.strip():
        enc = encrypt_secret(body.openai_api_key.strip())
        _upsert(db, KEY_OPENAI_API_KEY, enc, is_secret=True)
    key_plain = load_openai_api_key(db)
    last4 = mask_last4(key_plain) if key_plain else None
    return SettingsConfigResponse(
        model_provider=load_model_provider(db),
        default_chat_model=load_default_chat_model(db),
        default_embed_model=load_default_embed_model(db),
        openai_api_key_configured=bool(key_plain),
        openai_api_key_last4=last4,
    )


# --- Users ---


class UserOut(BaseModel):
    id: str
    email: str
    role: UserRole
    is_active: bool
    monthly_request_limit: int | None
    requests_this_period: int


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    role: UserRole = UserRole.normal
    monthly_request_limit: int | None = None


class UserPatch(BaseModel):
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
        role=u.role,
        is_active=u.is_active,
        monthly_request_limit=u.monthly_request_limit,
        requests_this_period=u.requests_this_period,
    )


# --- Agent personas ---


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


# --- Jobs ---


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
        out.append(
            JobRow(
                id=str(j.id),
                celery_task_id=j.celery_task_id,
                job_type=j.job_type.value,
                created_by_user_id=str(j.created_by_user_id) if j.created_by_user_id else None,
                meta=j.meta,
                created_at=j.created_at.isoformat(),
                celery_status=tr.status,
                celery_successful=tr.successful() if tr.ready() else None,
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


# --- Usage ---


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


# --- Logs ---


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
        all_lines = f.readlines()
    tail = [ln.rstrip("\n") for ln in all_lines[-lines:]]
    return LogsResponse(path=path, lines=tail)
