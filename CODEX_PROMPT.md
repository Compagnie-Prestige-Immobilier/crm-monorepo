# Mandat d'audit et d'amélioration — CPI GO

Tu améliores un CRM de terrain en production. Ce n'est pas une revue de style :
je veux que tu **trouves des défauts réels et que tu les corriges toi-même**,
avec un test qui prouve chacun.

Ne rends pas une liste de suggestions. Rends du code qui marche.

---

## Le produit, et pourquoi ça change ce qui compte

CPI GO gère l'enrôlement immobilier de fonctionnaires sénégalais. Trois surfaces :

| Surface       | Technologie                                | Qui s'en sert                                    |
| ------------- | ------------------------------------------ | ------------------------------------------------ |
| `apps/api`    | NestJS, Prisma, PostgreSQL                 | —                                                |
| `apps/web`    | Next.js 15, Base UI, Tailwind              | téléconseillers, superviseurs, banque, direction |
| `apps/mobile` | Flutter, drift/SQLite, Riverpod, go_router | téléconseillers en tournée                       |

**Les contraintes qui décident de tout :**

1. **Hors ligne d'abord.** Le mobile écrit dans une base locale et pousse par une
   file d'opérations. Un téléphone peut rester des semaines sans réseau.
2. **Le parc ne se met pas à jour de force.** Un changement de schéma local ou de
   contrat coûte un APK et un renouvellement de parc. Une valeur d'énumération
   ajoutée sans précaution bloque des saisies **définitivement**, sur le terrain,
   sans message.
3. **Téléphones modestes, écrans petits, texte souvent agrandi**, réseau cher et
   intermittent.
4. **Une erreur avalée ne se voit jamais.** Il n'y a ni console ni rapport de
   plantage chez l'utilisateur.
5. **« Un téléconseiller ne tape pas. »** Partout où une valeur peut se choisir,
   elle se choisit. La frappe d'identifiants est une source d'erreur et de
   doublons.

---

## Ce que je veux que tu cherches

Par ordre de valeur. Cite `fichier:ligne` pour tout.

### 1. Défauts de logique métier

Les plus coûteux, et ceux qu'aucun outil ne trouve.

- Une règle appliquée à deux endroits avec deux définitions qui divergent.
- Un calcul juste sur le mauvais champ. Exemple réel déjà corrigé ici : compter
  l'activité d'un téléconseiller sur `createdAt` (arrivée en base) au lieu de
  `clientCreatedAt` (saisie terrain) attribuait au jeudi les appels du lundi
  d'un téléphone hors ligne.
- Un état dérivé stocké qui se désynchronise de sa source.
- Un invariant tenu par l'application mais pas par la base, ou l'inverse.
- Une transaction qui devrait être atomique et ne l'est pas.
- Une idempotence supposée mais non garantie : le mobile **rejoue** ses
  opérations, un rejeu ne doit jamais produire un doublon.

### 2. Pertes de saisie et erreurs muettes

- Une écriture dont l'échec ne produit ni message ni trace.
- Un `catch` qui avale sans journaliser.
- Un état de chargement qui ne se relâche pas sur une branche d'erreur : bouton
  grisé pour toujours, application à tuer.
- Une double soumission possible sur réseau lent.
- Un brouillon écrasé, perdu, ou ressuscité après enregistrement.

### 3. Expérience réelle

Pas de l'esthétique : du geste compté.

- Un parcours qui demande trois écrans là où un suffirait.
- Un état vide qui n'explique rien, ou pire qui ment : « aucun résultat » quand
  la base est vide, ou l'inverse.
- Un libellé ambigu, du jargon technique affiché à l'utilisateur, un anglicisme.
- Deux écrans qui font le même geste différemment.
- Une information affichée comme certaine alors qu'elle est approximative.
- Un chiffre qui a l'air complet et ne l'est pas.

### 4. Solidité

- Une requête sans borne sur une table qui grossit.
- Un index manquant sur un chemin réellement emprunté ; un index inutile.
- Une liste non paresseuse au-delà de quelques dizaines de lignes.
- Une reconstruction inutile sur un chemin chaud.

---

## Interdits absolus

Les violer casse un parc de téléphones qu'on ne peut pas mettre à jour.

1. **Ne touche pas au schéma drift ni à `schemaVersion`.** Si tu crois qu'il le
   faut, arrête-toi et signale-le.
2. **Ne renomme ni ne retire aucune clé de charge utile de synchronisation.** Une
   opération en file depuis trois semaines doit rester lisible par le nouveau code.
