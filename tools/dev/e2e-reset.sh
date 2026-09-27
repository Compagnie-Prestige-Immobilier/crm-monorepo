#!/usr/bin/env bash
# Recree les bases des parcours depuis zero : schema, migrations, comptes
# fixtures et jeu de demonstration. Refuse toute base hors de ce poste.
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${E2E_DB:?}" "${E2E_DB_DEMO:?}" "${E2E_URL:?}"
GOOSE="go run github.com/pressly/goose/v3/cmd/goose@v3.28.0"
for url in "$E2E_DB" "$E2E_DB_DEMO"; do
  hote=$(printf '%s' "$url" | sed -E 's#^postgres(ql)?://##; s#[/?].*##; s#.*@##; s#:[0-9]*$##')
  case "$hote" in localhost|127.0.0.1) ;; *) echo "base hors du poste refusee : $url" >&2; exit 1 ;; esac
  base=$(printf '%s' "$url" | sed -E 's#^[^/]*//[^/]*/##; s#\?.*##')
  maintenance=$(printf '%s' "$url" | sed -E "s#/$base#/postgres#")
  psql "$maintenance" -v ON_ERROR_STOP=1 -q -c "DROP DATABASE IF EXISTS \"$base\" WITH (FORCE)" -c "CREATE DATABASE \"$base\""
  psql "$url" -v ON_ERROR_STOP=1 -q -f sql/schema.sql
  $GOOSE -dir sql/migrations postgres "$url" up >/dev/null
done
DATABASE_URL="$E2E_DB" DATABASE_URL_DEMO="$E2E_DB_DEMO" PUBLIC_WEB_URL="$E2E_URL" LOG_FORMAT=text \
  SEED_FIXTURE_PASSWORD="${SEED_FIXTURE_PASSWORD:-fixtures-e2e-2026}" go run ./cmd/server -seed
