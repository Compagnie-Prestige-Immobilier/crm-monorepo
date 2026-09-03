# CPI GO

Monorepo du CRM de prospection de la Compagnie Prestige Immobilier. Il réunit
le panel web, l'API, l'application Android hors ligne, PostgreSQL et les clients
générés à partir du contrat OpenAPI.

Le produit couvre quatre espaces:

- Accueil: registre des visites du comptoir.
- Projet CHUES: qualification des représentants, collecte de prospects,
  conversion et suivi bancaire.
- Projet Grand Public: prospection et conversion hors CHUES.
- Administration: comptes, référentiels, imports, notifications, mises à jour
  Android et paramètres.

Le réseau mobile est considéré comme intermittent. CPI GO enregistre d'abord
sur le téléphone, puis synchronise avec l'API. Une saisie ne dépend jamais
d'une réponse réseau pour être conservée.

## Architecture

```text
┌──────────────────────────┐       HTTPS       ┌──────────────────────────┐
│ Panel web                │◀─────────────────▶│ API NestJS / Fastify     │
│ Next.js 16, React 19     │                   │ Auth, métier, OpenAPI    │
└──────────────────────────┘                   └────────────┬─────────────┘
                                                          │
┌──────────────────────────┐       HTTPS / WS             │ Prisma
│ CPI GO Android           │◀─────────────────────────────┤
│ Flutter, Drift, Riverpod │                               │
│ stockage local + outbox  │                   ┌───────────▼──────────────┐
└──────────────────────────┘                   │ PostgreSQL 18            │
                                               └──────────────────────────┘
```

| Emplacement                  | Responsabilité                                           | Pile principale                                  |
| ---------------------------- | -------------------------------------------------------- | ------------------------------------------------ |
| `apps/api`                   | API HTTP, présence WebSocket, métier, imports et exports | NestJS 11, Fastify 5, Prisma 7                   |
| `apps/web`                   | Panel multi-espace et administration                     | Next.js 16, React 19, TanStack Query, Tailwind 4 |
| `apps/mobile`                | Application Android hors ligne                           | Flutter 3.41, Riverpod, Drift, Dio               |
| `packages/database`          | Schéma, migrations, seed et client partagé               | PostgreSQL 18, Prisma 7                          |
| `packages/api-client`        | Client TypeScript généré                                 | openapi-typescript, openapi-fetch                |
| `packages/api-client-dart`   | Client Dart généré                                       | OpenAPI Generator, dart-dio                      |
| `packages/typescript-config` | Configurations TypeScript partagées                      | TypeScript 5.9                                   |
| `infra`                      | Développement Docker et déploiement                      | Docker Compose, Dokploy                          |

Le workspace pnpm contient les applications Node et les paquets partagés.
Flutter reste un projet autonome, mais consomme le client Dart par dépendance de
chemin.

## Principes structurants

### Hors ligne d'abord

Le mobile écrit les changements dans SQLite et dans une outbox locale. Le
moteur de synchronisation envoie des groupes ordonnés, idempotents et
indépendants. Une fiche invalide ne doit pas bloquer les autres fiches.

Après une saisie, le mobile tente immédiatement l'envoi. Si le réseau ou le
serveur est indisponible, il relance rapidement, puis conserve la file pour les
cycles suivants. Android peut retarder le travail en arrière-plan; le chemin
fiable reste la synchronisation au premier plan.

Voir [`docs/adr/0001-offline-first-outbox.md`](docs/adr/0001-offline-first-outbox.md).

### Contrat généré

Les DTO et contrôleurs NestJS sont l'unique source du contrat public:

```text
apps/api
   └── openapi.json
       ├── packages/api-client/src/generated
       └── packages/api-client-dart/lib
```

Les clients générés sont versionnés et nécessaires au développement. Ils ne se
modifient jamais à la main. Toute évolution de route, paramètre, DTO ou enum
doit être suivie de:

```bash
pnpm codegen
pnpm codegen:check
```

Voir [`docs/adr/0002-contrat-openapi-genere.md`](docs/adr/0002-contrat-openapi-genere.md).

### Autorisation côté serveur

Masquer une entrée de navigation ne constitue pas une autorisation. Les rôles
sont contrôlés sur l'API et testés route par route.

