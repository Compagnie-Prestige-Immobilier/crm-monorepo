# Infrastructure, CPI GO

Deux fichiers Compose, deux usages qui ne se ressemblent pas.

| Fichier                          | Usage                                                                                                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docker/docker-compose.yml`      | Développement. Postgres (port hôte 5434) et Redis (6381) **seuls**. L'API et le web tournent sur la machine via `pnpm dev`, pour rester rechargeables à chaud. |
| `docker/docker-compose.prod.yml` | **VPS nu**, sans Dokploy. La pile entière : Caddy, web, API, migrations, Postgres, Redis, sauvegardes.                                                         |

> **Ce dépôt n'est PAS déployé par `docker-compose.prod.yml`.** La production
> tourne sur un hôte Dokploy, approvisionné par `dokploy/deploy.py`, et ce
> compose ne peut pas y tourner : son Caddy réclame les ports 80 et 443, que
> Traefik occupe déjà. Les sections 1 à 5 ci-dessous décrivent donc le cas du
> VPS nu. Pour la production réelle, lisez `dokploy/README.md`, et pour les
> sauvegardes la section 4, qui traite les deux cas séparément.

Les deux portent un `name:` explicite (`cpi-go`, `cpi-go-prod`). Sans lui, Compose
déduit le nom du projet du dossier parent, ici `docker`, et ce dépôt
partagerait son espace de noms avec tout autre projet CPI dont le compose vit
aussi dans `infra/docker/`. Un `up` remplacerait alors silencieusement les
conteneurs de l'autre projet, base de données comprise. Ce n'est pas
hypothétique : c'est la configuration de `CPI-PLATFORM-NEW`.

---

## 1. Préparer le VPS

Debian 12 ou Ubuntu 24.04, 2 vCPU / 4 Go suffisent pour la charge visée.

```bash
# Docker Engine + plugin compose (dépôt officiel, pas le paquet de la distro,
# qui est trop ancien pour `depends_on: condition: service_completed_successfully`)
curl -fsSL https://get.docker.com | sh

# Pare-feu : seuls 22, 80 et 443 sont exposés. Postgres n'a AUCUN port publié
# dans le compose de production, cette règle est une seconde barrière, pas la
# première.
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable

mkdir -p /srv/cpi-go/backups
```

**DNS** : un enregistrement `A` (et `AAAA` si le VPS a une IPv6) pointant sur le
serveur, propagé _avant_ le premier démarrage. Caddy demande son certificat au
boot ; si le domaine ne résout pas encore, le défi HTTP-01 échoue et Let's
Encrypt compte l'échec dans un quota.

## 2. Déployer

```bash
git clone <dépôt> /srv/cpi-go/app
cd /srv/cpi-go/app/infra/docker

cp production.env.example .env
chmod 600 .env
$EDITOR .env        # DOMAIN, ACME_EMAIL, POSTGRES_PASSWORD, les deux secrets JWT

# Les secrets : au moins 32 caractères, et DIFFÉRENTS l'un de l'autre.
openssl rand -base64 48

