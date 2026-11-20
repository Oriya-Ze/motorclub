"""A short bio on every member's profile, and photos for the content bots' posts and profile pictures.

Only adds nullable columns, so the code already running keeps working while this runs.

Revision ID: 0025_bio_and_bot_images
Revises: 0024_account_setup_pending
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0025_bio_and_bot_images"
down_revision: Union[str, None] = "0024_account_setup_pending"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("bio", sa.String(length=160), nullable=True))
    op.add_column("bot_items", sa.Column("image_files", postgresql.JSONB(), nullable=True))
    op.add_column("bot_items", sa.Column("image_keys", postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("bot_items", "image_keys")
    op.drop_column("bot_items", "image_files")
    op.drop_column("users", "bio")
