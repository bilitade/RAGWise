from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token, verify_password
from app.db.models import User
from app.db.session import get_db
from app.services.password_reset import request_password_reset, reset_password_with_token
from app.rate_limit import AUTH_PUBLIC_LIMIT, LOGIN_LIMIT, limiter

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/login", response_model=TokenResponse)
@limiter.limit(LOGIN_LIMIT, key_func=get_remote_address)
def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.scalar(select(User).where(User.email == payload.email.strip().lower()))
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User is disabled")
    token = create_access_token(
        user_id=str(user.id),
        email=user.email,
        role=user.role,
    )
    return TokenResponse(access_token=token)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    """Generic response to avoid account enumeration."""

    ok: bool = True


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
@limiter.limit(AUTH_PUBLIC_LIMIT, key_func=get_remote_address)
def forgot_password(request: Request, payload: ForgotPasswordRequest, db: Session = Depends(get_db)) -> ForgotPasswordResponse:
    request_password_reset(db, email=str(payload.email))
    return ForgotPasswordResponse()


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=10)
    new_password: str = Field(min_length=8)


@router.post("/reset-password", response_model=ForgotPasswordResponse)
@limiter.limit(AUTH_PUBLIC_LIMIT, key_func=get_remote_address)
def reset_password(request: Request, payload: ResetPasswordRequest, db: Session = Depends(get_db)) -> ForgotPasswordResponse:
    ok = reset_password_with_token(db, raw_token=payload.token, new_password=payload.new_password)
    if not ok:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")
    return ForgotPasswordResponse()
