from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_request_user_optional
from app.db.models import User, UserRole
from app.db.session import get_db

router = APIRouter(prefix="/me", tags=["me"])


class MeResponse(BaseModel):
    id: str
    email: str
    role: UserRole
    is_active: bool
    monthly_request_limit: int | None
    requests_this_period: int


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
        role=user.role,
        is_active=user.is_active,
        monthly_request_limit=user.monthly_request_limit,
        requests_this_period=user.requests_this_period,
    )
