"""SMTP settings stored in app_settings (admin-configurable)."""

from __future__ import annotations

import os
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.crypto import decrypt_secret
from app.db.models import AppSetting

KEY_SMTP_HOST = "smtp_host"
KEY_SMTP_PORT = "smtp_port"
KEY_SMTP_USERNAME = "smtp_username"
KEY_SMTP_PASSWORD = "smtp_password"
KEY_SMTP_FROM_EMAIL = "smtp_from_email"
KEY_SMTP_USE_TLS = "smtp_use_tls"


@dataclass(frozen=True)
class SmtpSettings:
    host: str
    port: int
    username: str
    password: str | None
    from_email: str
    use_tls: bool

    def is_configured(self) -> bool:
        return bool(self.host.strip() and self.from_email.strip() and self.password)


def _read_plain(db: Session, key: str) -> str:
    row = db.get(AppSetting, key)
    return (row.value or "").strip() if row else ""


def load_smtp_settings(db: Session) -> SmtpSettings:
    host = _read_plain(db, KEY_SMTP_HOST) or (os.environ.get("SMTP_HOST") or "").strip()
    port_raw = _read_plain(db, KEY_SMTP_PORT) or (os.environ.get("SMTP_PORT") or "587")
    try:
        port = int(port_raw)
    except ValueError:
        port = 587
    username = _read_plain(db, KEY_SMTP_USERNAME) or (os.environ.get("SMTP_USERNAME") or "").strip()
    from_email = _read_plain(db, KEY_SMTP_FROM_EMAIL) or (os.environ.get("SMTP_FROM_EMAIL") or "").strip()
    tls_raw = (_read_plain(db, KEY_SMTP_USE_TLS) or os.environ.get("SMTP_USE_TLS", "true")).lower()
    use_tls = tls_raw in ("1", "true", "yes")

    password: str | None = None
    row = db.get(AppSetting, KEY_SMTP_PASSWORD)
    if row and row.value:
        try:
            password = decrypt_secret(row.value).strip() or None
        except Exception:
            password = None
    if not password:
        password = (os.environ.get("SMTP_PASSWORD") or "").strip() or None

    return SmtpSettings(
        host=host,
        port=port,
        username=username,
        password=password,
        from_email=from_email,
        use_tls=use_tls,
    )


