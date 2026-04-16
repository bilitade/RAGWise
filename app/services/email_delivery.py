"""Send transactional email via SMTP (TLS)."""

from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from app.services.smtp_settings import SmtpSettings

_log = logging.getLogger(__name__)


def send_smtp_email(
    settings: SmtpSettings,
    *,
    to_email: str,
    subject: str,
    body_text: str,
) -> None:
    if not settings.is_configured():
        raise RuntimeError("SMTP is not fully configured (host, from address, and password required).")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.from_email
    msg["To"] = to_email
    if settings.username:
        msg["Reply-To"] = settings.username
    msg.set_content(body_text)

    with smtplib.SMTP(settings.host, settings.port, timeout=30) as smtp:
        smtp.ehlo()
        if settings.use_tls:
            smtp.starttls()
            smtp.ehlo()
        if settings.password:
            smtp.login(settings.username or settings.from_email, settings.password)
        smtp.send_message(msg)
    _log.info("Sent email to %s subject=%r", to_email, subject)
