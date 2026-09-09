#!/usr/bin/env bash
# Charge et latence de l'API avec ab (livré avec macOS), contre un serveur déjà lancé.
# Usage : tools/dev/charge.sh [URL] ; CHARGE_COMPTE / CHARGE_MDP pour le compte, CHARGE_C pour la concurrence.
set -euo pipefail

URL="${1:-http://localhost:4000}"
COMPTE="${CHARGE_COMPTE:-admin@cpi.sn}"
MDP="${CHARGE_MDP:-admin-local-2026}"
CONCURRENCES="${CHARGE_C:-15 50}"
REQUETES="${CHARGE_N:-1000}"
UA='Mozilla/5.0 (Macintosh) charge.sh'
ADRESSE='X-Forwarded-For: 10.99.0.1'

entete=$(curl -s -D - -o /dev/null "$URL/api/v1/auth/login" -H 'Content-Type: application/json' \
  -H "Origin: $URL" -H "$ADRESSE" -A "$UA" \
  --data "{\"identifier\":\"$COMPTE\",\"password\":\"$MDP\"}")
cookie=$(printf '%s' "$entete" | tr -d '\r' | awk -F': ' 'tolower($1)=="set-cookie"{print $2}' | cut -d';' -f1 | head -1)
[ -n "$cookie" ] || { echo "connexion refusée pour $COMPTE" >&2; printf '%s\n' "$entete" | head -1 >&2; exit 1; }

mesure() {
  local c="$1" n="$2" chemin="$3"
  shift 3
  local sortie
  sortie=$(ab -q -k -c "$c" -n "$n" -H "Cookie: $cookie" -H "$ADRESSE" -H "User-Agent: $UA" -H "Origin: $URL" "$@" "$URL$chemin" 2>&1)
  awk -v c="$c" -v chemin="$chemin" '
    /Requests per second/ {rps=$4}
    /Non-2xx responses/ {non2xx=$3}
    /Failed requests/ {echecs=$3}
    /^ +50%/ {p50=$2} /^ +95%/ {p95=$2} /^ +99%/ {p99=$2} /^ +100%/ {max=$2}
    END {printf "%-56s c=%-3s %8.0f req/s  p50 %4s  p95 %4s  p99 %4s  max %5s ms  non-2xx %s  échecs %s\n", chemin, c, rps, p50, p95, p99, max, non2xx+0, echecs+0}
  ' <<<"$sortie"
}

echo "cible $URL, compte $COMPTE, $REQUETES requêtes par point"
echo "== lecture, par concurrence"
for c in $CONCURRENCES; do
  for chemin in \
    /health/ready \
    / \
    /api/v1/auth/me \
    /api/v1/referentiels \
    /api/v1/prospects \
    '/api/v1/prospects?search=Prospect%204242' \
    /api/v1/representants \
    '/api/v1/representants?search=Repr%C3%A9sentant%20777' \
    /api/v1/phase2/callbacks \
    /api/v1/ouvertures/comptage \
    /api/v1/analytics/funnel \
    /api/v1/analytics/by-departement \
    /api/v1/admin/supervision \
    /api/v1/supervision/activite \
    /api/v1/users; do
    mesure "$c" "$REQUETES" "$chemin"
  done
done

echo "== export xlsx de 5 000 prospects, 10 requêtes"
mesure 2 10 /api/v1/export/prospects.xlsx

echo "== connexion argon2id, 10 requêtes (limiteur 10/min par adresse)"
corps=$(mktemp)
printf '{"identifier":"%s","password":"%s"}' "$COMPTE" "$MDP" >"$corps"
sortie=$(ab -q -c 5 -n 10 -p "$corps" -T application/json -H "Origin: $URL" -H 'X-Forwarded-For: 10.99.0.2' -H "User-Agent: $UA" "$URL/api/v1/auth/login" 2>&1)
rm -f "$corps"
awk '/Requests per second/{rps=$4} /Non-2xx/{n=$3} /^ +50%/{p50=$2} /^ +100%/{max=$2} END{printf "POST /api/v1/auth/login c=5 %6.1f req/s  p50 %s  max %s ms  non-2xx %s\n", rps, p50, max, n+0}' <<<"$sortie"

pid=$(pgrep -f 'cpi-go$' | head -1 || true)
[ -n "$pid" ] && echo "RSS du serveur après charge : $(ps -o rss= -p "$pid" | tr -d ' ') Ko"
