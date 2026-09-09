# Audit Prisma vers sqlc : ce qui passe, ce qui casse

Lecture seule, 8 septembre 2026. Verdict : le modèle ne change pas (57
modèles, aucun type exotique, `id` en `TEXT`, jointures peu profondes). Ce qui
casse est la couche de composition SQL : sur les 79 requêtes brutes, 13 sont
collables telles quelles, 56 sont assemblées à l'exécution.

## 1. Les 79 requêtes SQL brutes

80 sites `$queryRaw`/`$executeRaw`, dont une déclaration d'interface
(`prospects/last-attempt.ts:20`) : 79 requêtes réelles.

| Classe | Nombre | Sort |
| --- | --- | --- |
| Disparaissent en v2 (démo, multi-schéma, sync) | 10 | rien à porter |
| (a) statiques, collables | 13 | `sql/queries/` tel quel |
| (b) dynamiques | 56 | parade requise |

Disparaissent : `prisma/prisma.service.ts:51`, `deploy-workspaces.ts:33`,
`demo-workspace-factory.ts:69,83`, `demo-volume.ts:744,745`,
`sync/batch-store.ts:28,35,52`, `sync/sync.service.ts:1747`.
Statiques : `analytics/stock-representants.service.ts:24,35,42`,
`health/health.controller.ts:22`, `heartbeat/heartbeat.service.ts:55`,
`lots-export/lots-export.service.ts:898,901,976,979,1098,1102`,
`enrolement/indicateurs.service.ts:211`, `bank-cases/bank-case-stages.service.ts:50`.

Les fragments `PROSPECT_FROM`, `BANK_CASE_FROM`, `CLOSED_AT`, `SEGMENT_EXPR`
(`analytics/analytics.sql.ts:202`), `REP_FICHE_COLONNES`,
`prospectOutcomeColumns()` (`analytics/pilotage.sql.ts:74`) sont constants :
il suffit de les développer. Quatre causes de dynamisme réel :

| Cause | Où | Requêtes | Parade minimale |
| --- | --- | --- | --- |
| D1 prédicats optionnels | `analytics.sql.ts:10-33` (`prospectConditions`, 17 prédicats `:89-171`), `bank-cases.sql.ts:93-100`, `analytics/supervision.service.ts:1061-1070`, `enrolement/indicateurs.service.ts:230-238`, `ouvertures/ouvertures.service.ts:368-372`, `analytics/quality.service.ts:120-126` | 39 | `sqlc.narg` + `($1 IS NULL OR col = $1)`, au prix du plan générique |
| D2 liste de valeurs | `prospects/last-attempt.ts:44`, `enrolement/enrolement.service.ts:437` | 2 | `= ANY($1::text[])` |
| D3 identifiant ou expression variable | colonne de groupe `analytics.service.ts:347`, `quality.service.ts:233` ; unité `date_trunc` `analytics.service.ts:113`, `bank-cases-analytics.service.ts:136,153` ; tri `bank-cases.sql.ts:103-128` (10 variantes) ; table cible `lots-export.service.ts:998` ; CTE `supervision.service.ts:590,617,675,699` | 12 | une requête par variante ; pgx direct pour le tri |
| D4 `CASE` d'arité variable | `admin/supervision.service.ts:437-442`, `analytics/supervision.service.ts:555-562,77-86` | 3 | arité figée à 2 par `work-shifts.service.ts:26-38,44-46` : requête statique à 4 paramètres |

Coût de D1 : `prospectConditions` sert 25 agrégats sur `prospects` (~500 000
lignes). En `sqlc.narg`, PostgreSQL ne peut plus élaguer et les index
partiels (`prospects_a_revoir_idx`, `prospects_origin_idx`) ne servent plus.

## 2. Requêtes Prisma non brutes à risque

