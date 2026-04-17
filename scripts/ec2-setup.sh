#!/usr/bin/env bash
# Run once on a fresh Ubuntu 22.04 EC2 instance as root (or with sudo).
# curl -fsSL https://raw.githubusercontent.com/<you>/ragwise/main/scripts/ec2-setup.sh | sudo bash
set -euo pipefail

echo "==> Updating system packages"
apt-get update -y && apt-get upgrade -y

echo "==> Installing Docker CE"
apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

echo "==> Adding ubuntu user to docker group"
usermod -aG docker ubuntu

echo "==> Adding 2 GB swap (helps on t3.small / t3.medium)"
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Creating app directory"
mkdir -p /opt/ragwise
chown ubuntu:ubuntu /opt/ragwise

echo ""
echo "Done. Next steps:"
echo "  1. Log out and back in (docker group takes effect)"
echo "  2. Copy docker-compose.prod.yml to /opt/ragwise/"
echo "  3. Create /opt/ragwise/.env.prod with your secrets"
