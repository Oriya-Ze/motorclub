"""Members who join with Google choose their username and accept the terms before using the app.

Only adds a column with a default, so the code already running keeps working while this runs.

Revision ID: 0024_account_setup_pending
Revises: 0023_vehicle_registry_verified
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0024_account_setup_pending"
down_revision: Union[str, None] = "0023_vehicle_registry_verified"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("account_setup_pending", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    op.drop_column("users", "account_setup_pending")
