from datetime import UTC, datetime, timedelta

import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models import Event, Forum, Group, User


async def seed_database(db: AsyncSession) -> None:
    result = await db.execute(select(Forum).limit(1))
    if result.scalar_one_or_none():
        return

    forums = [
        Forum(name="שאלות ותשובות", description="שאלות טכניות ופתרונות לבעיות ברכב", icon="HelpCircle"),
        Forum(name="דיונים כלליים", description="שיחות כלליות על רכבים ותחבורה", icon="MessageSquare"),
        Forum(name="קניה ומכירה", description="עצות לקניה ומכירה של רכבים", icon="ShoppingCart"),
        Forum(name="טיפים והמלצות", description="טיפים לתחזוקה, שדרוגים והמלצות", icon="Lightbulb"),
        Forum(name="רכבי אספנות", description="דיונים על רכבי אספנות וקלאסיקות", icon="Star"),
        Forum(name="טuning ושדרוגים", description="שדרוגים, tuning ומראה", icon="Wrench"),
    ]
    db.add_all(forums)

    admin = User(
        email="admin@motorclub.local",
        username="admin",
        full_name="MotorClub Admin",
        password_hash=None,
        account_type="personal",
        is_verified=True,
    )
    db.add(admin)
    await db.flush()

    demo_events = [
        Event(
            creator_id=admin.id,
            title="מפגש חובבי פורשה",
            description="מפגש חודשי של חובבי פורשה בمركز הארץ",
            event_type="meetup",
            location="תל אביב",
            event_date=datetime.now(UTC) + timedelta(days=14),
            max_participants=50,
        ),
        Event(
            creator_id=admin.id,
            title="סדנת תחזוקה בסיסית",
            description="למדו לבדוק שמן, צמיגים ונוזלים",
            event_type="workshop",
            location="חיפה",
            event_date=datetime.now(UTC) + timedelta(days=30),
            max_participants=20,
        ),
    ]
    db.add_all(demo_events)

    demo_groups = [
        Group(
            name="חובבי JDM",
            description="קבוצה לחובבי רכבי JDM יapanese",
            category="jdm",
            creator_id=admin.id,
        ),
        Group(
            name="BMW Israel",
            description="קהילת בעלי BMW בישראל",
            category="bmw",
            creator_id=admin.id,
        ),
    ]
    db.add_all(demo_groups)
    await db.commit()


async def main() -> None:
    async with async_session() as db:
        await seed_database(db)


if __name__ == "__main__":
    asyncio.run(main())
