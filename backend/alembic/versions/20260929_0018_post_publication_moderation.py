"""Hold an entire post until every current image is approved.

Revision ID: 0018_post_publication_moderation
Revises: 0017_media_scan_request_id
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0018_post_publication_moderation"
down_revision: Union[str, None] = "0017_media_scan_request_id"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "posts",
        sa.Column("moderation_status", sa.String(length=20), nullable=False, server_default="published"),
    )
    op.add_column("posts", sa.Column("media_version", sa.String(length=64), nullable=True))
    op.add_column("posts", sa.Column("moderation_blocks", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column(
        "posts",
        sa.Column("publish_requested", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column("posts", sa.Column("first_published_at", sa.DateTime(timezone=True), nullable=True))
    # Every post that exists before this revision was published once, including ones a moderator later hid.
    op.execute("UPDATE posts SET first_published_at = created_at")
    # Before this revision only a moderator could set hidden_at, so those posts were removed by staff.
    op.execute("UPDATE posts SET moderation_status = 'removed' WHERE hidden_at IS NOT NULL")
    op.create_table(
        "moderation_appeals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("post_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("posts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("media_version", sa.String(length=64), nullable=False),
        sa.Column("snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="open"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_moderation_appeals_user_id", "moderation_appeals", ["user_id"])
    op.create_index("ix_moderation_appeals_post_id", "moderation_appeals", ["post_id"])
    op.create_index(
        "uq_open_appeal_version",
        "moderation_appeals",
        ["post_id", "media_version"],
        unique=True,
        postgresql_where=sa.text("status = 'open'"),
    )


def downgrade() -> None:
    op.drop_index("uq_open_appeal_version", table_name="moderation_appeals")
    op.drop_index("ix_moderation_appeals_post_id", table_name="moderation_appeals")
    op.drop_index("ix_moderation_appeals_user_id", table_name="moderation_appeals")
    op.drop_table("moderation_appeals")
    op.drop_column("posts", "first_published_at")
    op.drop_column("posts", "publish_requested")
    op.drop_column("posts", "moderation_blocks")
    op.drop_column("posts", "media_version")
    op.drop_column("posts", "moderation_status")
