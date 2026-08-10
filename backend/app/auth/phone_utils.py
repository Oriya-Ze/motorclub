import re
import secrets
import uuid

from fastapi import HTTPException

from app.config import settings


_PHONE_RE = re.compile(r"^\+[1-9]\d{7,14}$")


def normalize_phone(phone: str) -> str:
    raw = phone.strip().replace(" ", "").replace("-", "")
    digits = re.sub(r"\D", "", raw)

    if raw.startswith("+"):
        candidate = f"+{digits}"
    elif digits.startswith("972"):
        candidate = f"+{digits}"
    elif digits.startswith("0") and len(digits) >= 9:
        candidate = f"+972{digits[1:]}"
    elif len(digits) == 9:
        candidate = f"+972{digits}"
    else:
        candidate = f"+{digits}"

    if not _PHONE_RE.match(candidate):
        raise HTTPException(status_code=400, detail="Invalid phone number. Use Israeli format, e.g. 0501234567")
    return candidate


def phone_placeholder_email(phone: str) -> str:
    digits = re.sub(r"\D", "", phone)
    return f"{digits}@phone.motorclub.co.il"


def random_password() -> str:
    return secrets.token_urlsafe(24) + "Aa1!"
