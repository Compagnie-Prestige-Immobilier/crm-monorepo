# apps/go

Binaire v2 : API, panneau embarqué, crons. Cible et arbitrages dans
`docs/v2-refonte/plan.md`.

```
make setup   # base cpi_v2_dev avec le schéma v1, dépendances, sqlc, OpenAPI, types
make dev     # API sur :4000 et Vite sur :5173, logs lisibles
make test    # tests d'intégration contre la base
make lint    # golangci-lint, sqlc vet sur la base, lint du panneau
make build   # panneau embarqué + binaire ./cpi-go
```

Variables dans `.env.example`. En production les logs sont en JSON
(`LOG_FORMAT=json`) ; chaque ligne porte `requestId`, `pattern`, `status`,
`ms`, et toute erreur 5xx est journalisée avec le même `requestId` que le
corps de réponse.

`sql/schema.sql` est le `pg_dump --schema-only` de la base v1 ; il se
régénère après chaque migration Prisma reportée. Les migrations v2 sont dans
`sql/migrations/` (goose, appliquées au démarrage).
