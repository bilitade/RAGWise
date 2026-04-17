"""Initial schema (mirrors SQLAlchemy models).

Revision ID: 001
Revises:
Create Date: 2026-04-08

Deploy note: the API also calls ``Base.metadata.create_all`` on startup for convenience.
Use ``alembic upgrade head`` when managing schema via migrations only.
"""

import sqlalchemy as sa
from alembic import op


revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    from app.db.models import Base

    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)

    # Alembic's default version_num column is VARCHAR(32), which is too short
    # for descriptive revision IDs like "005_groq_hf_nvidia_chat_providers".
    # Widen it once here so every subsequent migration can be recorded cleanly.
    bind.execute(sa.text("ALTER TABLE alembic_version ALTER COLUMN version_num TYPE VARCHAR(256)"))


def downgrade() -> None:
    from app.db.models import Base

    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
