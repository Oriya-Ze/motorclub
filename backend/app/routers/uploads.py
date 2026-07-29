from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.deps import get_user_model
from app.media.factory import get_media_storage
from app.media.local import LocalMediaStorage
from app.models import User
from app.schemas_media import UploadFileResponse, UploadMultipleResponse

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
    user: User = Depends(get_user_model),
):
    storage = _require_local_storage()
    content_type = file.content_type or ""
    data = await file.read()
    saved = storage.save_multipart_file(
        content_type=content_type,
        data=data,
        original_filename=file.filename,
    )
    return UploadFileResponse(url=saved.url, type=saved.media_type)


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
