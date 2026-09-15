"""accept pending follows for public profiles

Revision ID: 0012_public_follow_accept
Revises: 0011_follow_requests
Create Date: 2026-09-15
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0012_public_follow_accept"
down_revision: Union[str, None] = "0011_follow_requests"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE followers
        SET status = 'accepted'
        WHERE status = 'pending'
          AND (
            following_id NOT IN (SELECT user_id FROM profile_settings)
            OR following_id IN (
              SELECT user_id FROM profile_settings WHERE profile_public = true
            )
          )
        """
    )


def downgrade() -> None:
    pass
