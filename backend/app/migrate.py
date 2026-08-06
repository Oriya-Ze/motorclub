"""Deprecated ad-hoc migrations superseded by Alembic.

Use Alembic instead:

    cd backend
    alembic upgrade head

This module is retained temporarily until the Alembic baseline has been fully
validated. It is no longer invoked during application startup.
"""

import warnings

from sqlalchemy import text

from app.database import get_engine


async def run_migrations() -> None:
    """Apply legacy ad-hoc SQL migrations.

    Deprecated: use ``alembic upgrade head``. Retained for manual reference only.
    """
    warnings.warn(
        "app.migrate.run_migrations() is deprecated; use 'alembic upgrade head' instead",
        DeprecationWarning,
        stacklevel=2,
    )
    statements = [
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL",
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS hashtags TEXT[]",
    ]
    async with get_engine().begin() as conn:
        for stmt in statements:
            try:
                await conn.execute(text(stmt))
            except Exception:
                pass
