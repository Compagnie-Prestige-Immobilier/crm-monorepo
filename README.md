# CPI GO — Prospection terrain

Suivi de la prospection terrain CPI : un **commercial** enregistre un **représentant**, qui lui
remet une liste de **prospects** intéressés. Le siège lit, filtre, analyse et exporte.

| Application   | Rôle                                                                         |
| ------------- | ---------------------------------------------------------------------------- |
| `apps/api`    | NestJS 11 sur Fastify — seule source du contrat OpenAPI                      |
| `apps/web`    | Next.js 16 — panel admin : dashboard Chart.js, table filtrable, export Excel |
| `apps/mobile` | Flutter — app terrain Android, **offline-first**                             |

Le terrain sénégalais a un réseau incertain. L'app mobile écrit **toujours** en local d'abord ;
la synchronisation est un détail d'infrastructure, visible seulement via une icône d'état par
ligne. Elle n'est jamais sur le chemin critique d'une saisie.

## Prérequis

Node 24.18.0 · pnpm 11.15.1 · Docker · Flutter 3.41.7 · JDK 21 (pour le générateur OpenAPI)

## Démarrer

```bash
cp .env.example .env          # puis renseigner les deux secrets JWT
docker compose -f infra/docker/docker-compose.yml up -d
pnpm install
pnpm db:migrate && pnpm db:seed
pnpm dev                      # API :3001 (docs /api/docs) · web :3000
```

Mobile :

```bash
cd apps/mobile && flutter run
```

## Règle non négociable : rien n'est écrit à la main dans les clients

```
apps/api  ──(@nestjs/swagger, boot headless)──▶  apps/api/openapi.json
                          │
        ┌─────────────────┴─────────────────┐
        ▼                                   ▼
packages/api-client/src/generated     apps/mobile/lib/api/generated
   (openapi-typescript)                 (openapi-generator, dart-dio)
```

`pnpm codegen:check` régénère tout puis exige un `git diff` vide. La CI en fait un bloquant :
une modification manuelle d'un client généré casse le build.

## Documentation

- [`docs/design.md`](docs/design.md) — tokens de design, source unique pour le web **et** le mobile
- `docs/adr/` — décisions d'architecture
