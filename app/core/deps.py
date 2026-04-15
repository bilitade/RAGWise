from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from jose import JWTError
from sqlalchemy.orm import Session

from app.config import REQUIRE_AUTH
from app.core.security import decode_token
from app.db.models import User, UserRole
from app.db.session import get_db


def get_request_user_optional(
    authorization: Annotated[str | None, Header()] = None,
    db: Session = Depends(get_db),
) -> User | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        return None
    try:
        payload = decode_token(token)
        sub = payload.get("sub")
        if not sub:
            return None
        try:
            uid = UUID(sub)
        except ValueError:
            return None
        user = db.get(User, uid)
        return user
    except JWTError:
        return None


def require_active_user(
    user: Annotated[User | None, Depends(get_request_user_optional)],
) -> User | None:
    """When REQUIRE_AUTH is true, a valid JWT must be present."""
    if REQUIRE_AUTH and user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if user is not None and not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is disabled")
    return user


def require_pro_or_admin(
    user: Annotated[User | None, Depends(require_active_user)],
) -> User | None:
    if user is None:
        return None
    if user.role not in (UserRole.pro, UserRole.admin):
        raise HTTPException(status_code=403, detail="Pro or admin role required")
    return user


def require_user(
    user: Annotated[User | None, Depends(require_active_user)],
) -> User:
    """Valid JWT required (used for persisted chat and other user-scoped routes)."""
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_admin(
    user: Annotated[User | None, Depends(get_request_user_optional)],
) -> User:
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User is disabled")
    if user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin role required")
    return user
