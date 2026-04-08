import base64
import hashlib

from cryptography.fernet import Fernet

from app.config import JWT_SECRET, SETTINGS_SECRET_KEY


def _fernet_key_bytes() -> bytes:
    secret = SETTINGS_SECRET_KEY.strip() or JWT_SECRET
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def encrypt_secret(plain: str) -> str:
    f = Fernet(_fernet_key_bytes())
    return f.encrypt(plain.encode("utf-8")).decode("utf-8")


def decrypt_secret(token: str) -> str:
    f = Fernet(_fernet_key_bytes())
    return f.decrypt(token.encode("utf-8")).decode("utf-8")


def mask_last4(value: str | None) -> str | None:
    if not value or len(value) < 4:
        return None
    return f"****{value[-4:]}"
