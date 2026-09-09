# Parcours Playwright

Prerequis : `cpi_v2_dev` avec le schema v1 (`make db`) et le binaire a jour
(`make build`). `global-setup` cree les sept comptes `e2e.<role>@cpi.sn`
et ecrit `.roles.json` depuis `./cpi-go -roles` ; `global-teardown` les
supprime. Quand `go run . -seed` existera, remplacer `creerComptes` par lui.

Commande : `pnpm --dir apps/go/web e2e`, ou `pnpm test` ici. Aucun autre
serveur ne doit tenir le port 4000 : le harnais lance `../cpi-go` avec
`API_TRUST_PROXY_HEADERS=true`, ce qui donne a chaque parcours son propre
budget de connexions via `X-Forwarded-For` (limiteur 10/min par adresse).

Ajouter un parcours : un fichier `<sujet>.spec.ts`, une adresse
`198.51.100.x` non prise si le parcours se connecte, l'etat de session par
`test.use({ storageState: compteDe('ROLE').etat })`. Les routes rejouees en
390 px vont dans `responsive.spec.ts`, seul fichier du projet `telephone`.

Regle : avant de garder un parcours, le casser. Modifier le code qu'il couvre,
verifier qu'il rougit, remettre. Un parcours vert sur du code casse est pire
que pas de parcours.
