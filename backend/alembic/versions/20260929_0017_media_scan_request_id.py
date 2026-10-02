"""Store the Rekognition request id on each image scan.

Revision ID: 0017_media_scan_request_id
Revises: 0016_private_media_visibility
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0017_media_scan_request_id"
down_revision: Union[str, None] = "0016_private_media_visibility"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("media_scans", sa.Column("aws_request_id", sa.String(length=128), nullable=True))


def downgrade() -> None:
    op.drop_column("media_scans", "aws_request_id")
