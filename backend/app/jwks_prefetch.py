"""Fetch the Cognito signing keys while the Lambda instance is still importing the app.

A cold instance spends over a second importing; the first signed-in request would then wait for this download
too. Started from handler.py before the import, the download overlaps the import instead. Anything that fails
here is ignored: CognitoAuthProvider fetches the keys itself when nothing was prefetched.
"""

import json
import os
import threading
import urllib.request

_done = threading.Event()
_keys: dict | None = None


def _fetch(url: str) -> None:
    global _keys
    try:
        with urllib.request.urlopen(url, timeout=3) as response:  # noqa: S310 - fixed https Cognito URL
            data = json.loads(response.read())
        if isinstance(data, dict) and isinstance(data.get("keys"), list):
            _keys = data
    except Exception:  # noqa: BLE001 - best effort; the provider fetches on demand
        pass
    finally:
        _done.set()


def start() -> None:
    pool_id = os.environ.get("COGNITO_USER_POOL_ID", "").strip()
    region = os.environ.get("AWS_REGION", "").strip()
    if os.environ.get("AUTH_PROVIDER", "").strip().lower() != "cognito" or not pool_id or not region:
        return
    url = f"https://cognito-idp.{region}.amazonaws.com/{pool_id}/.well-known/jwks.json"
    threading.Thread(target=_fetch, args=(url,), name="jwks-prefetch", daemon=True).start()


def prefetched() -> dict | None:
    """The keys if the prefetch already finished; never waits."""
    return _keys if _done.is_set() else None
