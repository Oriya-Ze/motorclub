import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import check_db_connection, close_db
from app.logging_config import setup_logging
from app.middleware import RequestLoggingMiddleware
from app.routers import auth, events_marketplace, garage, groups_forums, media, messages, posts, social, uploads, users, vehicle_catalog

setup_logging(settings.log_level)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await close_db()


app = FastAPI(
    title="MotorClub IL API",
    description="Israeli car community platform API",
    version=settings.app_version,
    lifespan=lifespan,
)

app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(posts.router, prefix="/api/v1")
app.include_router(groups_forums.groups_router, prefix="/api/v1")
app.include_router(groups_forums.forums_router, prefix="/api/v1")
app.include_router(events_marketplace.events_router, prefix="/api/v1")
app.include_router(events_marketplace.marketplace_router, prefix="/api/v1")
app.include_router(events_marketplace.services_router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(messages.router, prefix="/api/v1")
app.include_router(media.router, prefix="/api/v1")
app.include_router(uploads.router, prefix="/api/v1")
app.include_router(garage.router, prefix="/api/v1")
app.include_router(vehicle_catalog.router, prefix="/api/v1")
app.include_router(social.notifications_router, prefix="/api/v1")
app.include_router(social.stories_router, prefix="/api/v1")
app.include_router(social.explore_router, prefix="/api/v1")

if settings.is_local and settings.media_storage_provider == "local":
    os.makedirs(settings.upload_dir, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": settings.service_name,
        "version": settings.app_version,
        "auth_provider": settings.auth_provider,
    }


@app.get("/health/live")
async def health_live():
    return {"status": "ok"}


@app.get("/health/ready")
async def health_ready(response: Response):
    if await check_db_connection():
        return {"status": "ready"}
    response.status_code = 503
    return {"status": "not_ready"}
