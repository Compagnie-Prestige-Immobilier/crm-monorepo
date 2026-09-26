# Déploiement Dokploy, CPI GO

Un seul script, `deploy.py`, et des étapes à lancer dans l'ordre. Chacune est
**idempotente** : relancée, elle retrouve l'existant au lieu de le doubler.

```bash
export DOKPLOY_KEY='votre-clé-api'

python3 infra/dokploy/deploy.py provision   # Postgres + l'application cpi-go
python3 infra/dokploy/deploy.py configure   # dépôt, build, variables fusionnées, domaines
python3 infra/dokploy/deploy.py deploy      # démarrage
python3 infra/dokploy/deploy.py redeploy    # cpi-go seul, refusé sans sauvegarde de moins de 26 h
python3 infra/dokploy/deploy.py backup      # sauvegarde nocturne, voir plus bas
python3 infra/dokploy/deploy.py status      # état courant, sauvegardes comprises
```

`provision`, `configure` et `deploy` s'enchaînent avec `deploy.py all`.
`backup` en est volontairement exclu : il réclame les coordonnées d'un stockage
S3 que l'opérateur seul détient. `redeploy` refuse de partir tant que la
dernière sauvegarde réussie a plus de 26 h : le binaire applique ses migrations
au démarrage, et certaines suppriment des données.

`configure` lit l'environnement déjà posé sur `cpi-go` et le complète : une
variable posée à la main (`GLPI_*`, `KAIRO_*`, `BREVO_WEBHOOK_SECRET`,
`PLATEFORME_WEBHOOK_SECRET`, `SUPPORT_AI_*`, `DATABASE_URL_<NOM>`…) reste en
place, et un défaut du script ne remplace jamais une valeur existante. Seules
les intégrations exportées pour la session (`BREVO_API_KEY`, `TURNSTILE_*`,
`PLATEFORME_*_URL/TOKEN`, `IMPORT_LEADS_URL`) écrasent la valeur en place.

La clé n'est **jamais** écrite dans un fichier : elle ne vit que dans la variable
d'environnement, le temps de la session.

## Déploiement automatique sur `prod`

Ce paragraphe affirmait le contraire, et l'affirmation était fausse dans ses
conséquences. Le raisonnement — « Dokploy possède déjà le dépôt, un workflow ne
ferait que dupliquer un secret » — oubliait un fait : Dokploy est branché en
**custom git** (`application.saveGitProvider`), pas via l'intégration GitHub.
Il ne reçoit donc AUCUN crochet quand `prod` bouge. Une fusion vers `prod` avait
toutes les apparences d'une mise en ligne sans en produire une seule, et
personne ne le voyait avant d'aller regarder la version servie.

Depuis le 16 septembre 2026, GitHub ne déploie plus rien et ne teste pas
`prod` : la CI ne tourne que sur `dev`. La mise en ligne passe par Dokploy en
git, qui construit le Dockerfile. Tant que l'application reste en « custom
git », il faut soit activer l'intégration GitHub de Dokploy (auto-déploiement
sur `prod`), soit lancer le déploiement à la main, soit
`python3 infra/dokploy/deploy.py redeploy` (`redeploy` et **pas**
`deploy`, voir la docstring de `cmd_redeploy`). Seule cette dernière voie
vérifie la sauvegarde avant de déployer.

### Le seul réglage à faire

```bash
gh secret set DOKPLOY_KEY --repo Compagnie-Prestige-Immobilier/crm-monorepo
```

`DOKPLOY_URL` peut être posée en variable de dépôt pour viser un autre hôte ;
absente, le script retombe sur sa valeur par défaut. Toutes les autres valeurs
(`PROJECT_ID`, `ENVIRONMENT_ID`, les domaines) sont dans le script.

### Le lancer à la main reste possible

```bash
export DOKPLOY_KEY='…'
python3 infra/dokploy/deploy.py redeploy   # cpi-go seul
python3 infra/dokploy/deploy.py deploy     # première mise en route, Postgres compris
```

Le script monte aussi `cpi-go-db-dumps` sur `/repo/storage/db-dumps`, qui porte
les exports à la demande, et `cpi-go-imports` sur `/repo/storage/imports`. Ces
volumes **ne sont pas des sauvegardes** : ils vivent sur le disque du VPS, et le
premier est vidé dès le téléchargement de l'export. Les sauvegardes sont un
dispositif à part, décrit plus bas.

Un workflow SSH lançant `docker-compose.prod.yml` sur ce VPS serait pire que
rien : il démarrerait Caddy sur les ports 80 et 443, déjà tenus par le Traefik
de Dokploy, et l'un des deux ne monterait pas.

