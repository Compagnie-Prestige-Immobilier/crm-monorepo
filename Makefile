DB ?= postgres://localhost:5432/cpi_v2_dev?sslmode=disable
export DATABASE_URL ?= $(DB)
export TEST_DATABASE_URL ?= $(DB)
export LOG_FORMAT ?= text
export E2E_DB ?= postgres://localhost:5432/cpi_e2e?sslmode=disable
export E2E_DB_DEMO ?= postgres://localhost:5432/cpi_e2e_demo?sslmode=disable
export E2E_URL ?= http://localhost:4890
SQLC = go run github.com/sqlc-dev/sqlc/cmd/sqlc@v1.31.1
LINT = go run github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.13.2

.PHONY: setup db gen dev build test lint e2e e2e-reset

setup: db gen ## base locale, dépendances, code généré, en une commande
	pnpm --dir web install

db: ## crée cpi_v2_dev depuis sql/schema.sql si la base n'existe pas, puis sème référentiels, comptes et 60 jours de données de développement
	@hote=$$(printf '%s' "$(DB)" | sed -E 's#^postgres(ql)?://##; s#[/?].*##; s#.*@##; s#:[0-9]*$$##'); \
	case "$(DB)" in *[?\&]host=*|*[?\&]hostaddr=*) hote= ;; postgres://*|postgresql://*) ;; *) hote= ;; esac; \
	case "$$hote" in \
	  localhost|127.0.0.1) ;; \
	  *) echo "DB doit pointer vers localhost ou 127.0.0.1 : $(DB)" >&2; exit 1 ;; \
	esac
	@psql "$(DB)" -Atc 'select 1' >/dev/null 2>&1 || { \
	  createdb $(firstword $(subst ?, ,$(notdir $(DB)))) && psql "$(DB)" -v ON_ERROR_STOP=1 -q -f sql/schema.sql; }
	SEED_ADMIN_EMAIL=$${SEED_ADMIN_EMAIL:-admin@cpi.sn} SEED_ADMIN_USERNAME=$${SEED_ADMIN_USERNAME:-admin} \
	NODE_ENV=development SEED_ADMIN_PASSWORD=$${SEED_ADMIN_PASSWORD:-admin-local-2026} go run ./cmd/server -seed

gen: ## sqlc, document OpenAPI, types et routes du panneau
	tools/dev/gen.sh

dev: gen ## code régénéré, base semée, .env chargé, API et Vite sur les premiers ports libres
	$(MAKE) db
	@set -a; [ -f .env ] && . ./.env; set +a; \
	  command -v lsof >/dev/null || { echo "lsof est requis pour choisir le port API" >&2; exit 1; }; \
	  export PORT=$${PORT:-4000}; \
	  case "$$PORT" in *[!0-9]*|'') echo "PORT doit être un entier" >&2; exit 1 ;; esac; \
	  [ "$$PORT" -ge 1 ] && [ "$$PORT" -le 65515 ] || { echo "PORT doit être compris entre 1 et 65515" >&2; exit 1; }; \
	  limite=$$((PORT + 20)); \
	  while lsof -nP -iTCP:$$PORT -sTCP:LISTEN -t >/dev/null; do \
	    PORT=$$((PORT + 1)); \
	    [ "$$PORT" -lt "$$limite" ] || { echo "Aucun port API libre après 20 essais" >&2; exit 1; }; \
	  done; \
	  echo "API : http://localhost:$$PORT"; \
	  trap 'kill 0' INT TERM; \
	  pnpm --dir web dev & \
	  go run ./cmd/server ; wait

build: gen ## panneau embarqué + binaire ./cpi-go, avec la bascule de rôle du poste local
	VITE_BASCULE_ROLES=1 pnpm --dir web build
	CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o cpi-go ./cmd/server

test: ## tests d'intégration contre TEST_DATABASE_URL
	go test -tags integration -count=1 ./...

e2e-reset: ## recrée E2E_DB et E2E_DB_DEMO : schéma, migrations, fixtures et démonstration
	tools/dev/e2e-reset.sh

e2e: build e2e-reset ## parcours Playwright sur des bases neuves, jamais celle du développement ; ARGS= pour cibler
	DATABASE_URL=$(E2E_DB) DATABASE_URL_DEMO=$(E2E_DB_DEMO) PUBLIC_WEB_URL=$(E2E_URL) \
	  SEED_FIXTURE_PASSWORD=$${SEED_FIXTURE_PASSWORD:-fixtures-e2e-2026} pnpm --dir e2e test $(ARGS)

lint: ## golangci-lint, requêtes vérifiées contre la base, lint du panneau
	$(LINT) run ./...
	$(SQLC) vet
	pnpm --dir web lint
