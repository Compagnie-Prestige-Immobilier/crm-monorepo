# Mandat — surface Administration de CPI GO

Tu ameliores un CRM de terrain en production. Ce n'est pas une revue de style :
**trouve des defauts reels et corrige-les toi-meme**, avec un test qui prouve chacun.
Ne rends pas une liste de suggestions. Rends du code qui marche.

## Ton perimetre, STRICT

Uniquement la surface d'administration :
- `apps/api/src/modules/imports/**`
- `apps/api/src/modules/referentiels/**`
- `apps/api/src/modules/users/**`
- `apps/api/src/modules/notifications/**`
- `apps/api/src/modules/admin/**` (purge, supervision, mode demonstration)
- `apps/api/src/modules/app-updates/**`, `apps/api/src/modules/db-dump/**`
- `apps/web/src/app/(panel)/imports/**`, `referentiels/**`, `commerciaux/**`,
  `notifications/**`, `parametres/**`
- `apps/web/src/components/imports/**`, `referentiels/**`, `commerciaux/**`,
  `notifications/**`

**INTERDIT de toucher** : `apps/mobile` en entier, `apps/api/src/modules/sync/**`,
`apps/api/src/modules/analytics/**`, `apps/api/src/modules/representants/**`,
`apps/api/src/modules/prospects/**`, `apps/api/src/modules/visites/**`,
`apps/api/src/modules/bank-cases/**`, `apps/api/src/modules/client-requests/**`,
`apps/web/src/app/(panel)/accueil/**`, `apps/web/src/components/layout/**`,
`apps/web/src/app/globals.css`, `packages/database/prisma/schema.prisma`,
et tout fichier engendre de `packages/api-client` et `packages/api-client-dart`.
Six autres chantiers tournent en parallele sur ces zones.

## Ce que je veux que tu cherches

Par ordre de valeur. Cite `fichier:ligne` pour tout.

1. **Defauts de logique metier** : une regle appliquee a deux endroits avec deux
   definitions divergentes ; un calcul juste sur le mauvais champ ; un etat derive
   stocke qui se desynchronise de sa source ; un invariant tenu par l'application
   mais pas par la base ; une transaction qui devrait etre atomique et ne l'est pas.
2. **Pertes de saisie et erreurs muettes** : un `catch` qui avale sans journaliser ;
   un etat de chargement qui ne se relache pas sur une branche d'erreur (bouton grise
   pour toujours) ; une double soumission possible sur reseau lent ; un brouillon
   ecrase ou ressuscite apres enregistrement.
3. **Experience reelle**, pas de l'esthetique : un parcours en trois ecrans la ou un
   suffirait ; un etat vide qui ment (« aucun resultat » quand la base est vide) ; un
   libelle ambigu ou du jargon technique affiche ; **un chiffre qui a l'air complet et
   ne l'est pas**.
4. **Solidite** : une requete sans borne sur une table qui grossit ; un index manquant
   sur un chemin reellement emprunte ; une liste non paresseuse au-dela de quelques
   dizaines de lignes.

## Interdits absolus

1. **Ne supprime aucun test.** S'il te gene, il a probablement raison.
2. **N'affaiblis aucune assertion** pour la faire passer.
3. **N'ajoute aucune dependance** sans un defaut reel qu'elle corrige, sa sante et le
   cout de migration.
4. **Ne touche pas au schema Prisma.** Si tu crois qu'il le faut, arrete-toi et signale-le.
5. **N'elargis aucune autorisation.** Les inventaires nominatifs de routes
   (`apps/api/src/common/guards/role-routes.test.ts`,
   `apps/api/src/modules/phase2/authorization.test.ts`) sont la verite : un role
   ajoute sans y figurer fait rougir le balayage, c'est voulu.

## Regles d'ecriture du depot

Lis `AGENTS.md` a la racine AVANT d'ecrire. En resume :
- **Commentaires rares.** Seulement si le code ne PEUT pas porter l'information :
  contrainte externe, choix contre-intuitif, piege que le prochain lecteur
  reproduirait. Une ligne, deux au maximum. Pas de bandeaux, pas de narration.
  Avant d'ecrire un commentaire : renommer, ou decouper.
- **La solution la plus simple qui marche.** Pas d'abstraction sans deux appelants reels.
- Textes affiches **en francais**. On ecrit `teleconseiller`, JAMAIS `commercial`.
  `Banque & Finance` avec l'esperluette. **Pas de tiret cadratin.**
- **Aucune mention d'un assistant dans un commit.**
- Le panneau est sur **Base UI**, pas Radix : `render` et non `asChild`, `onClick` et
  non `onSelect`. Un `Select`/`Popover` dans un dialogue exige `isolate z-50` sur le
  `Positioner`, sinon la liste se peint SOUS le calque du dialogue.

## La preuve, non negociable

Pour CHAQUE correctif de comportement :
1. Ecris le test.
2. **Verifie qu'il est ROUGE** sur le code d'origine : applique la mutation, constate
   l'echec, annule-la.
3. Corrige.
4. Verifie qu'il est vert.

Un test jamais vu rouge ne prouve rien. Sur ce depot, deux tests passaient sur du code
casse : l'un ne prouvait qu'une soustraction, l'autre posait lui-meme les reglages
qu'il etait cense verifier.

## Verification avant de t'arreter

```
pnpm --filter @crm/api exec tsc --noEmit --incremental false
apps/api/node_modules/.bin/eslint src
pnpm --filter @crm/api exec vitest run
pnpm --filter @crm/web exec tsc -p tsconfig.json --noEmit --incremental false
apps/web/node_modules/.bin/eslint src
pnpm --filter @crm/web exec vitest run
```

`--incremental false` est OBLIGATOIRE : un `tsbuildinfo` perime a deja produit un faux
vert ici, avec huit fichiers casses non signales. `npx` echoue dans cet environnement :
appelle les binaires par leur chemin.

Reperes actuels : API 5939 tests sur 103 fichiers, panneau 968 sur 84. Un nombre
inferieur signifie que tu as supprime des tests, ce qui est interdit.

## Ce que tu rends

Un compte rendu court, dense, en francais. Pas de narration.
1. Ce que tu as corrige : le defaut, son emplacement, ce qu'il coutait a l'utilisateur,
   et le test qui le prouve.
2. Ce que tu as trouve sans corriger : pourquoi, et ce qu'il faudrait.
3. Ce que tu as verifie et juge sain : le dire aussi evite qu'on le casse en croyant
   l'ameliorer.
4. Le resultat des verifications, chiffres a l'appui.

**Commite ton travail** sur la branche courante, en commits
separes par sujet, messages en francais, **sans aucune mention d'un assistant**.
Ne pousse pas.
