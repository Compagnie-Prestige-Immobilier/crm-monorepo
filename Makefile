DB ?= postgres://localhost:5432/cpi_v2_dev?sslmode=disable
export DATABASE_URL ?= $(DB)
export TEST_DATABASE_URL ?= $(DB)
export LOG_FORMAT ?= text
SQLC = go run github.com/sqlc-dev/sqlc/cmd/sqlc@v1.31.1
LINT = go run github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.13.2

.PHONY: setup db gen dev build test lint e2e

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

gen: ## sqlc, document OpenAPI, types du panneau
	@mkdir -p web/dist && touch web/dist/index.html
	$(SQLC) generate
	go run ./cmd/server -openapi > openapi.json
	pnpm --dir web gen

dev: db ## base créée et semée si besoin, .env chargé, API sur :4000 et Vite sur :5173
	@set -a; [ -f .env ] && . ./.env; set +a; \
	  trap 'kill 0' INT TERM; \
	  pnpm --dir web dev & \
	  go run ./cmd/server ; wait

build: gen ## panneau embarqué + binaire ./cpi-go, avec la bascule de rôle du poste local
	VITE_BASCULE_ROLES=1 pnpm --dir web build
	CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o cpi-go ./cmd/server

test: ## tests d'intégration contre TEST_DATABASE_URL
	go test -tags integration -count=1 ./...

e2e: build ## parcours Playwright contre le binaire et la base locale
	pnpm --dir e2e test

lint: ## golangci-lint, requêtes vérifiées contre la base, lint du panneau
	$(LINT) run ./...
	$(SQLC) vet
	pnpm --dir web lint
