"""vehicle nickname, mods list, follow, and spots

Revision ID: 0013_vehicle_passport
Revises: 0012_public_follow_accept
Create Date: 2026-09-15
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0013_vehicle_passport"
down_revision: Union[str, None] = "0012_public_follow_accept"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("vehicles", sa.Column("nickname", sa.String(length=40), nullable=True))
    op.add_column("vehicles", sa.Column("walkaround_url", sa.String(length=500), nullable=True))
    op.add_column("vehicles", sa.Column("sound_url", sa.String(length=500), nullable=True))
    op.add_column("vehicles", sa.Column("mod_items", postgresql.JSONB(astext_type=sa.Text()), nullable=True))

    op.create_table(
        "vehicle_followers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("vehicle_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("vehicle_id", "user_id", name="uq_vehicle_followers_pair"),
    )
    op.create_index("ix_vehicle_followers_vehicle_id", "vehicle_followers", ["vehicle_id"])
    op.create_index("ix_vehicle_followers_user_id", "vehicle_followers", ["user_id"])

    op.create_table(
        "vehicle_spots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("vehicle_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("vehicle_id", "user_id", name="uq_vehicle_spots_pair"),
    )
    op.create_index("ix_vehicle_spots_vehicle_id", "vehicle_spots", ["vehicle_id"])
    op.create_index("ix_vehicle_spots_user_id", "vehicle_spots", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_vehicle_spots_user_id", table_name="vehicle_spots")
    op.drop_index("ix_vehicle_spots_vehicle_id", table_name="vehicle_spots")
    op.drop_table("vehicle_spots")
    op.drop_index("ix_vehicle_followers_user_id", table_name="vehicle_followers")
    op.drop_index("ix_vehicle_followers_vehicle_id", table_name="vehicle_followers")
    op.drop_table("vehicle_followers")
    op.drop_column("vehicles", "mod_items")
    op.drop_column("vehicles", "sound_url")
    op.drop_column("vehicles", "walkaround_url")
    op.drop_column("vehicles", "nickname")
