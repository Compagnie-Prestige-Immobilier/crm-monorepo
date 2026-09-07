# Migration v2 : plan et arbitrages

Statut : version 2 du plan, 8 septembre 2026. La version 1 (7 septembre) a été
soumise à cinq audits en lecture seule, archivés dans `docs/audit-v2/` : `api.md`,
`web.md`, `mobile.md`, `donnees-infra.md`, `critique-plan.md`. La critique a
relevé quinze erreurs factuelles et quatorze manques bloquants dans la
version 1 ; ce document les intègre. Chaque affirmation technique ci-dessous
renvoie à un `chemin:ligne` ou à une documentation officielle citée dans les
audits. Ce qui n'a pas pu être vérifié est marqué « à prouver en phase 0 ».

## 1. Pourquoi

| Mesure au 7 septembre 2026 | Valeur |
| --- | --- |
| Lignes écrites à la main (API, web, mobile, packages) | 165 000 |
| Lignes générées commises dans git (34 schémas Drift, tests de migration, client OpenAPI) | 212 000 |
| Routes API | 233 décorateurs sur 36 contrôleurs, 31 modules, plus un WebSocket hors routeur |
| Pages web (`page.tsx`) | 62, dont 55 dans les quatre espaces |
| Écrans mobile | 26, plus 5 feuilles modales |
| Fichiers Playwright | 80 specs, 19 900 lignes |
| Tâches planifiées | 7 crons |
| Chemins d'écriture mobile | 12 (6 par la file de sync, 2 par routes dédiées, 4 par HTTP direct) |
| Contraintes vivant seulement dans le SQL des migrations | 20 CHECK, 12 index partiels, 2 extensions, 1 fonction |

Ce que le produit fait tient en 55 000 à 70 000 lignes. Les deux décisions qui
coûtent le plus sont le moteur de synchronisation maison (`sync_engine.dart`
2 647 lignes, `sync.service.ts` 2 058 lignes, curseurs, tombstones,
`clearedFields`, idempotence à deux niveaux) et la double stack backend (classes
DTO Nest + Swagger, OpenAPI, codegen, relais Next).

## 2. Arbitrages

### 2.1 Pris le 7 septembre 2026

| Sujet | Décision |
| --- | --- |
| Backend | Next.js + Drizzle + zod, plus d'API séparée |
| Mobile | Flutter conservé, PowerSync à la place de la sync maison |
| Stratégie | Réécriture en parallèle, bascule unique, sans pilote, checklist de parité |
| Intouchable | Flutter ; les quatre espaces et les sept rôles |
| Téléphones le jour J | Mise à jour obligatoire, base locale vidée et resynchronisée |
| Infra conservée | Redis + SSE ; purge, dump, APK par l'API ; import/export Excel complets |
| Abandonné | Espace de démonstration |
| Tableaux de bord | Disposition personnalisable conservée |
| PowerSync | Auto-hébergé sur le VPS |
| Routes web | Un seul arbre, `projet` dans l'URL, redirections conservées |
| Authentification | Better Auth, hachages argon2id repris |
| Cadre | Gel des fonctionnalités sur `dev` |
| Base | Même Postgres, mêmes tables |
| Ordre | Socle, CHUES, Grand Public, Banque, Accueil, Admin |

### 2.2 Pris le 8 septembre 2026, après les audits

