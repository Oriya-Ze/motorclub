"""Cloudflare Turnstile CAPTCHA verification (free tier)."""

from __future__ import annotations

import httpx
from fastapi import HTTPException

from app.config import settings
from app.logging_config import get_logger

logger = get_logger(__name__)

VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


async def verify_turnstile_token(token: str, remote_ip: str | None = None) -> None:
    if not settings.turnstile_enabled:
        return

    if not token or not token.strip():
        raise HTTPException(status_code=400, detail="Captcha verification required")

    payload: dict[str, str] = {
        "secret": settings.turnstile_secret_key,
        "response": token.strip(),
    }
    if remote_ip:
        payload["remoteip"] = remote_ip

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(VERIFY_URL, data=payload)
            response.raise_for_status()
            result = response.json()
    except httpx.HTTPError as exc:
        logger.warning("Turnstile verification request failed: %s", exc)
        raise HTTPException(status_code=503, detail="Captcha verification unavailable") from exc

    if not result.get("success"):
        logger.info("Turnstile rejected token: %s", result.get("error-codes"))
        raise HTTPException(status_code=400, detail="Captcha verification failed")