## Le binaire Go

Une seule application, `cpi-go` (`Dockerfile` à la racine, port 4000), sert
l'API et le panneau sur `go.cpi-chues.com` et `go-admin.cpi-chues.com`.

Une seconde base (démo, client) se crée sur le conteneur Postgres existant,
puis se déclare dans l'environnement Dokploy de `cpi-go` par
`DATABASE_URL_<NOM>` ; la page de connexion la propose derrière `Ctrl+Shift+D` :

```bash
docker exec -i <postgres> psql -U crm -d crm -c 'CREATE DATABASE crm_demo'
docker exec -i <postgres> psql -U crm -d crm_demo -v ON_ERROR_STOP=1 -q < sql/schema.sql
docker exec -e DATABASE_URL=postgresql://crm:<mdp>@<postgres>:5432/crm_demo <cpi-go> /cpi-go -seed
```

## Pourquoi pas `docker-compose.prod.yml`

Le compose de production lance Caddy sur les ports 80 et 443. Sur un hôte
Dokploy ces ports appartiennent à Traefik : les deux entreraient en collision et
l'un ne démarrerait pas. La forme retenue est native, un service Postgres et une
application construite depuis le Dockerfile, et laisse à Traefik le domaine et
le TLS, qui lui reviennent.

`docker-compose.prod.yml` reste valable pour un VPS nu, sans Dokploy.

## À faire avant le premier déploiement

### 1. Certificat d'origine Cloudflare

Les deux domaines sont proxifiés (nuage orange). Traefik ne peut donc pas
obtenir de certificat Let's Encrypt : Cloudflare intercepte le challenge HTTP.

Dans Cloudflare → **SSL/TLS → Origin Server → Create Certificate**, en couvrant
les deux noms :

```
go.cpi-chues.com
go-admin.cpi-chues.com
```

Installez le certificat et sa clé sur le VPS, puis passez le mode SSL en
**Full (strict)**, et pas avant, sinon le site répond 526 entre les deux
opérations.

> Le mode **Flexible** est à proscrire ici : le tronçon Cloudflare → VPS
> circulerait en HTTP nu sur l'internet public, identifiants de connexion
> compris.

### 2. Accès Git

Le dépôt est privé et Dokploy n'a aucun fournisseur Git configuré. Créez une
clé de déploiement en lecture seule :

```bash
ssh-keygen -t ed25519 -C 'dokploy@cpi-go' -f ~/.ssh/cpi_go_deploy -N ''
cat ~/.ssh/cpi_go_deploy.pub
```

Déposez la partie publique dans GitHub → **Settings → Deploy keys → Add**, et la
partie privée dans Dokploy → **SSH Keys**.

### 3. DNS

| Type | Nom                      | Contenu         | Proxy  |
| ---- | ------------------------ | --------------- | ------ |
| A    | `go.cpi-chues.com`       | `72.61.198.237` | orange |
| A    | `go-admin.cpi-chues.com` | `72.61.198.237` | orange |

### 4. Bloquer l'accès direct au VPS

Avec `API_TRUST_PROXY_HEADERS=true`, le serveur Go fait confiance à l'en-tête
`CF-Connecting-IP` pour la limite de connexions par IP. Si le VPS reste
joignable directement (son IP est publiée dans ce fichier), n'importe qui peut
poser cet en-tête lui-même et contourner la limite.

Choisir l'une des deux protections, avant la mise en production :