| Sujet | Décision | Conséquence |
| --- | --- | --- |
| `uploadData` | 2xx systématique + table de verdicts synchronisée | Reproduit le contrat actuel (`sync.service.ts:222-244`) ; l'écran « À corriger » lit la table de verdicts |
| Périmètre mobile | Buckets par rôle et par campagne, contre la recommandation | Changement de comportement ; nombre de buckets à mesurer en phase 0 ; limite PowerSync de 1 000 buckets par utilisateur |
| Réaffectation | Une fiche reste dans le bucket du téléconseiller tant qu'il a une ouverture non fermée dessus | Condition de jointure dans les règles de sync ; répond à la raison écrite dans `scope.ts:66-74` |
| Format de sync | Sync Streams, édition 3 | Autorise les JOIN nécessaires ; à valider en phase 0 |
| Hors Next | Un serveur Node personnalisé qui héberge Next, le WebSocket de présence et les crons | Un conteneur ; le mode `standalone` pur est abandonné |
| Phase 0 | Quatre preuves sur copie de prod avec go/no-go écrit | Voir §7 |
| Identité | Table `users` réutilisée via `modelName`/`fields` de Better Auth | Une seule identité ; `account` et `session` ajoutées ; hachages migrés vers `account.password` |
| Identifiant de connexion | E-mail ou nom d'utilisateur conservés, plugin `username` | Un champ à l'écran, aiguillage sur la présence de `@` |
| Révocation | Sessions Better Auth en base, JWT PowerSync d'une heure, coupure acceptée sous une heure | La détection de rejeu de refresh et la coupure en 30 s ne sont pas reconstruites |
| `payloadVersion` | Abandonné | La mise à jour obligatoire garantit un seul APK en circulation |
| Schéma `demo` | Supprimé en phase 0 par une release v1 de maintenance | Un seul schéma pour la publication ; retour arrière J+1 simplifié |
| Shorebird | Conservé dans la v2 | Aucun patch v1 publié après le début de la phase 7 ; patches v2 seulement après J |
| Tests | Quinze parcours métier + un seizième « matrice des rôles » paramétré | Remplace `roles-refus`, `roles-navigation`, `roles-renvois`, `roles-espaces`, `roles-trous` |
| Release v1 | Une seule release v1 de maintenance, exception nommée au gel | Contenu fermé : §7 phase 0 |
| Données locales | Code d'extraction jetable dans la v1 pour tout pousser avant vidage | Brouillons, preuves d'appel, rappels remontent ; rien n'est perdu |
| Durée | Environ 24 semaines, phase 0 de 3 semaines, durées figées après les preuves | Les durées de §7 sont indicatives |

## 3. Cible

```
Téléphones Flutter ──PowerSync SDK──► powersync-service (VPS, Traefik) ──réplication logique──► Postgres 18.4
      │                                        ▲                                      ▲
      │ uploadData ──► Next.js (route handlers)◄── navigateur                         │
      │                  │  Drizzle · Better Auth · zod                               │
      │                  ├── serveur Node : WebSocket présence, 7 crons, SSE          │
      │                  └── Redis (cache, invalidation)                              │
      └── HTTP direct : notes vocales, APK, ouvertures, mot de passe ────────────────┘
```

Stack, versions vérifiées :

- Next.js 16.2, React 19.2, zod 4.4 (catalogue du dépôt). Serveur Node
  personnalisé (`server.ts`) : Next, `@fastify/websocket` ou `ws` pour
  `/api/v1/presence/live`, `node-cron` pour les sept tâches de
  `docs/audit-v2/api.md` §2, SSE `/api/v1/live` en `ReadableStream`.
- Drizzle ORM. `drizzle-kit pull` sert de point de départ, puis relecture
  manuelle des 76 migrations : les 20 CHECK, 12 index partiels, l'index GIN
  `immutable_unaccent`, les extensions `unaccent` et `pg_trgm` sont réécrits à
  la main dans le schéma Drizzle (`docs/audit-v2/donnees-infra.md` §2). Les
  79 requêtes SQL brutes, concentrées dans `analytics/*`, sont portées telles
  quelles en `sql` Drizzle. `@updatedAt` et `uuid(7)` deviennent applicatifs.
- Better Auth sur la table `users` existante (`modelName: 'user'`, `fields`
  mappés), plugins `username`, `jwt` (EdDSA, JWKS sur `/api/auth/jwks`,
  `definePayload` avec `sub` et `role`, `expirationTime: '1h'`), `bearer`
  pour le mobile. `password.hash`/`.verify` sur l'argon2id actuel
  (`apps/api/src/modules/auth/password.ts`, paramètres `memoryCost 19456,
  timeCost 2, parallelism 1`). Politique 8 à 24 caractères conservée.
