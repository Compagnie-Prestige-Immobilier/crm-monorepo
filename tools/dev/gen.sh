#!/usr/bin/env bash
# Tout le code engendre, jamais versionne : requetes sqlc, OpenAPI, types et
# routes du panneau. Un fichier perime fait echouer le typage bien plus loin.
set -euo pipefail
cd "$(dirname "$0")/../.."
[ -f web/dist/index.html ] || { mkdir -p web/dist && touch web/dist/index.html; }
go run github.com/sqlc-dev/sqlc/cmd/sqlc@v1.31.1 generate
go run ./cmd/server -openapi > openapi.json
pnpm --dir web gen
pnpm --dir web exec vite build --logLevel warn
