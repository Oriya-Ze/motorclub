"""Product listing fields, reports, and image scan records.

Revision ID: 0015_marketplace_moderation
Revises: 0014_refresh_tokens
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0015_marketplace_moderation"
down_revision: Union[str, None] = "0014_refresh_tokens"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_moderator", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("users", sa.Column("suspended_until", sa.DateTime(timezone=True), nullable=True))
    op.add_column("products", sa.Column("condition", sa.String(20), nullable=True))
    op.add_column("products", sa.Column("fit_make", sa.String(80), nullable=True))
    op.add_column("products", sa.Column("fit_model", sa.String(80), nullable=True))
    op.add_column("products", sa.Column("fit_year_from", sa.Integer(), nullable=True))
    op.add_column("products", sa.Column("fit_year_to", sa.Integer(), nullable=True))
    op.add_column("products", sa.Column("brand", sa.String(80), nullable=True))
    op.add_column("products", sa.Column("sku", sa.String(80), nullable=True))
    op.add_column("products", sa.Column("pickup_area", sa.String(120), nullable=True))
    op.add_column("products", sa.Column("ships", sa.Boolean(), nullable=True))
    op.add_column(
        "products",
        sa.Column("listing_status", sa.String(20), nullable=False, server_default="published"),
    )
    op.add_column(
        "products",
        sa.Column("moderation_status", sa.String(20), nullable=False, server_default="unscanned"),
    )
    op.create_index("ix_products_listing_status", "products", ["listing_status"])
    op.create_table(
        "content_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("reporter_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_type", sa.String(20), nullable=False),
        sa.Column("target_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reason", sa.String(40), nullable=False),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="new"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_content_reports_reporter_id", "content_reports", ["reporter_id"])
    op.create_index("ix_content_reports_target_id", "content_reports", ["target_id"])
    op.create_index("ix_content_reports_status", "content_reports", ["status"])
    op.create_table(
        "moderation_actions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("action", sa.String(40), nullable=False),
        sa.Column("target_type", sa.String(20), nullable=False),
        sa.Column("target_id", sa.String(80), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_moderation_actions_actor_id", "moderation_actions", ["actor_id"])
    op.create_table(
        "media_scans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("storage_key", sa.String(500), nullable=False),
        sa.Column("content_hash", sa.String(64), nullable=False),
        sa.Column("decision", sa.String(20), nullable=False),
        sa.Column("labels", postgresql.JSONB(), nullable=True),
        sa.Column("model_version", sa.String(80), nullable=True),
        sa.Column("policy_version", sa.String(40), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_media_scans_storage_key", "media_scans", ["storage_key"])


def downgrade() -> None:
    op.drop_index("ix_media_scans_storage_key", table_name="media_scans")
    op.drop_table("media_scans")
    op.drop_index("ix_moderation_actions_actor_id", table_name="moderation_actions")
    op.drop_table("moderation_actions")
    op.drop_index("ix_content_reports_status", table_name="content_reports")
    op.drop_index("ix_content_reports_target_id", table_name="content_reports")
    op.drop_index("ix_content_reports_reporter_id", table_name="content_reports")
    op.drop_table("content_reports")
    op.drop_index("ix_products_listing_status", table_name="products")
    for column in (
        "moderation_status",
        "listing_status",
        "ships",
        "pickup_area",
        "sku",
        "brand",
        "fit_year_to",
        "fit_year_from",
        "fit_model",
        "fit_make",
        "condition",
    ):
        op.drop_column("products", column)
    op.drop_column("users", "suspended_until")
    op.drop_column("users", "is_moderator")
