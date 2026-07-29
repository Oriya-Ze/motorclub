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

# 2. Start all services
docker compose up --build

# 3. Open the app
# Frontend (direct):  http://localhost:5173
# Via Nginx:          http://localhost
# API docs:           http://localhost:8000/docs
# Health check:       http://localhost:8000/health
```

## Register & Test

1. Open http://localhost:5173/auth
2. Click **הרשמה** (Sign Up)
3. Fill in name, username, email, password (min 8 chars, letter + number)
4. Explore: Feed, Groups, Forums, Events, Marketplace, Services

Seed data includes demo forums, events, and groups on first startup.

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