- PowerSync : `journeyapps/powersync-service`, stockage des buckets sur
  Postgres dans un schéma dédié, exclu des dumps ; `client_auth.jwks_uri` sur
  Better Auth, `audience` fixée ; Sync Streams édition 3. Prérequis :
  `wal_level = logical` (absent aujourd'hui, redémarrage de Postgres requis),
  publication `powersync` limitée aux tables du §5, rôle `powersync_role`.
- Mobile : `powersync` 2.4, `drift_sqlite_async` 0.3 (compatible avec
  `drift >=2.33.0 <2.34.0`). Le schéma Drift actuel n'est pas réutilisable :
  PowerSync n'a que trois types, des vues sur `ps_data__*`, pas d'index partiel
  ni de clé étrangère (`docs/audit-v2/critique-plan.md` E13). Les 28 tables de
  `schema.drift` sont re-spécifiées ; les 6 tables purement locales (`outbox`,
  `form_drafts`, `sync_state`, `attributions`, `preuves_appel`,
  `rep_callback_reminders`) sont remplacées ou reconstruites (§4).
- Module natif `sn.cpi.go` : neuf classes Kotlin conservées (`TelephonieChannel`,
  `AppelService`, `CpiCallScreeningService`, `SynchroService`, `BootReceiver`,
  `NetworkValidationChannel`, `TelephoniePrefs`, `UpdatesChannel`,
  `MainActivity`). `SynchroService` est rebranché sur `PowerSyncDatabase`
  au lieu du drain de l'outbox (`SynchroService.kt:88-98`).
- shadcn sur Base UI 1.7, Lucide : inchangés. Riverpod 3, go_router 17,
  Forui 0.21, Dio 5 : inchangés.

## 4. Écritures mobiles : les douze chemins

| Aujourd'hui | v2 |
| --- | --- |
| `representant`, `prospect`, `call_attempt`, `representant_comment`, `visite`, `appel_detecte` par la file de sync | Transactions PowerSync, `uploadData` vers `POST /api/v1/sync/upload`, un handler par entité, réponse 2xx, verdict par opération écrit dans `sync_verdicts` (synchronisée) |
| `rep_call_attempt` par route dédiée | Même voie, verdict dans `sync_verdicts` |
| `ouverture` (ouvrir, brouillon, fermeture) par routes dédiées | HTTP direct conservé : le verrou « une fiche à la fois » est une règle serveur synchrone (`ouvertures.controller.ts:46-55`) |
| Note vocale multipart (`phase2/call-attempts/:id/recording`) | HTTP direct conservé, PowerSync ne synchronise pas de binaire |
| `updateVisite` (correction) | HTTP direct conservé |
| `changeMyPassword` | Better Auth |

Règles serveur portées dans les handlers `uploadData`, avec verdict au lieu
d'exception : doublon de téléphone (`PROSPECT_PHONE_CONFLICT`,
`REPRESENTANT_PHONE_CONFLICT`), `REV_CONFLICT`, anti-squat d'identifiant,
ouverture du parcours (`openJourney`, `sync.service.ts:2021-2039`), bascule de
relation (`applyRelationChange`), journal de fiche (`recordFicheChange`),
rattachement des détections d'appel (`common/device-call.ts`), `lastCall*`,
rappel promis et son origine. L'ordre représentant → prospect → tentative →
fermeture d'ouverture est garanti par le handler, qui traite une transaction
PowerSync entière et rejette en verdict `skipped_dependency_failed` ce qui
dépend d'un parent refusé.

La table `sync_verdicts` remplace `sync_batches` et `sync_operations`. L'écran
« À corriger » (`corrections_screen.dart`) et ses feuilles la lisent. La fusion
manuelle de doublon (`ownership_sheet.dart`) devient un verdict `conflict` avec
la fiche existante en charge utile, et un geste « rattacher à la fiche
existante » qui réécrit les enfants côté serveur.

## 5. Descente : buckets et tables

Règles Sync Streams par rôle, à écrire en phase 1 et à mesurer en phase 0 :

- Référentiels (départements, IEF, banques, syndicats, canaux, professions,
  employeurs, pays, tranches, offres, listes du registre, motifs d'issue,
  statuts de qualification) : un bucket global, tous rôles.
- `representants` : encadrement et ADMIN, annuaire entier ; téléconseiller et
  chargé de clientèle, fiches créées par lui, confiées par un lot d'export
  actif (`lot_export_items`), ou ouvertes par lui (`ouvertures_fiche` non
  fermée).
- `prospects` : mêmes conditions, plus les prospects de ses représentants ; le
  chargé de clientèle reçoit en plus toute demande `CONVERTI`
  (`prospectReadScope`).
- `call_attempts`, `rep_call_attempts`, `representant_comments`,
  `device_call_detections` : enfants des fiches ci-dessus.
- `phase2_directory` : projection à six colonnes de `prospects` pour la
  détection de doublon hors ligne, jusqu'à 500 000 lignes
  (`schema.drift:611-644`). La sélection de colonnes dans une requête de sync
  est à prouver en phase 0 ; sinon ce canal reste en HTTP.
