"""Hold the emailed code a member enters to delete their account.

Only adds a table, so the code already running keeps working while this runs.

Revision ID: 0021_account_deletion_codes
Revises: 0020_vehicle_listings
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0021_account_deletion_codes"
down_revision: Union[str, None] = "0020_vehicle_listings"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "pending_account_deletions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_pending_account_deletions_user_id", "pending_account_deletions", ["user_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_pending_account_deletions_user_id", table_name="pending_account_deletions")
    op.drop_table("pending_account_deletions")
