# Lancer la preview en local

Prérequis : Docker Desktop lancé.

## 1. Démarrer la base de données (Postgres via Docker)

```bash
docker start cpi-v2-db
```

Si le conteneur n'existe pas encore, voir `docker-compose` / `infra` pour le créer.

Vérifier qu'elle tourne :

```bash
docker ps --filter name=cpi-v2-db
```

## 2. Démarrer l'API (Go)

Depuis la racine du repo :

```bash
$env:DATABASE_URL='postgres://cpi:cpi@localhost:5434/cpi_v2_dev?sslmode=disable'; $env:PORT='4000'; $env:LOG_FORMAT='text'; go run ./cmd/server
```

Vérifier que l'API répond (401 attendu tant que non connecté) :

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/v1/auth/me
```

## 3. Démarrer le web (Vite)

Dans un autre terminal :

```bash
cd web
npx vite
```

Ouvrir [http://localhost:5173](http://localhost:5173).

## Ordre important

Démarrer l'API **avant** le web : si Vite proxy vers l'API avant qu'elle soit prête, la page affiche une erreur 502 au premier chargement. Un simple rechargement (F5) une fois l'API up suffit à corriger ça.

## Config de référence

Ces commandes sont aussi définies dans `.claude/launch.json` (configurations `cpi-api` et `cpi-web`), utilisées par la preview intégrée de Claude Code.