| Objet | Constat | Équivalent v2 |
| --- | --- | --- |
| `include` imbriqués | profondeur max 4, deux fois (`sync.service.ts:1437` disparaît, `export/representants-export.service.ts:153`) | jointures plates ou `sqlc.embed` |
| `groupBy` | 16 sites (`admin/supervision.service.ts:262-286`, `lots-export.service.ts:469,614,1165`, `reminders.service.ts:162`, `segment-conversions.service.ts:44,49`) | `GROUP BY` + `count(*) FILTER` |
| `aggregate` | `lots-export.service.ts:651` | `SELECT sum(...)` |
| `upsert` | 17 sites | `INSERT … ON CONFLICT … DO UPDATE` |
| `createMany` + `skipDuplicates` | 22 sites ; relecture obligatoire après écart silencieux documentée `representants-import.service.ts:172,266`, `imports/representants.adapter.ts:532` | `ON CONFLICT DO NOTHING` + relecture |
| `updateMany`/`deleteMany` | 58 / 47 | statiques |
| `ownerScope`, `attributionScope`, `prospectReadScope` | `common/scope.ts:20-22,45-50,52-93`, `OR` avec `lotItems.some` (`:38-43`) | une clause SQL nommée en Go, réutilisée |
| Pagination keyset | `bank-cases-export.service.ts:256-262`, `global-export.service.ts:65` | `WHERE ($1::text IS NULL OR id > $1) ORDER BY id LIMIT n`, seul `narg` sans coût |
| `unaccent`/trigram | `bank-cases.service.ts:403` déjà de forme sqlc ; `bank-cases.sql.ts:64` `unaccent()` non indexé | copier tel quel |

## 3. Types

Aucune colonne `uuid`, aucune `timestamptz` : identifiants `TEXT`
(`20260812122350_init/migration.sql:15,34,48`), instants `TIMESTAMP(3)` (168
occurrences), une `DATE` (`20260903110000_agent_activity_days/migration.sql:3`).

| Prisma | DDL | Go | `overrides` sqlc |
| --- | --- | --- | --- |
| `String @id @default(uuid(7))` | `TEXT NOT NULL` sans DEFAULT | `string` | non |
| `DateTime` | `TIMESTAMP(3)` | `time.Time` | oui pour les `NOT NULL` |
| `Decimal @db.Decimal(18,0)` (`schema.prisma:1571,1617`) | `DECIMAL(18,0)` | `string` (déjà exposé en chaîne `:1568-1570`) | oui |
| `Json` (12 champs) | `JSONB` (13 colonnes) | `json.RawMessage` | oui |
| `String[]`, `Int[]` | `TEXT[]`, `INTEGER[]` | `[]string`, `[]int32` | non |
| 37 enums | `CREATE TYPE` | types générés | non ; `DevicePlatform` et `NotificationAudience.DEPARTEMENT` mortes |

