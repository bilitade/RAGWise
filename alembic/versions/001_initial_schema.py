"""Initial schema (mirrors SQLAlchemy models).

Revision ID: 001
Revises:
Create Date: 2026-04-08

Deploy note: the API also calls ``Base.metadata.create_all`` on startup for convenience.
Use ``alembic upgrade head`` when managing schema via migrations only.
"""

from alembic import op


revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    from app.db.models import Base

    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    from app.db.models import Base

    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
