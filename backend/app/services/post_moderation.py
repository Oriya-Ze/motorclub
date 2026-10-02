"""Decide whether a whole post may be published.

An approved image is not an approved post. Every image attached to the current
version has to pass, and a result for a replaced image cannot affect the new one.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.media.keys import is_private_storage_key, parse_storage_key
from app.models import MediaScan, ModerationAppeal, Post
from app.services.image_moderation import PUBLIC_REASON_CODES, ScanDecision, content_hash, scan_bytes
from app.services.media_gate import promote_private_image, read_media_bytes

_IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp", ".gif")

REMOVED = "removed"


def publicly_visible(owner_id=None):
    """Posts anyone may see. With owner_id, that owner's unpublished posts are included too."""
    public = and_(Post.hidden_at.is_(None), Post.moderation_status == "published")
    if owner_id is None:
        return public
    return or_(public, Post.user_id == owner_id)


@dataclass(frozen=True)
class ImageVerdict:
    storage_key: str
    content_hash: str
    decision: str
    reason_code: str | None


@dataclass(frozen=True)
class PostModeration:
    status: str
    media_version: str
    image_urls: list[str]
    blocks: list[dict]


def _is_image_key(storage_key: str) -> bool:
    return storage_key.lower().endswith(_IMAGE_EXTENSIONS)


def _public_reason(decision: ScanDecision) -> str | None:
    if decision.decision != "rejected":
        return None
    if decision.reason_code in PUBLIC_REASON_CODES:
        return decision.reason_code
    return None


def _decision_from_token(token: str) -> ScanDecision:
    if token == "needs_review":
        return ScanDecision("needs_review", [], "mock")
    if token == "error":
        return ScanDecision("error", [], None, error_message="scan_failed")
    if token.startswith("rejected:"):
        code = token.split(":", 1)[1]
        if code not in PUBLIC_REASON_CODES:
            code = None
        return ScanDecision("rejected", [], "mock", reason_code=code)
    return ScanDecision("approved", [], "mock")


def _status_for(decisions: list[str]) -> str:
    if any(item == "rejected" for item in decisions):
        return "rejected"
    if any(item == "error" for item in decisions):
        return "error"
    if any(item == "needs_review" for item in decisions):
        return "needs_review"
    if decisions and all(item == "approved" for item in decisions):
        return "published"
    return "published"


async def _admin_override(db: AsyncSession, post_id, storage_key: str, digest: str) -> bool:
    appeals = (
        await db.execute(
            select(ModerationAppeal).where(
                ModerationAppeal.post_id == post_id,
                ModerationAppeal.status == "approved",
            )
        )
    ).scalars().all()
    for appeal in appeals:
        for item in appeal.snapshot or []:
            if item.get("storage_key") == storage_key and item.get("content_hash") == digest:
                return True
    return False


async def moderate_images(
    db: AsyncSession,
    image_urls: list[str] | None,
    *,
    post_id=None,
    mock_decisions: list[str] | None = None,
) -> PostModeration:
    keys = [key for key in (image_urls or []) if key and _is_image_key(key)]
    verdicts: list[ImageVerdict] = []
    for index, key in enumerate(keys):
        payload = read_media_bytes(key)
        digest = content_hash(payload)
        if mock_decisions is not None and index < len(mock_decisions):
            decision = _decision_from_token(mock_decisions[index])
        elif post_id is not None and await _admin_override(db, post_id, key, digest):
            decision = ScanDecision("approved", [], "admin")
        else:
            decision = scan_bytes(payload)
            db.add(
                MediaScan(
                    storage_key=key,
                    content_hash=digest,
                    decision=decision.decision,
                    labels=decision.labels,
                    model_version=decision.model_version,
                    aws_request_id=decision.aws_request_id,
                    policy_version=decision.policy_version,
                    error_message=decision.error_message,
                )
            )
        verdicts.append(
            ImageVerdict(
                storage_key=key,
                content_hash=digest,
                decision=decision.decision if decision.decision != "approved" else "approved",
                reason_code=_public_reason(decision),
            )
        )
    status = _status_for([item.decision for item in verdicts])
    version_source = "|".join(f"{item.storage_key}:{item.content_hash}" for item in verdicts)
    media_version = hashlib.sha256(version_source.encode()).hexdigest()
    published_urls = list(image_urls or [])
    if status == "published":
        published_urls = [
            promote_private_image(key) if _is_image_key(key) and is_private_storage_key(key) else key
            for key in published_urls
        ]
        blocks: list[dict] = []
    else:
        blocks = [
            {
                "storage_key": item.storage_key,
                "content_hash": item.content_hash,
                "decision": item.decision,
                "reason_code": item.reason_code,
            }
            for item in verdicts
            if item.decision != "approved"
        ]
    return PostModeration(status=status, media_version=media_version, image_urls=published_urls, blocks=blocks)


def mock_decisions_from_header(headers, *, is_local: bool, mode: str) -> list[str] | None:
    if not is_local or mode != "mock":
        return None
    raw = headers.get("x-motorclub-mock-decisions", "")
    parts = [part.strip() for part in raw.split(",") if part.strip()]
    return parts or None


def purpose_of(storage_key: str) -> str:
    try:
        return parse_storage_key(storage_key).purpose_segment
    except Exception:
        return ""
