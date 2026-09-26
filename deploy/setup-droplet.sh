#!/bin/bash
# =============================================================================
# Whizan Cloud Service — DigitalOcean Droplet Setup Script
# Run as root on a fresh Ubuntu 24.04 droplet
# Usage: curl -fsSL <raw-github-url>/deploy/setup-droplet.sh | bash
# =============================================================================
set -e

echo "═══════════════════════════════════════════════"
echo "  Whizan Cloud Service — Droplet Setup"
echo "═══════════════════════════════════════════════"

# ── 1. System packages & OS Hardening ──────────────────────────────
echo "[1/8] Updating system & purging rogue web servers..."
apt-get update -qq && apt-get upgrade -y -qq
systemctl stop nginx apache2 caddy || true
apt-get purge nginx apache2 caddy -y -qq
apt-get autoremove -y -qq

echo "[2/8] Setting up 4GB Swapfile to prevent OOM crashes..."
if [ ! -f /swapfile ]; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab
fi

# ── 2. Docker ───────────────────────────────────────
echo "[3/8] Installing Docker..."
curl -fsSL https://get.docker.com | sh -s -- -q
systemctl enable --now docker
# Allow current user to use docker without sudo (if not root)
if [ "$USER" != "root" ]; then
  usermod -aG docker "$USER"
fi

# ── 3. Node.js 20 ───────────────────────────────────
echo "[4/8] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y -qq nodejs

# ── 4. PM2 ──────────────────────────────────────────
echo "[5/8] Installing PM2..."
npm install -g pm2 tsx --quiet

# ── 5. Clone & install ──────────────────────────────
echo "[6/8] Cloning repository..."
mkdir -p /opt/whizan /opt/whizan-builds /var/log/whizan
git clone https://github.com/Ayushkumar0602/Whizan-cloud-service.git /opt/whizan
cd /opt/whizan
npm install --production=false

# ── 6. Prisma ───────────────────────────────────────
echo "[7/8] Setting up Prisma..."
echo "  ⚠  Make sure /opt/whizan/.env.production exists with DATABASE_URL"
echo "  ⚠  Then run manually: cd /opt/whizan && npx prisma db push --schema=packages/db/prisma/schema.prisma"

# ── 7. PM2 startup ──────────────────────────────────
echo "[8/8] Configuring PM2 to start on boot..."
pm2 startup systemd -u root --hp /root | tail -1 | bash || true

echo ""
echo "═══════════════════════════════════════════════"
echo "  ✅ Setup complete!"
echo ""
echo "  NEXT STEPS:"
echo "  1. Create /opt/whizan/.env.production (see .env.example)"  
echo "  2. Run: cd /opt/whizan && npx prisma db push --schema=packages/db/prisma/schema.prisma"
echo "  3. Start API:    sudo bash -c \"set -a && source /opt/whizan/.env.production && pm2 start /opt/whizan/node_modules/.bin/tsx --name 'whizan-api' --cwd /opt/whizan/apps/api -- src/index.ts\""
echo "  4. Start Router: sudo bash -c \"set -a && source /opt/whizan/.env.production && pm2 start /opt/whizan/node_modules/.bin/tsx --name 'edge-router' --cwd /opt/whizan/apps/edge-router -- src/index.ts\""
echo "  5. Start Worker: sudo bash -c \"set -a && source /opt/whizan/.env.production && pm2 start /opt/whizan/node_modules/.bin/tsx --name 'build-worker' --cwd /opt/whizan/apps/build-worker -- src/worker.ts\""
echo "  6. Run: sudo pm2 save --force"
echo "  7. Set Router port 80: ufw allow 80 && ufw allow 443"
echo "═══════════════════════════════════════════════"
