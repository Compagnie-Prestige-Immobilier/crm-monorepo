#!/usr/bin/env bash
# Publie l'APK Shorebird courant sur la prod, via le contournement d'origine
# Cloudflare (plafond d'upload 60 s). Version-agnostique : lit la version et le
# sha256 de l'APK réellement présent.
#
# À LANCER DANS UN VRAI TERMINAL (Terminal.app), pas via `!` : le prompt de mot
# de passe a besoin d'un TTY. Le mot de passe n'est ni affiché ni stocké.
#
# Garde-fou : refuse d'uploader tant que le backend prod ne renvoie pas les
# nouveaux champs de qualification — impossible de livrer l'APK avant l'API.
set -euo pipefail

HOST="go.cpi-chues.com"
ORIGIN="72.61.198.237"
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
APK="/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/build/app/outputs/flutter-apk/app-release.apk"

[ -f "$APK" ] || { echo "APK introuvable: $APK"; exit 1; }
echo "APK local : sha256=$(shasum -a 256 "$APK" | cut -d' ' -f1)"

before=$(curl -s -A "$UA" "https://$HOST/api/v1/app-updates/android/current?versionCode=1")
echo "Publié actuellement : versionCode=$(echo "$before" | grep -o '"versionCode":[0-9]*' | head -1 | cut -d: -f2)"

# Mot de passe : env ADMIN_PW si fourni, sinon prompt TTY.
if [ -z "${ADMIN_PW:-}" ]; then
  read -rsp "Mot de passe admin prod : " ADMIN_PW; echo
fi
TOKEN=$(curl -s -A "$UA" -X POST "https://$HOST/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"identifier\":\"admin\",\"password\":\"$ADMIN_PW\"}" \
  | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
unset ADMIN_PW
[ -n "$TOKEN" ] || { echo "Login échoué (mauvais mot de passe, ou backend injoignable)."; exit 1; }
echo "Login OK."

echo "== Garde-fou : backend prod porte les nouveaux champs ? =="
rep=$(curl -s -A "$UA" -H "Authorization: Bearer $TOKEN" \
  "https://$HOST/api/v1/representants?pageSize=1")
if ! echo "$rep" | grep -q '"connaitUES"'; then
  echo "STOP : l'API prod ne renvoie pas encore \"connaitUES\" — déploiement backend"
  echo "pas terminé. Attends que Dokploy soit vert, puis relance ce script."
  echo "(aucun APK n'a été uploadé)"
  exit 2
fi
echo "OK : backend à jour."

echo "== Upload APK (origine directe, UA navigateur) =="
curl --resolve "$HOST:443:$ORIGIN" -A "$UA" \
  -X POST "https://$HOST/api/v1/app-updates/android" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$APK;type=application/vnd.android.package-archive" \
  -F "notes=1.1.0 : annuaire représentants en recherche seule, syndicat en liste déroulante, question « confirmer le numéro » retirée" \
  -w '\nHTTP %{http_code}\n'

echo "== Vérif publication =="
curl -s -A "$UA" "https://$HOST/api/v1/app-updates/android/current?versionCode=1" \
  | grep -o '"versionCode":[0-9]*\|"sha256":"[^"]*"\|"signerSha256":"[^"]*"' | head -3
echo
echo "Le versionCode publié doit valoir 13, et le sha256 doit égaler celui affiché"
echo "en tête (« APK local »). Le signerSha256 doit être 0cd1809449d3dde6…"
