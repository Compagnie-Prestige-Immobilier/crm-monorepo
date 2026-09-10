# CPI CRM

Un binaire Go : API, panneau React embarqué, crons. Cible et arbitrages dans
`docs/v2-refonte/plan.md`, conventions dans `AGENTS.md`.

```
make setup   # base cpi_v2_dev depuis sql/schema.sql, dépendances, sqlc, OpenAPI, types
make dev     # API sur :4000 et Vite sur :5173, logs lisibles
make test    # tests d'intégration contre la base
make lint    # golangci-lint, sqlc vet sur la base, lint du panneau
make build   # panneau embarqué + binaire ./cpi-go
make e2e     # build puis parcours Playwright contre le binaire et la base locale
```

Drapeaux du binaire : `-openapi` (contrat sur stdout), `-roles` (matrice des
rôles), `-seed` (référentiels, admin `SEED_ADMIN_*`, comptes de démonstration
hors production), `-healthcheck`. Le panneau (`web/`) est embarqué : un
changement d'écran se voit après `make build`, ou en direct avec `make dev`.

```
cmd/server/            démarrage, drapeaux, config, planification des crons, tests d'intégration
internal/<domaine>/    un package par domaine : auth, referentiels, representants, prospects,
                       qualification, campagnes, exports, banque, accueil, admin, notifications,
                       imports, analytics ; chacun expose Monter(api, deps), Garde et Taches(deps)
internal/shared/socle/ middleware, erreurs RFC 9457, garde des rôles, session, SSE, config
internal/shared/database/ migrations goose, audit, argon2id, téléphone
sql/                   schema.sql, queries/ (sqlc), migrations/ (embarquées)
db/                    généré par sqlc, non commité
web/  e2e/             panneau v1 repris tel quel (SPA Vite embarquée), parcours Playwright
infra/dokploy/         deploy.py, pilotage de Dokploy
```

Variables dans `.env.example`. En production les logs sont en JSON
(`LOG_FORMAT=json`) ; chaque ligne porte `requestId`, `pattern`, `status`,
`ms`, et toute erreur 5xx est journalisée avec le même `requestId` que le
corps de réponse.

`sql/schema.sql` est le schéma de référence (`pg_dump --schema-only` de la
base v1). Les migrations v2 sont dans `sql/migrations/` (goose, appliquées au
démarrage).

## Déploiement

`Dockerfile` à la racine construit le panneau puis le binaire. Dokploy est
branché en « custom git » : une fusion vers `prod` passe la CI
(`.github/workflows/ci.yml`) puis lance `python3 infra/dokploy/deploy.py
redeploy cpi-go`. Le reste des commandes (`provision`, `configure`, `bascule`,
`retour`, `backup`, `status`) est décrit dans `infra/dokploy/README.md`.
