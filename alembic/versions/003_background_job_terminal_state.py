"""background_jobs: persist terminal Celery state

Revision ID: 003
Revises: 002
"""

from alembic import op
import sqlalchemy as sa


revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    from sqlalchemy import inspect

    conn = op.get_bind()
    existing_cols = {col["name"] for col in inspect(conn).get_columns("background_jobs")}

    if "celery_state" not in existing_cols:
        op.add_column("background_jobs", sa.Column("celery_state", sa.String(32), nullable=True))
    if "finished_at" not in existing_cols:
        op.add_column("background_jobs", sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True))
    if "error_message" not in existing_cols:
        op.add_column("background_jobs", sa.Column("error_message", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("background_jobs", "error_message")
    op.drop_column("background_jobs", "finished_at")
    op.drop_column("background_jobs", "celery_state")
