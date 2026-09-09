# Dépannage de l'installation locale

Deux pièges connus du parcours d'installation du README. Aucun des deux ne
vient d'une machine mal configurée : ils se reproduisent sur un poste neuf, en
suivant le README à la lettre.

## 1. `pnpm dev` sur un dépôt jamais compilé

### Ce qu'on voit

Côté panel :

```
Module not found: Can't resolve '@crm/api-client/query'
```

Côté API :

```
Error: Cannot find module '<dépôt>/apps/api/dist/main.js'
Failed running 'dist/main.js'. Waiting for file changes before restarting...
```

Le panel répond alors 500 sur `/`, et la connexion rend 502 « Le serveur CPI
est injoignable » sur une pile pourtant saine.

### Pourquoi

`@crm/api-client` s'expose par `./dist/index.js` et `./dist/query.js`, jamais
par ses sources. Tant que `dist/` n'existe pas, la résolution échoue partout où
le panel importe `ApiError`, c'est-à-dire dès `app/layout.tsx`.

La tâche `dev` de `turbo.json` ne déclare pas `dependsOn: ["^build"]`, à la
différence de `build`. `pnpm dev` démarre donc les six paquets en parallèle
sans rien construire en amont.

Le message de l'API est le même défaut vu d'un autre angle : `dev` y lance
`tsc --watch` et `node --watch dist/main.js` côte à côte, et `node` ouvre le
fichier avant que `tsc` ne l'ait émis. Celui-là se règle seul à la première
émission, contrairement au précédent.

### Correctif

Compiler une fois avant le premier `pnpm dev` :

```bash
pnpm build
pnpm dev
```

Ensuite `pnpm dev` suffit : `dist/` survit entre les sessions.

## 2. `pnpm db:deploy` ne voit pas `DATABASE_URL`

### Ce qu'on voit

```
Error: DATABASE_URL est obligatoire pour deployer les migrations.
```

Alors que `pnpm db:migrate`, lancé juste avant dans le même terminal, a réussi.

### Pourquoi

RIEN dans la chaîne Prisma ne lit le `.env` de la racine. `db:migrate` ne
réussit pas parce qu'il trouve la variable : il réussit parce que
`packages/database/prisma.config.ts` retombe, hors production, sur une URL
écrite en dur :

```
postgresql://crm:crm@localhost:5434/crm
```

Cette URL est exactement celle du compose de développement, d'où l'illusion.
`deploy-workspaces.ts`, lui, lit `process.env.DATABASE_URL` sans repli et
s'arrête net.

Le piège n'est pas l'erreur, qui est claire, mais son revers silencieux :
**un `DATABASE_URL` modifié dans `.env` est ignoré par `db:migrate`**. Pointer
le fichier vers un autre port, un autre hôte ou une base distante ne change
rien, et les migrations partent sur la base locale sans le moindre
avertissement. Vérifié en mettant le port 9999 dans `.env` : `prisma migrate
status` s'est connecté sur 5434 et a rendu « Database schema is up to date ».

### Correctif

Exporter l'environnement avant toute commande de base :

```bash
set -a; . ./.env; set +a
pnpm db:deploy
```

Sur un `.env` dont une valeur contient une espace, `.` échoue sur cette ligne.
Un chargement qui les supporte :

```bash
while IFS= read -r line; do
  case "$line" in \#*|'') continue;; esac
  export "$line"
done < .env
```

C'est le même chargement qu'il faut pour `pnpm db:seed`, sans quoi le compte
administrateur n'est pas créé et le seed l'annonce discrètement :

```
admin : ignoré (SEED_ADMIN_EMAIL / _USERNAME / _PASSWORD absents)
```

## 3. `fvm install` échoue en HTTP 401

Sur un réseau qui filtre le protocole git intelligent, le clone de
`flutter/flutter` rend 401 alors que `git ls-remote` et `curl` passent :

```
error: RPC failed; HTTP 401 curl 22 The requested URL returned error: 401
fatal: expected flush after ref listing
```

Le symptôme ne dépend pas du dépôt cloné : `octocat/Hello-World` échoue de la
même façon. Seul `POST /git-upload-pack` est refusé, les `GET` passent.

L'archive officielle est un simple `GET`, et elle embarque le dépôt git, donc
`fvm` reconnaît la version extraite comme n'importe quelle autre :

```bash
VERSION=$(python3 -c "import json,pathlib;print(json.loads(pathlib.Path('apps/mobile/.fvmrc').read_text())['flutter'])")
curl -fL -o /tmp/flutter.tar.xz \
  "https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_${VERSION}-stable.tar.xz"
mkdir -p ~/fvm/versions
tar -xJf /tmp/flutter.tar.xz -C /tmp
mv /tmp/flutter ~/fvm/versions/"$VERSION"
fvm use "$VERSION"
```

Sans ce SDK, `pnpm build` échoue sur la seule tâche
`@crm/api-client-dart#generate`, avec une erreur qui nomme le vrai écart :

```
Because crm_api_client requires SDK version ^3.11.0, version solving failed.
```

Les sept autres tâches passent : le panel et l'API n'attendent pas Flutter.

## Pourquoi `db:deploy` et pas seulement `db:migrate`

Le README s'arrête à `pnpm db:migrate`, qui ne migre que le schéma `public`.
`PrismaClients.assertMigrationParity` compare au démarrage les migrations
appliquées à `public` et à `demo`, et refuse de laisser monter l'API sur une
divergence :

```
Les schémas PostgreSQL public et demo ne portent pas les mêmes migrations.
```

Un poste installé au README seul tombe donc dessus au premier `pnpm dev`.
`pnpm db:deploy` crée le schéma `demo` s'il manque et applique les migrations
aux deux.

## Parcours d'installation qui fonctionne

```bash
cp .env.example .env          # puis les deux secrets JWT, 32 caractères minimum
docker compose -f infra/docker/docker-compose.yml up -d
pnpm install
pnpm db:generate

while IFS= read -r line; do
  case "$line" in \#*|'') continue;; esac
  export "$line"
done < .env

pnpm db:deploy                # les DEUX schémas, pas seulement public
pnpm db:seed
pnpm build                    # avant le premier dev, voir §1
pnpm dev
```
