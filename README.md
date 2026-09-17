# CPI CRM

Le CRM de la Compagnie Prestige Immobilier : un binaire Go qui sert l'API, le
panneau React embarqué et les tâches planifiées, sur une base Postgres.
Conventions de travail dans `AGENTS.md`, cap et arbitrages de la v2 dans
`docs/v2-refonte/plan.md`.

## Prérequis

| Outil    | Version                      |
| -------- | ---------------------------- |
| Go       | 1.26 (`go.mod`)              |
| Node     | 24 (`.node-version`)         |
| pnpm     | 11 (`package.json`)          |
| Postgres | 18, local, sans mot de passe |

## Démarrer

```
cp .env.example .env
make setup   # crée cpi_v2_dev, sème référentiels et comptes, dépendances, code généré
make dev     # API sur :4000, Vite sur :5173
```

Compte par défaut : `admin@cpi.sn` / `admin-local-2026` (seed de développement).

## Commandes

```
make build   # panneau embarqué + binaire ./cpi-go
make test    # tests d'intégration Go contre la base
make e2e     # build puis parcours Playwright contre le binaire
make lint    # golangci-lint, sqlc vet, lint du panneau
make gen     # sqlc, OpenAPI, types TypeScript du panneau

pnpm verify:local   # format, lint, code mort, types, plafonds, golangci-lint
pnpm complexite:go  # dix fonctions les plus complexes
```

Les parcours Playwright se lancent avec `--workers=29` depuis `e2e/`.

## Arborescence

```
cmd/server/            démarrage, drapeaux, config, crons, tests d'intégration
internal/<domaine>/    un package par domaine : auth, referentiels, representants,
                       prospects, qualification, campagnes, exports, banque, accueil,
                       admin, notifications, imports, analytics
internal/shared/       socle (middleware, erreurs RFC 9457, rôles, session, SSE)
                       et database (migrations goose, audit, argon2id, téléphone)
sql/                   schema.sql (référence), queries/ (sqlc), migrations/ (goose)
web/                   panneau React repris de la v1, SPA Vite embarquée
e2e/                   parcours Playwright, un par métier
infra/dokploy/         deploy.py et son mode d'emploi
tools/dev/             plafonds.sh, charge.sh
docs/                  QUALITY.md, decisions/, v2-refonte/ (plan et audits)
```

Rien de généré n'est commité : `db/`, `openapi.json`, `web/dist/`,
`web/src/api/*.d.ts` et `web/src/routeTree.gen.ts` se rebâtissent au build.

## Drapeaux du binaire

`-openapi` écrit le contrat sur stdout, `-roles` la matrice des rôles, `-seed`
sème référentiels, admin (`SEED_ADMIN_*`) et comptes de démonstration hors
production, `-healthcheck` interroge le serveur.

## Plusieurs bases

`DATABASE_URL` est la base principale. Chaque `DATABASE_URL_<NOM>` en ajoute
une, choisie sur la page de connexion par `⌘/Ctrl+Shift+D` ou `N`. Une base de
démonstration se crée comme la première, puis reçoit le même seed :

```
createdb cpi_v2_demo && psql cpi_v2_demo -v ON_ERROR_STOP=1 -q -f sql/schema.sql
DATABASE_URL=postgres://localhost:5432/cpi_v2_dev?sslmode=disable \
DATABASE_URL_DEMO=postgres://localhost:5432/cpi_v2_demo?sslmode=disable \
NODE_ENV=development go run ./cmd/server -seed
```

## Déploiement

`Dockerfile` construit le panneau puis le binaire. La CI
(`.github/workflows/ci.yml`) ne tourne que sur `dev` et ne construit aucune
image. `prod` n'a pas de CI : Dokploy tire la branche en git et construit le
Dockerfile. Ne fusionner vers `prod` qu'un commit vert sur `dev`.
Les migrations goose s'appliquent au démarrage. Avant chaque `git push`,
`lefthook` exécute `pnpm verify:local` (installé par `pnpm install`). En production les logs sont en JSON
(`LOG_FORMAT=json`), chaque ligne porte `requestId`, `pattern`, `status` et
`ms`. Le reste des commandes est dans `infra/dokploy/README.md`.
