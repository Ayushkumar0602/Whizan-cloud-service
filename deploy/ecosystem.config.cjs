// PM2 Ecosystem Config for Azure VM
// Uses bash to source .env.production before launching each process.
// This is the most reliable approach — no dotenv dependency needed.
module.exports = {
  apps: [
    {
      name: "whizan-worker",
      cwd: "/opt/whizan/apps/build-worker",
      script: "bash",
      args: "-c 'set -a && source /opt/whizan/.env.production && set +a && npx tsx src/worker.ts'",
      interpreter: "none",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "800M",
      restart_delay: 5000,
      exp_backoff_restart_delay: 100,
      error_file: "/var/log/whizan/worker-error.log",
      out_file: "/var/log/whizan/worker-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
    {
      name: "whizan-router",
      cwd: "/opt/whizan/apps/edge-router",
      script: "bash",
      args: "-c 'set -a && source /opt/whizan/.env.production && set +a && npx tsx src/index.ts'",
      interpreter: "none",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "256M",
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,
      error_file: "/var/log/whizan/router-error.log",
      out_file: "/var/log/whizan/router-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
