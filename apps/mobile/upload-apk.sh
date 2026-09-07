#!/usr/bin/env bash
# Usage: DOCKPLOY_TOKEN_CRM_BPE=... ./upload-apk.sh [notes]
set -euo pipefail

APK="${APK:-build/app/outputs/flutter-apk/app-release.apk}"
NOTES="${1:-Version $(grep '^version:' pubspec.yaml | awk '{print $2}')}"
API="https://go.cpi-chues.com/api/v1"
UA='Mozilla/5.0'

: "${DOCKPLOY_TOKEN_CRM_BPE:?export DOCKPLOY_TOKEN_CRM_BPE first}"
[ -f "$APK" ] || { echo "APK introuvable: $APK"; exit 1; }

PW=$(curl -sf -A "$UA" -H "x-api-key: $DOCKPLOY_TOKEN_CRM_BPE" \
  'https://dokploy.cpi-chues.com/api/application.one?applicationId=dSsdgb5LFEWuscXIaBHU4' \
  | jq -r '.env | split("\n")[] | select(startswith("SEED_ADMIN_PASSWORD=")) | sub("^SEED_ADMIN_PASSWORD="; "")')

TOKEN=$(curl -sf -A "$UA" "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"identifier\":\"admin\",\"password\":\"$PW\"}" | jq -r .accessToken)

echo "Upload de $APK ($(du -h "$APK" | cut -f1))"
curl -A "$UA" "$API/app-updates/android" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$APK;filename=cpi-go.apk" \
  -F "notes=$NOTES" \
  -w '\nhttp=%{http_code} time=%{time_total}s\n'

echo "Release en ligne :"
curl -s -A "$UA" "$API/app-updates/android/current?versionCode=1" | jq .
