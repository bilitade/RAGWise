<div align="center">

# RagWise

**Production RAG agent — hybrid search, async ingestion, multi-provider LLM**

<br/>

![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.135-009688?style=flat-square&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Qdrant](https://img.shields.io/badge/Qdrant-1.17-FF3E84?style=flat-square&logo=qdrant&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-8-DC382D?style=flat-square&logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)
![LangChain](https://img.shields.io/badge/LangChain-1.2-1C3C3C?style=flat-square&logo=langchain&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-22c55e?style=flat-square)

</div>

---

## Overview

RagWise is a self-hosted RAG system built for production. Documents are ingested asynchronously into a Qdrant hybrid collection (dense + SPLADE sparse vectors). At query time, a LangChain agent calls `knowledge_base_search`, `internet_search`, or `multi_source_research` depending on what the question needs. The LLM provider is switchable at runtime with no restart required.

---

## Stack

| Layer | Technology |
|---|---|
| **API** | FastAPI · Uvicorn |
| **Agent & orchestration** | LangChain · LlamaIndex |
| **Vector store** | Qdrant — dense + sparse hybrid collection |
| **Sparse embeddings** | FastEmbed · SPLADE++ (ONNX) |
| **Dense embeddings** | OpenAI `text-embedding-3-small` |
| **Async workers** | Celery · Redis |
| **Database** | PostgreSQL · SQLAlchemy · Alembic |
| **Frontend** | React 18 · TypeScript · Vite · Tailwind CSS |
| **Observability** | LangSmith |
| **Containers** | Docker Compose — 7 services |

---

## Key Features

**Hybrid search** — three modes on one Qdrant collection: dense vector similarity, sparse SPLADE lexical, and weighted fusion with a configurable alpha.

**Async ingestion** — Celery worker parses PDF, DOCX, TXT, MD; chunks with LlamaIndex; embeds dense + sparse vectors; indexes in batches. Progress streams to the UI over SSE.

**Multi-provider LLM** — switch provider at runtime from the admin panel. All providers are OpenAI-compatible.

| Provider | Type |
|---|---|
| OpenAI | Cloud |
| Groq | Cloud |
| OpenRouter | Cloud router |
| HuggingFace | Cloud |
| NVIDIA NIM | Cloud |
| Tenstorrent | Local |

**Access control** — JWT with three roles: `normal` (similarity only) · `pro` (all search modes) · `admin` (full settings).

---

## Architecture

```
  ┌─────────────────────────────────┐
  │            Browser              │
  └─────────────────┬───────────────┘
                    │ :3080
  ┌─────────────────▼───────────────┐
  │              Nginx              │
  │  /      →   React SPA           │
  │  /api/  →   FastAPI  :8000      │
  └─────────────────┬───────────────┘
                    │
  ┌─────────────────▼───────────────┐
  │            FastAPI              │
  │  ├─ PostgreSQL   users · jobs   │
  │  ├─ Qdrant       vectors        │
  │  └─ Redis        task broker    │
  └─────────────────┬───────────────┘
                    │
  ┌─────────────────▼───────────────┐
  │          Celery Worker          │
  │  parse → chunk → embed → index  │
  └─────────────────────────────────┘
```

---

## Quick Start (Docker)

```bash
cp .env.docker .env.docker.local
# Fill in: OPENAI_API_KEY, JWT_SECRET, SETTINGS_SECRET_KEY, POSTGRES_PASSWORD

HF_TOKEN=<token> docker compose build
docker compose --env-file .env.docker.local up -d
```

Open [http://localhost:3080](http://localhost:3080).

| Container | Service |
|---|---|
| `ragwise-postgres` | PostgreSQL 18 |
| `ragwise-redis` | Redis 8 |
| `ragwise-qdrant` | Qdrant v1.17 |
| `ragwise-migrate` | Alembic migrations (run-once) |
| `ragwise-api` | FastAPI |
| `ragwise-worker` | Celery ingestion worker |
| `ragwise-frontend` | Nginx + React SPA |

---

## Local Development

```bash
# Backend
cp .env.example .env
uv sync
alembic upgrade head
uvicorn app.api.main:app --reload

# Frontend
cd frontend && npm install && npm run dev
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Yes | Chat and embeddings |
| `JWT_SECRET` | Yes | Auth token signing key |
| `SETTINGS_SECRET_KEY` | Yes | Encrypts stored API keys |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `QDRANT_URL` | Yes | Qdrant endpoint |
| `REDIS_URL` | Yes | Redis connection string |
| `QDRANT_HYBRID_ALPHA` | No | Dense weight in fusion, 0–1 (default `0.6`) |
| `LANGCHAIN_API_KEY` | No | LangSmith tracing |

Full reference: [`.env.example`](.env.example)

---

## License

[MIT](LICENSE)
