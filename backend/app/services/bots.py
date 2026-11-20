"""Content bots: a few accounts that publish prepared posts and replies, and like posts, to seed early activity.

The personas and their posts are not in this repository. A system admin uploads them as JSON from the admin
console (PUT /admin/bots/content); a scheduled tick (every 30 minutes, from EventBridge through
POST /internal/bots/tick) publishes them gradually. Bots never send messages, follow anyone, comment on members'
posts, or create products, businesses or reviews. Every bot account has users.is_bot, cannot sign in (no password
and no Cognito user), and delete_all_bots removes them with everything they published.
"""

import random
import re
import uuid
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.validation import validate_full_name, validate_username
from app.models import BotConfig, BotItem, Comment, Notification, Post, PostLike, ProfileSettings, User
from app.services.post_moderation import publicly_visible
from app.services.visibility import viewable_owner_ids

ISRAEL = ZoneInfo("Asia/Jerusalem")
ACTIVE_HOURS = range(8, 23)  # 08:00–22:59 Israel time
TICKS_PER_ACTIVE_DAY = len(ACTIVE_HOURS) * 2  # one tick every 30 minutes
POSTS_PER_DAY = 2.5
MIN_GAP_BETWEEN_POSTS = timedelta(hours=2)
MAX_REPLIES_PER_TICK = 2
LIKE_CHANCE_PER_TICK = 0.3
MAX_BOT_LIKES_PER_POST = 3
LIKE_LOOKBACK = timedelta(days=3)
BOT_EMAIL_DOMAIN = "bots.motorclub.invalid"
CONFIG_ID = 1

_KEY = re.compile(r"^[A-Za-z0-9_-]{1,20}$")
_IMAGE_FILE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,79}\.(?:jpe?g|png|webp)$", re.IGNORECASE)
MAX_POST_IMAGES = 4
BIO_LIMIT = 160
AVATAR_SIDE = 640
POST_IMAGE_SIDE = 2048
MAX_IMAGE_BYTES = 8 * 1024 * 1024


class BotContentError(ValueError):
    pass


def _text(value: object, field: str, limit: int = 2000) -> str:
    if not isinstance(value, str) or not value.strip():
        raise BotContentError(f"{field}: missing text")
    if len(value) > limit:
        raise BotContentError(f"{field}: longer than {limit} characters")
    return value.strip()