| Rôle technique   | Usage                                                    |
| ---------------- | -------------------------------------------------------- |
| `ADMIN`          | Administration complète                                  |
| `DIRECTION`      | Lecture transverse, supervision et opérations autorisées |
| `SUPERVISEUR`    | Pilotage et activité opérationnelle                      |
| `COMMERCIAL`     | Téléconseiller dans l'interface produit                  |
| `BANQUE_FINANCE` | Traitement des dossiers Banque & Finance                 |
| `ACCUEIL`        | Registre des visites                                     |

### Présence et données en direct

La présence mobile utilise une connexion WebSocket lorsque l'application est
active. Le serveur distingue le dernier signal, le temps actif observé, les
appels, les saisies, les opérations locales en attente et le retard de
synchronisation.

Le tableau de bord interroge régulièrement l'API. « En direct » signifie que le
panel vient de lire le serveur, pas qu'un téléphone hors ligne a déjà vidé son
outbox.

## Prérequis

- Node.js `>=24.18.0 <25`;
- pnpm `11.15.1`;
- Docker Engine avec le plugin Compose;
- Flutter `3.41.7` et Dart compatible avec `^3.11.5`;
- JDK 21 pour le générateur Dart;
- Android SDK et `adb` pour le mobile.

Les versions Node sont déclarées dans `.node-version`, `.nvmrc` et
`package.json`. La version pnpm est fixée par `packageManager`.

## Installation locale

### 1. Configurer l'environnement

```bash
cp .env.example .env
```

Renseigner au minimum deux secrets JWT différents d'au moins 32 caractères:

```bash
openssl rand -base64 48
openssl rand -base64 48
```

Les secrets restent dans `.env`, ignoré par Git. `.env.example` décrit toutes
les variables acceptées et leurs valeurs locales.

### 2. Installer les dépendances

```bash
pnpm install
cd apps/mobile
flutter pub get
cd ../..
```

### 3. Démarrer PostgreSQL

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

La base locale écoute sur `localhost:5434`. Ce Compose ne lance que PostgreSQL;
l'API et le web restent sur la machine pour le rechargement à chaud.

### 4. Préparer la base

```bash
pnpm db:deploy
pnpm db:seed
```

`db:deploy` applique les migrations aux espaces configurés. `db:seed` crée
l'administrateur initial et les comptes de test définis dans `.env`.

### 5. Démarrer les applications

Dans deux terminaux:

```bash
pnpm --filter @crm/api dev
pnpm --filter @crm/web dev
```

Ou depuis la racine:

```bash
pnpm dev
```

| Service                 | Adresse                                  |
| ----------------------- | ---------------------------------------- |
| Panel web               | `http://localhost:3000`                  |
| API                     | `http://localhost:3001`                  |
| Swagger, si activé      | `http://localhost:3001/api/docs`         |
| OpenAPI brut, si activé | `http://localhost:3001/api/openapi.json` |
| PostgreSQL              | `localhost:5434`                         |

Pour démarrer aussi l'émulateur Android:

```bash
pnpm dx -- --mobile
```

Cette commande démarre PostgreSQL, applique les migrations, exécute le seed,
lance l'émulateur configuré, puis démarre l'API, le web et Flutter. Sans
`--mobile`, `pnpm dx` démarre seulement l'API si nécessaire.

## Application Android

Depuis `apps/mobile`:

```bash
flutter devices
flutter run
```

Sur l'émulateur Android, la machine hôte est généralement accessible par
`10.0.2.2`. Un appareil physique doit joindre une adresse disponible sur le
réseau local ou l'environnement de test.

Commandes courantes:

```bash
flutter analyze
flutter test
flutter build apk --debug
```

La signature, les ABI et la diffusion sont décrites dans
[`apps/mobile/README.md`](apps/mobile/README.md). Une modification native exige
une nouvelle release; une modification Dart compatible peut utiliser
Shorebird.

## Base de données

Le schéma se trouve dans `packages/database/prisma/schema.prisma`. Les
migrations sous `packages/database/prisma/migrations` sont du patrimoine de
production: elles sont toujours versionnées et ne se réécrivent pas après
déploiement.

| Commande            | Effet                                           |
| ------------------- | ----------------------------------------------- |
| `pnpm db:generate`  | Régénère le client Prisma                       |
| `pnpm db:migrate`   | Crée ou applique une migration en développement |
| `pnpm db:deploy`    | Applique les migrations aux espaces configurés  |
| `pnpm db:studio`    | Ouvre Prisma Studio                             |
| `pnpm db:seed`      | Charge les données locales initiales            |
| `pnpm db:seed:demo` | Recharge l'espace de démonstration              |
| `pnpm db:reset`     | Détruit et reconstruit la base ciblée           |

