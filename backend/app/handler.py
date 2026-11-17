"""AWS Lambda entrypoint (API Gateway HTTP API + Mangum)."""

from app import jwks_prefetch

# Start downloading the Cognito keys first, so the download runs while the app below is still importing.
jwks_prefetch.start()

from mangum import Mangum  # noqa: E402

from app.main import app  # noqa: E402

# The app's lifespan only closes the database on shutdown. Running it on every invocation would throw away the
# warm connection each time, so the Lambda instance keeps it until AWS retires the instance.
handler = Mangum(app, lifespan="off")