def parse_content(data: object) -> dict:
    """Validate an uploaded content file and return it normalized. Raises BotContentError with the first problem."""
    if not isinstance(data, dict):
        raise BotContentError("the file must be a JSON object with personas and posts")
    personas_in, posts_in = data.get("personas"), data.get("posts")
    if not isinstance(personas_in, list) or not personas_in:
        raise BotContentError("personas: a non-empty list is required")
    if not isinstance(posts_in, list):
        raise BotContentError("posts: a list is required")

    personas: dict[str, dict] = {}
    usernames: set[str] = set()
    for i, persona in enumerate(personas_in):
        if not isinstance(persona, dict):
            raise BotContentError(f"personas[{i}]: must be an object")
        key = persona.get("key")
        if not isinstance(key, str) or not _KEY.match(key) or key in personas:
            raise BotContentError(f"personas[{i}]: key missing, invalid or repeated")
        try:
            username = validate_username(str(persona.get("username", "")))
            full_name = validate_full_name(str(persona.get("full_name", "")))
        except Exception as exc:  # the validators raise HTTPException with a readable detail
            raise BotContentError(f"personas[{i}]: {getattr(exc, 'detail', exc)}") from exc
        if username.lower() in usernames:
            raise BotContentError(f"personas[{i}]: username repeated")
        usernames.add(username.lower())
        avatar = persona.get("avatar")
        if avatar is not None and (not isinstance(avatar, str) or not _IMAGE_FILE.match(avatar)):
            raise BotContentError(f"personas[{i}]: avatar must be a file name like noa.jpg")
        bio = persona.get("bio")
        if bio is not None:
            bio = " ".join(_text(bio, f"personas[{i}].bio", BIO_LIMIT).split())
        personas[key] = {"key": key, "username": username, "full_name": full_name, "avatar": avatar, "bio": bio}

    posts: list[dict] = []
    post_ids: set[str] = set()
    for i, post in enumerate(posts_in):
        if not isinstance(post, dict):
            raise BotContentError(f"posts[{i}]: must be an object")
        pid = post.get("id")
        if not isinstance(pid, str) or not _KEY.match(pid) or pid in post_ids:
            raise BotContentError(f"posts[{i}]: id missing, invalid or repeated")
        post_ids.add(pid)
        if post.get("bot") not in personas:
            raise BotContentError(f"posts[{i}]: unknown bot")
        tags = post.get("hashtags") or []
        if not isinstance(tags, list) or not all(isinstance(t, str) and t.strip() and " " not in t.strip() for t in tags):
            raise BotContentError(f"posts[{i}]: hashtags must be single words")
        expires = post.get("expires")
        if expires is not None:
            try:
                expires = date.fromisoformat(str(expires))
            except ValueError as exc:
                raise BotContentError(f"posts[{i}]: expires must be a date like 2026-12-31") from exc
        images = post.get("images") or []
        if (
            not isinstance(images, list)
            or len(images) > MAX_POST_IMAGES
            or not all(isinstance(name, str) and _IMAGE_FILE.match(name) for name in images)
            or len(set(images)) != len(images)
        ):
            raise BotContentError(f"posts[{i}]: images must be up to {MAX_POST_IMAGES} different file names like p01.jpg")
        replies = []
        for j, reply in enumerate(post.get("replies") or []):
            if not isinstance(reply, dict) or reply.get("bot") not in personas:
                raise BotContentError(f"posts[{i}].replies[{j}]: unknown bot")
            after = reply.get("after_min", 0)
            if not isinstance(after, int) or not 0 <= after <= 7 * 24 * 60:
                raise BotContentError(f"posts[{i}].replies[{j}]: after_min must be 0–10080")
            replies.append({"bot": reply["bot"], "text": _text(reply.get("text"), f"posts[{i}].replies[{j}]", 1000), "after_min": after})
        posts.append({
            "id": pid,
            "bot": post["bot"],
            "text": _text(post.get("text"), f"posts[{i}]"),
            "hashtags": [t.strip().lstrip("#") for t in tags],
            "expires": expires,
            "images": images,
            "replies": replies,
        })
    return {"personas": list(personas.values()), "posts": posts}


async def _config(db: AsyncSession) -> BotConfig:
    config = await db.get(BotConfig, CONFIG_ID)
    if config is None:
        config = BotConfig(id=CONFIG_ID, enabled=False)
        db.add(config)
        await db.flush()
    return config


