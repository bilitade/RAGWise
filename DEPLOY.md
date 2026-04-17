# Deployment Guide — AWS EC2 + DockerHub + GitHub Actions

No paid AWS services required. Images are stored on DockerHub (free).

## Overview

```
  GitHub push to main
        │
        ▼
  GitHub Actions
    build backend  → push to DockerHub
    build frontend → push to DockerHub
        │
        ▼ SSH
  EC2 (Ubuntu)
    docker compose pull
    docker compose up -d
```

---

## 1. DockerHub — Create repositories

Sign up at [hub.docker.com](https://hub.docker.com) if you don't have an account.

Create two **public** repositories:

| Repository |
|---|
| `<your-username>/ragwise` |
| `<your-username>/ragwise-frontend` |

Generate an access token: **Account Settings → Security → New Access Token** (read/write).

---

## 2. EC2 — Launch Instance

> **Instance note:** The real AWS Free Tier is t2.micro (1 GiB RAM) — too small for this stack.
> For a 2-hour demo, use **t3.small** (2 GiB + 2 GiB swap = fine) or **t3.medium** (4 GiB).
> Cost: t3.small ≈ $0.02/hr → **$0.04 total for 2 hours**.

| Setting | Value |
|---|---|
| AMI | Ubuntu 22.04 LTS |
| Instance type | t3.small (demo) or t3.medium (comfortable) |
| Key pair | Create or use existing — save the `.pem` file |
| Storage | 20 GB gp3 |

**Security group — inbound rules:**

| Port | Source | Purpose |
|---|---|---|
| 22 | Your IP only | SSH |
| 80 | 0.0.0.0/0 | HTTP |

---

## 3. EC2 — Bootstrap

```bash
ssh -i your-key.pem ubuntu@<EC2-PUBLIC-IP>

curl -fsSL https://raw.githubusercontent.com/<you>/ragwise/main/scripts/ec2-setup.sh \
  | sudo bash

# Log out and back in so the docker group takes effect
exit
ssh -i your-key.pem ubuntu@<EC2-PUBLIC-IP>
```

---

## 4. EC2 — Copy files and create secrets

```bash
# From your local machine
scp -i your-key.pem docker-compose.prod.yml ubuntu@<EC2-PUBLIC-IP>:/opt/ragwise/
```

On the EC2, create the secrets file — **this never leaves the server**:

```bash
nano /opt/ragwise/.env.prod
```

```env
OPENAI_API_KEY=sk-...
JWT_SECRET=<run: openssl rand -hex 32>
SETTINGS_SECRET_KEY=<run: openssl rand -hex 32>
POSTGRES_PASSWORD=<strong-password>
POSTGRES_USER=raguser
POSTGRES_DB=ragdb
APP_ENV=production
LANGCHAIN_TRACING_V2=false
```

---

## 5. GitHub — Add Secrets

**Settings → Secrets and variables → Actions → New repository secret**

| Secret | Value |
|---|---|
| `DOCKERHUB_USERNAME` | Your DockerHub username |
| `DOCKERHUB_TOKEN` | DockerHub access token from step 1 |
| `EC2_HOST` | Public IP of your EC2 |
| `EC2_SSH_KEY` | Full contents of your `.pem` file |
| `HF_TOKEN` | HuggingFace token (for SPLADE model at build time) |

---

## 6. Deploy

Push to `main` — the pipeline triggers automatically:

```
build-and-push  (~8 min first run, ~2 min with cache)
      └── deploy  (~30 sec)
```

Watch it at: **GitHub repo → Actions**

Open `http://<EC2-PUBLIC-IP>` when done.

---

## 7. Tear down after demo

Stop billing immediately — go to EC2 console → **Stop** (or **Terminate**) the instance.

Stopped instances still charge for EBS storage (~$0.10/month for 20 GB).
Terminated instances charge nothing.

---

## Rollback

```bash
ssh -i your-key.pem ubuntu@<EC2-PUBLIC-IP>
cd /opt/ragwise
export DOCKERHUB_USERNAME=<your-username>
export RAGWISE_TAG=<previous-git-sha>
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

---

## Useful commands on EC2

```bash
# Live logs
docker compose -f /opt/ragwise/docker-compose.prod.yml logs -f api

# Status
docker ps

# Disk usage
docker system df
```
