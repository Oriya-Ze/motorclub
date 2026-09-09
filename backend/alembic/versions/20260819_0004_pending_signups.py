"""Add pending_signups table for pre-verification registration.

Revision ID: 0004_pending_signups
Revises: 0003_forum_i18n
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0004_pending_signups"
down_revision = "0003_forum_i18n"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pending_signups",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("username", sa.String(50), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("code_hash", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_pending_signups_email", "pending_signups", ["email"], unique=True)
    op.create_index("ix_pending_signups_username", "pending_signups", ["username"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_pending_signups_username", table_name="pending_signups")
    op.drop_index("ix_pending_signups_email", table_name="pending_signups")
    op.drop_table("pending_signups")