async def load_content(db: AsyncSession, data: object) -> dict:
    """Create missing bot accounts and queue posts and replies not queued yet. Text of unpublished items is updated;
    published items are left as they are. Does not commit."""
    content = parse_content(data)
    bots: dict[str, User] = {}
    created = 0
    for persona in content["personas"]:
        user = await db.scalar(select(User).where(func.lower(User.username) == persona["username"].lower()))
        if user is not None and not user.is_bot:
            raise BotContentError(f"the username {persona['username']} belongs to a member")
        if user is None:
            user = User(
                id=uuid.uuid4(),
                email=f"{persona['username'].lower()}@{BOT_EMAIL_DOMAIN}",
                username=persona["username"],
                full_name=persona["full_name"],
                account_type="personal",
                is_active=True,
                is_bot=True,
            )
            db.add(user)
            await db.flush()
            db.add(ProfileSettings(user_id=user.id, profile_public=True))
            created += 1
        else:
            user.full_name = persona["full_name"]
        if persona["bio"] is not None:
            user.bio = persona["bio"]
        bots[persona["key"]] = user

    existing = {item.item_key: item for item in (await db.execute(select(BotItem))).scalars().all()}
    queued = updated = 0

    def upsert(key: str, **fields) -> None:
        nonlocal queued, updated
        item = existing.get(key)
        files = fields.get("image_files")
        if item is None:
            fields["image_keys"] = [None] * len(files) if files else None
            db.add(BotItem(item_key=key, **fields))
            queued += 1
        elif item.kind == "avatar":
            # A new file name for a profile picture waits for its upload; the current picture stays until then.
            if item.image_files != files:
                item.image_files, item.image_keys, item.published_at = files, [None], None
                updated += 1
        elif item.published_at is None:
            # Photos already uploaded stay attached as long as the file name is still listed.
            if "image_files" in fields:
                kept = dict(zip(item.image_files or [], item.image_keys or [], strict=False))
                fields["image_keys"] = [kept.get(name) for name in files] if files else None
            for name, value in fields.items():
                setattr(item, name, value)
            updated += 1

    for persona in content["personas"]:
        if persona["avatar"]:
            # A profile picture waits here until its file is uploaded (see store_image).
            upsert(f"avatar:{persona['key']}", kind="avatar", bot_user_id=bots[persona["key"]].id, parent_key=None,
                   position=0, text=persona["username"], hashtags=None, after_min=0, image_files=[persona["avatar"]])

    for i, post in enumerate(content["posts"]):
        # "expires" is the last Israel calendar day the post may go out.
        expires_at = (
            datetime.combine(post["expires"] + timedelta(days=1), time(0), tzinfo=ISRAEL) if post["expires"] else None
        )
        upsert(post["id"], kind="post", bot_user_id=bots[post["bot"]].id, parent_key=None, position=i * 100,
               text=post["text"], hashtags=post["hashtags"] or None, after_min=0, expires_at=expires_at,
               image_files=post["images"] or None)
        for j, reply in enumerate(post["replies"]):
            upsert(f"{post['id']}.r{j + 1}", kind="reply", bot_user_id=bots[reply["bot"]].id, parent_key=post["id"],
                   position=i * 100 + j + 1, text=reply["text"], hashtags=None, after_min=reply["after_min"])
    await _config(db)
    return {"bots_created": created, "bots": len(bots), "queued": queued, "updated": updated}


def _post_body(item: BotItem) -> str:
    if not item.hashtags:
        return item.text
    return f"{item.text}\n\n" + " ".join(f"#{tag}" for tag in item.hashtags)


async def _publish_post(db: AsyncSession, item: BotItem, now: datetime) -> Post:
    post = Post(
        id=uuid.uuid4(),
        user_id=item.bot_user_id,
        content=_post_body(item),
        hashtags=[tag.lower() for tag in item.hashtags] if item.hashtags else None,
        image_urls=list(item.image_keys) if item.image_files else None,
        moderation_status="published",
        publish_requested=True,
        first_published_at=now,
        created_at=now,
        updated_at=now,
    )
    db.add(post)
    await db.flush()  # the queue row points at the post, so the post has to exist first
    item.post_id = post.id
    item.published_at = now
    return post


async def _publish_due_replies(db: AsyncSession, now: datetime, limit: int) -> list[str]:
    parents = {
        item.item_key: item
        for item in (await db.execute(select(BotItem).where(BotItem.kind == "post", BotItem.published_at.is_not(None)))).scalars()
    }
    pending = (
        await db.execute(
            select(BotItem).where(BotItem.kind == "reply", BotItem.published_at.is_(None)).order_by(BotItem.position)
        )
    ).scalars().all()
    done: list[str] = []
    for item in pending:
        if len(done) >= limit:
            break
        parent = parents.get(item.parent_key or "")
        if parent is None or parent.published_at is None:
            continue
        if parent.published_at + timedelta(minutes=item.after_min) > now:
            continue
        post = await db.get(Post, parent.post_id) if parent.post_id else None
        if post is None or post.hidden_at is not None:
            # The post was deleted or hidden: the reply has nowhere to go, so it is marked done without publishing.
            item.published_at = now
            continue
        comment = Comment(id=uuid.uuid4(), post_id=post.id, user_id=item.bot_user_id, content=item.text, created_at=now)
        db.add(comment)
        await db.flush()
        item.comment_id = comment.id
        item.published_at = now
        done.append(item.item_key)
    return done


