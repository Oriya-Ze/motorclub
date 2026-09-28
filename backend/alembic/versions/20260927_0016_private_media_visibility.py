"""Private image review fields and reversible content hiding.

Revision ID: 0016_private_media_visibility
Revises: 0015_marketplace_moderation
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0016_private_media_visibility"
down_revision: Union[str, None] = "0015_marketplace_moderation"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("business_hidden", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("posts", sa.Column("hidden_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("products", sa.Column("pending_image_urls", postgresql.ARRAY(sa.String()), nullable=True))


def downgrade() -> None:
    op.drop_column("products", "pending_image_urls")
    op.drop_column("posts", "hidden_at")
    op.drop_column("users", "business_hidden")
