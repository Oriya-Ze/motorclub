"""Add English forum labels and fix tuning forum Hebrew name.

Revision ID: 0003_forum_i18n
Revises: 0002_user_phone
"""

from alembic import op
import sqlalchemy as sa

revision = "0003_forum_i18n"
down_revision = "0002_user_phone"
branch_labels = None
depends_on = None

FORUM_I18N = [
    (
        "שאלות ותשובות",
        "Q&A",
        "Technical questions and car troubleshooting",
    ),
    (
        "דיונים כלליים",
        "General Discussion",
        "General conversations about cars and driving",
    ),
    (
        "קניה ומכירה",
        "Buying & Selling",
        "Advice on buying and selling vehicles",
    ),
    (
        "טיפים והמלצות",
        "Tips & Recommendations",
        "Maintenance tips, upgrades, and recommendations",
    ),
    (
        "רכבי אספנות",
        "Collector Cars",
        "Discussions about collector and classic cars",
    ),
    (
        "טיונינג ושדרוגים",
        "Tuning & Mods",
        "Performance upgrades, tuning, and styling",
    ),
]


def upgrade() -> None:
    op.add_column("forums", sa.Column("name_en", sa.String(length=255), nullable=True))
    op.add_column("forums", sa.Column("description_en", sa.Text(), nullable=True))

    conn = op.get_bind()
    conn.execute(
        sa.text(
            "UPDATE forums SET name = :fixed_name, description = :fixed_desc "
            "WHERE name ILIKE '%tuning%' OR name LIKE '%טuning%'"
        ),
        {
            "fixed_name": "טיונינג ושדרוגים",
            "fixed_desc": "שדרוגים, טיונינג ומראה",
        },
    )

    for name_he, name_en, desc_en in FORUM_I18N:
        conn.execute(
            sa.text(
                "UPDATE forums SET name_en = :name_en, description_en = :desc_en "
                "WHERE name = :name_he"
            ),
            {"name_he": name_he, "name_en": name_en, "desc_en": desc_en},
        )

    conn.execute(
        sa.text(
            "UPDATE forums SET name = :fixed_name, name_en = :name_en, "
            "description = :fixed_desc, description_en = :desc_en "
            "WHERE name ILIKE '%tuning%' OR name LIKE '%טuning%'"
        ),
        {
            "fixed_name": "טיונינג ושדרוגים",
            "fixed_desc": "שדרוגים, טיונינג ומראה",
            "name_en": "Tuning & Mods",
            "desc_en": "Performance upgrades, tuning, and styling",
        },
    )


def downgrade() -> None:
    op.drop_column("forums", "description_en")
    op.drop_column("forums", "name_en")