3. **N'ajoute aucune contrainte `CHECK` sur une valeur d'énumération venant du
   serveur** dans la base locale : une contrainte figée avorterait la transaction
   de pull entière le jour où le serveur ajoute une valeur.
4. **Ne touche pas à `phase2_directory`** : ses six colonnes sont une frontière de
   confidentialité verrouillée par un test, distribuée à 500 000 lignes sur chaque
   téléphone personnel.
5. **Ne rends obligatoire aucun champ de contrat qui était facultatif.** Un
   téléphone déjà déployé ne l'envoie pas, et `forbidNonWhitelisted` rejette le
   **lot entier**, pas l'opération.
6. **N'ajoute aucune dépendance** sans un défaut réel qu'elle corrige, sa santé
   (dernière publication, compatibilité SDK) et le coût de migration. Une
   dépendance de plus est une surface de maintenance et de sécurité.
7. **Ne supprime aucun test.** Si un test te gêne, il a probablement raison.
8. **N'affaiblis aucune assertion** pour la faire passer. Si l'interface a changé,
   l'assertion suit la nouvelle vérité ; si c'est le produit qui a un défaut, tu le
   corriges ou tu le signales.

---

## Règles d'écriture du dépôt

Lis `AGENTS.md` à la racine **avant** d'écrire. En résumé :

- **Commentaires rares.** Un commentaire ne se justifie que si le code ne _peut_
  pas porter l'information : contrainte externe, choix contre-intuitif, piège que
  le prochain lecteur reproduirait. Une ligne, deux au maximum. Pas de bandeaux,
  pas de paragraphes, pas de narration. Avant d'écrire un commentaire : renommer,
  ou découper.
- **La solution la plus simple qui marche.** Pas d'abstraction sans deux appelants
  réels. Pas d'indirection « au cas où ». Peu de fichiers.
- **Textes affichés en français.** On écrit `téléconseiller`, **jamais**
  `commercial`. `Banque & Finance` avec l'esperluette. **Pas de tiret cadratin.**
- **Aucune mention d'un assistant dans un commit.**
- Le panneau est sur **Base UI**, pas Radix : `render` et non `asChild`, `onClick`
  et non `onSelect` sur un item de menu.

---

## La preuve, et c'est non négociable

Pour **chaque** correctif de comportement :

1. Écris le test.
2. **Vérifie qu'il est ROUGE** sur le code d'origine — applique la mutation,
   constate l'échec, annule-la.
3. Corrige.
4. Vérifie qu'il est vert.

Un test qui n'a jamais été vu rouge ne prouve rien. Sur ce dépôt, deux tests
passaient sur du code cassé : l'un ne prouvait qu'une soustraction, l'autre posait
lui-même les réglages qu'il était censé vérifier.

Si tu ne peux pas rendre un test rouge, dis-le — c'est souvent le signe que le
défaut n'existe pas.

---

## Vérification avant de t'arrêter

Selon la surface que tu as touchée :

```
# API
pnpm --filter @crm/api exec tsc --noEmit --incremental false
apps/api/node_modules/.bin/eslint src
pnpm --filter @crm/api exec vitest run

# Panneau
pnpm --filter @crm/web exec tsc -p tsconfig.json --noEmit --incremental false
apps/web/node_modules/.bin/eslint src
pnpm --filter @crm/web exec vitest run

# Mobile
cd apps/mobile && flutter analyze && flutter test
```

Le drapeau `--incremental false` est **obligatoire** : un `tsbuildinfo` périmé a
déjà produit un faux vert sur ce dépôt, avec huit fichiers cassés non signalés.

`npx` échoue dans cet environnement : appelle les binaires par leur chemin.

**Les repères de tests.** Un nombre inférieur signifie que tu as supprimé des
tests, ce qui est interdit. Relève le compte avant de commencer et compare.

---

## Ce que tu rends

Un compte rendu court, dense, en français. Pas de narration.

1. **Ce que tu as corrigé** : le défaut, son emplacement, ce qu'il coûtait à
   l'utilisateur, et le test qui le prouve.
2. **Ce que tu as trouvé sans corriger** : pourquoi, et ce qu'il faudrait.
3. **Ce que tu as vérifié et jugé sain** : dis-le aussi. Savoir ce qui est solide
   évite qu'on le casse en croyant l'améliorer.
4. **Le résultat des vérifications**, chiffres à l'appui.

Ne commite pas, ne pousse pas.
