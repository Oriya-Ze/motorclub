"""group privacy and unique membership

Revision ID: 0010_group_privacy
Revises: 0009_media_assets
Create Date: 2026-09-14
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010_group_privacy"
down_revision: Union[str, None] = "0009_media_assets"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "groups",
        sa.Column("privacy", sa.String(length=20), nullable=False, server_default="public"),
    )
    op.execute(
        """
        DELETE FROM group_members a
        USING group_members b
        WHERE a.id > b.id
          AND a.group_id = b.group_id
          AND a.user_id = b.user_id
        """
    )
    op.create_unique_constraint("uq_group_members_group_user", "group_members", ["group_id", "user_id"])


def downgrade() -> None:
    op.drop_constraint("uq_group_members_group_user", "group_members", type_="unique")
    op.drop_column("groups", "privacy")
