"""Image moderation policy for Amazon Rekognition DetectModerationLabels.

Thresholds below are MotorClub product policy, not an AWS recommendation.
MinConfidence sent to Rekognition only controls which labels are returned.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass

POLICY_VERSION = "2026-09-27"
# Labels at or above these confidences are rejected.
REJECT_AT = {
    "explicit nudity": 90,
    "violence": 90,
    "visually disturbing": 90,
    "hate symbols": 85,
}
# Labels at or above these confidences, but below reject, wait for a person.
REVIEW_AT = {
    "explicit nudity": 60,
    "non-explicit nudity": 70,
    "suggestive": 80,
    "violence": 70,
    "visually disturbing": 70,
    "hate symbols": 60,
    "drugs": 80,
}


@dataclass(frozen=True)
class ScanLabel:
    name: str
    parent: str
    confidence: float


@dataclass(frozen=True)
class ScanDecision:
    decision: str
    labels: list[dict]
    model_version: str | None
    policy_version: str = POLICY_VERSION
    error_message: str | None = None


def content_hash(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _matches(label: ScanLabel, needle: str) -> bool:
    haystack = f"{label.parent} {label.name}".lower()
    return needle in haystack


def decide(labels: list[ScanLabel], *, model_version: str | None = None) -> ScanDecision:
    stored = [
        {"name": label.name, "parent": label.parent, "confidence": label.confidence}
        for label in labels
    ]
    for label in labels:
        for name, threshold in REJECT_AT.items():
            if _matches(label, name) and label.confidence >= threshold:
                return ScanDecision("rejected", stored, model_version)
    for label in labels:
        for name, threshold in REVIEW_AT.items():
            if _matches(label, name) and label.confidence >= threshold:
                return ScanDecision("needs_review", stored, model_version)
    return ScanDecision("approved", stored, model_version)


def scan_bytes(data: bytes, *, content_type: str = "") -> ScanDecision:
    from app.config import settings

    if content_type == "image/gif" or data[:6] in {b"GIF87a", b"GIF89a"}:
        return ScanDecision("rejected", [], None, error_message="animation_not_supported")
    mode = settings.rekognition_mode.strip().lower()
    if mode not in {"aws", "mock", "off"}:
        mode = "mock" if settings.is_local else "off"
    if mode == "off":
        return ScanDecision("error", [], None, error_message="rekognition_not_configured")
    if mode == "mock":
        if not settings.is_local:
            return ScanDecision("error", [], None, error_message="mock_forbidden_outside_local")
        decision = settings.rekognition_mock_decision.strip().lower()
        if decision not in {"approved", "needs_review", "rejected", "error"}:
            decision = "approved"
        return ScanDecision(decision, [], "mock")
    return _scan_aws(data)


def _scan_aws(data: bytes) -> ScanDecision:
    import time

    from app.config import settings

    last_error = "rekognition_failed"
    for attempt in range(3):
        try:
            import boto3

            client = boto3.client("rekognition", region_name=settings.aws_region)
            response = client.detect_moderation_labels(
                Image={"Bytes": data[:5_000_000]},
                MinConfidence=50,
            )
            break
        except Exception as exc:
            last_error = str(exc)[:300]
            if attempt == 2:
                return ScanDecision("error", [], None, error_message=last_error)
            time.sleep(0.25 * (2**attempt))
    else:
        return ScanDecision("error", [], None, error_message=last_error)
    labels = [
        ScanLabel(
            name=item.get("Name") or "",
            parent=item.get("ParentName") or "",
            confidence=float(item.get("Confidence") or 0),
        )
        for item in response.get("ModerationLabels") or []
    ]
    model = response.get("ModerationModelVersion")
    return decide(labels, model_version=str(model) if model else None)


def combine(decisions: list[ScanDecision]) -> str:
    if any(item.decision == "error" for item in decisions):
        return "error"
    if any(item.decision == "rejected" for item in decisions):
        return "rejected"
    if any(item.decision == "needs_review" for item in decisions):
        return "needs_review"
    if decisions and all(item.decision == "approved" for item in decisions):
        return "approved"
    return "pending"
