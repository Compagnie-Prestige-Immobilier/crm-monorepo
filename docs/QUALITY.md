# Qualité

Un seul job de vérification, `go` dans `.github/workflows/ci.yml`, sur chaque
PR vers `dev` ou `prod` et sur chaque push : plafonds (`tools/dev/plafonds.sh`),
aucun `*_test.go` sans le tag `integration`, schéma `sql/schema.sql` puis
`sqlc vet` contre la base, `golangci-lint` (`.golangci.yml`), `go vet`, lint
et types du panneau, build du binaire, tests d'intégration, parcours
Playwright. `security.yml` ajoute Gitleaks, Semgrep, OSV-Scanner et Trivy.
`sonar` tourne sur PR quand la variable `SONAR_ENABLED` vaut `true`, avec
`SONAR_TOKEN`, `SONAR_PROJECT_KEY` et `SONAR_ORGANIZATION` ; aucune condition
de couverture, il n'y a pas de tests unitaires. En local : `pnpm verify:local`.
