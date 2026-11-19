"""AWS Lambda entrypoint (API Gateway HTTP API + Mangum)."""

from app import jwks_prefetch

# Start downloading the Cognito keys first, so the download runs while the app below is still importing.
jwks_prefetch.start()

from mangum import Mangum  # noqa: E402

from app.main import app  # noqa: E402

# The app's lifespan only closes the database on shutdown. Running it on every invocation would throw away the
# warm connection each time, so the Lambda instance keeps it until AWS retires the instance.
_asgi = Mangum(app, lifespan="off")

# EventBridge invokes the function with {"motorclub_task": "bot_tick"} every 30 minutes (motorclub-infra). It is
# turned into an internal HTTP request so the tick runs on the same event loop and database pool as the API.
# The top-level "motorclub_internal" key marks it: API Gateway events never have it, so a request from outside
# cannot reach the internal route.
INTERNAL_TASKS = {"bot_tick": "/api/v1/internal/bots/tick"}


def _internal_event(task: str, path: str) -> dict:
    return {
        "version": "2.0",
        "routeKey": f"POST {path}",
        "rawPath": path,
        "rawQueryString": "",
        "headers": {"host": "internal", "content-type": "application/json"},
        "requestContext": {"http": {"method": "POST", "path": path, "protocol": "HTTP/1.1", "sourceIp": "127.0.0.1"}},
        "body": "",
        "isBase64Encoded": False,
        "motorclub_internal": task,
    }


def handler(event, context):
    task = event.get("motorclub_task") if isinstance(event, dict) else None
    if task in INTERNAL_TASKS:
        event = _internal_event(task, INTERNAL_TASKS[task])
    return _asgi(event, context)
