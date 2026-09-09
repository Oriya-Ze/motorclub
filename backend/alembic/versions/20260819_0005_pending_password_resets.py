"""Add pending_password_resets table for API-driven password reset emails.

Revision ID: 0005_pending_password_resets
Revises: 0004_pending_signups
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0005_pending_password_resets"
down_revision = "0004_pending_signups"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pending_password_resets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("code_hash", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_pending_password_resets_email", "pending_password_resets", ["email"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_pending_password_resets_email", table_name="pending_password_resets")
    op.drop_table("pending_password_resets")
