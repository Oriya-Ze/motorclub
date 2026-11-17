import io
import json
import subprocess
import sys

import pytest

from app import jwks_prefetch


def test_api_import_does_not_load_boto3():
    """boto3 is only for uploads and rate-limited auth writes; loading it at import made every cold start slower."""
    code = "import sys, app.main; print('boto3' in sys.modules or 'botocore' in sys.modules)"
    out = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, check=True)
    assert out.stdout.strip() == "False"


def _reset(monkeypatch):
    monkeypatch.setattr(jwks_prefetch, "_keys", None)
    monkeypatch.setattr(jwks_prefetch, "_done", jwks_prefetch.threading.Event())


def test_jwks_prefetch_keeps_valid_keys(monkeypatch):
    _reset(monkeypatch)
    body = json.dumps({"keys": [{"kid": "a"}]}).encode()
    monkeypatch.setattr(jwks_prefetch.urllib.request, "urlopen", lambda url, timeout: io.BytesIO(body))
    assert jwks_prefetch.prefetched() is None, "nothing before the download finishes"
    jwks_prefetch._fetch("https://example.test/jwks.json")
    assert jwks_prefetch.prefetched() == {"keys": [{"kid": "a"}]}


@pytest.mark.parametrize("payload", [b"not json", json.dumps({"no": "keys"}).encode()])
def test_jwks_prefetch_ignores_bad_answers(monkeypatch, payload):
    _reset(monkeypatch)
    monkeypatch.setattr(jwks_prefetch.urllib.request, "urlopen", lambda url, timeout: io.BytesIO(payload))
    jwks_prefetch._fetch("https://example.test/jwks.json")
    assert jwks_prefetch.prefetched() is None


def test_jwks_prefetch_starts_only_for_cognito(monkeypatch):
    started = []
    monkeypatch.setattr(jwks_prefetch.threading, "Thread", lambda **kw: started.append(kw) or type("T", (), {"start": lambda self: None})())
    monkeypatch.setenv("AUTH_PROVIDER", "local")
    monkeypatch.setenv("COGNITO_USER_POOL_ID", "eu-central-1_x")
    monkeypatch.setenv("AWS_REGION", "eu-central-1")
    jwks_prefetch.start()
    assert started == []
    monkeypatch.setenv("AUTH_PROVIDER", "cognito")
    jwks_prefetch.start()
    assert started and started[0]["args"] == ("https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_x/.well-known/jwks.json",)


@pytest.mark.asyncio
async def test_cognito_uses_prefetched_keys(monkeypatch):
    from app.auth import cognito

    monkeypatch.setattr(cognito, "_jwks_cache", None)
    monkeypatch.setattr(jwks_prefetch, "prefetched", lambda: {"keys": [{"kid": "pre"}]})

    class NoNetwork:
        def __init__(self, *a, **kw):
            raise AssertionError("must not download when keys were prefetched")

    monkeypatch.setattr(cognito.httpx, "AsyncClient", NoNetwork)
    assert await cognito.CognitoAuthProvider(db=None)._get_jwks() == {"keys": [{"kid": "pre"}]}
