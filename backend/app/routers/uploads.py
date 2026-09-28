from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile

from app.deps import get_user_model
from app.media.factory import get_media_storage
from app.media.keys import is_private_storage_key, parse_storage_key
from app.media.local import LocalMediaStorage
from app.media.validation import validate_actual_size, media_type_from_content_type
from app.models import User
from app.schemas_media import UploadFileResponse, UploadMultipleResponse
from app.services.media_gate import write_local_bytes

router = APIRouter(prefix="/uploads", tags=["uploads"])

MAX_MULTIPLE_FILES = 10


def _require_local_storage() -> LocalMediaStorage:
    storage = get_media_storage()
    if not isinstance(storage, LocalMediaStorage):
        raise HTTPException(
            status_code=501,
            detail="Direct multipart upload is only available with MEDIA_STORAGE_PROVIDER=local",
        )
    return storage


@router.post("", response_model=UploadFileResponse)
async def upload_file(
    file: UploadFile = File(...),
    storage_key: str | None = Query(default=None),
    user: User = Depends(get_user_model),
):
    storage = _require_local_storage()
    content_type = file.content_type or ""
    data = await file.read()
    if storage_key and is_private_storage_key(storage_key):
        parsed = parse_storage_key(storage_key)
        if parsed.user_id != user.id:
            raise HTTPException(status_code=403, detail="Not allowed")
        media_type = media_type_from_content_type(content_type)
        validate_actual_size(len(data), media_type)
        write_local_bytes(storage_key, data)
        return UploadFileResponse(url="", type=media_type, storage_key=storage_key)
    saved = storage.save_multipart_file(
        content_type=content_type,
        data=data,
        original_filename=file.filename,
    )
    return UploadFileResponse(url=saved.url, type=saved.media_type, storage_key=saved.storage_key)


@router.post("/multiple", response_model=UploadMultipleResponse)
async def upload_multiple(
    files: list[UploadFile] = File(...),
    user: User = Depends(get_user_model),
):
    storage = _require_local_storage()
    results: list[UploadFileResponse] = []
    for file in files[:MAX_MULTIPLE_FILES]:
        content_type = file.content_type or ""
        try:
            data = await file.read()
            saved = storage.save_multipart_file(
                content_type=content_type,
                data=data,
                original_filename=file.filename,
            )
            results.append(UploadFileResponse(url=saved.url, type=saved.media_type))
        except HTTPException:
            continue
    return UploadMultipleResponse(files=results)
