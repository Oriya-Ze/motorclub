from __future__ import annotations

import json
import os
import uuid
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

_engine: Engine | None = None


def _sync_database_url(url: str) -> str:
    if url.startswith("postgresql+asyncpg://"):
        url = "postgresql+psycopg2://" + url[len("postgresql+asyncpg://") :]
    elif url.startswith("postgresql://"):
        url = "postgresql+psycopg2://" + url[len("postgresql://") :]

    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    if "ssl" in query and "sslmode" not in query:
        ssl_val = query.pop("ssl").lower()
        query["sslmode"] = "require" if ssl_val in {"require", "true", "1"} else ssl_val
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        database_url = os.environ.get("DATABASE_URL")
        if not database_url:
            raise RuntimeError("DATABASE_URL is required")
        _engine = create_engine(_sync_database_url(database_url), pool_pre_ping=True)
    return _engine


def set_status(
    media_id: uuid.UUID,
    status: str,
    *,
    variants: dict[str, Any] | None = None,
    error_message: str | None = None,
    clear_original: bool = False,
) -> None:
    engine = get_engine()
    with engine.begin() as conn:
        if variants is not None:
            conn.execute(
                text(
                    """
                    UPDATE media_assets
                    SET status = :status,
                        variants = CAST(:variants AS jsonb),
                        error_message = :error_message,
                        original_key = CASE WHEN :clear_original THEN NULL ELSE original_key END,
                        updated_at = NOW()
                    WHERE id = :media_id
                    """
                ),
                {
                    "media_id": str(media_id),
                    "status": status,
                    "variants": json.dumps(variants),
                    "error_message": error_message,
                    "clear_original": clear_original,
                },
            )
        else:
            conn.execute(
                text(
                    """
                    UPDATE media_assets
                    SET status = :status,
                        error_message = :error_message,
                        original_key = CASE WHEN :clear_original THEN NULL ELSE original_key END,
                        updated_at = NOW()
                    WHERE id = :media_id
                    """
                ),
                {
                    "media_id": str(media_id),
                    "status": status,
                    "error_message": error_message,
                    "clear_original": clear_original,
                },
            )


def ensure_asset_exists(media_id: uuid.UUID, user_id: uuid.UUID, purpose: str, original_key: str) -> None:
    engine = get_engine()
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO media_assets (id, user_id, purpose, original_key, status, created_at, updated_at)
                VALUES (:id, :user_id, :purpose, :original_key, 'uploaded', NOW(), NOW())
                ON CONFLICT (id) DO NOTHING
                """
            ),
            {
                "id": str(media_id),
                "user_id": str(user_id),
                "purpose": purpose,
                "original_key": original_key,
            },
        )
