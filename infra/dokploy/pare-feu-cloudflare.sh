#!/usr/bin/env bash
# À lancer en root sur le VPS, Docker démarré, après chaque redémarrage et quand Cloudflare change ses plages.
# Les ports publiés par Docker (Traefik) passent par FORWARD, hors de portée d'ufw : le filtre vit dans DOCKER-USER.
set -euo pipefail

chaine=CLOUDFLARE-ORIGINE

plages() {
  local liste
  liste=$(curl -fsS --max-time 20 "https://www.cloudflare.com/ips-$1") || exit 1
  if ! grep -Eqx "$2" <<<"$liste" || grep -Evqx "$2" <<<"$liste" || [ "$(wc -l <<<"$liste")" -lt "$3" ]; then
    echo "plages Cloudflare $1 illisibles, aucune règle modifiée :" >&2
    echo "$liste" >&2
    exit 1
  fi
  echo "$liste"
}

interface_publique() {
  ip "$1" route show default | awk '{ for (i = 1; i < NF; i++) if ($i == "dev") { print $(i + 1); exit } }'
}

appliquer() {
  local outil=$1 interface=$2 liste=$3 parent port regle
  {
    echo '*filter'
    echo ":$chaine - [0:0]"
    for plage in $liste; do echo "-A $chaine -s $plage -j RETURN"; done
    echo "-A $chaine -j DROP"
    echo 'COMMIT'
  } | "$outil-restore" --noflush
  for parent in DOCKER-USER INPUT; do
    "$outil" -w -n -L "$parent" >/dev/null 2>&1 || continue
    for port in 80 443; do
      regle=(-i "$interface" -p tcp -m conntrack --ctstate NEW --ctorigdstport "$port" -j "$chaine")
      "$outil" -w -C "$parent" "${regle[@]}" 2>/dev/null || "$outil" -w -I "$parent" 1 "${regle[@]}"
    done
  done
  echo "$outil : $(wc -l <<<"$liste") plages, interface $interface"
}

v4=$(plages v4 '[0-9]{1,3}(\.[0-9]{1,3}){3}/[0-9]{1,2}' 10)
v6=$(plages v6 '[0-9a-f:]+/[0-9]{1,3}' 5)
interface_v4=$(interface_publique -4)
interface_v6=$(interface_publique -6)
[ -n "$interface_v4" ] || { echo "aucune route IPv4 par défaut, aucune règle modifiée" >&2; exit 1; }
iptables -w -n -L DOCKER-USER >/dev/null || { echo "chaîne DOCKER-USER absente : démarrer Docker d'abord" >&2; exit 1; }

appliquer iptables "$interface_v4" "$v4"
if [ -n "$interface_v6" ]; then
  appliquer ip6tables "$interface_v6" "$v6"
else
  echo "ip6tables : aucune route IPv6 par défaut, rien à filtrer"
fi
