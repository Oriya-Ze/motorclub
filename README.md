# MotorClub IL

Israeli car community platform — containerized rebuild of [motorhub.co.il](https://www.motorhub.co.il).

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌────────────┐
│   Nginx     │────▶│   Frontend   │     │  PostgreSQL │
│   :80       │     │   React/Vite │     │   :5432     │
└──────┬──────┘     └──────────────┘     └──────▲──────┘
       │                                        │
       └──────────────▶ Backend (FastAPI) ──────┘
                        :8000
```

| Service | Tech | Port |
|---------|------|------|
| Frontend | React 18, Vite, Tailwind, TanStack Query | 5173 |
| Backend | FastAPI, SQLAlchemy, PostgreSQL | 8000 |
| Database | PostgreSQL 16 | 5432 |
| Proxy | Nginx | 80 |

## Auth Providers

The backend supports two auth modes via `AUTH_PROVIDER`:

### Local (default — Docker/testing)

```env
AUTH_PROVIDER=local
JWT_SECRET=your-secret-key
```

Email + password with JWT tokens. No external dependencies.

### AWS Cognito (production)

```env
AUTH_PROVIDER=cognito
AWS_REGION=eu-west-1
COGNITO_USER_POOL_ID=eu-west-1_XXXXX
COGNITO_CLIENT_ID=xxxxxxxx
COGNITO_CLIENT_SECRET=xxxxxxxx   # optional
```

Switch provider without code changes — both implement the same `AuthProvider` interface.

## Quick Start

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Start PostgreSQL
docker compose up -d postgres

# 3. Apply database migrations
docker compose run --rm backend alembic upgrade head

# 4. Optional: load local demo seed data
docker compose run --rm backend python -m app.seed

# 5. Start the application stack
docker compose up -d

# 6. Open the app
# Frontend (direct):  http://localhost:5173
# Via Nginx:          http://localhost
# API docs:           http://localhost:8000/docs
# Health check:       http://localhost:8000/health
```

Schema migrations and seed data are **not** run automatically during API startup. Run Alembic explicitly before starting the backend.

### Existing local database created before Alembic

If your Docker Compose PostgreSQL volume already contains tables created by the old `create_all()` flow, do **not** run `alembic upgrade head` on that database. After reviewing the baseline migration, run the documented pre-stamp alignment SQL if needed, then:

```bash
docker compose run --rm backend alembic stamp head
```

Fresh databases should use `alembic upgrade head` instead.

## Database Migrations

MotorHub uses [Alembic](https://alembic.sqlalchemy.org/) with the async SQLAlchemy models in [backend/app/models.py](backend/app/models.py).

### Commands

```bash
cd backend
alembic upgrade head
alembic current
alembic history
alembic heads
alembic check
```

Via Docker Compose:

```bash
docker compose run --rm backend alembic upgrade head
docker compose run --rm backend alembic current
```

### Seed data

Seed data is separate from schema migration:

```bash
docker compose run --rm backend python -m app.seed
```

The seed command is **conditionally idempotent**: it exits without changes if any forum already exists. That means partially missing demo data will not be recreated automatically.

### Deprecated legacy migration module

[backend/app/migrate.py](backend/app/migrate.py) is deprecated and no longer called during API startup. Use Alembic instead.

## Media uploads

The backend media abstraction lives in [backend/app/media/](backend/app/media/). The frontend upload helper is in [frontend/src/lib/mediaUpload.ts](frontend/src/lib/mediaUpload.ts).

| Provider | Upload flow | Stored reference | Display |
|----------|-------------|------------------|---------|
| `local` (default) | `POST /media/upload-requests` → multipart `POST /uploads` | `/uploads/images/...` | `mediaUrl()` via API base |
| `s3` | `POST /media/upload-requests` → presigned PUT to S3 | `users/<id>/.../<uuid>.ext` | `VITE_MEDIA_BASE_URL` + key |

### Frontend upload flow (Phase 3B)

For each file, the client:

1. Calls `POST /api/v1/media/upload-requests` with `purpose`, `content_type`, `size_bytes`, and `filename`
2. Branches on `upload_method`:
   - **`multipart`** — authenticated `POST /api/v1/uploads` (local dev)
   - **`PUT`** — raw file to presigned S3 URL (no app `Authorization` header)
3. Submits the returned reference to the domain API (`image_urls`, `media_url`, etc.)

Presigned URLs are never stored in domain records.

### Orphaned uploads

If an upload succeeds but the subsequent domain operation fails (or the user abandons the form), the storage object may remain unreferenced. **No deletion API exists in this phase.** A future orphan-cleanup worker will remove unreferenced objects from local disk or S3.

### S3 CORS (infrastructure — not implemented in Phase 3)

When using `MEDIA_STORAGE_PROVIDER=s3`, the bucket must allow the frontend origin, `PUT`, and signed headers such as `Content-Type`. This is configured on AWS, not in frontend code.

### Upload request API

Authenticated clients call `POST /api/v1/media/upload-requests` with:

```json
{
  "purpose": "post",
  "content_type": "image/jpeg",
  "size_bytes": 245678,
  "filename": "photo.jpg"
}
```

- **`purpose`**: `post`, `story`, `vehicle`, or `avatar`
- **`media_type`**: derived server-side (`image` or `video`) and returned in the response

Actual file size is validated on multipart upload endpoints, not only the declared `size_bytes` on upload requests.

The upload-request contract is designed to support future S3 Multipart Upload for large videos without changing the frontend API shape.

### Run media tests

```bash
cd backend
pytest tests/test_media_validation.py tests/test_media_storage_local.py tests/test_media_storage_s3.py tests/test_media_upload_api.py -v
```

## Environment Variables

### Backend runtime

| Variable | Required | Description |
|----------|----------|-------------|
| `ENVIRONMENT` | No | `local` enables development defaults. Schema is managed by Alembic, not API startup. Default: `local` |
| `LOG_LEVEL` | No | Logging level (`DEBUG`, `INFO`, `WARNING`, `ERROR`). Default: `INFO` |
| `APP_VERSION` | No | Application version reported by `/health`. Default: `dev` |
| `DATABASE_URL` | Yes outside `local` | PostgreSQL connection string (`postgresql+asyncpg://...`) |
| `AUTH_PROVIDER` | No | `local` (JWT) or `cognito`. First AWS dev deployment uses `local` |
| `JWT_SECRET` | Yes when `AUTH_PROVIDER=local` and not `local` env | At least 32 characters; must not use insecure defaults |
| `JWT_ALGORITHM` | No | Default: `HS256` |
| `JWT_EXPIRE_MINUTES` | No | Default: `1440` |
| `BACKEND_CORS_ORIGINS` | Yes outside `local` | Comma-separated allowed origins |
| `UPLOAD_DIR` | No | Local upload directory. Default: `./uploads` |
| `MEDIA_STORAGE_PROVIDER` | No | `local` (multipart to `UPLOAD_DIR`) or `s3` (presigned PUT). Default: `local` |
| `MEDIA_BASE_URL` | For S3 | Public base URL for stored keys (e.g. CloudFront). Empty in local dev |
| `S3_MEDIA_BUCKET` | When `MEDIA_STORAGE_PROVIDER=s3` | Target S3 bucket name |
| `S3_PRESIGNED_URL_EXPIRY_SECONDS` | No | Presigned PUT lifetime. Default: `300` |
| `MAX_IMAGE_UPLOAD_BYTES` | No | Max image upload size in bytes. Default: `10485760` (10 MB) |
| `MAX_VIDEO_UPLOAD_BYTES` | No | Max video upload size in bytes. Default: `10485760` (10 MB) |
| `AWS_REGION` | For Cognito / S3 | Default: `eu-west-1` |
| `COGNITO_USER_POOL_ID` | When `AUTH_PROVIDER=cognito` | Cognito User Pool ID |
| `COGNITO_CLIENT_ID` | When `AUTH_PROVIDER=cognito` | Cognito app client ID |
| `COGNITO_CLIENT_SECRET` | Optional | Cognito app client secret |

### Docker Compose / PostgreSQL

| Variable | Description |
|----------|-------------|
| `POSTGRES_USER` | Database user |
| `POSTGRES_PASSWORD` | Database password |
| `POSTGRES_DB` | Database name |

### Frontend build-time

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | API base URL baked into the frontend bundle |
| `VITE_MEDIA_BASE_URL` | Public media base URL for storage-key references (required for S3 display) |

See [.env.example](.env.example) for a local development template without real secrets.

## Health Check Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | General health check used by Docker Compose and load balancers |
| `GET /health/live` | Liveness probe — confirms the process is running |
| `GET /health/ready` | Readiness probe — verifies database connectivity |

Example responses:

```json
{"status":"ok","service":"motorclub-api","version":"dev","auth_provider":"local"}
{"status":"ok"}
{"status":"ready"}
```

If the database is unavailable, `GET /health/ready` returns HTTP `503` with `{"status":"not_ready"}` and does not expose connection details.

## Production Docker

Build the backend image:

```bash
docker build -t motorclub-api ./backend
```

Run the backend container for a non-local environment:

```bash
docker run --rm -p 8000:8000 \
  -e ENVIRONMENT=dev \
  -e LOG_LEVEL=INFO \
  -e APP_VERSION=dev \
  -e DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@HOST:5432/motorclub \
  -e AUTH_PROVIDER=local \
  -e JWT_SECRET=replace-with-a-long-random-secret-at-least-32-chars \
  -e BACKEND_CORS_ORIGINS=https://motorhub.co.il \
  -e UPLOAD_DIR=/app/uploads \
  motorclub-api
```

Notes:

- The production image runs as a non-root user and does not use `--reload`.
- Docker Compose overrides the startup command to keep `--reload` for local development.
- Run `alembic upgrade head` before starting the backend when the database schema is not yet initialized.
- [backend/app/seed.py](backend/app/seed.py) is run explicitly via `python -m app.seed` when local demo data is needed.
- The container creates `/app/uploads` with correct ownership for the deferred local-upload flow.

## Register & Test

1. Open http://localhost:5173/auth
2. Click **הרשמה** (Sign Up)
3. Fill in name, username, email, password (min 8 chars, letter + number)
4. Explore: Feed, Groups, Forums, Events, Marketplace, Services

Seed data includes demo forums, events, and groups when you run `python -m app.seed` against an empty database.

## Development

### Backend only

```bash
cd backend
pip install -r requirements.txt
export DATABASE_URL=postgresql+asyncpg://motorclub:motorclub_dev@localhost:5432/motorclub
uvicorn app.main:app --reload
```

### Frontend only

```bash
cd frontend
npm install
npm run dev
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/register` | Register |
| POST | `/api/v1/auth/login` | Login |
| GET | `/api/v1/auth/me` | Current user |
| GET | `/api/v1/posts` | Feed |
| POST | `/api/v1/posts` | Create post |
| GET | `/api/v1/groups` | List groups |
| GET | `/api/v1/forums` | List forums |
| GET | `/api/v1/events` | List events |
| GET | `/api/v1/marketplace` | Products |
| GET | `/api/v1/services` | Business directory |

Full docs at `/docs` (Swagger UI).

## Switching to Cognito

1. Create a Cognito User Pool in AWS Console
2. Enable `USER_PASSWORD_AUTH` flow on the app client
3. Set env vars in `.env`:
   ```env
   AUTH_PROVIDER=cognito
   COGNITO_USER_POOL_ID=...
   COGNITO_CLIENT_ID=...
   ```
4. Restart backend: `docker compose restart backend`

User records are synced to PostgreSQL on first login (via `cognito_sub`).

## Project Structure

```
motorclub/
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── app/
│   │   ├── auth/          # Auth abstraction (local + cognito)
│   │   ├── media/         # Media storage abstraction (local + S3)
│   │   ├── routers/       # API routes
│   │   ├── models.py      # SQLAlchemy models
│   │   └── main.py
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/         # All app pages
│   │   ├── components/    # UI + Layout
│   │   └── lib/api.ts     # API client
│   └── Dockerfile
└── nginx/
    └── nginx.conf
```

## License

Private project — MotorClub IL
