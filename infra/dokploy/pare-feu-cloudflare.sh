#!/usr/bin/env bash
# À lancer en root SUR le VPS : n'accepte 80 et 443 que depuis Cloudflare,
# garde SSH ouvert, refuse le reste. Les plages viennent du site de Cloudflare
# au moment de l'exécution ; relancer le script quand elles changent.
set -euo pipefail

ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'

for plage in $(curl -fsS https://www.cloudflare.com/ips-v4) $(curl -fsS https://www.cloudflare.com/ips-v6); do
  ufw allow proto tcp from "$plage" to any port 80,443 comment 'Cloudflare'
done

ufw --force enable
ufw status numbered
