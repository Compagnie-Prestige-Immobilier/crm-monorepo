# Unifier le contrat OpenAPI

Tâche mécanique, à faire d'une traite, sans rien changer au comportement de
l'application. À la fin, `web/contrat-v1.openapi.json` n'existe plus et le
panneau tire ses types de l'OpenAPI que le binaire Go engendre à chaque build.

Mesures du 11 septembre 2026, à refaire avant de commencer : elles bougent à
chaque changement d'API.

## Pourquoi cette tâche existe

Le 10 septembre 2026, le panneau v1 a été repris à l'identique. Son code nomme
les types de l'API v1 (`ProspectDto`, `LotExportSummaryDto`). Le binaire Go
engendre son propre OpenAPI, sous ses propres noms (`Prospect`,
`LotExportSummaryDto` parfois, `ProspectListOutputBody` souvent).

Pour que le panneau compile, un contrat figé a été gardé,
`web/contrat-v1.openapi.json`, écrit à la main en JSON minifié. Chaque champ
ajouté à l'API doit y être recopié à la main. C'est la seule source écrite à la
main du dépôt, et elle ment dès qu'on oublie une ligne.

## Le geste central

Un seul fichier décide de tout : `web/src/api/compat/index.ts` importe
`@/api/schema-v1`. Les deux fichiers de types existent déjà et sont engendrés
par `make gen` :

| fichier | engendré depuis | qui l'utilise |
| --- | --- | --- |
| `web/src/api/schema.d.ts` | `openapi.json`, sorti du Go | personne, aujourd'hui |
| `web/src/api/schema-v1.d.ts` | `web/contrat-v1.openapi.json`, écrit à la main | tout le panneau |

La migration, c'est remplacer `schema-v1` par `schema` dans ce fichier, puis
réparer les 92 noms et les 28 routes mortes que le compilateur signale.

## Avant de commencer

```
git branch --show-current          # doit être v2, jamais prod
make gen                           # engendre openapi.json et les deux schema*.d.ts
node tools/dev/contrat-ecarts.cjs  # les deux tables d'écarts, à jour
```

`openapi.json`, `web/src/api/schema.d.ts` et `web/src/api/schema-v1.d.ts` sont
dans `.gitignore` : ils n'existent qu'après `make gen`. Ne jamais les commiter,
`pnpm plafonds` le refuse.

## Étape 1 : les routes mortes

`node tools/dev/contrat-ecarts.cjs routes` liste les routes du contrat figé
sans route de même forme côté Go. Une route de cette liste peut rester VIVANTE :
le Go déclare `/api/v1/referentiels/{kind}` là où le contrat figé écrit
`/api/v1/referentiels/banques`, et le routeur Go fait correspondre les deux à
l'exécution.

Il faut donc sonder, pas déduire. Lancer le binaire et interroger chaque route
avec sa vraie méthode :

```
make build
env -i PATH="$PATH" HOME="$HOME" PORT=4022 LOG_FORMAT=text \
  DATABASE_URL="$(grep '^DATABASE_URL=' .env | cut -d= -f2-)" ./cpi-go &
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:4022/api/v1/referentiels/banques
```

Lecture du code obtenu, sans session ouverte :

- `401` ou `403` : la route existe. Le panneau garde son appel, seul le nom du
  type change.
- `404` : la route n'existe pas dans le Go. Le code du panneau qui l'appelle est
  mort, il part.

Ne jamais sourcer `.env` dans un shell : des valeurs contiennent des espaces et
zsh imprime des fragments de secret. Passer les clés une par une, comme
ci-dessus.

Au 11 septembre 2026, sur les 47 routes appelées par le panneau et absentes du
contrat Go :

| verdict | nombre | ce que c'est |
| --- | --- | --- |
| vivantes, forme différente | 19 | les référentiels, servis par `{kind}` et `{kind}/{id}` |
| mortes | 28 | analytics v1, mises à jour Android, `sync/pull`, `auth/refresh`, `auth/workspace`, espace de démonstration, appels détectés du téléphone, notes vocales |

