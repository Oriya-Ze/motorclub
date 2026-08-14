from datetime import UTC, datetime, timedelta

import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session_factory
from app.models import Event, Forum, Group, User


async def seed_database(db: AsyncSession) -> None:
    result = await db.execute(select(Forum).limit(1))
    if result.scalar_one_or_none():
        return

    forums = [
        Forum(name="שאלות ותשובות", name_en="Q&A", description="שאלות טכניות ופתרונות לבעיות ברכב", description_en="Technical questions and car troubleshooting", icon="HelpCircle"),
        Forum(name="דיונים כלליים", name_en="General Discussion", description="שיחות כלליות על רכבים ותחבורה", description_en="General conversations about cars and driving", icon="MessageSquare"),
        Forum(name="קניה ומכירה", name_en="Buying & Selling", description="עצות לקניה ומכירה של רכבים", description_en="Advice on buying and selling vehicles", icon="ShoppingCart"),
        Forum(name="טיפים והמלצות", name_en="Tips & Recommendations", description="טיפים לתחזוקה, שדרוגים והמלצות", description_en="Maintenance tips, upgrades, and recommendations", icon="Lightbulb"),
        Forum(name="רכבי אספנות", name_en="Collector Cars", description="דיונים על רכבי אספנות וקלאסיקות", description_en="Discussions about collector and classic cars", icon="Star"),
        Forum(name="טיונינג ושדרוגים", name_en="Tuning & Mods", description="שדרוגים, טיונינג ומראה", description_en="Performance upgrades, tuning, and styling", icon="Wrench"),
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
            description="קבוצה לחובבי רכבי JDM יפניים",
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
    async with get_session_factory()() as db:
        await seed_database(db)


if __name__ == "__main__":
    asyncio.run(main())
