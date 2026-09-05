# Etat de `dev` au 5 septembre 2026

Ce fichier existe pour une raison : trois series de travaux ont ete fusionnees
dans `dev` le meme jour, et rien dans l'arborescence ne dit qu'elles sont
arrivees. Quelqu'un qui ouvre le depot sans lire l'historique refait le
connecteur d'enrolement, ou repose le verrou de fiche.

Verifier ce fichier avant d'ouvrir un chantier. S'il contredit le code, c'est
le code qui a raison : corriger le fichier.

## Ce qui est fusionne, donc fait

### Cache Redis et flux SSE du panel

Branche `feat/redis-implementation`, merge `67bf58bc`.

- `apps/api/src/redis/` : service Redis, interceptor `@Cached`, TTL 30 s.
  `fake-redis.ts` couvre les tests, aucune instance n'est requise pour `pnpm
  test`.
- `apps/api/src/modules/live/` : flux SSE, consomme par
  `apps/web/src/lib/live-stream.ts` et `components/live/live-stream.tsx`.
- Espace demo isole : `packages/database/src/demo-volume.ts`,
  `demo-workspace-factory.ts`, `apps/web/src/lib/demo-workspace.ts`.
- `REDIS_URL` est exige en production ; `DEMO_WORKSPACE_ENABLED` y est refuse.

Pas de BullMQ, pas de file d'attente. Une seule instance API.

### Lot 1, statuts de qualification et fiche prospect

Branche `feat/lot1-statuts-et-fiche`, merge `e1645745`, 54 commits.

- Le code d'un statut se DEDUIT de son libelle. Ne pas rouvrir la saisie
  manuelle du code (`a00f7838`, changement cassant assume).
- Un statut declare s'il exige un motif ; le motif remonte dans l'historique
  des appels.
- Ouverture de fiche : verrou serveur, brouillon, chronometre, historique en
  lecture seule, liberation manuelle par un superviseur. Web et mobile.
- Sous verrou, la deconnexion et le changement d'espace sont REFUSES : la fiche
  resterait verrouillee cote serveur, hors de vue.
- File de rappel, tuile de tableau de bord, comptage des fiches ouvertes.
- Faux numero et rappel convenu comptent comme des appels aboutis.

### Connecteur d'enrolement CHUES et Grand Public

Branche `feat/connecteur-enrolement`, commit `2c9dd76e`, merge `317d2eaf`.

- `apps/api/src/modules/enrolement/` : tirage, rapprochement, indicateurs,
  reglages.
- `plateformes.ts` porte les pieges des deux API distantes. Les horodatages
  Grand Public arrivent sans fuseau et sont lus en UTC ; son champ `statut` est
  decoratif, l'etat qui se mesure est l'ETAPE.
- Le rapprochement verifie le projet en plus de la requete : une inscription
  CHUES ne s'attache jamais a une fiche Grand Public.
- Ecran `apps/web/src/app/(panel)/admin/enrolement/`.
- Migration `20260905090000_inscriptions_plateforme`.

## Reste a faire

1. Pousser `dev`. 61 commits d'avance sur `origin/dev`, rien n'est publie.
2. Appliquer la migration `20260905090000_inscriptions_plateforme` hors local.
3. Renseigner `PLATEFORME_CHUES_URL`, `PLATEFORME_CHUES_TOKEN`,
   `PLATEFORME_GRAND_PUBLIC_URL`, `PLATEFORME_GRAND_PUBLIC_TOKEN`. Vides, le
   connecteur ne tire rien et l'ecran d'administration le dit.
4. Lancer les e2e Playwright. Ils n'ont pas tourne sur l'arbre fusionne.
5. Lint rouge, ANTERIEUR aux merges, non introduit par eux :
   - `packages/api-client/src/query.test.ts`, cinq
     `vitest(no-conditional-expect)` ;
   - `apps/web/src/components/representants/representants-view.tsx`,
     complexite 21 pour 20 permis ;
   - `apps/web/src/components/accueil/tableau-de-bord/sources.ts:469`,
     `unicorn(no-useless-length-check)` ;
   - `apps/web/src/components/prospects/prospect-detail-view.test.tsx`, faux
     positif `jsx-a11y(aria-role)` sur la prop `role` du composant.

## Ce qui n'est PAS un chantier ouvert

`codex/administration` et `codex/banque-finance` n'ont aucun commit et sont a
151 commits en retard de `dev`. Leurs worktrees ne portent qu'un
`CODEX_MANDAT.md` non commite. Ne pas les fusionner, ne pas partir de leur
etat.

## Verifie sur l'arbre fusionne

`pnpm typecheck` sans erreur. `pnpm test` : 15 taches, 1487 tests web.
`pnpm codegen` ne produit aucune difference, les clients engendres sont a jour.
