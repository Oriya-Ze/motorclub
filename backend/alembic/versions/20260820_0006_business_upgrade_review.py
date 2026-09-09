"""Extend business upgrade requests and add is_admin on users."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006_business_upgrade_review"
down_revision: Union[str, None] = "0005_pending_password_resets"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.false()))

    op.add_column("business_upgrade_requests", sa.Column("business_name", sa.String(length=255), nullable=True))
    op.add_column("business_upgrade_requests", sa.Column("business_type", sa.String(length=50), nullable=True))
    op.add_column("business_upgrade_requests", sa.Column("business_description", sa.Text(), nullable=True))
    op.add_column("business_upgrade_requests", sa.Column("business_phone", sa.String(length=30), nullable=True))
    op.add_column("business_upgrade_requests", sa.Column("business_address", sa.String(length=500), nullable=True))
    op.add_column("business_upgrade_requests", sa.Column("business_registration_id", sa.String(length=50), nullable=True))
    op.add_column("business_upgrade_requests", sa.Column("business_website", sa.String(length=500), nullable=True))
    op.add_column("business_upgrade_requests", sa.Column("contact_full_name", sa.String(length=255), nullable=True))
    op.add_column("business_upgrade_requests", sa.Column("contact_phone", sa.String(length=30), nullable=True))
    op.add_column("business_upgrade_requests", sa.Column("additional_notes", sa.Text(), nullable=True))
    op.add_column("business_upgrade_requests", sa.Column("reviewed_by_id", sa.UUID(), nullable=True))
    op.add_column("business_upgrade_requests", sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("business_upgrade_requests", sa.Column("rejection_reason", sa.Text(), nullable=True))
    op.add_column("business_upgrade_requests", sa.Column("admin_notes", sa.Text(), nullable=True))
    op.create_foreign_key(
        "fk_business_upgrade_requests_reviewed_by_id_users",
        "business_upgrade_requests",
        "users",
        ["reviewed_by_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_business_upgrade_requests_reviewed_by_id_users", "business_upgrade_requests", type_="foreignkey")
    op.drop_column("business_upgrade_requests", "admin_notes")
    op.drop_column("business_upgrade_requests", "rejection_reason")
    op.drop_column("business_upgrade_requests", "reviewed_at")
    op.drop_column("business_upgrade_requests", "reviewed_by_id")
    op.drop_column("business_upgrade_requests", "additional_notes")
    op.drop_column("business_upgrade_requests", "contact_phone")
    op.drop_column("business_upgrade_requests", "contact_full_name")
    op.drop_column("business_upgrade_requests", "business_website")
    op.drop_column("business_upgrade_requests", "business_registration_id")
    op.drop_column("business_upgrade_requests", "business_address")
    op.drop_column("business_upgrade_requests", "business_phone")
    op.drop_column("business_upgrade_requests", "business_description")
    op.drop_column("business_upgrade_requests", "business_type")
    op.drop_column("business_upgrade_requests", "business_name")
    op.drop_column("users", "is_admin")
