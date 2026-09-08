# Registre des risques v2

Consolidé le 8 septembre 2026 à partir de `plan.md`, des cinq audits et d'une
relecture complète. Gravité : B = bloquant pour la bascule, H = haute, M =
moyenne. Phase = où le risque est traité. État : ouvert, couvert (parade
décidée), fermé (preuve faite).

## 0. Réévaluation du 8 septembre

Relecture de tous les documents après regroupement. Corrections apportées :

- `plan.md` §5 citait une table `rep_callback` qui n'existe pas côté serveur ;
  les rappels promis viennent de `scheduled_callbacks` et de
  `representants.nextCallbackAt`. Corrigé.
- La projection à six colonnes de `phase2_directory` était « à prouver » ;
  la documentation PowerSync confirme la sélection de colonnes et plusieurs
  buckets par table. Risque fermé.
- Le clone principal est aujourd'hui sur `prod`, 25 commits devant
  `origin/dev`, avec des modifications locales non commises dans
  `apps/api/src/modules/ouvertures`, `parametres-chues` et
  `apps/mobile/.../representant_qualification_screen.dart`. Le travail v2
  dans un worktree séparé (`plan.md` §0) est ce qui évite qu'une bascule de
  branche emporte ce genre d'en-cours.
- Le déploiement prod passe par le job CI `deploy` et `deploy.py redeploy`,
  Dokploy n'ayant pas de webhook (`audits/donnees-infra.md` §4). Le runbook
  a été aligné : l'étape 8 déploie par `deploy.py`.
- La release v1 de maintenance doit remonter au serveur le nombre
  d'opérations en attente par appareil, sinon J-7 ne peut pas être vérifié :
  `heartbeat` mesure la présence, pas la file (`presence-socket.service.ts:28-35`).
  Ajouté à R14.
- `lot_export_items` a une clé composite sans `id` ; elle n'est utilisée que
  dans les requêtes de flux, jamais synchronisée vers le téléphone. Aucun `id`
  concaténé à prévoir. La table `attributions` du mobile disparaît, remplacée
  par le bucket.
- Version 2.2 du plan (§2.3) : backend en Go, panneau SPA embarqué, sqlc et
  goose sur du SQL pur, sessions dans `refresh_tokens`. R5, R9, R12, R16, R24
  et R28 sont réécrits ci-dessous ; R37 et R38 ajoutés.

## 1. Bloquants pour la bascule

