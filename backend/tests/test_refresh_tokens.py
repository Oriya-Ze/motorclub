from app.services.refresh_tokens import hash_refresh_token, tokens_match


def test_refresh_token_hash_is_stable_and_not_reversible():
    token = "a" * 40
    digest = hash_refresh_token(token)
    assert len(digest) == 64
    assert digest == hash_refresh_token(token)
    assert digest != token
    assert tokens_match(digest, token)
    assert not tokens_match(digest, "b" * 40)
