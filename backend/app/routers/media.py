from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_user_model
from app.media.factory import get_media_storage
from app.media.keys import parse_storage_key
from app.media.validation import validate_purpose
from app.media.video_assets import ensure_uploaded_video_asset
from app.models import User
from app.schemas_media import MediaUploadRequestCreate, MediaUploadRequestResponse

router = APIRouter(prefix="/media", tags=["media"])


@router.post("/upload-requests", response_model=MediaUploadRequestResponse)
async def create_upload_request(
    body: MediaUploadRequestCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    purpose = validate_purpose(body.purpose)
    storage = get_media_storage()
    request = await storage.create_upload_request(
        user_id=user.id,
        purpose=purpose,
        content_type=body.content_type,
        size_bytes=body.size_bytes,
        original_filename=body.filename,
    )
    if request.media_type in {"video", "image"} and request.storage_key:
        parsed = parse_storage_key(request.storage_key)
        await ensure_uploaded_video_asset(
            db,
            user_id=user.id,
            storage_key=request.storage_key,
            purpose_segment=parsed.purpose_segment,
        )
        await db.commit()
    return MediaUploadRequestResponse(
        storage_key=request.storage_key,
        media_type=request.media_type,
        purpose=request.purpose,
        upload_method=request.upload_method,
        upload_url=request.upload_url,
        upload_path=request.upload_path,
        required_headers=request.required_headers,
        expires_in=request.expires_in,
    )
