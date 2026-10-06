"""Let a business pick several categories and say whether it is self-employed or a company.

business_type stays as the primary (first) category, so code that reads one category keeps working.
Only adds nullable columns, so the code already running keeps working while this runs.

Revision ID: 0019_business_categories
Revises: 0018_post_publication_moderation
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0019_business_categories"
down_revision: Union[str, None] = "0018_post_publication_moderation"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = ("users", "business_upgrade_requests")


def upgrade() -> None:
    for table in TABLES:
        op.add_column(table, sa.Column("business_types", postgresql.ARRAY(sa.String(length=50)), nullable=True))
        op.add_column(table, sa.Column("business_entity", sa.String(length=20), nullable=True))
        op.execute(f"UPDATE {table} SET business_types = ARRAY[business_type] WHERE business_type IS NOT NULL")


def downgrade() -> None:
    for table in TABLES:
        op.drop_column(table, "business_entity")
        op.drop_column(table, "business_types")