- `notifications` (`mine`), `rep_callback` (rappels promis), `sync_verdicts`.
- `visites` : ACCUEIL, ADMIN, DIRECTION.

Exclues de la publication : `sync_batches`, `sync_operations`,
`agent_activity_slots`, `dashboard_layouts`, `lot_export_items` sauf projection
avec `id` concaténé, `android_releases`, `app_settings`, `agent_heartbeats`,
`audit_logs`, `import_jobs`, tables bancaires et d'analytics.

`payloadVersion` disparaît. Un référentiel ajouté après une release exige une
release obligatoire.

## 6. Structure du dépôt

```
apps/go/            Next.js + serveur Node : panneau, API, WebSocket, crons, SSE
apps/mobile/        Flutter, réécrit sur la branche v2
packages/schema/    zod + types partagés, sans codegen
infra/              Dockerfiles, powersync.yaml, sync-streams.yaml, Traefik via Dokploy
docs/               ce plan, docs/audit-v2/, ADR, runbook
```

Disparaissent : `apps/api`, `apps/web`, `packages/api-client`,
`packages/api-client-chues` et `-grand-public` (remplacés par deux clients
`openapi-fetch` minimaux dans `apps/go`), `packages/database`,
`apps/mobile/drift_schemas`, tests de migration générés, `openapi.json`,
`docs/adr/0001` et `0002` (remplacés par un ADR v2). Le `seed` (46
départements, référentiels, workflow bancaire, compte initial,
`api-entrypoint.sh:57-72`) est réécrit en Drizzle dans `apps/go`.

## 7. Phases

Durées indicatives pour un binôme propriétaire + assistant. Les durées
définitives sont figées à la fin de la phase 0.

### Phase 0. Preuves et préparation, 3 semaines

Sortie : quatre preuves écrites, go/no-go signé par le propriétaire.

1. Restauration d'une sauvegarde Dokploy (`pg_dump -Fc`, `pg_restore`) sur un
   Postgres de travail. Jamais fait à ce jour (`docs/migrations-en-attente.md:50-54`).
   Sans restauration réussie, rien d'autre ne commence.
2. Sur cette copie : `wal_level = logical`, publication, rôle,
   `powersync-service` avec stockage Postgres, Sync Streams édition 3.
3. Preuve A, `uploadData` : un doublon de téléphone réel produit un verdict
   `conflict` lisible sur le téléphone sans bloquer la file.
4. Preuve B, buckets : nombre de buckets par utilisateur avec les règles du §5
   sur les volumes réels (3 080 représentants, 12 929 prospects, jusqu'à
   500 000 lignes d'annuaire). Critère : sous 1 000 par utilisateur avec marge.
5. Preuve C, téléphonie : `CpiCallScreeningService` lit la base PowerSync,
   `SynchroService` et l'isolat Workmanager coexistent avec une seule
   instance connectée.
6. Preuve D, schéma : `drizzle-kit pull` puis relecture des 76 migrations ;
   diff SQL entre le schéma Drizzle régénéré et la base réelle vide.
7. Release v1 de maintenance, exception nommée au gel : suppression du schéma
   `demo` et de `DEMO_WORKSPACE_ENABLED` ; refus de l'installation de mise à
   jour tant que `pendingSyncCount > 0` (`app_update_screen.dart:29,80-83`
   affiche mais ne bloque pas) ; extraction jetable qui pousse `form_drafts`,
   `preuves_appel` et `rep_callback_reminders` au serveur avant vidage ; gel
   des patches Shorebird v1.

### Phase 1. Socle, 4 semaines

`apps/go` : serveur Node personnalisé, Better Auth sur `users` avec
`username` et `jwt`, matrice des sept rôles en une table de garde par route,
layout des quatre espaces, Redis et invalidation par groupe, SSE, WebSocket de
présence, sept crons, `packages/schema`. Mobile : coque, connexion Better Auth
(`bearer`), PowerSync + Drift, règles du §5, `uploadData` et `sync_verdicts`,
module natif rebranché, écran de diagnostic, mise à jour obligatoire. Sortie :
un téléconseiller se connecte, reçoit ses fiches hors ligne, une saisie remonte
avec verdict, un appel détecté se rattache.

### Phase 2. CHUES, 6 semaines

Représentants, qualification (script, statuts, suggestions, personne
proposée), prospects, conversion avec champs configurables, ouvertures de
fiche (verrou, brouillon, chronomètre, libération), rappels et origines, mes
contacts, campagnes et lots d'export (14 routes, répartition, réaffectation,
retrait, exports xlsx/zip/pdf), commentaires, historique unifié et journal du
formulaire, notes vocales (upload, lecture, purge), supervision (activité,
présence, fiches restées), statistiques avec disposition personnalisable et
export classeur, `parametres-chues`. Mobile : les 26 écrans. Sortie :
checklist §8 cochée pour téléconseiller, chargé de clientèle, superviseur,
direction.

