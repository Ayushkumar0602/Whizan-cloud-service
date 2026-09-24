# Hostify — Platform Architecture & Documentation

Hostify is a custom, local Platform-as-a-Service (PaaS) heavily inspired by Vercel. It allows users to instantly deploy GitHub repositories (Static, SSR, and Hybrid frameworks like Next.js) with dynamic subdomains, live logs, and advanced serverless resource optimization.

---

## 🏗️ 1. Core Microservices

The platform is split into four highly decoupled, scalable microservices communicating via Redis and BullMQ:

### **Dashboard (Next.js)**
- The user-facing control panel.
- Allows users to create projects, input GitHub URLs, manage secure environment variables, and trigger manual deployments.
- Features real-time streaming build logs using Server-Sent Events (SSE).
- Provides UI for lifecycle management: Pause, Resume, and Delete.

### **API (Fastify + Prisma)**
- The central brain of the platform.
- Manages the PostgreSQL database state for Projects, Deployments, and Environment Variables.
- Acts as the publisher. When a deployment is requested, it pushes a heavy job to the BullMQ Redis queue.
- Handles authentication and manual deployment lifecycle requests.

### **Build Worker (Node.js + Dockerode)**
- The heavy-lifter that consumes BullMQ jobs.
- **Build Phase:** Clones repositories from GitHub, injects decrypted environment variables, and runs `npm run build` inside a completely isolated Docker sandbox.
- **Analysis:** Scans the build output (`.next` or `dist`) to determine if the app is `STATIC`, `SSR`, or `HYBRID`.
- **Run Phase:** For SSR apps, it uses `AppRunner` to spin up a long-running Node.js Docker container on a randomized port.
- **Streaming:** Streams every single terminal log directly back to the API via Redis Pub/Sub so the user can watch the build live.

### **Edge Router (Node.js Proxy)**
- A hyper-fast HTTP reverse proxy running on port `8080`.
- Listens for wildcard subdomains (e.g., `http://my-app.localhost:8080`).
- Does **not** talk to the database. It instantly looks up routing rules in Redis (`deployment:slug`).
- Routes static file requests directly from the disk, and seamlessly proxies dynamic SSR requests to the specific Docker container port assigned by the Build Worker.

---

## ⚡ 2. Advanced DevOps & Optimizations

To make the platform production-grade, we implemented several highly complex resource-management features:

### **Zero-Downtime Deployments (Blue/Green)**
When a user clicks "Deploy" to push a new update, the old version of the app remains completely live. 
1. The new code is cloned and built in the background.
2. The new Docker container is spun up alongside the old one.
3. The Edge Router is instantly updated via Redis to point to the new container.
4. *Only after* traffic has successfully switched, the Build Worker hunts down the old deployment, kills its container, wipes its folder from the disk, and deletes its database record.

### **Strict "One-Build" Rule**
To prevent `/tmp/hostify-builds` from bloating indefinitely, the platform enforces a strict 1-to-1 relationship between a project and its build folder. Every new deployment strictly cleans up the orphaned files and containers of its predecessor.

### **Serverless "Scale-to-Zero" (Idle Spin-down)**
To save CPU and RAM, the platform mimics AWS Lambda / Vercel Edge functions by automatically killing containers that aren't being used.
- **Idle Tracking:** The Edge Router logs the exact millisecond of every incoming request to Redis (`access:deploymentId`).
- **The Reaper:** A cron job in the Build Worker sweeps every 60 seconds. If an app hasn't received a request in **10 minutes**, it ruthlessly kills the Docker container and unassigns the port, dropping resource usage to absolute zero.
- **Cold Starts:** If a user visits a sleeping app, they don't get a 404 error. The Edge Router detects the asleep state, holds the HTTP request open, and fires a `wakeup` signal over Redis.
- **Instant Resume:** The Build Worker intercepts the `wakeup`, bypasses the `git clone` and `npm build` phases, and instantly boots the container using the existing build files on disk. Once online (usually ~2 seconds), the Edge Router releases the held HTTP request and successfully proxies the user.

---

## 🔄 3. Lifecycle Actions

- **Pause:** Kills the Docker container to free up CPU/RAM/Ports instantly, but leaves the compiled build files perfectly intact on the disk.
- **Resume:** Skips the build pipeline and instantly spins the Docker container back up using the existing compiled files on disk.
- **Delete:** Performs a cascade cleanup—kills the container, completely wipes the source code and build files from the disk, deletes the Redis routing keys, and removes the database records.

---

## 🛠️ 4. Tech Stack Overview
- **Monorepo:** Turborepo
- **Frontend:** Next.js, TailwindCSS, Lucide Icons
- **Backend APIs:** Fastify, TypeScript
- **Database:** PostgreSQL, Prisma ORM
- **Queue & PubSub:** Redis, BullMQ
- **Containerization:** Docker Desktop, Dockerode
- **Proxy:** `http-proxy`, `serve-static`