Les 28 mortes viennent du client mobile, abandonné le 8 septembre 2026. Le code
du panneau qui les appelle ne s'exécute jamais : il se supprime, avec ses écrans
s'ils ne servent plus qu'à cela. Vérifier chaque suppression avec
`pnpm dead-code` plutôt qu'à l'œil.

## Étape 2 : basculer la source des types

Dans `web/src/api/compat/index.ts`, deux lignes :

```ts
import type { paths } from '@/api/schema';
export type { components, operations, paths } from '@/api/schema';
```

Puis `pnpm --dir web typecheck`. Le compilateur sort alors quelques centaines
d'erreurs : c'est la liste de travail des étapes suivantes, et elle est exacte.

## Étape 3 : renommer les types

`node tools/dev/contrat-ecarts.cjs schemas` donne la table des noms. Les alias
de types vivent dans seize fichiers seulement :

```
grep -rl "Schemas\['" web/src --include='*.ts' --include='*.tsx'
```

Presque tous sont dans `web/src/lib/data/`, plus `web/src/lib/types.ts`.
Renommer là, pas dans les composants : les composants importent ces alias.

Trois pièges dans cette table.

- Une ligne marquée `(PLUSIEURS)` veut dire qu'un seul type v1 correspond à
  plusieurs types Go selon la route. `OkDto` en est l'exemple : six types Go.
  Regarder la route appelée par la fonction, et prendre le type de cette
  route-là.
- Une ligne qui finit par `(corps anonyme)` veut dire que le Go ne nomme pas sa
  réponse. Écrire le type depuis l'opération plutôt que depuis le schéma :
  `operations['nomDeLOperation']['responses'][200]['content']['application/json']`.
- Un nom identique des deux côtés n'est pas forcément le même type. La table ne
  liste que les noms qui diffèrent ; si le compilateur se plaint d'un champ sur
  un nom commun, c'est que le Go a changé la forme, et c'est le panneau qui
  s'aligne.

## Étape 4 : les paramètres de requête

Le contrat figé et le Go ne nomment pas toujours leurs paramètres pareil, et le
Go est plus strict sur les énumérations. Les erreurs de cette étape se lisent
sur `params: { query: ... }`. Corriger côté panneau, jamais en élargissant
l'énumération côté Go.

## Étape 5 : supprimer le contrat figé

Quand `pnpm --dir web typecheck` est vert :

```
git rm web/contrat-v1.openapi.json
```

Puis retirer `contrat-v1.openapi.json` du script `gen` de `web/package.json`,
et `web/src/api/schema-v1.d.ts` de `.gitignore` et de `tools/dev/plafonds.sh`.
Renommer enfin `web/src/api/schema.d.ts` si le nom `schema-v1` traîne encore
quelque part.

Mettre à jour les deux endroits qui décrivent le mécanisme : `CLAUDE.md`, phrase
sur le contrat v1 figé à éditer à la main, et `docs/v2-refonte/plan.md`.

## Fini quand ces six commandes sont vertes

```
make gen
make build
make test
pnpm verify:local
E2E_URL=http://localhost:4020 pnpm --dir e2e exec playwright test --workers=29
git status --short          # aucun fichier engendré suivi
```

La suite Playwright est le juge : elle traverse les écrans avec le vrai binaire.
Une route mal renommée casse un parcours, pas la compilation.

## Ce qu'il ne faut pas faire

- Ne pas garder le contrat figé « au cas où ». Deux sources de types, c'est le
  problème qu'on supprime.
- Ne pas taire une erreur par un `as` ou un `any`. Une erreur de type ici est
  une route qui ne répond pas ce que le panneau croit.
- Ne pas toucher aux noms côté Go pour qu'ils ressemblent aux noms v1. Le Go est
  la source, le panneau s'aligne.
- Ne pas mélanger cette tâche avec une correction fonctionnelle. Le diff doit se
  relire comme un renommage.