async def _like_something(db: AsyncSession, now: datetime, rng: random.Random) -> str | None:
    bots = (await db.execute(select(User).where(User.is_bot.is_(True), User.is_active.is_(True)))).scalars().all()
    if not bots:
        return None
    bot = rng.choice(bots)
    bot_ids = [b.id for b in bots]
    bot_likes = (
        select(func.count())
        .select_from(PostLike)
        .where(PostLike.post_id == Post.id, PostLike.user_id.in_(bot_ids))
        .scalar_subquery()
    )
    already = select(PostLike.id).where(PostLike.post_id == Post.id, PostLike.user_id == bot.id).exists()
    candidates = (
        await db.execute(
            select(Post)
            .where(
                publicly_visible(),
                Post.user_id != bot.id,
                Post.created_at >= now - LIKE_LOOKBACK,
                bot_likes < MAX_BOT_LIKES_PER_POST,
                ~already,
            )
            .order_by(Post.created_at.desc())
            .limit(40)
        )
    ).scalars().all()
    viewable = await viewable_owner_ids(db, list({p.user_id for p in candidates}), bot.id)
    candidates = [p for p in candidates if p.user_id in viewable]
    if not candidates:
        return None
    post = rng.choice(candidates)
    db.add(PostLike(post_id=post.id, user_id=bot.id))
    owner = await db.get(User, post.user_id)
    if owner is not None and not owner.is_bot:
        # The same notification a member's like sends (routers/posts.py toggle_like).
        db.add(Notification(user_id=owner.id, actor_id=bot.id, type="like", title=f"{bot.full_name} liked your post", link="/"))
    return str(post.id)


async def run_tick(db: AsyncSession, *, now: datetime | None = None, rng: random.Random | None = None, force: bool = False) -> dict:
    """One scheduled step. force (from the admin console) skips the switch, the hours and the dice, and publishes the
    next post now. Commits."""
    now = now or datetime.now(UTC)
    rng = rng or random.Random()
    config = await _config(db)
    if not force:
        if not config.enabled:
            await db.commit()
            return {"skipped": "disabled"}
        if now.astimezone(ISRAEL).hour not in ACTIVE_HOURS:
            await db.commit()
            return {"skipped": "quiet_hours"}

    result: dict = {"post": None, "replies": [], "like": None}
    result["replies"] = await _publish_due_replies(db, now, MAX_REPLIES_PER_TICK)

    last = await db.scalar(select(func.max(BotItem.published_at)).where(BotItem.kind == "post"))
    gap_ok = last is None or now - last >= MIN_GAP_BETWEEN_POSTS
    if force or (gap_ok and rng.random() < POSTS_PER_DAY / TICKS_PER_ACTIVE_DAY):
        waiting = (
            await db.execute(
                select(BotItem)
                .where(
                    BotItem.kind == "post",
                    BotItem.published_at.is_(None),
                    or_(BotItem.expires_at.is_(None), BotItem.expires_at > now),
                )
                .order_by(BotItem.position)
            )
        ).scalars()
        # A post with photos waits for all of them to be uploaded; the next post goes out meanwhile.
        item = next((i for i in waiting if not _missing_images(i)), None)
        if item is not None:
            await _publish_post(db, item, now)
            result["post"] = item.item_key

    if force or rng.random() < LIKE_CHANCE_PER_TICK:
        result["like"] = await _like_something(db, now, rng)
    await db.commit()
    return result


def _missing_images(item: BotItem) -> list[str]:
    files, keys = item.image_files or [], item.image_keys or []
    return [name for n, name in enumerate(files) if n >= len(keys) or not keys[n]]


class BotImageError(ValueError):
    pass


