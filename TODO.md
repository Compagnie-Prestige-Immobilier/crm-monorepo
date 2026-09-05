# TODO

État de `dev` au 5 septembre 2026.

Lire ce fichier avant d'ouvrir un chantier. S'il contredit le code, c'est le
code qui a raison : corriger le fichier.

## À faire

- [ ] Appliquer la migration `20260905090000_inscriptions_plateforme` hors
      local. Elle crée `inscriptions_plateforme`, le miroir d'enrôlement.
- [ ] Renseigner `PLATEFORME_CHUES_URL`, `PLATEFORME_CHUES_TOKEN`,
      `PLATEFORME_GRAND_PUBLIC_URL`, `PLATEFORME_GRAND_PUBLIC_TOKEN`. Vides, le
      connecteur ne tire rien et l'écran d'administration le dit.
- [ ] Lancer les e2e Playwright. Ils n'ont jamais tourné sur l'arbre fusionné.
- [ ] Décider du sort des branches locales `feat/connecteur-enrolement` et
      `feat/redis-implementation` : fusionnées dans `dev`, à pousser ou à
      supprimer.
- [ ] Supprimer les branches `codex/administration` et `codex/banque-finance`.
      Zéro commit, 151 de retard, leurs worktrees sont déjà retirés.

## Questions ouvertes

- [ ] L'écran des statuts de qualification n'a pas de case « exige un motif »,
      contrairement à l'écran des motifs d'appel. La création envoie donc
      `requiresComment: false`. Ajouter le contrôle, ou l'assumer ?

## Fait, ne pas refaire

### Cache Redis et flux SSE du panel

`feat/redis-implementation`, merge `67bf58bc`.

- `apps/api/src/redis/` : service Redis, intercepteur `@Cached`, TTL 30 s.
  `fake-redis.ts` couvre les tests, `pnpm test` n'exige aucune instance.
- `apps/api/src/modules/live/` : flux SSE, consommé par
  `apps/web/src/lib/live-stream.ts` et `components/live/live-stream.tsx`.
- Espace démo isolé : `packages/database/src/demo-volume.ts`,
  `demo-workspace-factory.ts`, `apps/web/src/lib/demo-workspace.ts`.
- `REDIS_URL` est exigé en production, `DEMO_WORKSPACE_ENABLED` y est refusé.

Pas de BullMQ, pas de file d'attente, une seule instance API.

### Lot 1, statuts de qualification et fiche prospect

`feat/lot1-statuts-et-fiche`, merge `e1645745`, 54 commits.

- Le code d'un statut se DÉDUIT de son libellé. Ne pas rouvrir la saisie
  manuelle du code (`a00f7838`, rupture assumée).
- Un statut déclare s'il exige un motif, et le motif remonte dans l'historique
  des appels.
- Ouverture de fiche : verrou serveur, brouillon, chronomètre, historique en
  lecture seule, libération manuelle par un superviseur. Web et mobile.
- Sous verrou, la déconnexion et le changement d'espace sont REFUSÉS : la fiche
  resterait verrouillée côté serveur, hors de vue.
- File de rappel, tuile de tableau de bord, comptage des fiches ouvertes.
- Faux numéro et rappel convenu comptent comme des appels aboutis.

### Connecteur d'enrôlement CHUES et Grand Public

`feat/connecteur-enrolement`, merges `317d2eaf` puis `c805b924`.

- `apps/api/src/modules/enrolement/` : tirage, rapprochement, indicateurs,
  réglages, purge du miroir et suppression d'une inscription.
- `plateformes.ts` porte les pièges des deux API distantes. Les horodatages
  Grand Public arrivent sans fuseau et se lisent en UTC. Son champ `statut` est
  décoratif : l'état qui se mesure est l'ÉTAPE.
- Le rapprochement vérifie le projet en plus de la requête : une inscription
  CHUES ne s'attache jamais à une fiche Grand Public.
- Écran `apps/web/src/app/(panel)/admin/enrolement/`.

### Remise au vert de la CI

Merges `2c508581` et `5e9458af`. Deux pièges qui se reproduisent :

- Mode env strict de turbo 2 : une tâche ne voit QUE les variables déclarées
  dans sa `env`. Le workflow peut les exporter, turbo les jette. Deux suites
  d'intégration échouaient en CI et nulle part ailleurs.
- `turbo.json` : le cycle entre `@crm/api-client#build` et les clients de
  plateforme est rompu côté `generate`. `schema.ts` est commité, `codegen:check`
  reste le juge de sa fraîcheur.
