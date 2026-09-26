# syntax=docker/dockerfile:1.7
ARG PG_MAJOR=18

# Le contrat OpenAPI et le code sqlc sont générés, jamais commités : un
# checkout git n'a ni l'un ni l'autre, cette étape les produit pour les deux suivantes.
FROM golang:1.26.8-bookworm@sha256:a688600ca24f8a4d3ca77f95b0dd40704a9fc787c826660eb7ba0b641b8b175d AS contrat
WORKDIR /src
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download
COPY . ./
# `web/embed.go` exige un dossier `dist` : un fichier vide suffit pour écrire le contrat.
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    mkdir -p web/dist && touch web/dist/index.html \
    && go run github.com/sqlc-dev/sqlc/cmd/sqlc@v1.31.1 generate \
    && go run ./cmd/server -openapi > /openapi.json

FROM node:24.18.0-bookworm-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d AS panneau
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY web/package.json web/
RUN --mount=type=cache,id=cpi-pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store \
    && pnpm install --frozen-lockfile --filter @crm/panel
COPY web web
COPY tsconfig.base.json ./
COPY --from=contrat /openapi.json ./
RUN pnpm --filter @crm/panel gen && pnpm --filter @crm/panel build

FROM contrat AS binaire
ARG REVISION=""
COPY --from=panneau /repo/web/dist ./web/dist
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -trimpath -ldflags="-s -w -X main.revision=${REVISION}" -o /cpi-go ./cmd/server

# pg_dump 18 depuis PGDG : la version de Bookworm refuse un serveur 18.
FROM debian:bookworm-slim@sha256:3783cc01769c7b2b1b83a5c5ad96c815348e28ed7da68e2e3687004faa906251 AS runner
ARG PG_MAJOR
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
    && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/pgdg.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/pgdg.gpg] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client-${PG_MAJOR} \
    && apt-get purge -y --auto-remove curl gnupg \
    && rm -f /etc/apt/sources.list.d/pgdg.list /usr/share/keyrings/pgdg.gpg \
    && rm -rf /var/lib/apt/lists/*
RUN useradd --uid 10001 --create-home cpi \
    && mkdir -p /repo/storage/db-dumps /repo/storage/imports \
    && chown -R cpi:cpi /repo/storage
WORKDIR /repo
COPY --from=binaire /cpi-go /cpi-go
USER cpi
ENV PORT=4000
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s CMD ["/cpi-go", "-healthcheck"]
ENTRYPOINT ["/cpi-go"]
