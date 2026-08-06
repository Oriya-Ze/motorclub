#!/usr/bin/env bash
# Run Alembic migrations against Neon from your laptop.
# Usage: ./scripts/migrate-neon.sh [.env.neon]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/.env.neon"

if [[ $# -ge 1 && -f "$1" ]]; then
  ENV_FILE="$1"
  shift
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing ${ENV_FILE}"
  echo "Copy .env.neon.example to .env.neon and set DATABASE_URL to your Neon URL."
  exit 1
fi

if [[ ! -x "${ROOT}/.venv/bin/alembic" ]]; then
  echo "Missing ${ROOT}/.venv/bin/alembic — create the venv and install requirements first."
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ -z "${DATABASE_URL:-}" || "$DATABASE_URL" == *"USER:PASSWORD"* || "$DATABASE_URL" == *"://..."* ]]; then
  echo "DATABASE_URL in ${ENV_FILE} is missing or still a placeholder."
  echo "Set the full Neon URL: postgresql+asyncpg://user:pass@host/neondb?ssl=require"
  exit 1
fi

export ENVIRONMENT=local
cd "$ROOT"
exec .venv/bin/alembic "$@"
