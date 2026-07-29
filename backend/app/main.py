from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import async_session, init_db
from app.migrate import run_migrations
from app.routers import auth, events_marketplace, garage, groups_forums, messages, posts, social, uploads, users
from app.seed import seed_database


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await run_migrations()
    async with async_session() as db:
        await seed_database(db)
    yield


app = FastAPI(
    title="MotorClub IL API",
    description="Israeli car community platform API",
    version="1.0.0",
    lifespan=lifespan,
)

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
app.include_router(uploads.router, prefix="/api/v1")
app.include_router(garage.router, prefix="/api/v1")
app.include_router(social.notifications_router, prefix="/api/v1")
app.include_router(social.stories_router, prefix="/api/v1")
app.include_router(social.explore_router, prefix="/api/v1")

import os

os.makedirs(settings.upload_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")


@app.get("/health")
async def health():
    return {"status": "ok", "auth_provider": settings.auth_provider}
