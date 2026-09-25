// PM2 Ecosystem Config for Azure VM
// Runs build-worker and edge-router as persistent processes using tsx
//
// env_file does NOT auto-inject into process.env in all PM2 versions,
// so we use DOTENV_CONFIG_PATH + `import "dotenv/config"` inside each app.
module.exports = {
  apps: [
    {
      name: "whizan-worker",
      cwd: "/opt/whizan/apps/build-worker",
      script: "npx",
      args: "tsx src/worker.ts",
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
      env: {
        DOTENV_CONFIG_PATH: "/opt/whizan/.env.production",
        NODE_ENV: "production",
      },
    },
    {
      name: "whizan-router",
      cwd: "/opt/whizan/apps/edge-router",
      script: "npx",
      args: "tsx src/index.ts",
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
      env: {
        DOTENV_CONFIG_PATH: "/opt/whizan/.env.production",
        NODE_ENV: "production",
      },
    },
  ],
};
