from app.auth.cognito import (
    _is_uuid_like,
    _needs_better_username,
    _resolve_username_from_claims,
)


def test_is_uuid_like():
    assert _is_uuid_like("8295d454-1234-5678-9abc-def012345678")
    assert not _is_uuid_like("motorfan")
    assert not _is_uuid_like("")


def test_resolve_username_prefers_preferred_username():
    payload = {"preferred_username": "motorfan", "username": "8295d454-1234-5678-9abc-def012345678"}
    assert _resolve_username_from_claims(payload, "user@example.com") == "motorfan"


def test_resolve_username_uses_email_local_part_when_claim_is_uuid():
    payload = {"username": "8295d454-1234-5678-9abc-def012345678"}
    assert _resolve_username_from_claims(payload, "user@example.com") == "user"


def test_needs_better_username():
    sub = "8295d454-1234-5678-9abc-def012345678"
    assert _needs_better_username("", sub)
    assert _needs_better_username(sub, sub)
    assert _needs_better_username("motorfan", sub) is False