docker compose -f docker-compose.prod.yml up -d --build
```

Ordre de démarrage, imposé par les `depends_on` conditionnels :

```
postgres (healthy)  →  migrate (exit 0)  →  api (healthy)  →  web (healthy)  →  caddy
```

`migrate` est un conteneur éphémère qui lance `prisma migrate deploy` et
s'arrête. `api` attend sa **terminaison réussie**, pas son démarrage : aucune
requête n'est donc servie contre un schéma périmé. En `restart: "no"`, une
migration qui échoue doit bloquer le déploiement, pas boucler indéfiniment.

Vérifier :

```bash
docker compose -f docker-compose.prod.yml ps        # tout en `healthy`
docker compose -f docker-compose.prod.yml logs -f caddy
curl -I https://$DOMAIN
```

## 3. Mettre à jour

```bash
cd /srv/cpi-go/app && git pull
cd infra/docker
docker compose -f docker-compose.prod.yml up -d --build
```

`migrate` se relance à chaque `up` et applique les migrations en attente ; sans
migration nouvelle, il sort immédiatement en 0. Une brève coupure a lieu pendant
le redémarrage de `api` et `web`, le déploiement sans interruption n'est pas un
objectif ici : le panel admin est utilisé aux heures de bureau et l'app mobile
est _offline-first_, elle retentera sa synchronisation toute seule.

Revenir en arrière :

```bash
git checkout <tag précédent> && docker compose -f docker-compose.prod.yml up -d --build
```

⚠️ Un retour en arrière **ne défait pas les migrations**. Une migration
destructrice doit être déployée en deux temps (ajouter, migrer les données,
puis supprimer dans une version ultérieure), c'est la même contrainte que
celle qu'impose le portillon `oasdiff` en CI, pour la même raison : le parc
mobile installé n'est pas remplaçable à volonté.

## 4. Sauvegardes

**Deux mécanismes, sans rapport l'un avec l'autre, et un seul concerne la
production.** Les confondre a coûté cher : le service `backup` du compose a
longtemps été documenté ici comme s'il tournait, alors qu'il n'a jamais été lancé
sur l'hôte de production, qui est un hôte Dokploy. Lisez la section qui
correspond à votre serveur, pas l'autre.

| Serveur                  | Mécanisme                                       | Où atterrit le dump  |
| ------------------------ | ----------------------------------------------- | -------------------- |
| Hôte Dokploy, production | routeur `backup` de Dokploy, § 4.1              | bucket S3, hors VPS  |
| VPS nu, sans Dokploy     | service `backup` du compose, `backup.sh`, § 4.4 | bind mount de l'hôte |

### 4.1 Production, hôte Dokploy

Configuré une seule fois, depuis un poste :

```bash
export DOKPLOY_KEY='…'
export BACKUP_S3_ENDPOINT='https://s3.fr-par.scw.cloud'
export BACKUP_S3_BUCKET='cpi-go-sauvegardes'
export BACKUP_S3_REGION='fr-par'
export BACKUP_S3_ACCESS_KEY='…'
export BACKUP_S3_SECRET_KEY='…'
# À NE PAS OUBLIER : sans cette ligne, deploy.py enregistre la destination avec
# le fournisseur générique `Other`, alors que la procédure de restauration
# ci-dessous configure rclone en `Scaleway`. Sauvegarder et restaurer par deux
# implémentations S3 différentes marche souvent, et échoue le jour où l'une
# d'elles gère les métadonnées autrement.
export BACKUP_S3_PROVIDER='Scaleway'

python3 infra/dokploy/deploy.py backup
```

⚠️ Ces six variables ne sont lues qu'à la **création** de la destination.
`deploy.py` retrouve ensuite la destination par son nom et la réutilise telle
quelle : réexporter une clé ou un point d'accès différent puis relancer
`deploy.py backup` ne met **rien** à jour. Pour changer ces valeurs, passer par
Dokploy → Settings → S3 Destinations. Même remarque pour `BACKUP_SCHEDULE` et
`BACKUP_KEEP`, qui ne s'appliquent qu'à la création de l'entrée de sauvegarde.

La commande **refuse de s'exécuter** si aucun canal de notification Dokploy
n'écoute l'événement _Database Backup_ : une sauvegarde muette est précisément
la panne que ce dispositif corrige. Créez le canal d'abord, dans Dokploy →
Settings → Notifications, en cochant _Database Backup_.

Ce qu'elle met en place : chaque nuit à 2 h (heure serveur, identique à Dakar,
qui n'a pas d'heure d'été), Dokploy lance `pg_dump -Fc` dans le conteneur de la
base et pousse la sortie gzippée par `rclone` vers le bucket. Le fichier **ne
touche jamais le disque du VPS** ; c'est plus fort que « hors du volume de
données », et c'est la seule forme qui survive à la perte de la machine.
La rétention est bornée à 30 fichiers (`BACKUP_KEEP`), soit un mois : le bucket
ne peut pas gonfler indéfiniment, et une borne en _nombre de fichiers_ tient même
si la fréquence du cron change un jour, ce qu'une borne en jours ne ferait pas.

Vérifier l'état à tout moment :

```bash
python3 infra/dokploy/deploy.py status
```

La section « Sauvegardes » y affiche l'entrée, son horaire, sa rétention et le
résultat de la dernière exécution, ou une ligne rouge s'il n'y en a aucune.

**Comment un échec se voit.** Dokploy notifie sur le même canal la réussite _et_
l'échec. Un message arrive donc chaque nuit, et il se lit à trois niveaux :

| Ce que vous recevez | Ce que cela veut dire                                                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `success`           | rien à faire                                                                                                     |
| `error`             | la cause est dans le message ; corrigez, puis relancez à la main (Dokploy → la base → Backups → _Run manual_)    |
| **rien du tout**    | le cas le plus grave : ni succès ni échec signifie que rien ne s'est lancé. C'est ce silence qu'il faut traquer. |

Une alerte d'échec seule ne dirait jamais rien d'un ordonnanceur arrêté ou d'une
entrée désactivée par mégarde. C'est pour cela que la réussite est notifiée aussi :
le message nocturne est une preuve de vie, et son absence est le signal.

### 4.2 Restaurer, en production

⚠️ Les dumps Dokploy sont au **format `custom` de `pg_dump` (`-Fc`), puis
gzippés**. Ils se restaurent avec `pg_restore`, **jamais** avec `psql` : un
`gunzip | psql` sur ce fichier ne produit que des caractères illisibles et une
erreur de syntaxe à la première ligne. C'est l'inverse du format produit par
`backup.sh` (§ 4.4), qui lui est du SQL en clair.

Le plus simple et le plus sûr, sous pression : **Dokploy → la base
`cpi-go-postgres` → onglet Backups → le fichier voulu → _Restore_**. L'interface
affiche les journaux en direct et applique exactement la commande ci-dessous.

À la main, depuis une session SSH sur le VPS, si l'interface est indisponible :

```bash
# 1. Le remote rclone, défini par variables d'environnement, sans fichier de config.
export RCLONE_CONFIG_CPI_TYPE=s3
export RCLONE_CONFIG_CPI_PROVIDER=Scaleway
export RCLONE_CONFIG_CPI_ENDPOINT='https://s3.fr-par.scw.cloud'
export RCLONE_CONFIG_CPI_REGION=fr-par
export RCLONE_CONFIG_CPI_ACCESS_KEY_ID='…'
export RCLONE_CONFIG_CPI_SECRET_ACCESS_KEY='…'

