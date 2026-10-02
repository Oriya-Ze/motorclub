"""Image moderation policy for Amazon Rekognition DetectModerationLabels.

Thresholds below are MotorClub product policy, not an AWS recommendation.
MinConfidence sent to Rekognition only controls which labels are returned.
Stored files stay in their uploaded format. Rekognition receives a temporary
JPEG copy decoded from the file contents.
"""

from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass
from io import BytesIO

logger = logging.getLogger(__name__)

POLICY_VERSION = "2026-09-27"
REKOGNITION_MAX_BYTES = 5_000_000
REKOGNITION_MAX_EDGE = 10_000
REKOGNITION_MIN_EDGE = 80
MAX_INPUT_BYTES = 10 * 1024 * 1024
MAX_PIXELS = 40_000_000
_TRANSIENT_CODES = frozenset(
    {
        "ThrottlingException",
        "ProvisionedThroughputExceededException",
        "TooManyRequestsException",
        "RequestTimeout",
        "RequestTimeoutException",
        "InternalServerError",
        "ServiceUnavailable",
        "ServiceUnavailableException",
    }
)
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
_REASON_CODE = {
    "explicit nudity": "explicit_nudity",
    "violence": "violence",
    "visually disturbing": "graphic_violence",
    "hate symbols": "hate_symbols",
}
PUBLIC_REASON_CODES = frozenset({*_REASON_CODE.values(), "animation"})


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
    aws_request_id: str | None = None
    reason_code: str | None = None


class ImagePrepError(Exception):
    def __init__(self, reason: str):
        self.reason = reason
        super().__init__(reason)