`db:reset` est destructif. Ne jamais l'exécuter sur une URL non vérifiée.

Pour ajouter une migration:

1. modifier `schema.prisma`;
2. lancer `pnpm db:migrate` avec un nom explicite;
3. relire le SQL produit;
4. lancer `pnpm db:generate`;
5. vérifier les tests concernés.

## Variables d'environnement

Le contrat complet est dans `.env.example`.

| Groupe           | Variables principales                                             |
| ---------------- | ----------------------------------------------------------------- |
| API              | `PORT`, `PUBLIC_WEB_URL`, `API_CORS_ORIGINS`, `API_DOCS_ENABLED`  |
| Base             | `DATABASE_URL`                                                    |
| Authentification | secrets JWT, durées et limites de connexion                       |
| Métier           | fuseau, région téléphonique et taille des lots de synchronisation |
| Fichiers         | répertoires APK, notes vocales et exports de base                 |
| Démonstration    | garde-fou et configuration du workspace                           |
| Web              | `API_INTERNAL_URL`                                                |
| Notifications    | rappels, rapport quotidien et transport Brevo                     |
| Mobile           | `SHOREBIRD_TOKEN` sur la CI ou le poste de release                |

Règles de sécurité:

- ne jamais committer `.env`, clé privée, keystore ou jeton;
- utiliser des secrets différents selon l'environnement;
- garder Swagger désactivé en production;
- n'activer les en-têtes proxy que derrière un proxy qui les réécrit;
- monter APK, enregistrements et exports sur des volumes persistants;
- traiter un export de base comme une copie complète des données clients.

## Commandes du monorepo

| Commande                | Description                                      |
| ----------------------- | ------------------------------------------------ |
| `pnpm dev`              | Lance le développement via Turborepo             |
| `pnpm build`            | Compile les paquets Node et le web               |
| `pnpm lint`             | Exécute Oxlint                                   |
| `pnpm typecheck`        | Vérifie les types TypeScript                     |
| `pnpm test`             | Exécute les tests unitaires                      |
| `pnpm test:integration` | Exécute les tests PostgreSQL                     |
| `pnpm test:e2e`         | Exécute les parcours Playwright                  |
| `pnpm test:coverage`    | Produit les rapports de couverture               |
| `pnpm dead-code`        | Recherche les fichiers et dépendances inutilisés |
| `pnpm format`           | Formate le dépôt avec Prettier                   |
| `pnpm format:check`     | Vérifie le formatage sans écrire                 |
| `pnpm codegen`          | Régénère OpenAPI et les clients TypeScript/Dart  |
| `pnpm codegen:check`    | Refuse toute dérive des fichiers générés         |
| `pnpm verify:local`     | Lance les contrôles locaux principaux            |

Les commandes Flutter se lancent séparément depuis `apps/mobile`.

## Tests et qualité

La vérification comprend:

- Vitest pour l'API, le web et les paquets TypeScript;
- tests d'intégration API contre PostgreSQL;
- Playwright pour les parcours du panel;
- Flutter Test pour les écrans, SQLite et la synchronisation;
- TypeScript, Oxlint, Prettier, Knip et `flutter analyze`;
- Gitleaks, Semgrep, OSV et Trivy pour la sécurité;
- Lighthouse, k6 et Maestro dans les contrôles étendus.

Avant une pull request:

```bash
pnpm verify:local
pnpm test:integration

cd apps/mobile
flutter analyze
flutter test
```

Un test ajouté doit avoir été observé en échec lorsque le comportement couvert
est volontairement cassé, puis en succès après restauration.

Voir [`docs/QUALITY.md`](docs/QUALITY.md) et [`E2E.md`](E2E.md).

## Organisation du dépôt

```text
.
├── apps/
│   ├── api/                  API NestJS et contrat OpenAPI
│   ├── mobile/               application Flutter Android
│   └── web/                  panel Next.js
├── packages/
│   ├── api-client/           client TypeScript généré
│   ├── api-client-dart/      client Dart généré
│   ├── database/             Prisma, migrations et seeds
│   └── typescript-config/    configurations TypeScript
├── docs/
│   ├── adr/                  décisions d'architecture
│   └── qa-mobile/            procédures de contrôle mobile
├── infra/
│   ├── docker/               développement et Compose autonome
│   └── dokploy/              production actuelle
├── tools/dev/                scripts de développement et génération
├── .github/workflows/        intégration continue et sécurité
├── AGENTS.md                 conventions d'ingénierie
├── E2E.md                    contrats des parcours navigateur
└── Plan.md                   historique consolidé de la refonte métier
```