### Phase 3. Grand Public, 2 semaines

Même arbre, `projet` en paramètre. Formulaire Grand Public, consentement,
conversion, console, rappels, statistiques. Formulaire public `/demande/[jeton]`
avec Turnstile. Sortie : checklist Grand Public.

### Phase 4. Banque, 2 semaines

Dossiers, étapes, transitions, corrections ADMIN, demandes de création de
client, vue d'ensemble, export 3 feuilles. Sortie : checklist Banque & Finance.

### Phase 5. Accueil, 1,5 semaine

Registre, listes, tableau de bord, impression, import avec revue.

### Phase 6. Admin, 3 semaines

Utilisateurs (reprise de portefeuille, dernier admin), référentiels (29 + 10
routes), imports de masse unifiés (un seul système, job avec bail, tranches,
reprise), notifications (composeur, gabarits, Brevo, rappels planifiés,
compte rendu), plateformes d'enrôlement (tirage, indicateurs), paramètres,
champs de conversion, purge avec plan topologique, dump, APK (manifeste,
signature, obligatoire, retrait).

### Phase 7. Parité et bascule, 2,5 semaines

Seize parcours Playwright dont la matrice des rôles, smoke Maestro, checklist
complète sur copie de prod, runbook §9 répété deux fois à blanc.

Total indicatif : 24 semaines.

## 8. Checklist de parité

Une ligne par geste, cochée à la main sur la v2 branchée sur une copie de prod.

Téléconseiller et chargé de clientèle : connexion par e-mail et par nom
d'utilisateur ; ouvrir une fiche, brouillon, verrou « une fiche à la fois »,
libération ; qualifier (script, statut, motif, personne proposée, rappel
promis, prospects promis) ; ajouter un prospect avec doublon ; convertir
(méthode, rendez-vous, champs ajoutés, note vocale) ; rappels du jour et
alarmes ; mes contacts ; suggestions ; fiche représentant avec toute
l'histoire ; fiche prospect ; WhatsApp ; hors ligne complet, remontée avec
verdict, appel détecté rattaché, « À corriger » sur un doublon ; mise à jour
obligatoire refusée tant que la file n'est pas vide.

Superviseur et direction : tableau de bord et disposition ; activité et
présence ; fiches restées ouvertes ; campagnes ; représentants et prospects ;
listes de référence ; paramètres CHUES ; export classeur ; créneaux de travail.

Banque & Finance : vue d'ensemble ; dossier ouvert, avancé, rejeté, encaissé,
corrigé ; export ; demandes de création et refus notifié.

Accueil : visite saisie ; tableau de bord ; impression ; import et revue.

Admin : compte créé, promu, désactivé avec reprise, supprimé ; mot de passe
réinitialisé ; imports représentants, prospects, Grand Public, registre ;
notification envoyée, programmée, annulée ; gabarit rendu ; plateformes
d'enrôlement ; purge après sauvegarde ; dump ; APK publié, obligatoire,
retiré.

Transverse : anciennes adresses redirigées ; liens des notifications déjà
envoyées ; mots de passe actuels ; limiteurs de débit (connexion 10/min,
formulaire public 5/min, APK par `Range`) ; formulaire public avec Turnstile ;
SSE et présence.

## 9. Jour de bascule

Production réelle : Dokploy + Traefik + Cloudflare, applications `cpi-go-api`
et `cpi-go-web` (`infra/dokploy/deploy.py`), sauvegarde nocturne Dokploy vers
S3 au format `pg_dump -Fc`. Le `Caddyfile` et `backup.sh` du dépôt ne servent
pas en production.

1. J-7 : la release v1 de maintenance est sur tous les téléphones (vérifié par
   `heartbeat` et par le compteur de mises à jour). Aucun patch Shorebird v1.
