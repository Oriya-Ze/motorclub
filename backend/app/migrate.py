from sqlalchemy import text

from app.database import engine


async def run_migrations() -> None:
    """Add columns/tables that create_all won't alter on existing DB."""
    statements = [
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL",
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS hashtags TEXT[]",
    ]
    async with engine.begin() as conn:
        for stmt in statements:
            try:
                await conn.execute(text(stmt))
            except Exception:
                pass
