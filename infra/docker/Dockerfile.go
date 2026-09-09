# syntax=docker/dockerfile:1.7
ARG GO_VERSION=1.26
ARG NODE_VERSION=24.18.0
ARG PG_MAJOR=18

FROM node:${NODE_VERSION}-bookworm-slim AS panneau
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/go/web/package.json apps/go/web/
RUN pnpm install --frozen-lockfile --filter @crm/panel
COPY apps/go/web apps/go/web
COPY apps/go/openapi.json apps/go/
RUN pnpm --filter @crm/panel gen && pnpm --filter @crm/panel build

FROM golang:${GO_VERSION}-bookworm AS binaire
WORKDIR /src
COPY apps/go/go.mod apps/go/go.sum ./
RUN go mod download
COPY apps/go ./
COPY --from=panneau /repo/apps/go/web/dist ./web/dist
RUN go run github.com/sqlc-dev/sqlc/cmd/sqlc@v1.31.1 generate \
    && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /cpi-go .

# pg_dump 18 depuis PGDG, comme Dockerfile.api : la version de Bookworm refuse un serveur 18.
FROM debian:bookworm-slim AS runner
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
    && mkdir -p /repo/storage/db-dumps /repo/storage/notes-vocales /repo/storage/imports \
    && chown -R cpi:cpi /repo/storage
WORKDIR /repo
COPY --from=binaire /cpi-go /cpi-go
USER cpi
ENV PORT=4000
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD ["/cpi-go", "-healthcheck"]
ENTRYPOINT ["/cpi-go"]