def _prepared_jpeg(data: bytes, side: int) -> bytes:
    """Decode by content, apply EXIF rotation, flatten, shrink, and re-encode without metadata."""
    import io

    from PIL import Image, ImageOps, UnidentifiedImageError

    if len(data) > MAX_IMAGE_BYTES:
        raise BotImageError("image larger than 8MB")
    try:
        image = Image.open(io.BytesIO(data))
        if getattr(image, "is_animated", False):
            raise BotImageError("animated images are not allowed")
        image = ImageOps.exif_transpose(image)
        if image.mode in ("RGBA", "LA", "P"):
            image = image.convert("RGBA")
            flat = Image.new("RGB", image.size, "white")
            flat.paste(image, mask=image.getchannel("A"))
            image = flat
        image = image.convert("RGB")
    except (UnidentifiedImageError, OSError) as exc:
        raise BotImageError("not an image") from exc
    image.thumbnail((side, side))
    out = io.BytesIO()
    image.save(out, "JPEG", quality=86, optimize=True)
    return out.getvalue()


def _write_public(storage_key: str, data: bytes) -> None:
    import app.config as app_config
    from app.services.media_gate import write_local_bytes

    settings = app_config.settings
    if settings.media_storage_provider == "s3" and settings.s3_media_bucket:
        import boto3

        boto3.client("s3", region_name=settings.aws_region).put_object(
            Bucket=settings.s3_media_bucket, Key=storage_key, Body=data, ContentType="image/jpeg"
        )
        return
    write_local_bytes(storage_key, data)


async def store_image(db: AsyncSession, filename: str, data: bytes) -> dict:
    """Attach an uploaded photo to every waiting bot item that lists this file name: a profile picture, or a photo
    of a post not published yet. The admin uploading it is the review, recorded like an approval in the console.
    Does not commit; returns the replaced files for deleting after the commit."""
    from app.models import MediaScan
    from app.services.image_moderation import POLICY_VERSION, content_hash

    if not _IMAGE_FILE.match(filename or ""):
        raise BotImageError("file name must look like p01.jpg")
    items = [
        item
        for item in (await db.execute(select(BotItem).where(BotItem.kind.in_(["avatar", "post"])))).scalars()
        if filename in (item.image_files or []) and (item.kind == "avatar" or item.published_at is None)
    ]
    if not items:
        raise BotImageError("no profile picture or waiting post uses this file name")
    used_by: list[str] = []
    replaced: list[str] = []
    for item in items:
        avatar = item.kind == "avatar"
        prepared = _prepared_jpeg(data, AVATAR_SIDE if avatar else POST_IMAGE_SIDE)
        key = f"users/{item.bot_user_id}/{'avatar' if avatar else 'posts'}/{uuid.uuid4()}.jpg"
        _write_public(key, prepared)
        if not avatar:
            db.add(MediaScan(storage_key=key, content_hash=content_hash(prepared), decision="approved", labels=None,
                             model_version="admin", policy_version=POLICY_VERSION))
        index = item.image_files.index(filename)
        keys = list(item.image_keys or [None] * len(item.image_files))
        keys += [None] * (len(item.image_files) - len(keys))
        if keys[index]:
            replaced.append(keys[index])
        keys[index] = key
        item.image_keys = keys
        if avatar:
            bot = await db.get(User, item.bot_user_id)
            if bot.profile_picture_url and bot.profile_picture_url not in replaced:
                replaced.append(bot.profile_picture_url)
            bot.profile_picture_url = key
            item.published_at = datetime.now(UTC)
        used_by.append(item.item_key)
    return {"file": filename, "used_by": used_by, "replaced": replaced}


async def set_enabled(db: AsyncSession, enabled: bool) -> None:
    config = await _config(db)
    config.enabled = enabled


