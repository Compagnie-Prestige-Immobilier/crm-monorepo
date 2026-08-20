# Mandat — retirer le mode demonstration de CPI GO

> Ecrit d'avance, a executer **quand la restructuration en projets sera terminee**.
> Ne pas lancer avant : le mode demonstration croise chaque lecture metier, et
> le faire bouger pendant que les ecrans se deplacent rend tout conflit illisible.

## Ce que c'est aujourd'hui

Le mode demonstration n'est PAS une insertion suivie d'une suppression. C'est une
**bascule d'affichage** : les lignes fictives coexistent en permanence avec les
vraies, et l'interrupteur ne fait que les montrer ou les cacher. Rien n'est jamais
detruit, et une ligne de demonstration ne peut pas se retrouver dans un export reel.

Son empreinte, mesuree :

| Surface | Empreinte |
| --- | --- |
| Schema | **20 modeles** portent une colonne `isDemo` |
| API | **112 fichiers** citent `isDemo`, `demoScope`, `DemoVisibilityService` ou `authorIsDemo` |
| Panneau | 18 fichiers |
| Mobile | 1 fichier |
| Garde-fous | `demo-visibility.sweep.test.ts` impose le filtre **site d'appel par site d'appel** ; `purge-plan.ts` orchestre l'effacement |

## La note : 6 sur 10

Ce n'est pas 10, et ce n'est pas 2.

**Ce qui fait monter la note.** Le balayage `demo-visibility.sweep.test.ts` oblige
CHAQUE lecture sur un modele portant `isDemo` a composer `demoScope(...)`, sinon le
test rougit. C'est un impot permanent sur tout code nouveau : l'agent qui ajoute une
requete doit y penser, et l'oubli ne se voit qu'au test. La propagation
`authorIsDemo` traverse la synchronisation jusqu'a la creation d'un prospect, ou
elle se compose avec `parent.isDemo` parce qu'aucun des deux ne suffit. Le mode
oblige aussi la purge a exister et a etre juste : `PURGE_DOMAIN_KEYS`,
`PURGE_STEP_ORDER` et leurs dependances `Restrict` sont un ordonnancement complet
qui n'aurait pas lieu d'etre.

**Ce qui fait baisser la note.** L'ossature est concentree : `demoScope` est UNE
fonction, `DemoVisibilityService` UN service, et le balayage sait deja nommer tous
les sites. Ce n'est pas une regle dispersee en quinze definitions divergentes. Rien
de la logique metier ne DEPEND du mode : c'est un filtre en plus, jamais une branche
de calcul. Le retirer est une soustraction mecanique, pas une reconception.

**Verdict.** Le mode demonstration ne rend pas l'architecture dix fois plus dure.
Il ajoute environ un tiers de charge mentale sur toute ecriture de requete, et il
impose une machinerie de purge entiere. Sur une equipe qui livre vite, c'est reel.

## La decision est prise : deux schemas PostgreSQL

Le mode demonstration servait a deux choses : montrer le produit sans toucher aux
vraies fiches, et former un teleconseiller sans polluer les statistiques. Les deux
restent utiles. Elles sont **deplacees hors des tables de production** au lieu d'y
cohabiter derriere un filtre.

**Une seule base, deux schemas** : `public` et `demo`. Deux `PrismaClient`, choisis
par la session, distingues par `?schema=demo` dans la chaine de connexion. Rien
d'autre a ecrire dans le code metier.

Ce que cela supprime, et que `isDemo` ne supprimera jamais :
- l'impot permanent de `demoScope` sur chaque lecture, et le balayage qui rougit
  quand on l'oublie ;
- **le risque de fuite par construction** : une ligne fictive ne peut pas apparaitre
  dans un export reel, elle n'est pas dans la meme table ;
- les 20 colonnes `isDemo` et leurs index ;
- la propagation `authorIsDemo` a travers la synchronisation.

Ce que cela coute, et qu'il faut tenir :
1. `prisma migrate deploy` tourne **deux fois**, une par schema. Un oubli laisse le
   schema de demonstration en arriere **sans que rien ne le dise** : pose un controle
   de sante qui compare les deux etats de migration et refuse de demarrer s'ils
   divergent.
