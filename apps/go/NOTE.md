# Dernière étape : ranger `apps/go` par domaine

À faire UNIQUEMENT quand tout le reste est livré et vert (écrans, parcours
Playwright, lint, tests). Décision du propriétaire du 9 septembre 2026.

## Cible

```
apps/go/
  cmd/server/main.go            démarrage, drapeaux, config, planification
  internal/
    auth/  referentiels/  representants/  prospects/  qualification/
    campagnes/  exports/  banque/  accueil/  admin/  notifications/
    imports/  analytics/
    shared/
      http/        middleware, erreurs RFC 9457, garde des rôles, live SSE
      database/    pool, migrations goose, audit, argon, téléphone
  db/                            sqlc, généré, non commité
  sql/                           schema.sql, queries/, migrations/
  web/  e2e/
```

Dans un domaine : `handler.go`, `service.go`, `types.go` seulement si le
domaine est assez gros ; un domaine petit reste un seul fichier. Pas de
`repository.go` : le package `db` généré par sqlc est déjà la couche d'accès
aux données, en ajouter une contredit `AGENTS.md` (« pas de couche
repository »).

## Règles

- Déplacer, ne pas réécrire : un fichier de domaine devient un package, ses
  identifiants utilisés hors du domaine passent en exporté, rien d'autre ne
  change. Comportement identique, `openapi.json` identique (le vérifier au
  diff), tests identiques.
- N'extraire dans `shared/` que ce qui a déjà au moins deux appelants réels
  (`ecrireProblem`, `problem`, `garde`, `auditer`, `normaliserTelephone`,
  `hacherMotDePasse`, `live`, `cache`). Pas de dossier `utils`.
- Aucune interface tant qu'il n'existe pas deux implémentations.
- Les requêtes restent dans `sql/queries/`, un fichier par domaine, et `db/`
  reste généré et non commité.
- Handlers courts ; la logique va dans `service.go` seulement quand elle
  dépasse ce qu'un handler linéaire porte lisiblement.
- Les helpers de test dupliqués (`banqueJSON`, `representantJSON`, `appel`
  par domaine) se réduisent à un seul jeu dans un package de test partagé
  sous tag `integration`.
- Une seule passe de déplacement d'abord, verte de bout en bout ; la passe
  DRY vient ensuite, sur des duplications prouvées par `dupl`, pas devinées.

## Ce qui change mécaniquement

- `service` (un seul struct partagé) devient un struct par domaine portant
  `*db.Queries`, `*pgxpool.Pool`, la config et le bus `live`.
- `domaines.go` (ancres `monter:`, `garde:`, `taches:`) devient une liste
  explicite dans `cmd/server/main.go` : chaque package expose `Monter(api,
  deps)`, `Garde()` et `Taches(deps)`.
- Le préfixe de domaine sur les identifiants (`banqueX`, `prospectY`) devient
  inutile dans un package séparé : le retirer au passage, sans changer les
  noms de routes, de champs JSON ni de codes d'erreur.
- `roles.go` et `verifierGarde` restent uniques, dans `shared/http`.
- Les plafonds de la CI (1 500 lignes par fichier, tests sous tag) s'appliquent
  aux nouveaux chemins : mettre à jour les motifs `git ls-files` du job `go`.

## Ordre

1. `git mv` par domaine, `package` renommé, exports, `go build` vert.
2. `make lint`, `make test`, `go run ./cmd/server -openapi` : diff vide sur
   `openapi.json`.
3. Passe DRY sur les doublons signalés par `dupl` et les helpers de test.
4. `Dockerfile.go`, `Makefile`, `README.md`, `ci.yml` : chemins mis à jour.

# Étape suivante : purger la v1 et faire de `apps/go` la racine

Décision du propriétaire du 9 septembre 2026. Après le rangement par domaine,
après J+7 (`docs/v2-refonte/plan.md` §7 : la v1 ne redémarre plus, la garder
ne protège plus rien), et seulement une fois tout commité et vert. Aujourd'hui
`git ls-files apps/go` compte 21 fichiers sur une soixantaine : rien de ce qui
suit ne commence avant que le reste soit dans git.

## Règle

