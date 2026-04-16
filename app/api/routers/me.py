from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_request_user_optional, require_user
from app.core.security import hash_password, verify_password
from app.db.models import User, UserRole
from app.db.session import get_db

router = APIRouter(prefix="/me", tags=["me"])


class MeResponse(BaseModel):
    id: str
    email: str
    first_name: str | None
    last_name: str | None
    role: UserRole
    is_active: bool
    monthly_request_limit: int | None
    requests_this_period: int


class MePatch(BaseModel):
    first_name: str | None = Field(None, max_length=120)
    last_name: str | None = Field(None, max_length=120)


class MePasswordPatch(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8)


@router.get("", response_model=MeResponse)
def me(
    user: User | None = Depends(get_request_user_optional),
    db: Session = Depends(get_db),
) -> MeResponse:
    """Returns current user profile (requires Bearer token)."""
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    db.refresh(user)
    return MeResponse(
        id=str(user.id),
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        role=user.role,
        is_active=user.is_active,
        monthly_request_limit=user.monthly_request_limit,
        requests_this_period=user.requests_this_period,
    )


@router.patch("", response_model=MeResponse)
def patch_me(
    body: MePatch,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
) -> MeResponse:
    if body.first_name is not None:
        user.first_name = body.first_name.strip() or None
    if body.last_name is not None:
        user.last_name = body.last_name.strip() or None
    db.add(user)
    db.commit()
    db.refresh(user)
    return MeResponse(
        id=str(user.id),
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        role=user.role,
        is_active=user.is_active,
        monthly_request_limit=user.monthly_request_limit,
        requests_this_period=user.requests_this_period,
    )


@router.patch("/password", response_model=MeResponse)
def patch_me_password(
    body: MePasswordPatch,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
) -> MeResponse:
    if not verify_password(body.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    user.hashed_password = hash_password(body.new_password)
    db.add(user)
    db.commit()
    db.refresh(user)
    return MeResponse(
        id=str(user.id),
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        role=user.role,
        is_active=user.is_active,
        monthly_request_limit=user.monthly_request_limit,
        requests_this_period=user.requests_this_period,
    )