def content_hash(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _matches(label: ScanLabel, needle: str) -> bool:
    haystack = f"{label.parent} {label.name}".lower()
    return needle in haystack


def decide(
    labels: list[ScanLabel],
    *,
    model_version: str | None = None,
    aws_request_id: str | None = None,
) -> ScanDecision:
    stored = [
        {"name": label.name, "parent": label.parent, "confidence": label.confidence}
        for label in labels
    ]
    for label in labels:
        for name, threshold in REJECT_AT.items():
            if _matches(label, name) and label.confidence >= threshold:
                return ScanDecision(
                    "rejected",
                    stored,
                    model_version,
                    aws_request_id=aws_request_id,
                    reason_code=_REASON_CODE[name],
                )
    for label in labels:
        for name, threshold in REVIEW_AT.items():
            if _matches(label, name) and label.confidence >= threshold:
                return ScanDecision("needs_review", stored, model_version, aws_request_id=aws_request_id)
    return ScanDecision("approved", stored, model_version, aws_request_id=aws_request_id)


def _target_size(width: int, height: int) -> tuple[int, int]:
    if width < 1 or height < 1:
        raise ImagePrepError("image_unreadable")
    if width * height > MAX_PIXELS:
        scale = (MAX_PIXELS / (width * height)) ** 0.5
        width = max(1, int(width * scale))
        height = max(1, int(height * scale))
    fit = min(1.0, REKOGNITION_MAX_EDGE / width, REKOGNITION_MAX_EDGE / height)
    width = max(1, int(width * fit))
    height = max(1, int(height * fit))
    if min(width, height) < REKOGNITION_MIN_EDGE:
        grow = REKOGNITION_MIN_EDGE / min(width, height)
        grown_w = max(1, int(round(width * grow)))
        grown_h = max(1, int(round(height * grow)))
        if max(grown_w, grown_h) > REKOGNITION_MAX_EDGE:
            raise ImagePrepError("image_dimensions_unsupported")
        width, height = grown_w, grown_h
    return width, height


def _flatten_for_jpeg(image):
    from PIL import Image

    if image.mode == "P" and "transparency" in image.info:
        image = image.convert("RGBA")
    if image.mode in {"RGBA", "LA"} or (image.mode == "P" and "transparency" in image.info):
        rgba = image.convert("RGBA")
        background = Image.new("RGB", rgba.size, (255, 255, 255))
        background.paste(rgba, mask=rgba.getchannel("A"))
        return background
    if image.mode != "RGB":
        return image.convert("RGB")
    return image


def _encode_jpeg(image) -> bytes:
    from PIL import Image

    current = image
    for _ in range(6):
        for quality in (90, 75, 60, 45):
            buffer = BytesIO()
            current.save(buffer, format="JPEG", quality=quality, optimize=True)
            encoded = buffer.getvalue()
            if len(encoded) <= REKOGNITION_MAX_BYTES:
                return encoded
        width, height = current.size
        next_size = _target_size(max(1, int(width * 0.75)), max(1, int(height * 0.75)))
        if next_size == current.size:
            break
        current = current.resize(next_size, Image.Resampling.LANCZOS)
    raise ImagePrepError("image_too_large")


def prepare_image_for_scan(data: bytes) -> bytes:
    """Decode the stored file by its contents and return a temporary JPEG.

    The returned bytes are for Rekognition only. Callers keep the original
    object, including WebP uploads, unchanged in storage.
    """
    if not data:
        raise ImagePrepError("image_unreadable")
    if len(data) > MAX_INPUT_BYTES:
        raise ImagePrepError("image_too_large")

    from PIL import Image, ImageOps, UnidentifiedImageError

    previous_limit = Image.MAX_IMAGE_PIXELS
    Image.MAX_IMAGE_PIXELS = MAX_PIXELS
    try:
        try:
            with Image.open(BytesIO(data)) as image:
                if getattr(image, "n_frames", 1) > 1 or getattr(image, "is_animated", False):
                    raise ImagePrepError("animation_not_supported")
                if (image.format or "").upper() == "GIF":
                    raise ImagePrepError("animation_not_supported")
                image.load()
                oriented = ImageOps.exif_transpose(image)
                flattened = _flatten_for_jpeg(oriented)
                width, height = _target_size(*flattened.size)
                if (width, height) != flattened.size:
                    flattened = flattened.resize((width, height), Image.Resampling.LANCZOS)
                return _encode_jpeg(flattened)
        except ImagePrepError:
            raise
        except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
            logger.warning("image scan could not decode stored bytes: %s", exc)
            raise ImagePrepError("image_unreadable") from exc
    finally:
        Image.MAX_IMAGE_PIXELS = previous_limit


def _is_transient(exc: Exception) -> bool:
    from botocore.exceptions import ClientError, ConnectTimeoutError, EndpointConnectionError, ReadTimeoutError

    if isinstance(exc, (ConnectTimeoutError, ReadTimeoutError, EndpointConnectionError, TimeoutError)):
        return True
    if isinstance(exc, ClientError):
        code = (exc.response.get("Error") or {}).get("Code") or ""
        return code in _TRANSIENT_CODES
    text = str(exc).lower()
    return "throttl" in text or "timeout" in text or "timed out" in text


def _request_id_from(response: dict | None) -> str | None:
    if not response:
        return None
    metadata = response.get("ResponseMetadata") or {}
    request_id = metadata.get("RequestId")
    return str(request_id) if request_id else None


def scan_bytes(data: bytes, *, content_type: str = "") -> ScanDecision:
    from app.config import settings

    del content_type  # Format comes from the file contents, not the filename or declared type.
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
    try:
        prepared = prepare_image_for_scan(data)
    except ImagePrepError as exc:
        logger.warning("image scan preparation failed: %s", exc.reason)
        if exc.reason == "animation_not_supported":
            return ScanDecision("rejected", [], None, error_message=exc.reason, reason_code="animation")
        return ScanDecision("error", [], None, error_message=exc.reason)
    return _scan_aws(prepared)


def _scan_aws(data: bytes) -> ScanDecision:
    import time

    from app.config import settings
    from botocore.exceptions import ClientError

    last_error = "rekognition_failed"
    for attempt in range(3):
        try:
            import boto3

            client = boto3.client("rekognition", region_name=settings.aws_region)
            response = client.detect_moderation_labels(
                Image={"Bytes": data},
                MinConfidence=50,
            )
            break
        except Exception as exc:
            last_error = str(exc)[:300]
            request_id = _request_id_from(getattr(exc, "response", None)) if isinstance(exc, ClientError) else None
            if not _is_transient(exc) or attempt == 2:
                logger.warning("rekognition scan failed: %s", last_error)
                return ScanDecision("error", [], None, error_message=last_error, aws_request_id=request_id)
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
    return decide(
        labels,
        model_version=str(model) if model else None,
        aws_request_id=_request_id_from(response),
    )


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