Les répertoires `dist`, `.next`, `build`, `coverage`, `.turbo`, `.dart_tool` et
`node_modules` sont des sorties locales ignorées. Les sources générées des
clients OpenAPI sont volontairement suivies par Git.

## Déploiement

La production actuelle est gérée par Dokploy. Le déroulement attendu est:

1. construire les images depuis un commit identifié;
2. appliquer les migrations avant la nouvelle API;
3. attendre que l'API soit saine;
4. démarrer le panel web;
5. vérifier santé, journaux et dernière sauvegarde;
6. diffuser l'APK après confirmation de compatibilité avec l'API.

Ne pas lancer `infra/docker/docker-compose.prod.yml` sur l'hôte Dokploy: son
proxy occupe déjà les ports 80 et 443. Voir [`infra/README.md`](infra/README.md)
et [`infra/dokploy/README.md`](infra/dokploy/README.md).

Une migration de production doit rester compatible avec la version précédente
de l'API pendant un retour arrière. Une suppression de colonne ou de table se
livre donc en plusieurs étapes.

## Données persistantes et sauvegardes

PostgreSQL n'est pas le seul état à préserver. La production utilise aussi des
volumes pour les APK publiés, les notes vocales temporaires et les exports
intégraux en attente de téléchargement.

Les sauvegardes PostgreSQL de production sont envoyées hors du VPS. Une
sauvegarde n'est valide qu'après un exercice de restauration. La procédure, la
rétention et les alertes sont documentées dans `infra/README.md`.

## Conventions de contribution

- Réutiliser les paquets, composants et helpers existants avant d'ajouter du
  code.
- Garder les fonctions lisibles, les conditions plates et les abstractions
  justifiées par plusieurs usages réels.
- Ne pas modifier un client généré à la main.
- Ne pas modifier une migration déjà déployée.
- Ne pas affaiblir une règle de lint ou un test.
- Préserver le vocabulaire français contrôlé par les tests du web.
- Écrire les commits au format Conventional Commits avec une portée, par
  exemple `fix(mobile): reprendre une synchronisation occupée`.
- Ne jamais ajouter de signature ou mention d'assistant dans un commit.

Les règles détaillées sont dans `AGENTS.md`.

## Dépannage

### L'API ne démarre pas

Vérifier PostgreSQL sur le port 5434, `DATABASE_URL` et les deux secrets JWT.

```bash
docker compose -f infra/docker/docker-compose.yml ps
pnpm db:deploy
pnpm --filter @crm/api dev
```

### Le web répond mais les données échouent

Vérifier `API_INTERNAL_URL`, l'état de l'API et CORS. Une page rendue ne prouve
pas que l'API ou la base sont disponibles.

### Une saisie mobile n'apparaît pas encore

La saisie reste dans l'outbox jusqu'à confirmation du serveur. Vérifier le
compteur « En attente », la session, le réseau réel et la version de
l'application. « En direct » sur le panel ne garantit pas que tous les
téléphones ont terminé leur synchronisation.

### Le contrat est désynchronisé

```bash
pnpm codegen
pnpm codegen:check
```

Relire le diff généré. Ne jamais corriger directement les clients produits.

### Flutter ne trouve pas un fichier Drift généré

Depuis `apps/mobile`:

```bash
dart run build_runner build --delete-conflicting-outputs
```

Ces fichiers locaux restent nécessaires même lorsqu'ils sont régénérables.

## Documentation utile

- [`docs/design.md`](docs/design.md): langage visuel partagé.
- [`docs/QUALITY.md`](docs/QUALITY.md): qualité et CI.
- [`docs/adr/`](docs/adr): décisions d'architecture.
- [`docs/qa-mobile/`](docs/qa-mobile): validation Android.
- [`docs/migrations-en-attente.md`](docs/migrations-en-attente.md): opérations à surveiller.
- [`infra/README.md`](infra/README.md): Compose, sauvegardes et restauration.
- [`infra/dokploy/README.md`](infra/dokploy/README.md): production Dokploy.
- [`apps/mobile/README.md`](apps/mobile/README.md): build et diffusion Android.
