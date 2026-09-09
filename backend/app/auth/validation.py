"""Shared auth field validation — runs before Cognito or DB writes."""

from __future__ import annotations

import re

from fastapi import HTTPException

PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 128
USERNAME_MIN_LENGTH = 3
USERNAME_MAX_LENGTH = 30
FULL_NAME_MIN_LENGTH = 2
FULL_NAME_MAX_LENGTH = 255

# Latin letters, digits, underscore, dot; must start with a letter; 3–30 chars
USERNAME_PATTERN = re.compile(r"^[a-zA-Z][a-zA-Z0-9_.]{2,29}$")
EMAIL_PATTERN = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")

RESERVED_USERNAMES = frozenset(
    {
        "admin",
        "administrator",
        "support",
        "help",
        "motorclub",
        "official",
        "system",
        "api",
        "www",
        "root",
        "null",
        "undefined",
        "moderator",
        "staff",
    }
)


def normalize_email(email: str) -> str:
    return email.strip().lower()


def normalize_username(username: str) -> str:
    return username.strip()


def validate_email_format(email: str) -> str:
    normalized = normalize_email(email)
    if not normalized or len(normalized) > 254:
        raise HTTPException(status_code=400, detail="Invalid email address")
    if not EMAIL_PATTERN.match(normalized):
        raise HTTPException(status_code=400, detail="Invalid email address")
    return normalized


def validate_username(username: str) -> str:
    cleaned = normalize_username(username)
    if len(cleaned) < USERNAME_MIN_LENGTH:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if len(cleaned) > USERNAME_MAX_LENGTH:
        raise HTTPException(status_code=400, detail="Username must be at most 30 characters")
    if not USERNAME_PATTERN.match(cleaned):
        raise HTTPException(
            status_code=400,
            detail="Username must start with a letter and contain only letters, numbers, dots, or underscores",
        )
    if cleaned.endswith(".") or cleaned.endswith("_"):
        raise HTTPException(status_code=400, detail="Username cannot end with a dot or underscore")
    if ".." in cleaned or "__" in cleaned or "._" in cleaned or "_." in cleaned:
        raise HTTPException(status_code=400, detail="Username cannot contain consecutive special characters")
    if cleaned.lower() in RESERVED_USERNAMES:
        raise HTTPException(status_code=400, detail="Username is reserved")
    return cleaned


def validate_full_name(full_name: str) -> str:
    cleaned = full_name.strip()
    if len(cleaned) < FULL_NAME_MIN_LENGTH:
        raise HTTPException(status_code=400, detail="Full name must be at least 2 characters")
    if len(cleaned) > FULL_NAME_MAX_LENGTH:
        raise HTTPException(status_code=400, detail="Full name is too long")
    return cleaned


def validate_password_for_registration(password: str, email: str, username: str) -> None:
    _validate_password_shape(password)
    if username.lower() in password.lower():
        raise HTTPException(status_code=400, detail="Password cannot contain username")
    email_local = email.split("@")[0].lower()
    if len(email_local) >= 3 and email_local in password.lower():
        raise HTTPException(status_code=400, detail="Password cannot contain email")


def validate_password_for_login(password: str) -> None:
    _validate_password_shape(password)


def _validate_password_shape(password: str) -> None:
    if not password or not password.strip():
        raise HTTPException(status_code=400, detail="Password is required")
    if len(password) < PASSWORD_MIN_LENGTH:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if len(password) > PASSWORD_MAX_LENGTH:
        raise HTTPException(status_code=400, detail="Password is too long")
    if not re.search(r"[A-Za-z]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one letter")
    if not re.search(r"\d", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one number")
