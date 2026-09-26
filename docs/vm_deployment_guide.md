# VM Deployment & PM2 Troubleshooting Guide

## The Ultimate VM Hardening Protocol

When hosting a Node.js/Docker platform on a raw Linux VPS (like Azure or DigitalOcean), the server is susceptible to three major edge cases upon reboot or crash:
1. **The 99% CPU Bug (NPM Zombie Loops):** Using `npx` via PM2 can occasionally result in background `npm exec` wrappers getting stuck in endless internal loops during crashes, instantly spiking the VM's CPU to 99%.
2. **The 502 Bad Gateway Bug (Port 80 Hijacking):** Linux distributions often come pre-installed with background web servers (like Nginx, Apache, or Caddy). When the VM boots up, these hidden services can start automatically via Systemd and hijack Port 80 before PM2 can start the `edge-router`. If `edge-router` gets blocked from Port 80 (`EADDRINUSE`), the rogue web server intercepts all user traffic and returns a `502 Bad Gateway`.
3. **The Missing Environment Variables Bug:** When PM2 restores apps on boot, it does so completely naked. If variables from `.env.production` are not explicitly bound to the PM2 daemon at startup, the apps crash-loop instantly (e.g. `build-worker` throwing `DATABASE_URL is not defined`).

---

### The Bulletproof Master Script

To guarantee that none of these three bugs ever occur again, you must completely purge competing web servers, cleanly kill all zombie PM2 instances, and start the architecture using raw binary paths. 

Run this exact script on the VM as `root` or `azureuser`:

```bash
# 1. PERMANENTLY DESTROY ANY PORT 80 HIJACKERS
# (This ensures Nginx, Apache, or Caddy can never steal port 80 again)
sudo systemctl stop nginx apache2 caddy || true
sudo apt-get purge nginx apache2 caddy -y
sudo apt-get autoremove -y

# 2. NUKE ALL OLD PM2 DAEMONS & ZOMBIE PROCESSES
# (Kills the shadow PM2 daemons on both root and local users)
sudo pm2 kill
pm2 kill
sudo killall -9 node npm npx tsx || true

# 3. FRESH START USING ONLY DIRECT BINARIES (NO NPM/NPX)
# (Injects the .env file natively into the shell before launching PM2, and targets raw tsx)
sudo bash -c "set -a && source /opt/whizan/.env.production && pm2 start /opt/whizan/node_modules/.bin/tsx --name 'whizan-api' --cwd /opt/whizan/apps/api -- src/index.ts"

sudo bash -c "set -a && source /opt/whizan/.env.production && pm2 start /opt/whizan/node_modules/.bin/tsx --name 'edge-router' --cwd /opt/whizan/apps/edge-router -- src/index.ts"

sudo bash -c "set -a && source /opt/whizan/.env.production && pm2 start /opt/whizan/node_modules/.bin/tsx --name 'build-worker' --cwd /opt/whizan/apps/build-worker -- src/worker.ts"

# 4. FORCE SAVE AND LOCK IT TO THE ROOT STARTUP SEQUENCE
sudo pm2 save --force
sudo pm2 startup systemd -u root --hp /root
```

*(Note: When you run `sudo pm2 startup systemd`, it may output a final `sudo env PATH...` command. Make sure to copy-paste and run that generated command to finalize the boot sequence!)*

---

## 4. The `ecosystem.config.cjs` Anti-Pattern (Deprecated)

Historically, this project used an `ecosystem.config.cjs` file to manage PM2. **Do not use it.** It has been completely deprecated due to two massive architectural bugs:

1. **The CPU Bug:** In the ecosystem file, the start script was defined as `script: "npx"` with `args: "tsx src/index.ts"`. Using `npx` to start long-running daemon servers creates a buggy background `npm exec` wrapper. Upon VM crashes, this wrapper can enter an endless internal loop and permanently lock the CPU at 99%. By bypassing `npx` and pointing PM2 directly to the raw `/opt/whizan/node_modules/.bin/tsx` binary, CPU overhead is reduced to 0%.
2. **The Environment Variable Bug:** Ecosystem files attempt to inject `.env` variables internally via `env_production:`. However, during a cold OS boot, PM2 can load the ecosystem file *before* the environment is fully mounted, launching the apps completely naked without variables (resulting in instant crash-loops). By abandoning the ecosystem file and wrapping the startup commands in `bash -c "set -a && source .env"`, we aggressively force Linux to load the variables *before* PM2 is allowed to touch the apps.

---
## 4. The "Stuck in BUILDING" Edge Case

**The Issue:** If your VM crashes or reboots *while* a user's project is actively building, the database will say `status: BUILDING` forever. When the VM comes back online, the `edge-router` will ping the worker to wake the project up, but the worker will ignore it because it's not `READY`, causing a permanent 502 error until the user manually hits redeploy in their dashboard.

**The Fix:** A Startup Cleanup Routine was explicitly added to `apps/api/src/index.ts` right below the analytics processor. Every time the API boots up, it scans the database for any deployments stuck in `BUILDING` or `QUEUED` and automatically marks them as `FAILED` with the message *"Build interrupted by system reboot or crash."* This ensures projects never get permanently locked up.

---

## Useful Commands for VM Monitoring

*   **View all running PM2 services:** `sudo pm2 status`
*   **View error logs for the worker:** `sudo pm2 logs build-worker --err --lines 100`
*   **Check which services are hogging ports (e.g. port 80):** `sudo ss -tulpn`
*   **Kill a zombie process blocking port 80:** `sudo fuser -k 80/tcp`
*   **Check all running Docker containers:** `sudo docker ps`
