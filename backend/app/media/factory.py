from functools import lru_cache
from typing import Literal

import app.config as app_config
from app.media.base import MediaStorage
from app.media.local import LocalMediaStorage
from app.media.s3 import S3MediaStorage


@lru_cache
def get_media_storage() -> MediaStorage:
    provider: Literal["local", "s3"] = app_config.settings.media_storage_provider
    if provider == "s3":
        return S3MediaStorage()
    return LocalMediaStorage()


def reset_media_storage_cache() -> None:
    get_media_storage.cache_clear()