| N° | Risque | Preuve | Parade | Phase | État |
| --- | --- | --- | --- | --- | --- |
| R1 | Un 4xx dans `uploadData` bloque définitivement la file d'un téléphone | doc PowerSync « writing client changes » ; `sync.service.ts:222-244` | 2xx systématique, `sync_verdicts` synchronisée, « À corriger » la lit | 0 (preuve A), 1 | couvert |
| R2 | Buckets par rôle et par campagne au-delà de 1 000 par utilisateur | doc PowerSync sync rules ; 3 080 représentants, 12 929 prospects, annuaire 500 000 | Preuve B sur volumes réels ; repli sur tirage global + filtre appareil | 0 | ouvert |
| R3 | Réaffectation de campagne qui efface une fiche ouverte hors ligne | `scope.ts:66-74` | Condition « ouverte par moi » dans le flux ; test de parcours | 1, 7 | couvert |
| R4 | Restauration de sauvegarde jamais exécutée | `docs/migrations-en-attente.md:50-54`, `infra/README.md:243-248` | Première tâche de la phase 0, avant toute autre | 0 | ouvert |
| R5 | Le schéma de référence v2 diverge de la base réelle (20 CHECK, 12 index partiels, index fonctionnel) | `audits/donnees-infra.md` §2 | `sql/schema.sql` est le `pg_dump --schema-only` de la copie de prod ; sqlc compile chaque requête contre lui, preuve D | 0 | couvert |
| R6 | Téléphonie native et isolat Workmanager sous PowerSync (`.connect()` depuis une seule instance) | `background_sync.dart:19-64`, `CpiCallScreeningService` lit `cpi_go.sqlite` en direct | Preuve C | 0 | ouvert |
| R7 | `wal_level = logical` exige un redémarrage de Postgres en production | `docker-compose.prod.yml` sans `command`, `audits/donnees-infra.md` §7 | Étape J 3 du runbook, répétée à blanc | 7 | couvert |
| R8 | Douze chemins d'écriture mobile, dont quatre en HTTP direct | `api_port.dart:210-321` | Tableau `plan.md` §4 ; chaque chemin dans la checklist | 1, 2 | couvert |
| R9 | Sept crons et le WebSocket de présence à héberger dans le même processus que l'API | `imports.cron.ts:44`, `reminders.service.ts:96,137,191`, `db-dump.service.ts:110`, `recordings.service.ts:35`, `enrolement.service.ts:188`, `bootstrap.ts:78` | gocron et `coder/websocket` dans `main.go`, arrêt propre par `context` | 1 | couvert |
| R10 | Schéma `demo` migré à chaque démarrage, retour arrière J+1 impossible avec lui | `api-entrypoint.sh:35-44` | Suppression en phase 0 par la release v1 | 0 | couvert |
| R11 | Sync Streams édition 3 : format récent, non éprouvé dans ce dépôt | doc PowerSync « sync streams overview » | Preuve B écrite en Streams ; repli Sync Rules + colonne dénormalisée | 0 | ouvert |
| R12 | Deux identités si une table d'auth vit à côté de `users` | `schema.prisma:301-330` (dizaines de FK) | Aucune table ajoutée : `users.passwordHash` et `refresh_tokens` réutilisés (`schema.prisma:378-393`) | 1 | fermé |
| R13 | Perte de données locales au vidage (outbox refusée, brouillons, preuves d'appel, alarmes) | `schema.drift:556,984,1057` | Extraction jetable dans la release v1 ; alarmes réarmées depuis `nextCallbackAt` | 0, 7 | couvert |
| R14 | Impossible de savoir à J-3 quels téléphones ont encore une file | `presence-socket.service.ts:28-35` | La release v1 remonte `pendingCount` dans le heartbeat ; écran admin qui liste les retardataires | 0 | ouvert |

## 2. Hauts

| N° | Risque | Preuve | Parade | Phase | État |
| --- | --- | --- | --- | --- | --- |
| R15 | Compte désactivé qui synchronise encore jusqu'à une heure | `fresh-session.guard.ts:8,33-52` ; JWT PowerSync ≤ 24 h | JWT 1 h, accepté par écrit le 8 septembre | 1 | couvert |
| R16 | Rejeu de refresh token plus détecté | `auth.service.ts:119-128` | Jeton opaque unique de 30 jours haché dans `refresh_tokens`, révoqué à la déconnexion ; plus de rotation, accepté | 1 | couvert |
| R17 | Réplication logique et purge de masse : WAL et buckets | `purge.service.ts`, `purge-steps.ts` | Purge par tranches mesurée sur copie ; schéma de buckets exclu des dumps | 0, 6 | ouvert |
| R18 | Cloudflare : corps limité à 100 Mo, APK à 82 Mo avant ajout des bibliothèques PowerSync | mémoire projet ; `env.ts:75` | Mesurer l'APK v2 ; servir le téléchargement par l'origine si dépassement | 1 | ouvert |
| R19 | Cloudflare bloque certains agents non-navigateur ; nouvel hôte `sync.cpi-chues.com` | `api_environment.dart:18` (`CPI-GO/1.0`) | Règle explicite sur le nouvel hôte, testée depuis un téléphone réel | 0 | ouvert |
| R20 | Traefik `readTimeout 0s` posé par API Dokploy, non versionné | mémoire projet 2026-09-07 | Versionner dans `deploy.py` ; vérifier après chaque recréation de service | 0 | ouvert |
| R21 | Shorebird conservé : un patch v1 remet du code v1 en circulation ; un patch v2 doit respecter la signature | `shorebird.yaml:8`, `app-updates.controller.ts:164-173` | Aucun patch v1 après le début de la phase 7 ; patches v2 après J seulement | 7 | couvert |
| R22 | Notes vocales, APK, dumps : binaires hors PowerSync, `pg_dump` 18 dans l'image | `recordings.service.ts`, `db-dump.runner.ts:25-34`, `Dockerfile.web` sans client Postgres | HTTP direct ; `postgresql-client-18` dans `Dockerfile.go` | 1, 6 | couvert |
| R23 | Deux systèmes d'import de représentants en v1 | `representants-import.service.ts`, `imports/representants.adapter.ts:20-64` | Un seul système à jobs en v2 | 6 | couvert |
| R24 | Export `consolidated` à 500 000 lignes réécrit avec excelize | `export.service.ts:199-231` | `StreamWriter` d'excelize vers `http.ResponseWriter` ; mémoire relevée sur la copie de prod | 2 | ouvert |
| R25 | Gel de trois semaines, correctifs prod à reporter | `plan.md` §2 | Report chaque soir par merge de `origin/prod` dans le worktree v2 | toutes | couvert |
| R26 | 223 sites d'autorisation à reporter sans en perdre un | `audits/critique-plan.md` §2.2 | Table de garde par route dans `roles.go`, seizième parcours « matrice des rôles » généré depuis cette table | 1, 7 | couvert |
| R27 | Quatre limiteurs de débit à reproduire (600/min, 300/min, login 10/min, APK par `Range`) | `bootstrap.ts:103`, `app.module.ts:107-109`, `app-updates.controller.ts:42-59` | Un seul limiteur en v2 avec trois règles nommées ; ligne de checklist | 1 | couvert |
| R28 | Invalidation de cache couplée au SSE : un handler qui oublie `bump` perd une invalidation | `redis/cache.interceptor.ts:58-62` | Cache mémoire dans le processus Go ; une fonction `invalidate(group)` unique appelée par les handlers d'écriture ; parcours Playwright sur les référentiels | 1 | couvert |

## 3. Moyens

| N° | Risque | Preuve | Parade | Phase | État |
| --- | --- | --- | --- | --- | --- |
| R29 | Enums, `timestamptz`, `jsonb`, `Decimal`, `String[]` arrivent en texte côté client | `audits/donnees-infra.md` §7 | Schéma PowerSync explicite par table, conversion dans `data/` | 1 | couvert |
| R30 | `phase2_directory` : jusqu'à 500 000 lignes sur téléphone personnel | `schema.drift:611-644` | Projection à six colonnes confirmée par la doc ; `allowBackup=false` conservé | 1 | couvert |
| R31 | Formulaire public avec Turnstile oublié du périmètre v1 | `formulaire-public.controller.ts:50-59` | Phase 3, ligne de checklist | 3 | couvert |
| R32 | Ouvertures de fiche (verrou, brouillon, chronomètre) oubliées du périmètre v1 | `ouvertures.controller.ts:46-55` | Phase 2, HTTP direct, ligne de checklist | 2 | couvert |
| R33 | `sync_batches`/`sync_operations` lues par l'écran de diagnostic | `audits/critique-plan.md` §2.3 | Diagnostic réécrit sur `sync_verdicts` et l'état PowerSync | 1 | couvert |
| R34 | Volumes réels par table inconnus hors `prospects` et `representants` | aucun chiffre en dépôt | Comptage sur la copie de prod en phase 0 | 0 | ouvert |
| R35 | Ports de développement des deux worktrees en collision | `plan.md` §0 | v2 sur 4000, 5173, 5435, 8080 ; `.env.example` de `apps/go` | 1 | couvert |
| R36 | Colonnes mortes (`users.departementId`, `device_tokens`, `notifications.payload`) reprises telles quelles dans `sql/schema.sql` | `docs/migrations-en-attente.md` §1-2 | Migration de suppression en phase 0, avec la release v1, avant le `pg_dump` de référence | 0 | couvert |
| R37 | Choix de Go sans mesure de consommation préalable | `audits/donnees-infra.md` §4 : aucune limite ni relevé | `docker stats` sur la prod en phase 0 ; RSS du binaire relevée en phase 1 et comparée | 0, 1 | ouvert |
| R38 | Exports xlsx, pdf, zip et lecture d'APK réécrits sans les bibliothèques JS | `apps/api/package.json` | excelize, maroto, `archive/zip`, androidbinary ; chaque export et l'APK dans la checklist §8 | 2, 6 | couvert |

## 4. Défauts documentés de la v1 que la v2 corrige par construction

Source : `docs/qa-mobile/`, 54 défauts, dont ceux-ci nommés dans `audits/mobile.md`.

| Défaut | v1 | v2 |
| --- | --- | --- |
| SEC-01 / SYN-02 : la déconnexion ne purge pas la base locale, le compte suivant hérite des fiches et de la file | `auth_controller.dart:135-149` | `PowerSyncDatabase.disconnectAndClear()` à la déconnexion, obligatoire ; ligne de checklist |
| SYN-01 : identifiant de lot rejoué | `_stableBatchId` | Plus de lot : transactions PowerSync |
| SYN-04 : suppression écartée qui fait avancer le curseur | `_applyPage` | Plus de curseur maison |
| SYN-07 : un push en échec bloque le pull | `runOnce` | Descente et remontée indépendantes dans PowerSync |
| SEC-02 : rôle jamais réévalué après connexion | `AuthState.role` | Rôle dans le JWT d'une heure, session relue en base à chaque requête |
| SEC-04 : rejeu du refresh après timeout | `auth_interceptor.dart` | Jeton opaque unique, plus de rotation maison |
| Messages serveur bruts en anglais dans « À corriger » | `corrections_screen.dart` | `sync_verdicts` porte un code et un libellé français |

Défauts qui restent à traiter explicitement en v2, non couverts par la
construction : SEC-11 (`FLAG_SECURE`), FOR-04 (numéro international collé
tronqué, `core/utils/phone.dart`), EMU-01 (saisie zombie). À trancher en §11
de `plan.md`.
