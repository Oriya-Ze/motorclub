"""DynamoDB-backed rate limiting for auth endpoints (minimal cost, PAY_PER_REQUEST)."""

import asyncio
import time
from functools import lru_cache

import boto3
from botocore.exceptions import ClientError
from fastapi import HTTPException, Request

from app.config import get_settings
from app.logging_config import get_logger

logger = get_logger(__name__)


@lru_cache
def _table():
    settings = get_settings()
    if not settings.rate_limit_table:
        return None
    dynamodb = boto3.resource("dynamodb", region_name=settings.aws_region)
    return dynamodb.Table(settings.rate_limit_table)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def _check_sync(key: str, limit: int, window_seconds: int) -> None:
    table = _table()
    if table is None:
        return

    now = int(time.time())
    try:
        resp = table.get_item(Key={"pk": key})
        item = resp.get("Item")
        if item and int(item.get("expires_at", 0)) > now:
            count = int(item.get("count", 0))
            if count >= limit:
                raise HTTPException(status_code=429, detail="Too many requests. Please try again later.")
            table.update_item(
                Key={"pk": key},
                UpdateExpression="SET #c = #c + :one",
                ExpressionAttributeNames={"#c": "count"},
                ExpressionAttributeValues={":one": 1},
            )
        else:
            table.put_item(Item={"pk": key, "count": 1, "expires_at": now + window_seconds})
    except HTTPException:
        raise
    except ClientError as exc:
        logger.warning("Rate limit check failed: %s", exc)


async def enforce_rate_limit(
    request: Request,
    scope: str,
    *,
    identifier: str | None = None,
    limit: int = 5,
    window_seconds: int = 3600,
) -> None:
    ip = _client_ip(request)
    parts = [scope, ip]
    if identifier:
        parts.append(identifier.strip().lower())
    key = ":".join(parts)
    await asyncio.to_thread(_check_sync, key, limit, window_seconds)
