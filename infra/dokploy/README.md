# Déploiement Dokploy — CPI GO

Trois scripts à lancer dans l'ordre. Chacun est **idempotent** : relancé, il
retrouve l'existant au lieu de le doubler.

```bash
export DOKPLOY_KEY='votre-clé-api'

bash infra/dokploy/01-provision.sh    # Postgres + les deux applications
bash infra/dokploy/02-configure.sh    # dépôt, build, variables, domaines
bash infra/dokploy/03-deploy.sh       # démarrage
```

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
survivent ainsi aux reconstructions et redéploiements de l'API.

Un workflow SSH lançant `docker-compose.prod.yml` sur ce VPS serait pire que
rien : il démarrerait Caddy sur les ports 80 et 443, déjà tenus par le Traefik
de Dokploy, et l'un des deux ne monterait pas.

## Pourquoi pas `docker-compose.prod.yml`

Le compose de production lance Caddy sur les ports 80 et 443. Sur un hôte
Dokploy ces ports appartiennent à Traefik : les deux entreraient en collision et
l'un ne démarrerait pas. La forme retenue est native — un service Postgres, deux
applications construites depuis leurs Dockerfile — et laisse à Traefik le
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
**Full (strict)** — et pas avant, sinon le site répond 526 entre les deux
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

## Fichiers engendrés — jamais commités

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
ouvertes — à corriger d'urgence. Un `502` ou `526` signale que le certificat
d'origine n'est pas en place.

## Après la mise en ligne

- Régénérer la clé d'API Dokploy : elle a circulé en clair.
- Changer le mot de passe administrateur à la première connexion.
- Repasser `DEMO_MODE_ALLOWED` à `false` le jour où de vraies fiches entrent
  dans cette base.