# 2. Choisir le fichier. LISTER D'ABORD, ne pas composer le chemin de tête.
#
#    `deploy.py` ne configure qu'un préfixe, `cpi-go/postgres/` (BACKUP_PREFIX).
#    Le reste de la clé S3, un éventuel segment d'application en tête et le
#    nom exact du fichier, est composé par Dokploy et n'a jamais été observé sur
#    ce
#    bucket, faute d'exercice de restauration. Un chemin recopié à l'aveugle
#    depuis cette page peut donc renvoyer un 404 au moment précis où l'on en a
#    besoin. La liste, elle, est toujours juste.
rclone ls cpi:cpi-go-sauvegardes/ | sort -k2

# 3. Le conteneur de la base, dont le nom porte le suffixe engendré par Dokploy.
PG=$(docker ps --filter name=cpi-go-postgres --format '{{.ID}}' | head -1)
API=$(docker ps --filter name=cpi-go-api --format '{{.ID}}' | head -1)

# 4. Arrêter l'API AVANT de restaurer : --clean supprime les objets un par un,
#    et une requête qui arrive au milieu lit une base à moitié démontée.
docker stop "$API"

# 5. Restaurer. --clean --if-exists remplace le contenu existant ; -O ignore les
#    propriétaires, qui n'existent pas dans un conteneur neuf.
#    <clé> est la ligne EXACTE recopiée depuis la sortie de l'étape 2.
#    Le suffixe est `.sql.gz` mais le contenu est une archive `custom` : c'est
#    Dokploy qui nomme ainsi, et c'est pg_restore qui a raison, pas le nom.
rclone cat 'cpi:cpi-go-sauvegardes/<clé>' \
  | gunzip \
  | docker exec -i "$PG" pg_restore -U crm -d crm -O --clean --if-exists

docker start "$API"
```

`pg_restore` signale des avertissements sur les objets absents même avec
`--if-exists` ; ce sont des avertissements. Seule une sortie non nulle compte.

### 4.3 Éprouver la restauration, chaque trimestre

**Une sauvegarde non testée n'est pas une sauvegarde**, et jusqu'à la mise en
place décrite en § 4.1 aucun exercice de ce genre n'avait jamais eu lieu ici :
il n'y avait rien à restaurer. Le premier est donc à faire dès l'activation, pas
au trimestre prochain.

Dans une base jetable, à côté de la base réelle, sans jamais y toucher :

```bash
PG=$(docker ps --filter name=cpi-go-postgres --format '{{.ID}}' | head -1)

