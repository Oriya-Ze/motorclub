from app.media.factory import get_media_storage


def resolve_media_url(storage_key_or_legacy_path: str) -> str:
    if not storage_key_or_legacy_path:
        return ""
    return get_media_storage().resolve_url(storage_key_or_legacy_path)
