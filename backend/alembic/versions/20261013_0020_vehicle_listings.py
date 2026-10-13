"""Link a shop listing to the vehicle card it sells.

A vehicle for sale is listed from its card, and the listing shows the card's name and photos. Deleting the vehicle
deletes its listing. Only adds a nullable column, so the code already running keeps working while this runs.

Revision ID: 0020_vehicle_listings
Revises: 0019_business_categories
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0020_vehicle_listings"
down_revision: Union[str, None] = "0019_business_categories"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("products", sa.Column("vehicle_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_products_vehicle_id_vehicles", "products", "vehicles", ["vehicle_id"], ["id"], ondelete="CASCADE"
    )
    op.create_index("ix_products_vehicle_id", "products", ["vehicle_id"])


def downgrade() -> None:
    op.drop_index("ix_products_vehicle_id", table_name="products")
    op.drop_constraint("fk_products_vehicle_id_vehicles", "products", type_="foreignkey")
    op.drop_column("products", "vehicle_id")
