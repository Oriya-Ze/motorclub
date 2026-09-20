from __future__ import annotations

import logging
import tempfile
import uuid
from pathlib import Path
from urllib.parse import unquote_plus

import boto3

from lambda_media.db import ensure_asset_exists, set_status
from lambda_media.images import ImageProcessError, process_image
from lambda_media.transcode import TranscodeError, transcode_video

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")

VIDEO_SUFFIXES = (".mp4", ".mov", ".webm")
IMAGE_SUFFIXES = (".jpg", ".jpeg", ".png", ".webp", ".gif")
VIDEO_SEGMENTS = {"posts", "stories"}
IMAGE_SEGMENTS = {"posts", "stories", "vehicles", "products"}
SKIP_SEGMENTS = {"videos", "images"}
CACHE_CONTROL = "public, max-age=31536000, immutable"


def _kind(key: str) -> str | None:
    lower = key.lower()
    if lower.endswith(VIDEO_SUFFIXES):
        return "video"
    if lower.endswith(IMAGE_SUFFIXES):
        return "image"
    return None


def _should_process(key: str) -> bool:
    if key.startswith("processed/") or not key.startswith("users/"):
        return False
    kind = _kind(key)
    if kind is None:
        return False
    parts = key.split("/")
    if len(parts) < 4:
        return False
    if parts[2] in SKIP_SEGMENTS:
        return False
    allowed = VIDEO_SEGMENTS if kind == "video" else IMAGE_SEGMENTS
    return parts[2] in allowed


def _parse_key(key: str) -> tuple[uuid.UUID, uuid.UUID, str]:
    parts = key.split("/")
    user_id = uuid.UUID(parts[1])
    purpose = parts[2]
    media_id = uuid.UUID(Path(parts[3]).stem)
    return user_id, media_id, purpose


def _upload_file(bucket: str, key: str, path: Path, content_type: str) -> None:
    s3.upload_file(
        str(path),
        bucket,
        key,
        ExtraArgs={"ContentType": content_type, "CacheControl": CACHE_CONTROL},
    )


def _process_video(bucket: str, key: str, user_id: uuid.UUID, media_id: uuid.UUID) -> None:
    prefix = f"users/{user_id}/videos/{media_id}"
    variant_keys = {
        "1080p": f"{prefix}/1080p.mp4",
        "720p": f"{prefix}/720p.mp4",
        "480p": f"{prefix}/480p.mp4",
        "poster": f"{prefix}/poster.webp",
        "thumb": f"{prefix}/thumb.webp",
    }

    with tempfile.TemporaryDirectory() as tmp:
        tmpdir = Path(tmp)
        source = tmpdir / "source"
        s3.download_file(bucket, key, str(source))
        try:
            outputs = transcode_video(source, tmpdir / "out")
        except TranscodeError as exc:
            logger.exception("Transcode failed for %s", key)
            set_status(media_id, "failed", error_message=str(exc))
            return

        _upload_file(bucket, variant_keys["1080p"], outputs["1080p"], "video/mp4")
        _upload_file(bucket, variant_keys["720p"], outputs["720p"], "video/mp4")
        _upload_file(bucket, variant_keys["480p"], outputs["480p"], "video/mp4")
        _upload_file(bucket, variant_keys["poster"], outputs["poster"], "image/webp")
        _upload_file(bucket, variant_keys["thumb"], outputs["thumb"], "image/webp")

    s3.delete_object(Bucket=bucket, Key=key)
    set_status(
        media_id,
        "ready",
        variants={
            "480p": variant_keys["480p"],
            "720p": variant_keys["720p"],
            "1080p": variant_keys["1080p"],
            "poster": variant_keys["poster"],
            "thumb": variant_keys["thumb"],
        },
        clear_original=True,
    )
    logger.info("Processed video %s", media_id)


def _process_image(bucket: str, key: str, user_id: uuid.UUID, media_id: uuid.UUID, purpose: str) -> None:
    prefix = f"users/{user_id}/images/{media_id}"
    is_gif = key.lower().endswith(".gif")
    variant_keys = {
        "thumb": f"{prefix}/thumb.webp",
        "display": key if is_gif else f"{prefix}/display.webp",
    }

    with tempfile.TemporaryDirectory() as tmp:
        tmpdir = Path(tmp)
        source = tmpdir / "source"
        s3.download_file(bucket, key, str(source))
        try:
            outputs = process_image(source, tmpdir / "out", make_display=not is_gif)
        except ImageProcessError as exc:
            logger.exception("Image process failed for %s", key)
            set_status(media_id, "failed", error_message=str(exc))
            return

        _upload_file(bucket, variant_keys["thumb"], outputs["thumb"], "image/webp")
        if not is_gif:
            _upload_file(bucket, variant_keys["display"], outputs["display"], "image/webp")

    drop_original = (not is_gif) and purpose in {"vehicles", "posts"}
    if drop_original:
        s3.delete_object(Bucket=bucket, Key=key)
    set_status(
        media_id,
        "ready",
        variants={
            "thumb": variant_keys["thumb"],
            "display": variant_keys["display"],
        },
        clear_original=drop_original,
    )
    logger.info("Processed image %s", media_id)


def process_object(bucket: str, key: str) -> None:
    if not _should_process(key):
        logger.info("Skipping key %s", key)
        return

    kind = _kind(key)
    logger.info("Processing %s %s", kind, key)
    user_id, media_id, purpose = _parse_key(key)
    ensure_asset_exists(media_id, user_id, purpose, key)
    set_status(media_id, "processing")
    if kind == "video":
        _process_video(bucket, key, user_id, media_id)
        return
    _process_image(bucket, key, user_id, media_id, purpose)


def handler(event, context):
    for record in event.get("Records", []):
        bucket = record["s3"]["bucket"]["name"]
        key = unquote_plus(record["s3"]["object"]["key"])
        process_object(bucket, key)
    return {"ok": True}
