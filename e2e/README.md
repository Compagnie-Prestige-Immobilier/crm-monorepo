# Parcours Playwright

Prerequis : `cpi_v2_dev` avec le schema v1 (`make db`) et le binaire a jour
(`make build` : le panneau est embarque, un changement produit ne se voit
qu'apres reconstruction). `global-setup` cree un jeu de sept comptes
`e2e.<role>.<index>@cpi.sn` par travailleur Playwright (un index par coeur,
le prefixe `fixture.` appartient au seed) et ecrit `.roles.json` depuis
`./cpi-go -roles` ; `auth.setup.ts` ouvre leurs sessions par l'API ;
`global-teardown` les supprime. `compteDe('ROLE')` rend le compte du
travailleur courant (`TEST_PARALLEL_INDEX`) : deux fichiers qui tournent en
meme temps ne partagent ni fiche ouverte, ni rappels, ni disposition.

Commande : `make e2e` depuis la racine, ou `pnpm test` ici : un travailleur
par coeur (`workers: '100%'`), la suite entiere tient en trois minutes. Sur un
poste a huit coeurs, `--workers=29` ne va pas plus vite et fait tomber des
delais : les navigateurs se disputent la machine. Le harnais lance
`../cpi-go` sur le port de `E2E_URL` (4000 par defaut) contre `DATABASE_URL`
avec `API_TRUST_PROXY_HEADERS=true`, ce qui donne a chaque parcours son
propre budget de connexions via `X-Forwarded-For` (limiteur 10/min par
adresse). Etat de session et resultats sont ranges par port (`.auth/<port>/`,
`test-results/<port>/`) : deux suites tournent en parallele avec un port et
une copie de base chacune (`pg_dump cpi_v2_dev | psql -q cpi_v2_e2e_x`).

Deux familles de fichiers : les parcours metier (`connexion`, `hub`,
`qualifier`, `ajouter-prospect`, `convertir`, `rappels`, `listes-et-fiches`,
`suggestions`, `chiffres`, `dossiers-bancaires`, `grand-public`,
`registre-visites`, `admin-*`, `cycle-complet`, `roles`, `pannes`,
`responsive`) et les parcours de parite `parite-<domaine>.spec.ts`, qui
portent les specs Playwright de la v1 (commit 782cb997, `apps/web/e2e`) et
posent un `test.fixme` motive sur chaque ecart restant.

Ajouter un parcours : un fichier `<sujet>.spec.ts`, une adresse
`198.51.100.x` non prise si le parcours se connecte, l'etat de session par
`test.use({ storageState: compteDe('ROLE').etat })`, chaque ecriture relue
en base via `avecBase`. Les routes rejouees en 390 px vont dans
`responsive.spec.ts`, seul fichier du projet `telephone` ; un describe en
`viewport 390` est admis ailleurs.

Verification : `pnpm exec prettier --check .`, `pnpm exec oxlint --config
../../../.oxlintrc.json --report-unused-disable-directives .` (pas `pnpm
lint` : un crochet local le detourne) et `pnpm exec tsc --noEmit`.

Regle : avant de garder un parcours, le casser. Modifier le code qu'il couvre,
verifier qu'il rougit, remettre. Un parcours vert sur du code casse est pire
que pas de parcours.