- **Pare-feu aux plages Cloudflare** : n'autoriser le trafic entrant sur 80/443
  que depuis les [plages IP publiées par Cloudflare](https://www.cloudflare.com/ips/).
  Le script `infra/dokploy/pare-feu-cloudflare.sh`, lancé en root sur le VPS,
  pose ces règles avec `ufw` en gardant SSH ouvert. L'équivalent existe dans
  hPanel Hostinger (VPS → Pare-feu) avec les mêmes plages.
- **Authenticated Origin Pulls** : Cloudflare → **SSL/TLS → Origin Server**,
  activer _Authenticated Origin Pulls_ et faire vérifier par Traefik le
  certificat client `cloudflare.crt` que Cloudflare présente à chaque requête.

## Après le déploiement

Depuis un terminal du conteneur `cpi-go`, **une seule fois** :

```bash
/cpi-go -seed   # référentiels, workflow bancaire et compte administrateur
```

Sans le seed, aucune saisie n'est possible : les banques, syndicats et
départements sont des clés étrangères obligatoires.

## Migrations d'index `CONCURRENTLY`

`20260925230100` et `20260925230200` créent leurs index sans bloquer les
écritures, mais le binaire migre avec `lock_timeout=5s`. Derrière une
transaction longue (export, tirage de campagne : jusqu'à 120 s), l'attente
dépasse ce délai : la migration échoue, le conteneur sort en 1 et Dokploy le
relance jusqu'à ce que la base soit calme.

- Déployer ces versions hors pointe, sans export en cours.
- `20260925230100` retire d'abord les fiches en double dans un lot (la plus
  petite position reste). Pour les compter avant, lancer
  `tools/dev/audit-coherence.sql` sur une copie de la base.
- En cas d'échec, le journal de démarrage nomme la migration. Un
  `CONCURRENTLY` interrompu laisse un index `INVALID` : le supprimer avant de
  relancer.

```bash
docker exec -i <postgres> psql -U crm -d crm -Atc \
  'select indexrelid::regclass from pg_index where not indisvalid'
docker exec -i <postgres> psql -U crm -d crm -c 'DROP INDEX CONCURRENTLY IF EXISTS public."<index>"'
```

## Fichiers engendrés, jamais commités

| Fichier              | Contenu                                     |
| -------------------- | ------------------------------------------- |
| `.secrets.generated` | mot de passe Postgres, mot de passe admin   |
| `.ids.generated`     | identifiants Dokploy de la base et de l'app |

Les deux sont en `chmod 600` et listés dans le `.gitignore` local. Les secrets
sont engendrés une seule fois : une relance les relit, sinon les mots de passe
déjà en base deviendraient invérifiables et toutes les sessions seraient
invalidées.

## Vérification

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://go.cpi-chues.com/api/v1/referentiels/banques
```

**401 est le résultat attendu** : le service répond et le garde
d'authentification fait son travail. Un `200` signifierait que les routes sont
ouvertes, à corriger d'urgence. Un `502` ou `526` signale que le certificat
d'origine n'est pas en place.

## Sauvegardes

> Tant que `deploy.py backup` n'a pas été lancé, cet hôte n'a **aucune**
> sauvegarde automatique, `deploy.py status` l'affiche en rouge et
> `deploy.py redeploy` refuse de déployer. Le service `backup` de
> `docker-compose.prod.yml` n'y change rien : ce compose ne tourne pas ici.

Le dispositif retenu est le routeur `backup` natif de Dokploy : `pg_dump -Fc`
dans le conteneur de la base, compressé par `gzip` et poussé par `rclone` vers
un stockage S3, donc **hors du VPS**. Le raisonnement complet, et les deux solutions écartées, sont
en tête de `deploy.py`.

### 1. Un bucket, chez un tiers

Pas sur ce VPS : un MinIO installé à côté de Postgres retomberait avec lui.
Scaleway (`fr-par`), Backblaze B2 ou Wasabi coûtent quelques centimes par mois
pour ce volume. Créez le bucket, puis une clé d'accès limitée à ce seul bucket.

### 2. Un canal d'alerte, AVANT tout le reste

Dokploy → **Settings → Notifications** → un canal (Telegram et Slack se
configurent en une minute, sans serveur SMTP), en cochant **Database Backup**.

`deploy.py backup` **refuse de s'exécuter** tant qu'aucun canal n'écoute cet
événement. Ce n'est pas une précaution de confort : une sauvegarde silencieuse
est exactement la panne qu'on corrige ici, elle a l'air de fonctionner jusqu'au
jour où on en a besoin. Le canal doit aboutir sur une boîte **relevée**.

### 3. Activer

```bash
export DOKPLOY_KEY='…'
export BACKUP_S3_ENDPOINT='https://s3.fr-par.scw.cloud'
export BACKUP_S3_BUCKET='cpi-go-sauvegardes'
export BACKUP_S3_REGION='fr-par'
export BACKUP_S3_ACCESS_KEY='…'
export BACKUP_S3_SECRET_KEY='…'
export BACKUP_S3_PROVIDER='Scaleway'    # facultatif

python3 infra/dokploy/deploy.py backup
```

**À la première exécution seulement**, le script éprouve l'accès au bucket avant
d'enregistrer quoi que ce soit. Il déclenche ensuite une sauvegarde immédiate :
un fichier doit apparaître dans le bucket et une notification de réussite
arriver, sous la minute. Ne considérez l'étape faite qu'après avoir vu les deux
; le script, lui, ne vérifie pas le résultat de cette sauvegarde manuelle et
sort en 0 sans rien en savoir.

⚠️ **Les réglages ci-dessous ne s'appliquent qu'à la création.** Aux exécutions
suivantes, `deploy.py` retrouve la destination et l'entrée de sauvegarde par leur
nom et les reprend telles quelles : ni l'horaire, ni la rétention, ni les
identifiants S3 ne sont comparés ni mis à jour, et l'accès au bucket n'est pas
réévalué. Réexporter une variable puis relancer la commande est un **no-op
silencieux**. Pour changer une valeur déjà en place, passer par l'interface
Dokploy.

| Réglage       | Défaut      | Variable          | Modifiable par relance |
| ------------- | ----------- | ----------------- | ---------------------- |
| Horaire       | `0 2 * * *` | `BACKUP_SCHEDULE` | non                    |
| Rétention     | 30 fichiers | `BACKUP_KEEP`     | non                    |
| Nom du bucket | (requis)    | `BACKUP_S3_*`     | non                    |

L'heure serveur vaut l'heure de Dakar : `Africa/Dakar` est sur UTC toute l'année,
il n'y a pas de décalage saisonnier à rattraper.

### 4. Surveiller

Un message arrive **chaque nuit**, en réussite comme en échec. C'est délibéré :
une alerte d'échec seule ne dirait jamais rien d'un ordonnanceur arrêté. Aucun
message du tout est donc le signal le plus grave, pas le plus rassurant.

```bash
python3 infra/dokploy/deploy.py status   # entrée, horaire, dernière exécution
```

## Restaurer

Le fichier `<appName de la base>/cpi-go/postgres/<horodatage>.sql.gz` est un
dump au format `custom` compressé par `gzip` : il se relit avec `pg_restore`, pas
avec `psql`. Il ne couvre que la base `crm` ; une seconde base (`crm_demo`) n'est
pas sauvegardée par cette entrée.

On restaure dans une base **neuve**, à côté de celle en service, puis on échange
les noms : la base abîmée reste disponible tant que la restauration n'est pas
vérifiée.

```bash
# 1. Récupérer le dump voulu depuis le bucket (console S3, rclone ou aws s3 cp).
# 2. Arrêter cpi-go dans Dokploy : plus aucune écriture ni connexion à `crm`.
docker exec -i <postgres> psql -U crm -d postgres -c 'CREATE DATABASE crm_restauree'
gunzip -c <horodatage>.sql.gz \
  | docker exec -i <postgres> pg_restore -U crm -d crm_restauree --no-owner --no-acl --exit-on-error

# 3. Vérifier avant d'échanger : volumes des tables clés et dernière migration.
docker exec -i <postgres> psql -U crm -d crm_restauree -Atc \
  'select count(*) from prospects; select count(*) from ventes; select max(version_id) from goose_db_version'

# 4. Les dumps Dokploy sont pris sans droits (--no-acl) : rejouer ceux de l'assistant.
sed -n '/+goose Up/,/+goose Down/p' sql/migrations/20260925220000_assistant_lecture.sql \
  | docker exec -i <postgres> psql -U crm -d crm_restauree -v ON_ERROR_STOP=1

# 5. Échanger les noms, puis redémarrer cpi-go : goose applique les migrations postérieures au dump.
docker exec -i <postgres> psql -U crm -d postgres \
  -c 'ALTER DATABASE crm RENAME TO crm_avant_restauration' \
  -c 'ALTER DATABASE crm_restauree RENAME TO crm'
```

`crm_avant_restauration` se supprime une fois le service vérifié.

Une fois le rôle `crm_app` en place (section suivante), créer la base par
`CREATE DATABASE crm_restauree OWNER crm_app` et ajouter `--role=crm_app` à
`pg_restore` : restaurées par `crm` sans droits, les tables seraient
inaccessibles au service.

Exercice du 26 septembre 2026, sur la base locale : dump `-Fc` gzippé de 1,4 Mo,
restauration dans une base neuve avec les options ci-dessus, mêmes 77 tables,
même dernière migration et même nombre de fiches, rejeu des droits de l'assistant
sans erreur. À refaire sur un dump de production dès que le canal S3 est actif.

## Rôle Postgres sans superutilisateur

L'image `postgres` fait de `crm` son superutilisateur d'amorçage : une injection
SQL y obtiendrait `COPY … PROGRAM`, et ce rôle ne peut pas être rétrogradé. Le
binaire l'écrit en avertissement au démarrage tant qu'il s'y connecte. On crée
donc un rôle applicatif neuf, `crm_app`, propriétaire des objets ; `crm` reste
le superutilisateur des sauvegardes Dokploy, des extensions et des réparations.

Ordre imposé : d'abord déployer la version qui porte
`20260925220000_assistant_lecture.sql`, appliquée par `crm` au démarrage (elle
crée `assistant_lecture` et retire `set_config` à `PUBLIC`, ce qu'un rôle
ordinaire ne peut pas faire). Ensuite seulement, application arrêtée :

```bash
# 1. Le rôle, autorisé à créer les bases de démonstration et à endosser assistant_lecture.
docker exec -i <postgres> psql -U crm -d postgres -v ON_ERROR_STOP=1 \
  -c "CREATE ROLE crm_app LOGIN NOSUPERUSER NOCREATEROLE CREATEDB PASSWORD '<secret gardé dans .secrets.generated>'" \
  -c "GRANT assistant_lecture TO crm_app"

# 2. Dans chaque base servie, puis dans template1, modèle des bases de démonstration créées ensuite.
for base in crm crm_demo template1; do
  docker exec -i <postgres> psql -U crm -d "$base" -v ON_ERROR_STOP=1 \
    -c 'REVOKE EXECUTE ON FUNCTION pg_catalog.set_config(text, text, boolean) FROM PUBLIC' \
    -c 'GRANT EXECUTE ON FUNCTION pg_catalog.set_config(text, text, boolean) TO crm_app'
done

# 3. Dans chaque base servie : la base, le schéma et ses objets passent à crm_app.
#    REASSIGN OWNED BY crm est refusé : crm, rôle d'amorçage, possède le catalogue.
for base in crm crm_demo; do
  docker exec -i <postgres> psql -U crm -d "$base" -v ON_ERROR_STOP=1 <<'SQL'
ALTER DATABASE :"DBNAME" OWNER TO crm_app;
ALTER SCHEMA public OWNER TO crm_app;
DO $$
DECLARE
  ordre text;
BEGIN
  FOR ordre IN
    SELECT format('ALTER %s %s OWNER TO crm_app', CASE c.relkind WHEN 'v' THEN 'VIEW'
             WHEN 'm' THEN 'MATERIALIZED VIEW' WHEN 'S' THEN 'SEQUENCE' ELSE 'TABLE' END, c.oid::regclass)
    FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p', 'v', 'm', 'S')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid
                        AND (d.deptype = 'e' OR (c.relkind = 'S' AND d.deptype IN ('a', 'i'))))
    UNION ALL
    SELECT format('ALTER TYPE %s OWNER TO crm_app', t.oid::regtype)
    FROM pg_type t
    WHERE t.typnamespace = 'public'::regnamespace AND t.typtype IN ('e', 'd')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_type'::regclass AND d.objid = t.oid AND d.deptype = 'e')
    UNION ALL
    SELECT format('ALTER ROUTINE %s OWNER TO crm_app', p.oid::regprocedure)
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e')
  LOOP
    EXECUTE ordre;
  END LOOP;
