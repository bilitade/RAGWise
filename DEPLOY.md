# Deployment Guide — AWS EC2

Production deployment of RagWise on a single EC2 instance. Build and run everything from source.

---

## Prerequisites

- AWS account
- EC2 instance (Ubuntu 22.04 LTS, t3.small or larger, 50 GB storage)
- SSH key (`.pem` file)
- OpenAI API key
- HuggingFace token (for SPLADE model)

---

## Step 1 — Launch EC2

AWS Console → EC2 → **Launch instance**

| Setting | Value |
|---|---|
| Name | ragwise |
| AMI | Ubuntu 22.04 LTS |
| Instance type | t3.small (minimum) |
| Key pair | Create new → download `.pem` |
| Storage | 50 GB gp3 |

**Security group inbound rules:**

| Type | Protocol | Port | Source |
|---|---|---|---|
| SSH | TCP | 22 | Anywhere (0.0.0.0/0) |
| HTTP | TCP | 80 | Anywhere (0.0.0.0/0) |

Note the **Public IPv4 address**.

---

## Step 2 — Bootstrap the instance

SSH in:

```bash
ssh -i ~/path/to/your-key.pem ubuntu@<EC2-PUBLIC-IP>
```

Install Docker and add 2 GB swap:

```bash
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Add user to docker group
sudo usermod -aG docker ubuntu

# Add 2 GB swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Log out and back in:

```bash
exit
ssh -i ~/path/to/your-key.pem ubuntu@<EC2-PUBLIC-IP>
```

Activate the docker group:

```bash
newgrp docker
```

---

## Step 3 — Clone the repo

```bash
sudo mkdir -p /opt/ragwise
sudo chown ubuntu:ubuntu /opt/ragwise
git clone https://github.com/bilitade/RAGWise.git /opt/ragwise
cd /opt/ragwise
```

---

## Step 4 — Create secrets file

```bash
nano .env.docker
```

Paste and fill in:

```env
OPENAI_API_KEY=sk-...
JWT_SECRET=<run: openssl rand -hex 32>
SETTINGS_SECRET_KEY=<run: openssl rand -hex 32>
POSTGRES_PASSWORD=<strong-password>
HF_TOKEN=<your-hf-token>
POSTGRES_USER=raguser
POSTGRES_DB=ragdb
APP_ENV=production
LANGCHAIN_TRACING_V2=false
```

Save: `Ctrl+X → Y → Enter`

Generate secrets on your local machine:

```bash
openssl rand -hex 32
```

Run twice, use each output for `JWT_SECRET` and `SETTINGS_SECRET_KEY`.

---

## Step 5 — Build and deploy

```bash
docker compose up --build -d
```

First build takes ~15 minutes. All 7 containers should reach healthy state:

```bash
docker ps
```

All containers should show `Up` or `Healthy`.

---

## Access the application

Open your browser:

```
http://<EC2-PUBLIC-IP>
```

You should see the RagWise UI.

---

## Stop and restart the instance

### Stop (pauses compute charges, keeps storage)

AWS Console → EC2 → Instances → select your instance → **Instance state → Stop**

### Restart (resumes with all data intact)

AWS Console → EC2 → Instances → select your instance → **Instance state → Start**

The public IP may change. Check the new IP in the AWS Console.

### Reconnect after restart

```bash
ssh -i ~/path/to/your-key.pem ubuntu@<NEW-EC2-PUBLIC-IP>
cd /opt/ragwise

# Containers auto-restart; verify they're up
docker ps
```

All data in volumes persists across stop/start cycles.

---

## Useful commands

```bash
# Check container status
docker ps

# View live logs
docker logs ragwise-api -f
docker logs ragwise-worker -f

# Restart all containers
docker compose restart

# Stop all containers (keeps data)
docker compose stop

# Stop and remove containers (keeps volumes)
docker compose down

# View disk usage
docker system df

# Free up space
docker image prune -f
```

---

## Troubleshooting

**Containers failing to start?**

```bash
docker compose logs
docker logs ragwise-api
docker logs ragwise-worker
```

**Out of disk space?**

```bash
df -h
docker system df
docker image prune -a --volumes
```

If still full, expand the EBS volume via AWS Console:

```bash
sudo growpart /dev/nvme0n1 1
sudo resize2fs /dev/nvme0n1p1
```

**Need to redeploy code?**

```bash
cd /opt/ragwise
git pull origin main
docker compose up --build -d
```

---

## Costs

| Component | Cost |
|---|---|
| t3.small (compute) | $0.0208/hr |
| 50 GB EBS (if stopped) | $0.10/month |

**2-hour demo:** ~$0.04  
**1 week running:** ~$3.50  

### Permanent shutdown

Terminate the instance to stop all charges:

AWS Console → EC2 → Instances → select instance → **Instance state → Terminate**

---

## Architecture

```
  ┌─────────────────────────────────┐
  │           Browser               │
  │    http://<EC2-PUBLIC-IP>       │
  └─────────────────┬───────────────┘
                    │ :80
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