async def bot_status(db: AsyncSession) -> dict:
    config = await _config(db)
    bots = (await db.execute(select(User).where(User.is_bot.is_(True)).order_by(User.username))).scalars().all()
    items = (await db.execute(select(BotItem).order_by(BotItem.position))).scalars().all()
    by_bot = {b.id: b for b in bots}
    likes = dict(
        (await db.execute(select(PostLike.user_id, func.count()).where(PostLike.user_id.in_(list(by_bot))).group_by(PostLike.user_id))).all()
    ) if bots else {}

    now = datetime.now(UTC)

    def expired(item: BotItem) -> bool:
        return item.published_at is None and item.expires_at is not None and item.expires_at <= now

    def summary(kind: str) -> dict:
        of_kind = [i for i in items if i.kind == kind]
        return {
            "total": len(of_kind),
            "published": sum(1 for i in of_kind if i.published_at),
            "expired": sum(1 for i in of_kind if expired(i)),
        }

    upcoming = [i for i in items if i.kind == "post" and i.published_at is None and not expired(i)][:5]
    missing_images = sorted({
        name
        for i in items
        if (i.kind == "avatar" or (i.kind == "post" and i.published_at is None and not expired(i)))
        for name in _missing_images(i)
    })
    recent = sorted((i for i in items if i.published_at and i.kind == "post"), key=lambda i: i.published_at, reverse=True)[:5]

    def row(item: BotItem) -> dict:
        bot = by_bot.get(item.bot_user_id)
        return {
            "key": item.item_key,
            "username": bot.username if bot else None,
            "text": item.text[:140],
            "published_at": item.published_at.isoformat() if item.published_at else None,
            "expires_at": item.expires_at.isoformat() if item.expires_at else None,
            "post_id": str(item.post_id) if item.post_id else None,
            "images": len(item.image_files or []),
            "missing_images": _missing_images(item),
        }

    return {
        "enabled": config.enabled,
        "bots": [
            {
                "id": str(b.id),
                "username": b.username,
                "full_name": b.full_name,
                "posts": sum(1 for i in items if i.bot_user_id == b.id and i.kind == "post" and i.published_at),
                "replies": sum(1 for i in items if i.bot_user_id == b.id and i.kind == "reply" and i.published_at),
                "likes": int(likes.get(b.id, 0)),
            }
            for b in bots
        ],
        "posts": summary("post"),
        "replies": summary("reply"),
        "missing_images": missing_images,
        "upcoming": [row(i) for i in upcoming],
        "recent": [row(i) for i in recent],
    }


async def delete_all_bots(db: AsyncSession) -> dict:
    """Remove every bot account with its posts, replies and likes, the notifications they caused, and the queue.
    Does not commit."""
    from app.services.media_cleanup import user_media

    bot_ids = list((await db.execute(select(User.id).where(User.is_bot.is_(True)))).scalars().all())
    # Their photos are deleted after the commit (delete_bot_files); collect them while the rows still exist.
    media = [(bot_id, *(await user_media(db, bot_id))) for bot_id in bot_ids]
    queued_keys = [
        key
        for keys in (await db.execute(select(BotItem.image_keys).where(BotItem.image_keys.is_not(None)))).scalars()
        for key in keys or []
        if key
    ]
    notifications = 0
    if bot_ids:
        notifications = (await db.execute(delete(Notification).where(Notification.actor_id.in_(bot_ids)))).rowcount or 0
    items = (await db.execute(delete(BotItem))).rowcount or 0
    if bot_ids:
        await db.execute(delete(User).where(User.id.in_(bot_ids)))
    config = await _config(db)
    config.enabled = False
    return {"bots": len(bot_ids), "items": items, "notifications": notifications, "_media": media, "_queued_keys": queued_keys}


def delete_bot_files(removed: dict) -> None:
    """After delete_all_bots is committed: remove the bots' photos, processed copies included."""
    from app.services.media_cleanup import delete_media_files, delete_user_media_files

    for bot_id, keys, media_ids in removed.pop("_media", []):
        delete_user_media_files(bot_id, keys, media_ids)
    delete_media_files(removed.pop("_queued_keys", []))