docker exec "$PG" createdb -U crm crm_restore_test
# <clé> : la ligne exacte recopiée depuis `rclone ls`, cf. § 4.2 étape 2.
rclone cat 'cpi:cpi-go-sauvegardes/<clé>' \
  | gunzip | docker exec -i "$PG" pg_restore -U crm -d crm_restore_test -O

# Le contrôle qui compte : des lignes, pas seulement un schéma.
#
# Les noms sont EN MINUSCULES ET AU PLURIEL : ce sont les noms de tables
# PostgreSQL réels, posés par les `@@map` de schema.prisma, et non les noms de
# modèles Prisma. `select ... from "Prospect"` échoue avec
# « relation "Prospect" does not exist ». Il n'existe par ailleurs aucune table
# Dossier ni Encaissement : la table des dossiers bancaires est `bank_cases`.
#
# ON_ERROR_STOP=1 n'est pas décoratif. Sans lui, psql signale les trois erreurs
# sur stderr, poursuit et sort en 0 : l'exercice de restauration se conclut par
# un succès sur une base vide, ce qui est l'exact contraire de son objet.
docker exec "$PG" psql -U crm -d crm_restore_test -v ON_ERROR_STOP=1 \
  -c 'select count(*) from prospects;' \
  -c 'select count(*) from bank_cases;' \
  -c 'select count(*) from representants;'

docker exec "$PG" dropdb -U crm crm_restore_test
```

Un schéma restauré avec zéro ligne partout est un échec, pas une réussite. C'est
la seule vérification qui distingue une sauvegarde d'une archive vide.

### 4.4 VPS nu, sans Dokploy

**Ne s'applique pas à la production actuelle.** Sur un VPS lancé avec
`docker-compose.prod.yml`, le service `backup` boucle en tâche de fond : une
sauvegarde au démarrage, puis une par jour à `BACKUP_HOUR`, avec rotation au-delà
de `BACKUP_RETENTION_DAYS` (14 par défaut).

Les dumps sont écrits dans `BACKUP_DIR`, un **bind mount de l'hôte**, jamais dans
le volume `pgdata` : une sauvegarde qui disparaît avec le volume qu'elle protège
n'est pas une sauvegarde. Chaque dump est écrit en `.partial` puis renommé, un
VPS redémarré en plein `pg_dump` ne laisse pas derrière lui une archive tronquée
qui passerait pour valide.

```bash
docker compose -f docker-compose.prod.yml logs backup   # dernier cycle
ls -lh /srv/cpi-go/backups
```

Ici le dump est du **SQL en clair** gzippé, donc `psql` et non `pg_restore`. Le
suffixe le dit : `crm-AAAAMMJJ-HHMMSS.plain.sql.gz`. Les archives du § 4.1 se
nomment `.sql.gz` alors qu'elles sont au format `custom` ; le `.plain.` est là
pour qu'on ne confonde pas les deux fichiers à trois heures du matin.

```bash
docker compose -f docker-compose.prod.yml stop api web

gunzip -c /srv/cpi-go/backups/crm-AAAAMMJJ-HHMMSS.plain.sql.gz \
  | docker compose -f docker-compose.prod.yml exec -T postgres \
      psql -U crm -d crm -v ON_ERROR_STOP=1