END $$;
SQL
done
```

4. Dans Dokploy, remplacer `crm:<mdp>` par `crm_app:<secret>` dans `DATABASE_URL`
   et dans chaque `DATABASE_URL_<NOM>` de `cpi-go` (le service Postgres garde
   `crm`), puis redéployer.
5. Vérifier : l'avertissement de démarrage a disparu, une question à l'assistant
   répond, l'export de la base aboutit, et :

```bash
docker exec -i <postgres> psql -U crm_app -d crm -Atc 'select rolsuper from pg_roles where rolname = current_user'   # f
docker exec -i <postgres> pg_dump -U crm_app -d crm --schema=public -f /dev/null && echo pg_dump ok
```

Toute migration postérieure tourne sous `crm_app` : une extension non
approuvée (`trusted`) ou un droit sur `pg_catalog` se pose à la main avec `crm`.

Exercice du 26 septembre 2026, Postgres 16 local, base jetable migrée par `crm`
puis passée à `crm_app` : avant l'étape 2, `pg_dump` sous `crm_app` échoue sur
`set_config` ; après, il réussit, `SET ROLE assistant_lecture` lit `prospects`
et se voit refuser `users` et `set_config`, `CREATE DATABASE` réussit et
`-seed` passe sous `crm_app`. Une base créée par `crm_app` puis migrée par lui
reçoit toutes les migrations ; sans l'étape 2 sur son modèle, `set_config`
y reste ouvert à `assistant_lecture`, d'où `template1` dans la boucle.

## Après la mise en ligne

- Lancer `deploy.py backup`. Sans lui, la perte du VPS est définitive, et
  `redeploy` refuse de déployer.
- Éprouver la restauration ci-dessus une première fois sur une base jetable,
  puis chaque trimestre. Une sauvegarde non testée n'est pas une sauvegarde.
- Régénérer la clé d'API Dokploy : elle a circulé en clair.
- Changer le mot de passe administrateur à la première connexion.
