"""Migrate Grok → Groq app_settings keys; align model_provider value.

Revision ID: 005_groq_hf_nvidia_chat_providers
Revises: 004_user_profile_password_reset
Create Date: 2026-04-16

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "005_groq_hf_nvidia_chat_providers"
down_revision = "004_user_profile_password_reset"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            """
            INSERT INTO app_settings (key, value, is_secret)
            SELECT 'groq_api_key', value, is_secret
            FROM app_settings
            WHERE key = 'grok_api_key'
              AND NOT EXISTS (SELECT 1 FROM app_settings s2 WHERE s2.key = 'groq_api_key')
            """
        )
    )
    bind.execute(
        sa.text(
            "UPDATE app_settings SET value = 'groq' WHERE key = 'model_provider' AND lower(trim(value)) = 'grok'"
        )
    )
    bind.execute(sa.text("DELETE FROM app_settings WHERE key = 'grok_api_key'"))


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            """
            INSERT INTO app_settings (key, value, is_secret)
            SELECT 'grok_api_key', value, is_secret
            FROM app_settings
            WHERE key = 'groq_api_key'
              AND NOT EXISTS (SELECT 1 FROM app_settings s2 WHERE s2.key = 'grok_api_key')
            """
        )
    )
    bind.execute(
        sa.text(
            "UPDATE app_settings SET value = 'grok' WHERE key = 'model_provider' AND lower(trim(value)) = 'groq'"
        )
    )
    bind.execute(sa.text("DELETE FROM app_settings WHERE key = 'groq_api_key'"))