docker compose -f docker-compose.prod.yml start api web
```

Deux détails sans lesquels cette commande ne fait pas ce qu'elle annonce.

- **`-v ON_ERROR_STOP=1`.** Par défaut `psql` signale chaque instruction en
  échec et continue, puis sort en **0**. Une restauration à moitié appliquée se
  lit alors comme une réussite, et l'API redémarre sur une base incohérente.
- **Le dump doit contenir ses `DROP`.** `pg_dump --format=plain` sans `--clean`
  n'émet que des `CREATE` : rejoué sur la base existante, il échoue à la
  première table (« relation already exists ») et, avec `ON_ERROR_STOP=1`, ne
  restaure rien du tout. `backup.sh` pose donc `--clean --if-exists`, et les
  dumps produits depuis remplacent le contenu en place. **Pour une archive plus
  ancienne, écrite avant ce changement**, il faut recréer la base d'abord :

  ```bash
  C="docker compose -f docker-compose.prod.yml"
  $C stop api web
  $C exec -T postgres dropdb -U crm --force crm
  $C exec -T postgres createdb -U crm crm
  gunzip -c /srv/cpi-go/backups/<ancien>.sql.gz \
    | $C exec -T postgres psql -U crm -d crm -v ON_ERROR_STOP=1
  $C start api web
  ```

Deux limites à connaître, qui sont la raison pour laquelle la production ne
repose pas sur ce mécanisme :

- **Rien ne prévient en cas d'échec.** `backup.sh` écrit `ÉCHEC` sur sa sortie
  standard et continue ; encore faut-il lire `docker compose logs backup`.
- **Le `BACKUP_DIR` reste sur le VPS.** Il doit être répliqué ailleurs (rclone,
  rsync, snapshot du fournisseur), sans quoi un serveur perdu emporte la base
  _et_ ses sauvegardes.

## 5. TLS

Caddy obtient et renouvelle seul les certificats Let's Encrypt pour `DOMAIN`.
Les certificats vivent dans le volume `caddy-data`.

**Ne pas supprimer ce volume.** Let's Encrypt limite à 5 certificats par domaine
et par semaine ; quelques `docker compose down -v` successifs suffisent à
épuiser le quota et à laisser le site sans certificat pendant plusieurs jours.
Pour mettre au point un déploiement, décommenter la ligne `acme_ca` du
`Caddyfile`, qui bascule sur l'environnement de test de Let's Encrypt (quota
généreux, certificat non reconnu par les navigateurs).

`Strict-Transport-Security` est posé sur un an : un navigateur qui a vu cet
en-tête refusera le HTTP en clair sur ce domaine pendant un an. Ne l'activer
qu'une fois le domaine définitif et le certificat obtenu.

## 6. Images

| Fichier                 | Cibles                                                  |
| ----------------------- | ------------------------------------------------------- |
| `docker/Dockerfile.api` | `runner` (API NestJS) et `migrator` (migrations Prisma) |
| `docker/Dockerfile.web` | panel Next.js en sortie `standalone`                    |

Le contexte de build est la **racine du dépôt**. Les deux images découpent le
workspace avec `turbo prune --docker`, ce qui sépare la couche d'installation
des dépendances de la couche des sources : modifier une ligne de `apps/web` ne
réinstalle pas les dépendances de l'API.

Trois points qui ne sont pas évidents à la lecture :

- **`migrator` dérive de `builder`, pas de l'image de production.**
  `prisma migrate deploy` a besoin du CLI Prisma **et** de
  `packages/database/prisma.config.ts`, qui importe `prisma/config`, deux
  `devDependencies` absentes d'une image `--prod`. Le conteneur vit trente
  secondes ; sa taille n'a pas d'importance, sa correction si.
- **Le client Prisma est régénéré après l'installation `--prod`**, avec un CLI
  global épinglé sur la même version que `@prisma/client`. L'installation de
  production efface `node_modules`, donc le client généré pendant la phase de
  build avec lui.
- **Les images compilent le code généré committé, elles ne le régénèrent pas.**
  Régénérer exigerait le workspace complet, plus Java et Flutter, dans le
  contexte de build. C'est la CI (job `contract`) qui garantit que l'arbre
  committé correspond au contrat, voir `docs/adr/0002`.

`apps/web/next.config.ts` **doit** déclarer `output: 'standalone'`, sinon
`Dockerfile.web` échoue à l'étape finale sur un `COPY` introuvable.

## 7. Exploitation courante

```bash
C="docker compose -f docker-compose.prod.yml"

$C ps                      # état et santé
$C logs -f api             # journaux (plafonnés à 5 × 20 Mo par service)
$C exec postgres psql -U crm -d crm
$C restart api
$C down                    # sans -v : les volumes et les certificats restent
```

Postgres n'a aucun port publié. Pour l'inspecter depuis un poste, passer par le
conteneur (`exec psql` ci-dessus) ou par un tunnel SSH, ne pas ajouter un
`ports:` en clair sur l'interface publique.

---

## Ports

| Port    | Où            | Quoi                                             |
| ------- | ------------- | ------------------------------------------------ |
| 80, 443 | VPS, public   | Caddy, le seul service exposé                    |
| 3001    | réseau Docker | API                                              |
| 3000    | réseau Docker | web                                              |
| 5432    | réseau Docker | Postgres, **jamais publié**                      |
| 5434    | poste de dev  | Postgres de développement (`docker-compose.yml`) |

Le 5434 en développement n'est pas arbitraire : `CPI-PLATFORM-NEW` occupe déjà
le 5433 et une installation Postgres classique prend le 5432. S'y connecter par
mégarde reviendrait à travailler dans la base d'un autre projet.
