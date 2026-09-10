# @crm/panel

Le panneau d'administration v1 (React, Base UI, Tailwind, React Query), repris
tel quel le 10 septembre 2026 et servi par le binaire Go comme SPA Vite. `pnpm
dev` relaie `/api` vers 4000.

- `src/components/` et `src/lib/` sont le code v1, écran par écran. Il parle le
  contrat v1 : `contrat-v1.openapi.json` est ce contrat figé, `pnpm gen` en
  tire `src/api/schema-v1.d.ts`, et `@crm/api-client` pointe sur
  `src/api/compat/`. Le binaire Go sert ce contrat ; l'écart se mesure en
  comparant les deux fichiers OpenAPI, pas avec des casts.
- Les imports Next (`next/link`, `next/navigation`, `next/image`, `next/script`,
  `next-themes`) sont des cales de `src/shims/`, branchées dans `tsconfig.json`
  et `vite.config.ts`.
- Une page v1 (`app/.../page.tsx`) est un fichier de `src/routes/` : il garde
  les rôles (`beforeLoad: guardRoles([...])`), le squelette de chargement
  (`pendingComponent`) et rend le composant de vue v1 avec les mêmes props.
  Les adresses sont celles de la v1 : `/chues/...`, `/grand-public/...`,
  `/admin/...`, `/accueil/...`, `/espaces`, `/compte`, `/notifications`.
- La session est un cookie posé par l'API (`/api/v1/auth/login`) ; les jetons
  JWT et le relais Next de la v1 ont disparu (`src/lib/api/browser.ts`). En
  TLS le cookie est `__Host-cpi_session` (Secure) ; en clair, poste de
  développement ou téléphone sur le réseau local, `cpi_session`.
- `pnpm dev` affiche « Accès développeur » sur la connexion et dans la barre :
  un rôle choisi connecte le compte semé par `make db` (`admin@cpi.sn` /
  `admin-local-2026`, fixtures `ChangeMoi123456`). Autres mots de passe :
  `VITE_SEED_ADMIN_PASSWORD`, `VITE_SEED_FIXTURE_PASSWORD` dans `web/.env.local`.
- Disparus avec le mobile et l'espace démo : relevés d'appels du téléphone,
  versions Android, bandeau démo.
- Rien de généré ne se commite (`routeTree.gen.ts`, `schema.d.ts`,
  `schema-v1.d.ts`, `dist/`).
