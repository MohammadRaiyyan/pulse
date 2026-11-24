#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo bash bootstrap.sh" >&2
  exit 1
fi

. /etc/os-release
if [ "${ID:-}" != "ubuntu" ]; then
  echo "This script supports Ubuntu only (found ${ID:-unknown})" >&2
  exit 1
fi

deploy_user=${DEPLOY_USER:-deploy}
deploy_path=${DEPLOY_PATH:-/opt/pulse}
swap_size=${SWAP_SIZE:-2G}
ssh_source_user=${SSH_SOURCE_USER:-${SUDO_USER:-ubuntu}}

export DEBIAN_FRONTEND=noninteractive

echo "Installing base packages"
apt-get update -q
apt-get upgrade -yq
apt-get install -yq ca-certificates curl gnupg ufw unattended-upgrades fail2ban

echo "Installing Docker Engine and the Compose plugin"
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
  >/etc/apt/sources.list.d/docker.list
apt-get update -q
apt-get install -yq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

install -m 0644 /dev/stdin /etc/docker/daemon.json <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "5" },
  "live-restore": true
}
JSON
systemctl enable docker
systemctl restart docker

echo "Creating the $deploy_user user"
if ! id "$deploy_user" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$deploy_user"
fi
usermod -aG docker "$deploy_user"
install -d -m 700 -o "$deploy_user" -g "$deploy_user" "/home/$deploy_user/.ssh"
if [ -f "/home/$ssh_source_user/.ssh/authorized_keys" ] && [ ! -f "/home/$deploy_user/.ssh/authorized_keys" ]; then
  install -m 600 -o "$deploy_user" -g "$deploy_user" \
    "/home/$ssh_source_user/.ssh/authorized_keys" "/home/$deploy_user/.ssh/authorized_keys"
fi
install -d -m 750 -o "$deploy_user" -g "$deploy_user" "$deploy_path" "$deploy_path/deploy"

echo "Hardening SSH"
install -m 0644 /dev/stdin /etc/ssh/sshd_config.d/60-pulse.conf <<'SSHD'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
SSHD
systemctl reload ssh || systemctl reload sshd

echo "Configuring the firewall (22, 80, 443)"
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

if ! swapon --show | grep -q .; then
  echo "Creating a $swap_size swap file"
  fallocate -l "$swap_size" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
  install -m 0644 /dev/stdin /etc/sysctl.d/60-pulse-swap.conf <<'SYSCTL'
vm.swappiness=10
SYSCTL
  sysctl --system >/dev/null
fi

echo "Enabling unattended security upgrades"
install -m 0644 /dev/stdin /etc/apt/apt.conf.d/20auto-upgrades <<'APT'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
APT
systemctl enable --now unattended-upgrades
systemctl enable --now fail2ban

echo
echo "Done. Next steps:"
echo "  1. ssh $deploy_user@<server> and copy the deploy/ folder to $deploy_path/deploy"
echo "  2. cp $deploy_path/deploy/.env.production.example $deploy_path/deploy/.env and fill it in"
echo "  3. cd $deploy_path/deploy && docker compose -f compose.production.yml up -d --wait"
