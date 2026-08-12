#!/bin/bash
# Extra database for @selecta/db integration tests (same Postgres instance).
# Only runs on first volume init; existing installs use `pnpm db:test:prepare`.
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -c "CREATE DATABASE selecta_test;"
