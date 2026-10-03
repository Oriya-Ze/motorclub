"""Keep unapproved images off the public CDN.

New images are stored under ``users/{id}/private/...``. CloudFront is denied
that prefix. A public copy is created only after an approved scan.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException

import app.config as app_config
from app.media.keys import is_private_storage_key, public_storage_key


def _private_path(storage_key: str) -> Path:
    return Path(app_config.settings.private_upload_dir) / storage_key


def _public_path(storage_key: str) -> Path:
    return Path(app_config.settings.upload_dir) / storage_key


def write_local_bytes(storage_key: str, data: bytes) -> None:
    path = _private_path(storage_key) if is_private_storage_key(storage_key) else _public_path(storage_key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def read_media_bytes(storage_key: str) -> bytes:
    if app_config.settings.media_storage_provider == "s3" and app_config.settings.s3_media_bucket:
        import boto3

        obj = boto3.client("s3", region_name=app_config.settings.aws_region).get_object(
            Bucket=app_config.settings.s3_media_bucket,
            Key=storage_key,
        )
        return obj["Body"].read(app_config.settings.max_image_upload_bytes)
    path = _private_path(storage_key) if is_private_storage_key(storage_key) else _public_path(storage_key)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Media object not found")
    return path.read_bytes()


def promote_private_image(storage_key: str) -> str:
    if not is_private_storage_key(storage_key):
        return storage_key
    public_key = public_storage_key(storage_key)
    if app_config.settings.media_storage_provider == "s3" and app_config.settings.s3_media_bucket:
        import boto3

        client = boto3.client("s3", region_name=app_config.settings.aws_region)
        client.copy_object(
            Bucket=app_config.settings.s3_media_bucket,
            Key=public_key,
            CopySource={"Bucket": app_config.settings.s3_media_bucket, "Key": storage_key},
        )
        client.delete_object(Bucket=app_config.settings.s3_media_bucket, Key=storage_key)
        return public_key
    data = read_media_bytes(storage_key)
    dest = _public_path(public_key)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    _private_path(storage_key).unlink(missing_ok=True)
    return public_key


_VIDEO_VARIANT_NAMES = ("1080p.mp4", "720p.mp4", "480p.mp4", "poster.webp", "thumb.webp")


def public_image_objects(storage_key: str) -> list[str]:
    """Public original plus its processed copies: display and thumb for images, renditions and posters for video."""
    public = public_storage_key(storage_key)
    parts = public.split("/")
    if len(parts) < 4 or parts[0] != "users":
        return [public]
    user_id, media_file = parts[1], parts[-1]
    media_id = media_file.rsplit(".", 1)[0]
    if public.lower().endswith((".mp4", ".mov", ".webm")):
        return [public, *[f"users/{user_id}/videos/{media_id}/{name}" for name in _VIDEO_VARIANT_NAMES]]
    return [
        public,
        f"users/{user_id}/images/{media_id}/display.webp",
        f"users/{user_id}/images/{media_id}/thumb.webp",
    ]


def _quarantine_key(public_key: str) -> str:
    if public_key.startswith("users/") and "/private/" not in public_key:
        user_id, tail = public_key.split("/", 2)[1], public_key.split("/", 2)[2]
        return f"users/{user_id}/private/removed/{tail}"
    return f"private/removed/{public_key}"


def _object_exists(storage_key: str) -> bool:
    if app_config.settings.media_storage_provider == "s3" and app_config.settings.s3_media_bucket:
        import boto3
        from botocore.exceptions import ClientError

        try:
            boto3.client("s3", region_name=app_config.settings.aws_region).head_object(
                Bucket=app_config.settings.s3_media_bucket,
                Key=storage_key,
            )
            return True
        except ClientError:
            return False
    path = _private_path(storage_key) if is_private_storage_key(storage_key) else _public_path(storage_key)
    return path.is_file()


def _move_object(source_key: str, dest_key: str) -> None:
    data = read_media_bytes(source_key)
    if app_config.settings.media_storage_provider == "s3" and app_config.settings.s3_media_bucket:
        import boto3

        client = boto3.client("s3", region_name=app_config.settings.aws_region)
        client.put_object(Bucket=app_config.settings.s3_media_bucket, Key=dest_key, Body=data)
        client.delete_object(Bucket=app_config.settings.s3_media_bucket, Key=source_key)
        return
    dest = _private_path(dest_key) if is_private_storage_key(dest_key) else _public_path(dest_key)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    delete_media_object(source_key)


def invalidate_public_paths(paths: list[str]) -> list[str]:
    """Ask CloudFront to drop cached copies. No-op until a distribution id is configured."""
    distribution_id = app_config.settings.media_distribution_id.strip()
    if not paths or not distribution_id or app_config.settings.media_storage_provider != "s3":
        return paths
    import boto3

    boto3.client("cloudfront").create_invalidation(
        DistributionId=distribution_id,
        InvalidationBatch={
            "Paths": {"Quantity": len(paths), "Items": paths},
            "CallerReference": f"motorclub-{paths[0]}-{len(paths)}",
        },
    )
    return paths


def takedown_public_image(storage_key: str) -> list[str]:
    """Remove the public original and thumbnails so a new request cannot read them."""
    removed: list[str] = []
    for key in public_image_objects(storage_key):
        if not _object_exists(key):
            continue
        _move_object(key, _quarantine_key(key))
        removed.append(f"/{key}")
    if is_private_storage_key(storage_key) and _object_exists(storage_key):
        delete_media_object(storage_key)
    invalidate_public_paths(removed)
    return removed


def restore_public_image(storage_key: str) -> list[str]:
    restored: list[str] = []
    for key in public_image_objects(storage_key):
        quarantine = _quarantine_key(key)
        if not _object_exists(quarantine):
            continue
        _move_object(quarantine, key)
        restored.append(f"/{key}")
    invalidate_public_paths(restored)
    return restored


def delete_media_object(storage_key: str) -> None:
    if app_config.settings.media_storage_provider == "s3" and app_config.settings.s3_media_bucket:
        import boto3

        boto3.client("s3", region_name=app_config.settings.aws_region).delete_object(
            Bucket=app_config.settings.s3_media_bucket,
            Key=storage_key,
        )
        return
    path = _private_path(storage_key) if is_private_storage_key(storage_key) else _public_path(storage_key)
    path.unlink(missing_ok=True)


def presigned_get_url(storage_key: str) -> str:
    if not is_private_storage_key(storage_key):
        raise HTTPException(status_code=400, detail="Only private media uses a protected URL")
    if app_config.settings.media_storage_provider == "s3" and app_config.settings.s3_media_bucket:
        import boto3

        return boto3.client("s3", region_name=app_config.settings.aws_region).generate_presigned_url(
            ClientMethod="get_object",
            Params={"Bucket": app_config.settings.s3_media_bucket, "Key": storage_key},
            ExpiresIn=120,
        )
    if not _private_path(storage_key).is_file():
        raise HTTPException(status_code=404, detail="Media object not found")
    return f"/api/v1/media/private-file?key={storage_key}"
