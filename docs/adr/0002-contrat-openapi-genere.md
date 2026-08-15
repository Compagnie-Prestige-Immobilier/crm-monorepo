# ADR 0002 : Le contrat OpenAPI est généré, les clients aussi

**Statut** : accepté · **Date** : 2026-08-12

## Contexte

Trois applications, deux langages clients. Toute divergence entre ce que l'API renvoie et ce que
les clients attendent se paie au runtime : et sur mobile, dans un village sans réseau, chez un
utilisateur qu'on ne peut pas forcer à mettre à jour.

## Décision

L'API NestJS est la **seule** source du contrat. Rien n'est écrit à la main en aval.

```
apps/api ──(@nestjs/swagger, boot headless)──▶ apps/api/openapi.json
                          │
        ┌─────────────────┴─────────────────┐
        ▼                                   ▼
packages/api-client/src/generated     packages/api-client-dart/lib
   (openapi-typescript)                (openapi-generator, dart-dio)
```

### Génération headless

Le script assigne les valeurs d'environnement par défaut avec `??=` **puis** importe le
bootstrap dynamiquement. Un import statique évaluerait le schéma d'environnement en premier et
lèverait une exception.

Un drapeau `OPENAPI_GENERATION` court-circuite `PrismaService.onModuleInit`. Avec Prisma 7 et
`@prisma/adapter-pg`, le pool pg est créé immédiatement : sans ce garde-fou, générer le contrat
exigerait une base démarrée, et chaque développeur contournerait en lançant Docker.

### Déterminisme

Le portillon anti-dérive compare octet à octet. Donc : version figée en dur, aucun horodatage,
aucun SHA git, normalisation prettier systématique.

### Générateur Dart : `dart-dio` + `json_serializable`

`built_value` impose `BuiltList`/`BuiltMap` et un registre `Serializers` global **à travers
toute l'application** : chaque état Riverpod, chaque conversion Drift, chaque `copyWith` traverse
cette frontière. C'est une dépendance virale vers une bibliothèque en maintenance dont
l'ergonomie précède la sûreté du null.

`json_serializable` produit des classes Dart ordinaires, directement interopérables avec Drift
**et avec les charges utiles JSON brutes de l'outbox** : `outbox.payload` est littéralement la
sortie de `model.toJson()`.

**Risque assumé** : ce mode est marqué BETA en 7.24.0 (le défaut reste `built_value`). Il est
validé par une génération réelle avant que le moindre code applicatif n'en dépende. Repli :
revenir à `built_value`, confiné derrière des mappers pour qu'aucun `BuiltList` n'échappe au
paquet client.

`enumUnknownDefaultCase: true` est activé : une nouvelle valeur d'énumération côté serveur ne
doit pas faire planter une version ancienne installée sur un téléphone qu'on ne peut pas mettre
à jour.

### Le code généré est committé

Y compris la sortie `*.g.dart` de build_runner. Inhabituel pour du code applicatif, correct ici :
`flutter build`, `dart analyze` et l'auto-complétion ont besoin des sources ; un développeur
Android ne devrait pas avoir besoin de Node **et** de Java pour ouvrir le projet ; et surtout
cela rend le contrôle de dérive **total** : un fichier généré à la compilation ne peut pas être
détecté comme périmé.

## Deux bugs du dépôt de référence, corrigés ici

Le pipeline est repris de `CPI-PLATFORM-NEW`, qui contient deux défauts silencieux :

1. **`dependsOn: ["^openapi:generate"]` est un no-op.** `^` résout sur les _dépendances de
   package_ ; `packages/api-client` ne dépend pas du paquet API, donc l'ensemble résolu est vide
   et l'arête n'existe pas. Cela ne fonctionne là-bas que parce que la CI lance les deux
   commandes dans le bon ordre, sur deux lignes consécutives. Ici : référence de tâche explicite
   `@crm/api#openapi:generate`.

2. **`git diff --exit-code` ne voit pas les fichiers non suivis.** Un nouveau DTO produit des
   fichiers générés inédits : la CI passe au vert pendant que le dépôt est désynchronisé. Le
   problème est bien plus grave côté Dart, où chaque modèle est un fichier. Correctif :
   `git add -A --intent-to-add` juste avant le diff.

## Portillon supplémentaire : rupture de contrat

`oasdiff breaking` compare le contrat à celui de la branche de base et échoue sans le libellé
`api-breaking`. Les clients mobiles sur le terrain ne peuvent pas être mis à jour de force : un
champ supprimé ou renommé est un incident de production, pas une remarque de revue. Avec
`enumUnknownDefaultCase`, cela constitue toute la stratégie de compatibilité ascendante.

## Qualité du contrat en amont

`@nestjs/swagger` ne produit du Dart correct que si les DTO sont décorés délibérément :

- `type: () => [MonDto]` sur **chaque** tableau. La réflexion TypeScript ne voit pas le type des
  éléments d'un tableau : l'oublier est la première cause de `List<dynamic>` dans le Dart généré,
  et cela détruit silencieusement le typage de toute la charge de synchronisation.
- `@ApiOperation({ operationId: '...' })` sur **chaque** route : openapi-generator en dérive le
  nom des méthodes Dart ; sans lui on obtient `representantsControllerFindAll_1`.
- `nullable: true` et « champ optionnel » sont distingués : en Dart, `T?` et un champ absent ne
  sont pas la même chose.
- `Idempotency-Key` est déclaré via `@ApiHeader` pour devenir un paramètre nommé typé dans le
  client généré. L'alternative : le passer dans `Options(headers:)` : fonctionne mais n'est pas
  contrainte, et un en-tête oublié signifie des doubles insertions silencieuses. Le compilateur
  tient l'invariant.