`@updatedAt` : 37 colonnes `NOT NULL` sans DEFAULT ni trigger
(`20260812122350_init/migration.sql:31`, `audits/donnees-infra.md:109`).
Recommandation : trigger `BEFORE INSERT OR UPDATE` par table, une fonction, une
migration goose au jour J, compatible v1 (Prisma envoie la valeur, le trigger
la réécrit à l'identique). L'alternative applicative expose ~150 `UPDATE` à un
oubli silencieux, et deux index en dépendent (`prospects_phase2_directory`
sur `(updatedAt, id)`, `schema.prisma:942`). `uuid(7)` : `google/uuid` v7 en
`TEXT`. `@map` : sqlc lit `camelCase` entre guillemets, noms Go `CreatedById`.

## 4. Le schéma de référence

`pg_dump --schema-only --no-owner --no-privileges --no-comments --schema=public`
puis relecture :

| Contenu | Traitement |
| --- | --- |
| `SET …`, `set_config('search_path')` | supprimer |
| `CREATE EXTENSION unaccent / pg_trgm` (`20260812141010_…/migration.sql:388-389`) | à prouver en phase 0 ; repli : commenter et créer dans la première migration goose |
| `CREATE FUNCTION immutable_unaccent(text)` (`20260823180000_…/migration.sql:16-22`) | conserver, sqlc doit connaître sa signature (`bank-cases.service.ts:403`) |
| index GIN opclass `public.gin_trgm_ops` (`:41-43`) | conserver ; commenter si sqlc refuse |
| 12 index partiels, ~35 `CHECK` sur 17 migrations | conserver : seule définition écrite de ces règles |
| `_prisma_migrations` | conserver en base, exclure de `sql/schema.sql` |

Le schéma `demo` doit avoir disparu avant le dump (57 tables en double sinon).

## 5. Tables et colonnes après l'abandon du mobile

| Objet | Réalité | Décision |
| --- | --- | --- |
| `sync_batches`, `sync_operations` | FK composite `sync_operations → sync_batches` (`init/migration.sql:325`), aucune FK entrante | supprimer à J+7, enfant d'abord |
| `device_call_detections` | aucune FK entrante (`admin/purge-plan.ts:8-10`) | supprimer à J+7 |
| `android_releases` | aucune FK entrante | supprimer à J+7 |
| `device_tokens` + `DevicePlatform`, `users.departementId` | migrations déjà écrites (`docs/migrations-en-attente.md:69-86`) | phase 0, indépendantes du mobile |
| `agent_heartbeats` | vivante (`heartbeat.service.ts:38`, `admin/supervision.service.ts:294`) | garder |
| `app_settings` | vivante, 7 consommateurs (`work-shifts`, `champs-conversion`, `dashboards`, `db-dump`, `enrolement`, `parametres-chues`) | garder |
| `payloadVersion` | n'existe pas en base ; `minPayloadVersion` sur `call_outcome_reasons` (`schema.prisma:2261`) et `statuts_qualification` (`:2335`) | garder, colonne inerte |
| `source MOBILE|APPEL` | suffixe de `audit_logs.action` (`fiche-change.ts:9-12`), texte | rien |
| enum `ChangeSource {WEB, MOBILE}` | `segment_changes`, `representant_relation_changes`, append-only | garder la valeur |
| 13 listes de référence (`banques`, `syndicats`, `canaux_provenance`, `professions`, `employeurs`, `pays`, `income_bands`, `offers`, `bank_rejection_reasons`, 4 `visite_*`) | mêmes 7 colonnes de base plus 1 ou 2 colonnes propres chacune (`schema.prisma` : `sigle`, `secteur`, `isTeaching`, `type`, `indicatif`, `minXof`/`maxXof`, `description`, `isSystem`) ; FK typées depuis `prospects`, `bank_cases`, `visites` | garder les 13 tables ; fusion en une table `kind` écartée (FK typées perdues, migration au jour J, retour arrière §7 cassé, aucun gain mesurable) ; un seul handler Go, `plan.md` §1.1 et §2.1 |
| 6 tables d'historique (`audit_logs`, `segment_changes`, `representant_relation_changes`, `app_setting_changes`, `visite_import_changes`, `lot_export_reaffectations`) | append-only, colonnes différentes, un `INSERT` sqlc de 5 lignes chacune | garder ; fusion écartée pour la même raison |

Migration goose J+7, sans `Down` :

```sql
-- +goose Up
DROP TABLE "sync_operations";
DROP TABLE "sync_batches";
DROP TYPE "OperationResult";
DROP TYPE "BatchStatus";
DROP TABLE "device_call_detections";
DROP TABLE "android_releases";
```

## 6. Transactions et verrous

31 sites `$transaction`, 26 en `READ COMMITTED` par défaut.

| Site | v1 | pgx |
| --- | --- | --- |
| `bank-case-stages.service.ts:50` | `pg_advisory_xact_lock(4271001)` | identique |
| `global-export.service.ts:182` | `RepeatableRead`, 120 s | `pgx.TxOptions{IsoLevel: pgx.RepeatableRead}`, rejouer sur `40001` |
| `admin/purge.service.ts:63,80` | 60 étapes (`purge-plan.ts:3-62`) | une transaction, `SET LOCAL statement_timeout`, pas de découpe |
| `lots-export.service.ts:220` | 120 s | idem |
| `import-runner.service.ts:303` | 60 s par tranche, bail `:284-297` | `pgx.Batch` + `:batchexec` |

Aucun `SELECT … FOR UPDATE` aujourd'hui : `rev` et index uniques partiels.
Verrou « une fiche à la fois » : index unique, `23505` = conflit métier.
Imports : `pgx.Batch`, pas `CopyFrom` (`CopyFrom` ignore `ON CONFLICT DO
NOTHING`, 22 sites en dépendent) ; `CopyFrom` vers table temporaire seulement
si une tranche mesurée dépasse 60 s.

## 7. Pool

Aujourd'hui `DATABASE_POOL_SIZE=10` divisé par deux (`prisma.service.ts:22`) :
5 connexions utiles. pgxpool : `MaxConns` 10, `MinConns` 2, `MaxConnLifetime`
30 min, `MaxConnIdleTime` 5 min, `QueryExecModeCacheStatement` (pas de pooler
en mode transaction), pas de `statement_timeout` global (`SET LOCAL` sur les
transactions longues). Exports de 500 000 lignes : pagination keyset déjà
écrite, pages de 1 000 lignes hors transaction, `StreamWriter` excelize ; pas
de curseur `DECLARE`/`FETCH` (transaction longue qui bloque le `VACUUM`).

## 8. Migrations goose et seed

Numérotation `YYYYMMDDHHMMSS` comme les 76 dossiers Prisma. `goose_db_version`
à côté de `_prisma_migrations` intacte. Au jour J : la seule migration est
celle des 37 triggers `updatedAt`, compatible v1. Annotations : `-- +goose
StatementBegin/End` autour de la fonction plpgsql, `-- +goose NO TRANSACTION`
pour `CREATE INDEX CONCURRENTLY`.

Seed (`packages/database/src/seed.ts:439-460`) : 20 `upsert`, contrôle
bloquant `DEPARTEMENT_COUNT` (`:104-105`), `seedAdmin` upsert-si-absent
(`:360-398`, ne jamais réécrire le mot de passe). `go run ./apps/go -seed`
garde exactement cette forme.

## 9. Dump et purge

`db-dump.runner.ts:17-23,33-36` : `pg_dump --format=plain --no-owner
--no-privileges --schema=public` tubé dans gzip 9, `stderr` borné à 4 000
octets (`:39-42`). Go : `exec.CommandContext` + `compress/gzip`
`BestCompression`. Purge : 60 étapes `PURGE_STEP_ORDER` (`purge-plan.ts:3-62`)
reprises telles quelles moins `syncOperations`, `syncBatches`,
`deviceCallDetections` ; `audit_logs` écrit après les suppressions
(`purge.service.ts:68-79`) ; garde « premier admin » (`:106-116`).

## 10. Arbitrages

| # | Question | Recommandation | Coût |
| --- | --- | --- | --- |
| 1 | 39 requêtes D1 | Mixte : sqlc pour les ~250 requêtes simples et les 13 statiques ; pgx direct avec `strings.Builder` + `[]any` (~40 l.) pour les 39 agrégats analytiques et le tri bancaire | 40 l. non typées au build contre un plan générique sur 500 000 lignes |
| 2 | `@updatedAt` | trigger, 37 tables, une migration au jour J | 1 fonction + 37 `CREATE TRIGGER` |
| 3 | `sql/schema.sql` | dump relu | une demi-journée en phase 0 |
| 4 | Plan « 79 collées telles quelles » | corriger : 13 collables, 56 à réécrire dont 12 en variantes | |
| 5 | Nettoyage J+7 | une seule migration, sans `Down` | fin du retour arrière |
| 6 | `device_tokens`, `departementId` | phase 0, release v1 | |
| 7 | Imports | `pgx.Batch` | |
| 8 | Pool | 10, mesurer avant de bouger | |

## Hypothèses et non vérifié

Le plan cite `ouvertures.service.ts:332` pour une requête à `:374`. 31
transactions et non 30. Coût du plan générique déduit, non mesuré. Le
comportement de sqlc 1.31 sur ce `schema.sql` (extensions, opclass, fonction)
est la preuve A de la phase 0. Aucun `EXPLAIN`, aucun volume par table hors
`prospects` et `representants`. ~35 `CHECK` comptés contre 20 annoncés, avec
des redéfinitions successives.
