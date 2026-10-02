#!/bin/bash
# Claude Code cloud sessions: install deps and bring up the container's
# preinstalled Postgres so DB-backed tests run. Idempotent; safe to re-run.
#
# Register as a SessionStart hook in .claude/settings.json:
#   "command": "$CLAUDE_PROJECT_DIR/scripts/cloud-db-setup.sh"
# or call it from the cloud environment's setup script.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/..}"

# .env is gitignored; seed it from the example. Its DATABASE_URL is
# postgres:postgres@localhost:5432/festgrid, which is what gets provisioned below.
if [ ! -f .env ]; then
  cp .env.example .env
fi
# The backend env loader requires BACKEND_PORT, which .env.example doesn't define.
if ! grep -q '^BACKEND_PORT=' .env; then
  echo 'BACKEND_PORT="4000"' >> .env
fi

service postgresql start >/dev/null
for _ in $(seq 1 30); do
  pg_isready -q && break
  sleep 1
done
su postgres -c "psql -q -c \"ALTER USER postgres PASSWORD 'postgres';\""
if ! su postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname = 'festgrid'\"" | grep -q 1; then
  su postgres -c "psql -q -c 'CREATE DATABASE festgrid;'"
fi

pnpm install --frozen-lockfile
if [ -f _bmad-output/specs/ritual-session-orchestrator/mailbox-runner/package.json ]; then
  (cd _bmad-output/specs/ritual-session-orchestrator/mailbox-runner && npm install --no-audit --no-fund)
fi

set -a
. ./.env
set +a
pnpm --filter @festgrid/database migrate

# Time-zone-dependent fixtures assume UTC (FIND-062)
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo 'export TZ=UTC' >> "$CLAUDE_ENV_FILE"
fi
