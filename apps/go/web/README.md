# @crm/panel

SPA Vite + React servie par le binaire Go. `pnpm dev` relaie `/api` vers 4000.

- Un écran vit dans `src/routes/`, un fichier par adresse. Le composant feuille
  remplace `<Ecran titre="…" />` ; ni le `beforeLoad` de rôle ni la coque ne
  changent.
- Ajouter une route : créer le fichier sous `src/routes/`, `Route.beforeLoad =
  guardRoles([...])` ou `guardProjet({ chues, 'grand-public' })`, puis ajouter
  l'entrée dans `src/lib/nav-*.ts` si elle doit paraître dans la barre.
- Les deux projets partagent l'arbre `src/routes/_panneau/$projet/` : le segment
  est validé par `$projet.tsx`, `Route.useParams()` donne `chues` ou
  `grand-public`, le contexte donne `projetApi` pour l'API.
- `pnpm gen` réécrit `src/api/schema.d.ts` depuis `apps/go/openapi.json`. Rien de
  généré ne se commite (`routeTree.gen.ts`, `schema.d.ts`, `dist/`).
- Plafond de 300 lignes par fichier `.ts`/`.tsx`, vérifié en CI.
