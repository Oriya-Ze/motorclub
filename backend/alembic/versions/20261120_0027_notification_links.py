"""Point existing notifications at what they are about: a like at its post, a comment at the comment, a follow at
the profile (the old links went to the home page, or to /users/... which the app does not have).

Only rewrites the link text of notifications; the code already running reads links the same way.

Revision ID: 0027_notification_links
Revises: 0026_hidden_posts
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0027_notification_links"
down_revision: Union[str, None] = "0026_hidden_posts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE notifications SET link = '/profile/' || substring(link from 8) WHERE link LIKE '/users/%'")
    # A comment: the actor's comment on a post of the recipient whose text starts like the notification's preview,
    # the one written closest to the notification.
    op.execute(
        """
        UPDATE notifications n SET link = found.link FROM (
            SELECT DISTINCT ON (n2.id) n2.id AS nid, '/posts/' || c.post_id || '?comment=' || c.id AS link
            FROM notifications n2
            JOIN comments c ON c.user_id = n2.actor_id
            JOIN posts p ON p.id = c.post_id AND p.user_id = n2.user_id
            WHERE n2.type = 'comment' AND n2.link = '/' AND left(c.content, 100) = coalesce(n2.body, '')
            ORDER BY n2.id, abs(extract(epoch FROM (c.created_at - n2.created_at)))
        ) found
        WHERE n.id = found.nid
        """
    )
    # A like: the actor's like on a post of the recipient, the one closest in time to the notification.
    op.execute(
        """
        UPDATE notifications n SET link = found.link FROM (
            SELECT DISTINCT ON (n2.id) n2.id AS nid, '/posts/' || pl.post_id AS link
            FROM notifications n2
            JOIN post_likes pl ON pl.user_id = n2.actor_id
            JOIN posts p ON p.id = pl.post_id AND p.user_id = n2.user_id
            WHERE n2.type = 'like' AND n2.link = '/'
            ORDER BY n2.id, abs(extract(epoch FROM (pl.created_at - n2.created_at)))
        ) found
        WHERE n.id = found.nid
        """
    )


def downgrade() -> None:
    pass  # the old links pointed nowhere useful; nothing to restore
