"""follow request status and unique pair

Revision ID: 0011_follow_requests
Revises: 0010_group_privacy
Create Date: 2026-09-15
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0011_follow_requests"
down_revision: Union[str, None] = "0010_group_privacy"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "followers",
        sa.Column("status", sa.String(length=20), nullable=False, server_default="accepted"),
    )
    op.execute(
        """
        DELETE FROM followers a
        USING followers b
        WHERE a.id > b.id
          AND a.follower_id = b.follower_id
          AND a.following_id = b.following_id
        """
    )
    op.create_unique_constraint("uq_followers_pair", "followers", ["follower_id", "following_id"])
    op.alter_column("followers", "status", server_default="pending")


def downgrade() -> None:
    op.drop_constraint("uq_followers_pair", "followers", type_="unique")
    op.drop_column("followers", "status")
