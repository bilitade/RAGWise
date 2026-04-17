# Deploy to AWS EC2

No registry. No DockerHub. No IAM keys.
GitHub pushes code → EC2 builds and runs it.

---

## How it works

```
  git push main
       │
       ▼
  GitHub Actions
    SSH into EC2
    git pull
    docker compose up --build -d
       │
       ▼
  http://<EC2-PUBLIC-IP>
```

---

## Step 1 — Launch EC2

AWS Console → EC2 → **Launch instance**

| Setting | Value |
|---|---|
| Name | ragwise |
| AMI | Ubuntu 22.04 LTS |
| Instance type | t3.small |
| Key pair | Create new → download `.pem` |
| Storage | 20 GB gp3 |

**Network settings → Edit → Add inbound rules:**

| Type | Protocol | Port | Source |
|---|---|---|---|
| SSH | TCP | 22 | My IP |
| HTTP | TCP | 80 | Anywhere (0.0.0.0/0) |

Launch and copy the **Public IPv4 address**.

---

## Step 2 — Bootstrap the EC2

```bash
# SSH in
ssh -i your-key.pem ubuntu@<EC2-PUBLIC-IP>

# Install Docker + add 2 GB swap
curl -fsSL https://raw.githubusercontent.com/<your-github-username>/ragwise/main/scripts/ec2-setup.sh \
  | sudo bash

# Re-login so docker group takes effect
exit
ssh -i your-key.pem ubuntu@<EC2-PUBLIC-IP>
```

---

## Step 3 — Clone repo and create secrets file

```bash
git clone https://github.com/<your-github-username>/ragwise.git /opt/ragwise
cd /opt/ragwise
nano .env.docker
```

Paste and fill in:

```env
OPENAI_API_KEY=sk-...
JWT_SECRET=
SETTINGS_SECRET_KEY=
POSTGRES_PASSWORD=
HF_TOKEN=
POSTGRES_USER=raguser
POSTGRES_DB=ragdb
APP_ENV=production
API_CORS_ORIGINS=http://<EC2-PUBLIC-IP>
LANGCHAIN_TRACING_V2=false
```

Generate `JWT_SECRET` and `SETTINGS_SECRET_KEY` (run twice):

```bash
openssl rand -hex 32
```

Save: `Ctrl+X → Y → Enter`

---

## Step 4 — Add GitHub Secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Value |
|---|---|
| `EC2_HOST` | Your EC2 public IP |
| `EC2_SSH_KEY` | Full contents of your `.pem` file |
| `HF_TOKEN` | Your HuggingFace token |

**How to get the `.pem` contents:**

```bash
cat your-key.pem
```

Copy everything including `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----`.

---

## Step 5 — Push and deploy

```bash
git add .
git commit -m "deploy"
git push origin main
```

Watch it: **GitHub repo → Actions tab**

| Phase | Time |
|---|---|
| EC2 git pull | ~15 sec |
| Docker build (first time) | ~10–15 min |
| Containers up | ~2 min |

When the action goes green, open:

```
http://<EC2-PUBLIC-IP>
```

---

## After your demo — stop all charges

EC2 console → select instance → **Instance state → Terminate**

---

## Useful commands on EC2

```bash
# Check all 7 containers are running
docker ps

# Live logs
docker logs ragwise-api -f
docker logs ragwise-worker -f

# Restart one service
docker compose restart api
```
