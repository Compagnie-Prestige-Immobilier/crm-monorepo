# Déploiement Dokploy, CPI GO

Un seul script, `deploy.py`, et des étapes à lancer dans l'ordre. Chacune est
**idempotente** : relancée, elle retrouve l'existant au lieu de le doubler.

```bash
export DOKPLOY_KEY='votre-clé-api'

python3 infra/dokploy/deploy.py provision   # Postgres + les deux applications
python3 infra/dokploy/deploy.py configure   # dépôt, build, variables, domaines
python3 infra/dokploy/deploy.py deploy      # démarrage
python3 infra/dokploy/deploy.py backup      # sauvegarde nocturne, voir plus bas
python3 infra/dokploy/deploy.py status      # état courant, sauvegardes comprises
```

`provision`, `configure` et `deploy` s'enchaînent avec `deploy.py all`.
`backup` en est volontairement exclu : il réclame les coordonnées d'un stockage
S3 que l'opérateur seul détient, et un `all` qui échouerait faute de bucket
ferait échouer un déploiement par ailleurs correct.

La clé n'est **jamais** écrite dans un fichier : elle ne vit que dans la variable
d'environnement, le temps de la session.

## Pas de workflow GitHub de déploiement

Il n'y en a volontairement aucun. Dokploy possède déjà le dépôt, la clé de
déploiement, les variables et les domaines : un workflow ne ferait que lui
demander de reconstruire, en dupliquant un secret d'API et des identifiants
pour rien.

Le déploiement se lance d'ici :

```bash
export DOKPLOY_KEY='…'
python3 infra/dokploy/deploy.py deploy
```

Le script configure aussi le volume Dokploy `cpi-go-apk-releases`, monté sur
`/repo/storage/releases`. Les APK publiés depuis **Paramètres → Release Android**
survivent ainsi aux reconstructions et redéploiements de l'API. Même chose pour
`cpi-go-db-dumps` sur `/repo/storage/db-dumps`, qui porte les exports à la
demande. Ces deux volumes **ne sont pas des sauvegardes** : ils vivent sur le
disque du VPS, et le second est vidé dès le téléchargement de l'export. Les
sauvegardes sont un dispositif à part, décrit plus bas.

Un workflow SSH lançant `docker-compose.prod.yml` sur ce VPS serait pire que
rien : il démarrerait Caddy sur les ports 80 et 443, déjà tenus par le Traefik
de Dokploy, et l'un des deux ne monterait pas.

## Pourquoi pas `docker-compose.prod.yml`

Le compose de production lance Caddy sur les ports 80 et 443. Sur un hôte
Dokploy ces ports appartiennent à Traefik : les deux entreraient en collision et
l'un ne démarrerait pas. La forme retenue est native, un service Postgres, deux
applications construites depuis leurs Dockerfile, et laisse à Traefik le
domaine et le TLS, qui lui reviennent.

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

## Après le déploiement

Depuis un terminal du conteneur API, **une seule fois** :

```bash
pnpm --filter @crm/database db:deploy   # migrations
pnpm --filter @crm/database db:seed     # référentiels + compte administrateur
```

Sans le seed, aucune saisie n'est possible : les banques, syndicats et
départements sont des clés étrangères obligatoires.

Les données de démonstration s'activent depuis le panel web
(**Paramètres → Mode démonstration**), jamais en ligne de commande.

## Fichiers engendrés, jamais commités

| Fichier              | Contenu                                                |
| -------------------- | ------------------------------------------------------ |
| `.secrets.generated` | mot de passe Postgres, secrets JWT, mot de passe admin |
| `.ids.generated`     | identifiants Dokploy des trois services                |

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

> **État actuel : à activer.** Tant que `deploy.py backup` n'a pas été lancé,
> cet hôte n'a **aucune** sauvegarde automatique, et `deploy.py status` l'affiche
> en rouge. Le service `backup` de `docker-compose.prod.yml` n'y change rien :
> ce compose ne tourne pas ici, pour la raison expliquée plus haut.

Le dispositif retenu est le routeur `backup` natif de Dokploy : `pg_dump -Fc`
dans le conteneur de la base, poussé par `rclone` vers un stockage S3, donc
**hors du VPS**. Le raisonnement complet, et les deux solutions écartées, sont
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

Le script éprouve l'accès au bucket **avant** d'enregistrer quoi que ce soit,
puis déclenche une sauvegarde immédiate : un fichier doit apparaître dans le
bucket et une notification de réussite arriver, sous la minute. Ne considérez
l'étape faite qu'après avoir vu les deux.

| Réglage       | Défaut      | Variable          |
| ------------- | ----------- | ----------------- |
| Horaire       | `0 2 * * *` | `BACKUP_SCHEDULE` |
| Rétention     | 30 fichiers | `BACKUP_KEEP`     |
| Nom du bucket | (requis)    | `BACKUP_S3_*`     |

L'heure serveur vaut l'heure de Dakar : `Africa/Dakar` est sur UTC toute l'année,
il n'y a pas de décalage saisonnier à rattraper.

### 4. Surveiller

Un message arrive **chaque nuit**, en réussite comme en échec. C'est délibéré :
une alerte d'échec seule ne dirait jamais rien d'un ordonnanceur arrêté. Aucun
message du tout est donc le signal le plus grave, pas le plus rassurant.

```bash
python3 infra/dokploy/deploy.py status   # entrée, horaire, dernière exécution
```

**La procédure de restauration, avec les commandes exactes, est dans
`../README.md`, section 4.2.** Elle utilise `pg_restore` et non `psql` : les
dumps Dokploy sont au format `custom`, pas du SQL en clair.

## Après la mise en ligne

- Lancer `deploy.py backup`. Sans lui, la perte du VPS est définitive.
- Éprouver la restauration une première fois (`../README.md`, section 4.3), puis
  chaque trimestre. Une sauvegarde non testée n'est pas une sauvegarde.
- Régénérer la clé d'API Dokploy : elle a circulé en clair.
- Changer le mot de passe administrateur à la première connexion.
- Repasser `DEMO_MODE_ALLOWED` à `false` le jour où de vraies fiches entrent
  dans cette base.
