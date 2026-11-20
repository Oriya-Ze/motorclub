"""Posts a member hid from their own feed when reporting them.

Only adds a table, so the code already running keeps working while this runs.

Revision ID: 0026_hidden_posts
Revises: 0025_bio_and_bot_images
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0026_hidden_posts"
down_revision: Union[str, None] = "0025_bio_and_bot_images"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "hidden_posts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("post_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("posts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "post_id", name="uq_hidden_posts_pair"),
    )
    op.create_index("ix_hidden_posts_user_id", "hidden_posts", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_hidden_posts_user_id", table_name="hidden_posts")
    op.drop_table("hidden_posts")
