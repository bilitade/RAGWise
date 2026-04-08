"""One-time admin bootstrap from environment."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_PASSWORD
from app.core.security import hash_password
from app.db.models import User, UserRole


def ensure_initial_admin(db: Session) -> None:
    if not INITIAL_ADMIN_EMAIL or not INITIAL_ADMIN_PASSWORD:
        return
    exists = db.scalar(select(User.id).limit(1))
    if exists:
        return
    admin = User(
        email=INITIAL_ADMIN_EMAIL.strip().lower(),
        hashed_password=hash_password(INITIAL_ADMIN_PASSWORD),
        role=UserRole.admin,
        is_active=True,
        monthly_request_limit=None,
        requests_this_period=0,
    )
    db.add(admin)
    db.commit()
