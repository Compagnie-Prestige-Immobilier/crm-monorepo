FROM golang:1.26-bookworm AS tools
RUN go install github.com/sqlc-dev/sqlc/cmd/sqlc@v1.31.1 \
    && CGO_ENABLED=0 go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.13.2

FROM node:24.18.0-bookworm-slim AS node

FROM python:3.13-slim-bookworm
COPY --from=tools /usr/local/go /usr/local/go
COPY --from=tools /go/bin/sqlc /go/bin/golangci-lint /usr/local/bin/
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/go/bin/go /usr/local/go/bin/gofmt /usr/local/bin/ \
    && ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/* \
    && npm install --global @anthropic-ai/claude-code@2.1.278 @openai/codex@0.155.1 pnpm@11.15.1 \
    && npm cache clean --force
RUN mkdir -p /home/nobody /work/jobs /work/cache && chown -R nobody:nogroup /home/nobody /work
COPY requirements.txt /opt/ticket-solver/requirements.txt
RUN pip install --no-cache-dir -r /opt/ticket-solver/requirements.txt
COPY app /opt/ticket-solver/app
USER nobody
ENV HOME=/home/nobody PYTHONUNBUFFERED=1 PORT=8080
WORKDIR /opt/ticket-solver
EXPOSE 8080
HEALTHCHECK --interval=60s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/healthz')"
CMD ["python", "-m", "app.main"]
