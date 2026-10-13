"""AWS Lambda entrypoint (API Gateway HTTP API + Mangum)."""

from mangum import Mangum

from app.main import app

# The app's lifespan only closes the database on shutdown. Running it on every invocation would throw away the
# warm connection each time, so the Lambda instance keeps it until AWS retires the instance.
handler = Mangum(app, lifespan="off")
