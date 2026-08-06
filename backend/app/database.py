import logging
import os
from collections.abc import AsyncGenerator
from functools import lru_cache

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import settings
from app.models import Base

logger = logging.getLogger(__name__)


def _is_lambda_runtime() -> bool:
    return bool(os.getenv("AWS_LAMBDA_FUNCTION_NAME"))


@lru_cache
def get_engine() -> AsyncEngine:
    engine_kwargs: dict = {"echo": False}
    if _is_lambda_runtime():
        engine_kwargs["poolclass"] = NullPool
    return create_async_engine(settings.database_url, **engine_kwargs)


@lru_cache
def get_session_factory() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(get_engine(), class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with get_session_factory()() as session:
        yield session


async def init_db() -> None:
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def check_db_connection() -> bool:
    try:
        engine = get_engine()
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception as exc:
        logger.warning("Database readiness check failed: %s", type(exc).__name__)
        return False


async def close_db() -> None:
    engine = get_engine()
    await engine.dispose()
    get_engine.cache_clear()
    get_session_factory.cache_clear()
