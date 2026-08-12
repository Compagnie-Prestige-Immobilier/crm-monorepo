# Infrastructure — CPI GO

Deux fichiers Compose, deux usages qui ne se ressemblent pas.

| Fichier                          | Usage                                                                                                                                               |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docker/docker-compose.yml`      | Développement. Postgres **seul**, sur le port hôte 5434. L'API et le web tournent sur la machine via `pnpm dev`, pour rester rechargeables à chaud. |
| `docker/docker-compose.prod.yml` | Production. La pile entière : Caddy, web, API, migrations, Postgres, sauvegardes.                                                                   |

Les deux portent un `name:` explicite (`cpi-go`, `cpi-go-prod`). Sans lui, Compose
déduit le nom du projet du dossier parent — ici `docker` — et ce dépôt
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
# dans le compose de production — cette règle est une seconde barrière, pas la
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
requête n'est donc servie contre un schéma périmé. En `restart: "no"` — une
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
le redémarrage de `api` et `web` — le déploiement sans interruption n'est pas un
objectif ici : le panel admin est utilisé aux heures de bureau et l'app mobile
est _offline-first_, elle retentera sa synchronisation toute seule.

Revenir en arrière :

```bash
git checkout <tag précédent> && docker compose -f docker-compose.prod.yml up -d --build
```

⚠️ Un retour en arrière **ne défait pas les migrations**. Une migration
destructrice doit être déployée en deux temps (ajouter, migrer les données,
puis supprimer dans une version ultérieure) — c'est la même contrainte que
celle qu'impose le portillon `oasdiff` en CI, pour la même raison : le parc
mobile installé n'est pas remplaçable à volonté.

## 4. Sauvegardes

Le service `backup` boucle en tâche de fond : une sauvegarde au démarrage, puis
une par jour à `BACKUP_HOUR`, avec rotation au-delà de
`BACKUP_RETENTION_DAYS` (14 par défaut).

Les dumps sont écrits dans `BACKUP_DIR`, un **bind mount de l'hôte**, jamais
dans le volume `pgdata` : une sauvegarde qui disparaît avec le volume qu'elle
protège n'est pas une sauvegarde. Chaque dump est écrit en `.partial` puis
renommé — un VPS redémarré en plein `pg_dump` ne laisse pas derrière lui une
archive tronquée qui passerait pour valide.

```bash
docker compose -f docker-compose.prod.yml logs backup   # dernier cycle
ls -lh /srv/cpi-go/backups
```

Restaurer :

```bash
docker compose -f docker-compose.prod.yml stop api web
gunzip -c /srv/cpi-go/backups/crm-AAAAMMJJ-HHMMSS.sql.gz \
  | docker compose -f docker-compose.prod.yml exec -T postgres psql -U crm -d crm
docker compose -f docker-compose.prod.yml start api web
```

**Une sauvegarde non testée n'est pas une sauvegarde.** Restaurer le dernier
dump dans une base jetable au moins une fois par trimestre :

```bash
docker compose -f docker-compose.prod.yml exec postgres createdb -U crm crm_restore_test
gunzip -c <dump> | docker compose -f docker-compose.prod.yml exec -T postgres psql -U crm -d crm_restore_test
docker compose -f docker-compose.prod.yml exec postgres dropdb -U crm crm_restore_test
```

Le `BACKUP_DIR` doit être répliqué hors du VPS (rclone, rsync, snapshot du
fournisseur). Un serveur perdu emporte sinon la base _et_ ses sauvegardes.

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
  `packages/database/prisma.config.ts`, qui importe `prisma/config` — deux
  `devDependencies` absentes d'une image `--prod`. Le conteneur vit trente
  secondes ; sa taille n'a pas d'importance, sa correction si.
- **Le client Prisma est régénéré après l'installation `--prod`**, avec un CLI
  global épinglé sur la même version que `@prisma/client`. L'installation de
  production efface `node_modules`, donc le client généré pendant la phase de
  build avec lui.
- **Les images compilent le code généré committé, elles ne le régénèrent pas.**
  Régénérer exigerait le workspace complet, plus Java et Flutter, dans le
  contexte de build. C'est la CI (job `contract`) qui garantit que l'arbre
  committé correspond au contrat — voir `docs/adr/0002`.

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
conteneur (`exec psql` ci-dessus) ou par un tunnel SSH — ne pas ajouter un
`ports:` en clair sur l'interface publique.

---

## Ports

| Port    | Où            | Quoi                                             |
| ------- | ------------- | ------------------------------------------------ |
| 80, 443 | VPS, public   | Caddy — le seul service exposé                   |
| 3001    | réseau Docker | API                                              |
| 3000    | réseau Docker | web                                              |
| 5432    | réseau Docker | Postgres, **jamais publié**                      |
| 5434    | poste de dev  | Postgres de développement (`docker-compose.yml`) |

Le 5434 en développement n'est pas arbitraire : `CPI-PLATFORM-NEW` occupe déjà
le 5433 et une installation Postgres classique prend le 5432. S'y connecter par
mégarde reviendrait à travailler dans la base d'un autre projet.
