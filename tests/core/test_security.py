"""app.core.security"""

from __future__ import annotations

import uuid

import pytest
from jose import JWTError

from app.core.security import (
    create_access_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db.models import UserRole


def test_hash_password_verify_round_trip() -> None:
    h = hash_password("secret-password")
    assert h != "secret-password"
    assert verify_password("secret-password", h)
    assert not verify_password("wrong", h)


def test_verify_password_invalid_hash() -> None:
    assert not verify_password("x", "not-a-valid-bcrypt-string")


def test_access_token_round_trip() -> None:
    uid = str(uuid.uuid4())
    token = create_access_token(user_id=uid, email="a@b.com", role=UserRole.admin)
    payload = decode_token(token)
    assert payload["sub"] == uid
    assert payload["email"] == "a@b.com"
    assert payload["role"] == "admin"


def test_decode_token_invalid_raises() -> None:
    with pytest.raises(JWTError):
        decode_token("not.a.valid.jwt")