2. Deux pools de connexions au lieu d'un. Dimensionne-les, ne double pas la valeur
   par defaut a l'aveugle.
3. **Le mobile doit savoir vers lequel il pointe.** Un telephone de formation qui
   ecrit dans le vrai est le pire resultat possible. La bascule ne peut pas etre une
   simple case a cocher locale : elle doit venir du jeton de session, et l'ecran doit
   dire en permanence dans lequel on se trouve.
4. Le jeu de demonstration devient un **seed**, pas une insertion melangee. Nettoyer,
   c'est vider un schema, pas parcourir vingt tables dans un ordre de dependances.

## Le travail

Apres la restructuration en projets, jamais avant.

Dans cet ordre, un commit par etape, chaque etape verte avant la suivante.

1. **Verifier qu'aucune ligne fictive ne subsiste** en production : `POST
   /v1/admin/demo/purge` doit rendre zero. Une colonne retiree alors que des lignes
   la portent encore les rend indiscernables des vraies, definitivement.
2. **Retirer le filtre a la lecture** : supprimer `demoScope`, `demoScopeOn`,
   `demoScopeSql` et leurs 112 sites d'appel. Supprimer `DemoVisibilityService` et son
   injection.
3. **Retirer la propagation a l'ecriture** : `authorIsDemo` dans la synchronisation,
   `isDemo: authorIsDemo || parent.isDemo` a la creation de prospect.
4. **Retirer la surface** : `DemoController`, `DEMO_MODE_ALLOWED` dans `env.ts`, l'ecran
   Parametres cote panneau, la route `/v1/demo/status` de `ANY_AUTHENTICATED`.
5. **Retirer la purge** si elle n'existait QUE pour la demonstration — verifier
   d'abord : `purge-plan.ts` sert aussi a vider une base de recette. Si oui, la garder
   et n'en retirer que les etapes propres au fictif.
6. **Retirer les colonnes** : une migration `DROP COLUMN "isDemo"` sur les 20 tables,
   et les index `@@index([isDemo])` qui les accompagnent. En DERNIER, apres que le code
   ne les lit plus.
7. **Retirer les garde-fous devenus vides** : `demo-visibility.sweep.test.ts`,
   `fake-demo-visibility.ts`, `demo-marking.ts`, `demo-round-trip.test.ts`.
8. **Mettre a jour les inventaires nominatifs** : `role-routes.test.ts` cite
   `DemoController.status`, `openapi-contract.test.ts` cite la route.

## Interdits

1. **Ne retire aucune colonne avant que le code ait cesse de la lire.** L'inverse laisse
   une fenetre ou une lecture filtre sur une colonne absente : erreur SQL en production.
2. **Ne supprime aucun test qui prouve autre chose** que la demonstration. Beaucoup de
   tests posent `isDemo: false` en passant : adapte-les, ne les jette pas.
3. **Ne touche pas au schema drift** : le mobile ne cite la demonstration qu'en un
   seul fichier, et un palier de schema coute un APK et un renouvellement de parc.
4. **Une migration `DROP COLUMN` ne se rejoue pas.** Verifie la sauvegarde avant.

## Regles d'ecriture du depot

Lis `AGENTS.md`. En resume : commentaires rares, une ligne ou deux, seulement si le
code ne peut pas porter l'information. Solution la plus simple qui marche. Textes
affiches en francais, `teleconseiller` et jamais `commercial`. Pas de tiret cadratin.
**Aucune mention d'un assistant dans un commit.**

## La preuve

Pour chaque etape : le compte de tests ne doit pas baisser autrement que par les
fichiers de garde-fou explicitement retires a l'etape 7, et ce retrait doit etre
justifie ligne a ligne dans le compte rendu.

```
pnpm --filter @crm/api exec tsc --noEmit --incremental false
apps/api/node_modules/.bin/eslint src
pnpm --filter @crm/api exec vitest run
pnpm --filter @crm/web exec tsc -p tsconfig.json --noEmit --incremental false
pnpm --filter @crm/web exec vitest run
cd apps/mobile && flutter analyze && flutter test
```

`--incremental false` est OBLIGATOIRE. `npx` echoue dans cet environnement.
