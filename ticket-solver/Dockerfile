FROM golang:1.26-bookworm AS builder
RUN go install github.com/sqlc-dev/sqlc/cmd/sqlc@v1.31.1 \
    && CGO_ENABLED=0 go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.13.2

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /go/bin/kairo ./cmd/kairo

FROM node:24.18.0-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN npm install --global --no-audit --no-fund --loglevel=info @anthropic-ai/claude-code@2.1.278 @openai/codex@0.155.1 pnpm@11.15.1 \
    && npm cache clean --force
COPY --from=builder /usr/local/go /usr/local/go
COPY --from=builder /go/bin/kairo /go/bin/sqlc /go/bin/golangci-lint /usr/local/bin/
RUN ln -s /usr/local/go/bin/go /usr/local/go/bin/gofmt /usr/local/bin/
RUN mkdir -p /home/nobody /work/jobs /work/cache && chown -R nobody:nogroup /home/nobody /work
USER nobody
ENV HOME=/home/nobody PORT=8080
WORKDIR /work
EXPOSE 8080
HEALTHCHECK --interval=60s --timeout=5s CMD ["/usr/local/bin/kairo", "healthcheck"]
ENTRYPOINT ["/usr/local/bin/kairo"]
