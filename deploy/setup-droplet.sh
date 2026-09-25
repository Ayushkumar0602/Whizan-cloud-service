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

# ── 1. System packages ──────────────────────────────
echo "[1/7] Updating system..."
apt-get update -qq && apt-get upgrade -y -qq

# ── 2. Docker ───────────────────────────────────────
echo "[2/7] Installing Docker..."
curl -fsSL https://get.docker.com | sh -s -- -q
systemctl enable --now docker
# Allow current user to use docker without sudo (if not root)
if [ "$USER" != "root" ]; then
  usermod -aG docker "$USER"
fi

# ── 3. Node.js 20 ───────────────────────────────────
echo "[3/7] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y -qq nodejs

# ── 4. PM2 ──────────────────────────────────────────
echo "[4/7] Installing PM2..."
npm install -g pm2 tsx --quiet

# ── 5. Clone & install ──────────────────────────────
echo "[5/7] Cloning repository..."
mkdir -p /opt/whizan /opt/whizan-builds /var/log/whizan
git clone https://github.com/Ayushkumar0602/Whizan-cloud-service.git /opt/whizan
cd /opt/whizan
npm install --production=false

# ── 6. Prisma ───────────────────────────────────────
echo "[6/7] Setting up Prisma..."
echo "  ⚠  Make sure /opt/whizan/.env.production exists with DATABASE_URL"
echo "  ⚠  Then run manually: cd /opt/whizan && npx prisma db push --schema=packages/db/prisma/schema.prisma"

# ── 7. PM2 startup ──────────────────────────────────
echo "[7/7] Configuring PM2 to start on boot..."
pm2 startup systemd -u root --hp /root | tail -1 | bash || true

echo ""
echo "═══════════════════════════════════════════════"
echo "  ✅ Setup complete!"
echo ""
echo "  NEXT STEPS:"
echo "  1. Create /opt/whizan/.env.production (see .env.example)"  
echo "  2. Run: cd /opt/whizan && npx prisma db push --schema=packages/db/prisma/schema.prisma"
echo "  3. Run: pm2 start /opt/whizan/deploy/ecosystem.config.cjs"
echo "  4. Run: pm2 save"
echo "  5. Set Router port 80: ufw allow 80 && ufw allow 443"
echo "═══════════════════════════════════════════════"
