"""Revision ID: 20260810_0002_user_phone
Revises: 20260729_0001
Create Date: 2026-08-10
"""

from alembic import op
import sqlalchemy as sa

revision = "0002_user_phone"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("phone_number", sa.String(length=20), nullable=True))
    op.create_index("ix_users_phone_number", "users", ["phone_number"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_phone_number", table_name="users")
    op.drop_column("users", "phone_number")
