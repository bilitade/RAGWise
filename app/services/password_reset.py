"""Password reset token lifecycle."""

from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.config import PUBLIC_APP_URL
from app.core.security import hash_password
from app.db.models import PasswordResetToken, User
from app.services.email_delivery import send_smtp_email
from app.services.smtp_settings import load_smtp_settings

_log = logging.getLogger(__name__)

RESET_TOKEN_TTL = timedelta(hours=1)


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def request_password_reset(db: Session, *, email: str) -> None:
    """Create token and send mail if user exists and SMTP is configured. Always swallow user errors."""
    normalized = email.strip().lower()
    user = db.scalar(select(User).where(User.email == normalized))
    if not user or not user.is_active:
        _log.debug("Password reset requested for unknown or inactive email")
        return

    smtp = load_smtp_settings(db)
    if not smtp.is_configured():
        _log.warning("Password reset requested but SMTP is not configured")
        return

    raw_token = secrets.token_urlsafe(32)
    token_hash = _hash_token(raw_token)
    expires_at = datetime.now(tz=UTC) + RESET_TOKEN_TTL

    db.execute(delete(PasswordResetToken).where(PasswordResetToken.user_id == user.id))
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
    )
    db.commit()

    link = f"{PUBLIC_APP_URL}/reset-password?token={raw_token}"
    body = (
        f"You requested a password reset for {user.email}.\n\n"
        f"Open this link to choose a new password (valid for 1 hour):\n{link}\n\n"
        "If you did not request this, you can ignore this email."
    )
    try:
        send_smtp_email(
            smtp,
            to_email=user.email,
            subject="Password reset",
            body_text=body,
        )
    except Exception:
        _log.exception("Failed to send password reset email to %s", user.email)


def reset_password_with_token(db: Session, *, raw_token: str, new_password: str) -> bool:
    """Returns True if password was updated."""
    token_hash = _hash_token(raw_token.strip())
    row = db.scalar(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > datetime.now(tz=UTC),
        )
    )
    if not row:
        return False
    user = db.get(User, row.user_id)
    if not user or not user.is_active:
        return False

    user.hashed_password = hash_password(new_password)
    row.used_at = datetime.now(tz=UTC)
    db.add(user)
    db.add(row)
    db.commit()
    return True
