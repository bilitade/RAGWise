# =============================================================================
# Stage 1 – dependency resolver
#   Uses uv to export a fully-pinned requirements.txt from the lockfile.
#   Nothing from this stage reaches production — only the generated file.
# =============================================================================
FROM python:3.12.10-slim AS deps

COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

WORKDIR /build

COPY pyproject.toml uv.lock ./

# Export all production deps as a flat requirements.txt (no editable installs,
# no dev extras, no hashes — hashes trip up some pip versions with extras).
RUN uv export \
      --frozen \
      --no-dev \
      --no-emit-project \
      --no-hashes \
      -o requirements.txt


# =============================================================================
# Stage 2 – runtime image
#   Installs deps with plain pip (no uv at runtime), copies application code,
#   and sets up a non-root user.
# =============================================================================
FROM python:3.12.10-slim AS runtime

# libgomp1  → ONNX runtime used by fastembed (sparse embeddings)
# gosu      → drop root privileges cleanly in the entrypoint
# Also run apt-get upgrade to patch known vulnerabilities
RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends libgomp1 gosu \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies (layer-cached separately from code)
COPY --from=deps /build/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Application source
COPY app/       ./app/
COPY alembic/   ./alembic/
COPY alembic.ini .
COPY main.py    .

# Create non-root user and directories.
RUN groupadd --system --gid 1001 app \
    && useradd  --system --uid 1001 --gid app app \
    && mkdir -p /data/documents /app/model_cache \
    && chown -R app:app /app /data

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app \
    DOCUMENTS_DIR=/data/documents \
    FASTEMBED_CACHE_PATH=/app/model_cache \
    OMP_NUM_THREADS=4 \
    ONNX_NUM_THREADS=4 \
    ORT_NUM_THREADS=4

# ── Pre-download the sparse embedding model ───────────────────────────────────
# HF_TOKEN is a build-time secret — it is NOT stored in the final image.
# Passing it avoids HuggingFace rate-limiting during the model download.
ARG HF_TOKEN
RUN HF_TOKEN=${HF_TOKEN} HUGGING_FACE_HUB_TOKEN=${HF_TOKEN} python -c "\
from fastembed import SparseTextEmbedding; \
SparseTextEmbedding(model_name='prithivida/Splade_PP_en_v1')" \
    && chown -R app:app /app/model_cache

EXPOSE 8000

ENTRYPOINT ["docker-entrypoint.sh"]
# Default: run the API server.
# Override CMD in docker-compose.yml to run the Celery worker.
CMD ["uvicorn", "app.api.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
