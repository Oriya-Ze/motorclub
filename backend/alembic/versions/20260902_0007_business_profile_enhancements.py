"""Business profile enhancements: hours, gallery, services, reviews, analytics."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0007_business_profile"
down_revision: Union[str, None] = "0006_business_upgrade_review"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("cover_image_url", sa.String(length=500), nullable=True))
    op.add_column("users", sa.Column("business_website", sa.String(length=500), nullable=True))
    op.add_column("users", sa.Column("business_registration_id", sa.String(length=50), nullable=True))
    op.add_column("users", sa.Column("business_hours", postgresql.JSONB(), nullable=True))
    op.add_column("users", sa.Column("gallery_urls", postgresql.ARRAY(sa.String()), nullable=True))
    op.add_column("users", sa.Column("certifications", postgresql.ARRAY(sa.String()), nullable=True))
    op.add_column("users", sa.Column("service_area", postgresql.JSONB(), nullable=True))

    op.create_table(
        "business_services",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("business_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price_from", sa.Float(), nullable=True),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["business_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_business_services_business_id", "business_services", ["business_id"])

    op.create_table(
        "business_reviews",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("business_id", sa.UUID(), nullable=False),
        sa.Column("reviewer_id", sa.UUID(), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["business_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reviewer_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("business_id", "reviewer_id", name="uq_business_reviews_business_reviewer"),
    )
    op.create_index("ix_business_reviews_business_id", "business_reviews", ["business_id"])

    op.create_table(
        "business_views",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("business_id", sa.UUID(), nullable=False),
        sa.Column("viewer_id", sa.UUID(), nullable=True),
        sa.Column("event_type", sa.String(length=30), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["business_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["viewer_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_business_views_business_id", "business_views", ["business_id"])
    op.create_index("ix_business_views_created_at", "business_views", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_business_views_created_at", table_name="business_views")
    op.drop_index("ix_business_views_business_id", table_name="business_views")
    op.drop_table("business_views")
    op.drop_index("ix_business_reviews_business_id", table_name="business_reviews")
    op.drop_table("business_reviews")
    op.drop_index("ix_business_services_business_id", table_name="business_services")
    op.drop_table("business_services")
    op.drop_column("users", "service_area")
    op.drop_column("users", "certifications")
    op.drop_column("users", "gallery_urls")
    op.drop_column("users", "business_hours")
    op.drop_column("users", "business_registration_id")
    op.drop_column("users", "business_website")
    op.drop_column("users", "cover_image_url")
