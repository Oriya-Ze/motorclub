"""Vehicles added by licence plate: their details come from the Ministry of Transport and cannot be edited.

Only adds a column with a default, so the code already running keeps working while this runs.

Revision ID: 0023_vehicle_registry_verified
Revises: 0022_content_bots
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0023_vehicle_registry_verified"
down_revision: Union[str, None] = "0022_content_bots"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("vehicles", sa.Column("registry_verified", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    op.drop_column("vehicles", "registry_verified")
