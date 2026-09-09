"""Add event_end_date to events."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008_event_end_date"
down_revision: Union[str, None] = "0007_business_profile"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("events", sa.Column("event_end_date", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("events", "event_end_date")
