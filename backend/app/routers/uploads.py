import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.config import settings
from app.deps import get_user_model
from app.models import User

router = APIRouter(prefix="/uploads", tags=["uploads"])

ALLOWED_IMAGE = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_VIDEO = {"video/mp4", "video/webm", "video/quicktime"}
MAX_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("")
async def upload_file(
    file: UploadFile = File(...),
    user: User = Depends(get_user_model),
):
    content_type = file.content_type or ""
    if content_type not in ALLOWED_IMAGE | ALLOWED_VIDEO:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    data = await file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    ext = Path(file.filename or "file").suffix or (".jpg" if "image" in content_type else ".mp4")
    filename = f"{uuid.uuid4()}{ext}"
    folder = "images" if content_type in ALLOWED_IMAGE else "videos"
    dest_dir = Path(settings.upload_dir) / folder
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / filename
    dest.write_bytes(data)

    url = f"/uploads/{folder}/{filename}"
    return {"url": url, "type": "image" if folder == "images" else "video"}


@router.post("/multiple")
async def upload_multiple(
    files: list[UploadFile] = File(...),
    user: User = Depends(get_user_model),
):
    results = []
    for file in files[:10]:
        content_type = file.content_type or ""
        if content_type not in ALLOWED_IMAGE | ALLOWED_VIDEO:
            continue
        data = await file.read()
        if len(data) > MAX_SIZE:
            continue
        ext = Path(file.filename or "file").suffix or ".jpg"
        filename = f"{uuid.uuid4()}{ext}"
        folder = "images" if content_type in ALLOWED_IMAGE else "videos"
        dest_dir = Path(settings.upload_dir) / folder
        dest_dir.mkdir(parents=True, exist_ok=True)
        (dest_dir / filename).write_bytes(data)
        results.append({"url": f"/uploads/{folder}/{filename}", "type": folder[:-1]})
    return {"files": results}
