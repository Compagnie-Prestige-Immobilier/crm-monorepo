FROM python:3.13-slim
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates nodejs npm && rm -rf /var/lib/apt/lists/* \
    && npm install --global @anthropic-ai/claude-code @openai/codex \
    && npm cache clean --force
RUN useradd --uid 10001 --create-home solver && mkdir -p /work/jobs && chown -R solver:solver /work
COPY requirements.txt /opt/ticket-solver/requirements.txt
RUN pip install --no-cache-dir -r /opt/ticket-solver/requirements.txt
COPY app /opt/ticket-solver/app
USER solver
WORKDIR /opt/ticket-solver
ENV PYTHONUNBUFFERED=1 PORT=8080
EXPOSE 8080
CMD ["python", "-m", "app.main"]
