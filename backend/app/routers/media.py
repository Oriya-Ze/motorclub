from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_user_model, is_staff
from app.media.factory import get_media_storage
from app.media.keys import is_private_storage_key, parse_storage_key
from app.media.validation import validate_purpose
from app.media.video_assets import ensure_uploaded_video_asset
from app.models import MediaScan, User
from app.schemas_media import MediaUploadRequestCreate, MediaUploadRequestResponse
from app.services.image_moderation import content_hash, scan_bytes
from app.services.media_gate import presigned_get_url, promote_private_image, read_media_bytes

router = APIRouter(prefix="/media", tags=["media"])


@router.post("/upload-requests", response_model=MediaUploadRequestResponse)
async def create_upload_request(
    body: MediaUploadRequestCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    purpose = validate_purpose(body.purpose)
    from app import config as app_config

    if body.content_type.split(";", 1)[0].strip().lower().startswith("video/") and not app_config.settings.video_uploads_enabled:
        raise HTTPException(status_code=400, detail="video_uploads_disabled")
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


class ScanRequest(BaseModel):
    storage_key: str


def _can_read_private(user: User, storage_key: str) -> None:
    if not is_private_storage_key(storage_key):
        raise HTTPException(status_code=400, detail="Not a private media key")
    parsed = parse_storage_key(storage_key)
    if parsed.user_id != user.id and not is_staff(user):
        raise HTTPException(status_code=403, detail="Not allowed")


@router.post("/scans")
async def scan_uploaded_image(
    body: ScanRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    _can_read_private(user, body.storage_key)
    data = read_media_bytes(body.storage_key)
    decision = scan_bytes(data)
    db.add(
        MediaScan(
            storage_key=body.storage_key,
            content_hash=content_hash(data),
            decision=decision.decision,
            labels=decision.labels,
            model_version=decision.model_version,
            aws_request_id=decision.aws_request_id,
            policy_version=decision.policy_version,
            error_message=decision.error_message,
        )
    )
    from app.services.post_moderation import purpose_of

    public_key = None
    if decision.decision == "approved" and purpose_of(body.storage_key) != "posts":
        public_key = promote_private_image(body.storage_key)
    await db.commit()
    return {
        "decision": decision.decision,
        "storage_key": body.storage_key,
        "public_key": public_key,
        "error_message": decision.error_message,
        "aws_request_id": decision.aws_request_id,
        "model_version": decision.model_version,
        "reason_code": decision.reason_code if decision.decision == "rejected" else None,
    }


@router.get("/access-url")
async def access_url(
    key: str = Query(min_length=8),
    user: User = Depends(get_user_model),
):
    _can_read_private(user, key)
    return {"url": presigned_get_url(key)}


@router.get("/private-file")
async def private_file(
    key: str = Query(min_length=8),
    user: User = Depends(get_user_model),
):
    _can_read_private(user, key)
    data = read_media_bytes(key)
    media_type = "image/png" if key.lower().endswith(".png") else "image/webp" if key.lower().endswith(".webp") else "image/jpeg"
    return Response(content=data, media_type=media_type)
