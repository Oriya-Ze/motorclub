"""Transactional email via Resend."""

from __future__ import annotations

import json

import httpx

from app.config import settings
from app.logging_config import get_logger

logger = get_logger(__name__)

_resend_api_key_cache: str | None = None


def _load_resend_api_key() -> str:
    global _resend_api_key_cache
    if _resend_api_key_cache:
        return _resend_api_key_cache

    if settings.resend_api_key:
        _resend_api_key_cache = settings.resend_api_key
        return _resend_api_key_cache

    if not settings.resend_secret_arn:
        raise RuntimeError("Resend is not configured (RESEND_API_KEY or RESEND_SECRET_ARN required)")

    try:
        import boto3
    except ImportError as exc:
        raise RuntimeError("boto3 not installed") from exc

    sm = boto3.client("secretsmanager", region_name=settings.aws_region)
    raw = sm.get_secret_value(SecretId=settings.resend_secret_arn)["SecretString"]
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            key = (
                parsed.get("RESEND_API_KEY")
                or parsed.get("api_key")
                or parsed.get("value")
                or raw
            )
        else:
            key = str(parsed)
    except json.JSONDecodeError:
        key = raw.strip()

    if not key:
        raise RuntimeError("Resend API key missing in secret")
    _resend_api_key_cache = key
    return key


def _signup_email_html(code: str) -> str:
    app = settings.app_name
    site = settings.app_url or "https://motorclub.co.il"
    return f"""
    <div dir="rtl" style="font-family:Heebo,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#111;margin:0 0 12px">ברוכים הבאים ל-{app}</h2>
      <p style="color:#444;line-height:1.6">להשלמת ההרשמה, הזן את הקוד הבא באפליקציה:</p>
      <p style="font-size:28px;font-weight:bold;letter-spacing:6px;color:#e11d24">{code}</p>
      <p style="color:#666;font-size:14px">הקוד תקף ל-{settings.signup_code_expire_minutes} דקות. אם לא נרשמת — התעלם מהודעה זו.</p>
      <p style="margin-top:24px"><a href="{site}" style="color:#e11d24">{site}</a></p>
    </div>
    """


async def send_signup_verification_email(to_email: str, code: str) -> None:
    if settings.is_local and not settings.resend_api_key and not settings.resend_secret_arn:
        logger.info("Local signup verification code for %s: %s", to_email, code)
        return

    api_key = _load_resend_api_key()
    from_name = settings.resend_from_name
    from_email = settings.resend_from_email
    if not from_email:
        raise RuntimeError("RESEND_FROM_EMAIL is required to send signup emails")

    payload = {
        "from": f"{from_name} <{from_email}>",
        "to": [to_email],
        "subject": f"{settings.app_name} — קוד אימות",
        "html": _signup_email_html(code),
    }

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            "https://api.resend.com/emails",
            json=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
        )

    if response.status_code >= 400:
        logger.error("Resend API error %s: %s", response.status_code, response.text[:500])
        raise RuntimeError(f"Failed to send verification email (status {response.status_code})")

    logger.info("Signup verification email sent to %s", to_email)


def _password_reset_email_html(code: str) -> str:
    app = settings.app_name
    site = settings.app_url or "https://motorclub.co.il"
    return f"""
    <div dir="rtl" style="font-family:Heebo,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#111;margin:0 0 12px">איפוס סיסמה</h2>
      <p style="color:#444;line-height:1.6">קיבלנו בקשה לאיפוס הסיסמה שלך ב-{app}.</p>
      <p style="font-size:28px;font-weight:bold;letter-spacing:6px;color:#e11d24">{code}</p>
      <p style="color:#666;font-size:14px">הקוד תקף ל-{settings.password_reset_code_expire_minutes} דקות. אם לא ביקשת איפוס — התעלם מהודעה זו.</p>
      <p style="margin-top:24px"><a href="{site}" style="color:#e11d24">{site}</a></p>
    </div>
    """


async def send_password_reset_email(to_email: str, code: str) -> None:
    if settings.is_local and not settings.resend_api_key and not settings.resend_secret_arn:
        logger.info("Local password reset code for %s: %s", to_email, code)
        return

    api_key = _load_resend_api_key()
    from_name = settings.resend_from_name
    from_email = settings.resend_from_email
    if not from_email:
        raise RuntimeError("RESEND_FROM_EMAIL is required to send password reset emails")

    payload = {
        "from": f"{from_name} <{from_email}>",
        "to": [to_email],
        "subject": f"{settings.app_name} — איפוס סיסמה",
        "html": _password_reset_email_html(code),
    }

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            "https://api.resend.com/emails",
            json=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
        )

    if response.status_code >= 400:
        logger.error("Resend API error %s: %s", response.status_code, response.text[:500])
        raise RuntimeError(f"Failed to send password reset email (status {response.status_code})")

    logger.info("Password reset email sent to %s", to_email)
