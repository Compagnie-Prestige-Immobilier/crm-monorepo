#!/bin/sh
#
# Point d'entrée de l'API : migrations, puis démarrage.
#
# ─────────────────────────────────────────────────────────────────────────────
# POURQUOI LES MIGRATIONS SONT ICI
#
# `docker-compose.prod.yml` a un service `migrate` dédié qui tourne avant l'API.
# Les plateformes de déploiement — Dokploy, Railway, Fly — n'ont pas cette
# notion : une application y est un seul conteneur. Sans ces lignes, l'API
# démarre sur une base sans tables et répond 500 à toute requête, avec un
# message qui ne dit rien de la cause.
#
# `prisma migrate deploy` est sûr à rejouer :
#   • il n'applique que les migrations absentes de `_prisma_migrations` ;
#   • il prend un verrou consultatif PostgreSQL, donc plusieurs répliques
#     démarrant ensemble ne se marchent pas dessus — les autres attendent.
#
# En cas d'échec, on N'ENTRE PAS dans l'application. Servir une API sur un
# schéma faux est pire que ne rien servir : les écritures partiraient dans des
# colonnes qui n'existent pas, et l'erreur ne se verrait qu'à la première
# synchronisation d'un commercial, sur le terrain.
# ─────────────────────────────────────────────────────────────────────────────

set -e

echo "▸ Migrations de la base…"
cd /repo/packages/database
if ! node_modules/.bin/prisma migrate deploy; then
  echo "✗ Migrations en échec — l'API ne démarre pas." >&2
  echo "  Vérifiez DATABASE_URL et que Postgres est joignable." >&2
  exit 1
fi
echo "✓ Base à jour."

# ── Amorçage ────────────────────────────────────────────────────────────────
# Les référentiels — 46 départements, banques, syndicats, workflow bancaire —
# sont des clés étrangères OBLIGATOIRES : sans eux, aucune saisie n'est
# possible et même la connexion échoue faute de compte.
#
# Le seed est idempotent : chaque entité est écrite en `upsert` sur sa clé
# naturelle, et le mot de passe d'un compte existant n'est JAMAIS réécrit — un
# redémarrage ne remet donc pas le mot de passe de l'administrateur à la valeur
# du fichier d'environnement.
#
# `SEED_ON_START=false` permet de le couper une fois la plateforme en service.
if [ "${SEED_ON_START:-true}" = "true" ]; then
  echo "▸ Référentiels et compte initial…"
  if node dist/seed.js; then
    echo "✓ Référentiels en place."
  else
    # Volontairement non bloquant : une base déjà peuplée doit pouvoir
    # redémarrer même si le seed bute sur un détail. Les migrations, elles,
    # restent bloquantes — un schéma faux est irrattrapable, un référentiel
    # manquant se corrige depuis le panel.
    echo "! Amorçage incomplet — l'API démarre quand même." >&2
  fi
fi

cd /repo
# `exec` remplace le shell : Node devient PID 1 et reçoit SIGTERM directement,
# donc Nest ferme proprement le pool pg au lieu d'être tué au bout du délai de
# grâce.
exec node apps/api/dist/main.js