2. J-1 : publication de l'APK v2 en mise à jour obligatoire avec date
   d'activation ; la v1 pousse ses files et refuse l'installation tant qu'il
   reste une saisie.
3. J, 1. Sauvegarde Dokploy déclenchée, fichier téléchargé hors du VPS,
   restauration vérifiée sur la machine de travail.
4. J, 2. Arrêt de `cpi-go-api` et `cpi-go-web` dans Dokploy. Vérification que
   `sync_batches` n'a plus de lot `IN_PROGRESS` et que la file d'extraction
   v1 est vide.
5. J, 3. Postgres : `ALTER SYSTEM SET wal_level = logical`, redémarrage du
   conteneur, publication et rôle.
6. J, 4. Migrations Drizzle : `account`, `session`, `verification`,
   `sync_verdicts`, schéma de buckets. Script de reprise des hachages vers
   `account`.
7. J, 5. Déploiement de `powersync-service` derrière Traefik sur un nouvel
   hôte `sync.cpi-chues.com`, Cloudflare en mode proxy avec règle
   d'exception pour l'agent `CPI-GO`, `readTimeout` Traefik à `0s` posé par
   `deploy.py` et versionné.
8. J, 6. Déploiement de `apps/go`. Vérification : connexion e-mail et nom
   d'utilisateur, JWKS lu par PowerSync, réplication active.
9. J, 7. Un téléphone de test : resynchronisation, saisie hors ligne remontée
   avec verdict, alarme de rappel réarmée.
10. J, 8. Ouverture générale.

Retour arrière, jusqu'à J+1 : arrêt de `apps/go` et de PowerSync, redémarrage
de `cpi-go-api` et `cpi-go-web` sur la même base. Les tables Better Auth,
`sync_verdicts` et le schéma de buckets restent sans gêner la v1. Le schéma
`demo` n'existe plus (phase 0). Au-delà de J+1, les écritures v2 ne sont pas
rejouables en v1.

## 10. Risques

| Risque | Preuve | Parade |
| --- | --- | --- |
| Buckets par rôle et par campagne au-delà de la limite PowerSync | `docs/audit-v2/critique-plan.md` §3 | Preuve B en phase 0 ; repli sur le tirage global si le critère échoue |
| Un verdict `conflict` mal géré laisse une saisie orpheline | `sync.service.ts:1689-1739` | Preuve A ; « À corriger » couvert par un parcours Playwright et Maestro |
| Réaffectation pendant une ouverture | `scope.ts:66-74` | Condition d'ouverture dans les règles de sync ; test de parcours |
| Compte désactivé qui synchronise encore jusqu'à une heure | `fresh-session.guard.ts:8,33-52` | Accepté par écrit le 8 septembre |
| Restauration jamais faite | `docs/migrations-en-attente.md:50-54` | Première tâche de la phase 0 |
| Réplication logique et purge de masse | `purge.service.ts` | Buckets hors dumps ; purge mesurée sur copie |
| Cloudflare : corps 100 Mo, agents non-navigateur bloqués | mémoire projet, `api_environment.dart:18` | Nouvel hôte PowerSync avec règles explicites ; APK servi par l'origine si nécessaire |
| Shorebird conservé : un patch peut remettre du code v1 | `shorebird.yaml:8` | Aucun patch v1 après le début de la phase 7 |
| Notes vocales, APK, dumps sur volumes | `recordings.service.ts`, `db-dump.runner.ts:25-34` | HTTP direct ; `postgresql-client` 18 dans l'image `apps/go` |
| Deux systèmes d'import de représentants aujourd'hui | `representants-import.service.ts`, `imports/representants.adapter.ts:20-64` | Un seul système en v2, celui à jobs |
| Gel de 24 semaines | §2.2 | Correctifs prod sur `prod`, reportés dans `v2` chaque vendredi ; une seule release v1 nommée |

## 11. Points restant à valider

- Volumes réels par table sur la copie de prod (aucun chiffre hors
  `prospects` et `representants`).
- Sélection de colonnes dans une requête Sync Streams pour `phase2_directory`.
- Hôte et certificat de `powersync-service` (`sync.cpi-chues.com`, certificat
  d'origine Cloudflare comme les deux autres).
- Qui coche la checklist par rôle.
- Sort des 54 défauts documentés dans `docs/qa-mobile/` : lesquels la v2 corrige
  par construction, lesquels restent.