Un fichier hors de `apps/go` survit uniquement s'il est prouvé nécessaire au
binaire Go, au panneau, aux parcours Playwright, à l'image Docker, au
déploiement ou à la CI du job `go`. La preuve est un `grep` de son chemin
depuis `apps/go`, `Makefile`, `Dockerfile.go`, `deploy.py`, `ci.yml` (job `go`
seul) ou `sonar-project.properties`. Sans occurrence, il part. Le doute se
tranche en supprimant : `git revert` existe, l'inverse n'existe pas.

Pas de réécriture d'historique. `git rm` et `git mv` suffisent, `git log
--follow` retrouve tout, et les 212 000 lignes générées dans l'historique ne
coûtent rien à personne.

## Ce qui part, et pourquoi

| Chemin | Pourquoi | Preuve |
| --- | --- | --- |
| `apps/api`, `apps/web` | remplacés par le binaire et le panneau | `plan.md` §2.1 |
| `packages/api-client*`, `packages/database`, `packages/eslint-config` | contrat OpenAPI v1, Prisma, lint Nest | aucune référence hors v1 après le point « base » ci-dessous |
| `packages/typescript-config` | un seul `tsconfig.base.json` à la racine, deux consommateurs (`web`, `e2e`), pas de package | `web/package.json`, `e2e/package.json` |
| `turbo.json`, `openapitools.json`, `.oxlintrc.complexity.json`, `.nvmrc`, `.node-version` (l'un des deux) | orchestration et codegen v1 | `package.json` racine |
| `tools/dev/dx.mjs`, `generate-dart-client.mjs`, `generate-plateforme-client.mjs` | v1 ; `plafonds.sh` reste | |
| `infra/docker/Dockerfile.api`, `Dockerfile.web`, `api-entrypoint.sh`, `Caddyfile`, `backup.sh`, `docker-compose*.yml`, `production.env.example` | Dokploy construit depuis `Dockerfile.go` ; `Caddyfile` et `backup.sh` ne servent pas en production (`plan.md` §7) | |
| `.github/workflows/quality-extended.yml`, job `mobile`, `node`, `contract`, `sonar` (à reconfigurer), `.github/actions/setup-node` | mobile abandonné, Nest et contrat disparus | |
| `.maestro`, `.migration`, `logs`, `scratchpad`, `Plan.md`, `E2E.md`, `TODO.md`, `commentaire`, `t` | notes de travail v1 posées à la racine ; ce qui vaut encore va dans `docs/`, le reste part | |
| `docs/adr`, `docs/qa-mobile`, `docs/superpowers`, `docs/audit-chues-ux-ui-2026-09-01.md`, `docs/design.md`, `docs/migrations-en-attente.md`, `docs/troubleshoot.md`, `docs/QUALITY.md` | décrivent la v1 ; `QUALITY.md` est réécrit en dix lignes sur le job `go` | |
| `.env` racine, `.gitleaksignore` (à relire), `.prettierignore` (à réduire) | | |

Reste : `docs/v2-refonte/` entier, comme archive des décisions, même si ses
`chemin:ligne` v1 ne pointent plus sur rien ; `AGENTS.md` et `CLAUDE.md` ;
`.claude/agents` et `.codex/agents` ; `infra/dokploy/deploy.py` et son
`README.md` ; `security.yml` ; `.gitleaksignore` relu ;
`dexie-implementation.md`, gardé par décision du propriétaire du 9 septembre,
déplacé dans `docs/` au moment de la purge. C'est un document, pas une
décision : « ni sync » (`plan.md` §2.1) reste en vigueur tant que le plan ne
dit pas autre chose.

## Ce que le Go tient encore de la v1, à couper avant de purger

| Dépendance | Aujourd'hui | Après |
| --- | --- | --- |
| Base de test et base locale | `Makefile` cible `db` et job `go` de `ci.yml` rejouent `packages/database/prisma/migrations/*/migration.sql` | `sql/schema.sql` (déjà le `pg_dump` de la v1, 2 036 lignes) appliqué par `psql -f`, puis goose. Retirer `CREATE SCHEMA public` et `_prisma_migrations` du dump. À prouver sur une base vide : `dropdb`, `make db`, `make test` |
| `catalog:` de `pnpm-workspace.yaml` | `web` et `e2e` déclarent `catalog:` sur ~40 paquets | `pnpm-workspace.yaml` racine réduit à `packages: [web, e2e]` et au catalogue de ces deux-là, sans les entrées Nest, Fastify, Redis, Next, Prisma |
| `@crm/typescript-config` | `workspace:*` dans `web` et `e2e` | `tsconfig.base.json` à la racine, `extends` relatif |
| `.oxlintrc.json` | `--config ../../../.oxlintrc.json` | `../.oxlintrc.json` ; retirer les plugins `nextjs` et `vitest`, la règle `nextjs/no-img-element` et les `overrides` |
| `knip.json` | quatre workspaces v1 | `web` et `e2e` seulement |
| `sonar-project.properties` | `sonar.tests=apps/api/src,apps/web/e2e` | `sonar.tests=.,e2e`, `sonar.test.inclusions=**/*_integration_test.go,**/*.spec.ts`, `sonar.exclusions=db/**,web/dist/**,web/src/api/schema.d.ts` |
| `Dockerfile.go` | contexte racine, `COPY apps/go/...` | `COPY . .`, `Dockerfile` à la racine ; `deploy.py` : chemin du Dockerfile et contexte |
| `tools/dev/plafonds.sh`, `package.json` racine | motifs `apps/go/*.go`, `apps/go/web/src` ; scripts `lint`, `dead-code`, `plafonds`, `lint:go`, `complexite:go`, `verify:local` | motifs `*.go`, `web/src` ; scripts gardés, `turbo lint` remplacé par `pnpm -r lint` |
| `ci.yml` | sept jobs, `deploy` attend `node`, `contract`, `mobile`, `sonar`, `securite` | `go`, `securite`, `sonar`, `deploy` ; `deploy` attend `go`, `securite`, `sonar` ; le job `go` ajoute `pnpm -r lint` et `typecheck` du panneau, qui n'y sont pas aujourd'hui |
| `AGENTS.md`, `README.md` | chemins `apps/go`, sections Nest, mobile, `codegen` | réécrits pour la seule pile Go + panneau ; `README.md` est celui de `apps/go` complété par le déploiement |

## Arborescence cible

```
.
  cmd/server/main.go
  internal/                     domaines, shared/http, shared/database
  sql/                          schema.sql, queries/, migrations/
  db/                           généré, non commité
  web/  e2e/
  infra/dokploy/deploy.py
  docs/v2-refonte/
  .github/workflows/            ci.yml, security.yml
  .claude/agents  .codex/agents
  Dockerfile  Makefile  go.mod  go.sum  sqlc.yaml  .golangci.yml
  package.json  pnpm-workspace.yaml  pnpm-lock.yaml  tsconfig.base.json
  .oxlintrc.json  .prettierrc  knip.json  sonar-project.properties
  AGENTS.md  CLAUDE.md  README.md  .env.example  .gitignore
```

## Ordre

1. Couper les dépendances du tableau ci-dessus une par une, `make setup`
   sur une base vide, `make lint`, `make test`, `make e2e` verts à chaque
   coupe. Commit par coupe.
2. `git rm -r` de tout ce que le premier tableau liste. `pnpm install` :
   `pnpm-lock.yaml` régénéré, sans une entrée v1.
3. `git mv apps/go/* apps/go/.* .` puis `git rm -r apps`. Chemins de
   `Dockerfile`, `deploy.py`, `ci.yml`, `plafonds.sh`, `sonar-project.properties`
   mis à jour dans le même commit.
4. Preuve finale sur un clone frais : `dropdb cpi_v2_dev`, `make setup`,
   `make lint`, `make test`, `make e2e`, `docker build .`, `python3
   infra/dokploy/deploy.py redeploy cpi-go` sur l'environnement de test.
   Le nombre total de lignes suivies par git est relevé et inscrit dans
   `plan.md` §1 à côté des 165 000 de départ.
5. `.claude/settings.local.json` et les mémoires d'assistant qui citent
   `apps/api`, `apps/web`, `apps/mobile` ou Prisma sont corrigées ou
   supprimées, sinon les assistants continueront à chercher la v1.
