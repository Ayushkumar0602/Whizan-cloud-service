# Whizan Cloud Service ☁️

**Whizan Cloud Service** is a modern, Vercel-like Platform-as-a-Service (PaaS) that allows developers to deploy full-stack web applications and static sites with zero configuration. It automatically builds code from GitHub, packages it into Docker containers, and serves it globally with advanced features like **scale-to-zero**, **instant cold starts**, and **WebSocket proxying**.

---

## 🌟 Key Features

- **Zero-Config Builds:** Automatically detects and builds your framework (Next.js, React, Node.js, etc.) using Cloud Native Buildpacks (`pack`), just like Heroku and Vercel.
- **Scale-to-Zero (Serverless):** Inactive applications are automatically put to sleep to conserve server resources.
- **Instant Cold Starts:** When an asleep app receives traffic, the Edge Router displays a beautiful, auto-refreshing "Waking up..." screen while spinning up the container in the background.
- **Real-Time Log Streaming:** View your application's build and deployment logs live in the dashboard, powered by Redis Pub/Sub.
- **WebSocket & Real-Time Support:** Fully supports `wss://` traffic for Next.js HMR, Socket.io, and multiplayer games—even during cold starts.
- **Dynamic Edge Router:** A custom `http-proxy` based router that resolves subdomains (e.g., `my-app.whizan.com`) to the correct internal Docker containers.

## 🏗️ Architecture

This project is structured as a **Turborepo** monorepo containing several microservices:

### Apps
1. **`dashboard`** (Next.js): The user-facing frontend where developers can manage projects, trigger deployments, and view logs.
2. **`api`** (Express): The core REST API that manages the PostgreSQL database (via Prisma) and orchestrates deployments.
3. **`build-worker`** (Node.js/BullMQ): A background worker that pulls code from GitHub, builds Docker images, and runs the containers.
4. **`edge-router`** (Node.js/HTTP-Proxy): The primary entry point for all web traffic. It dynamically routes subdomains to internal Docker ports and manages scale-to-zero wakeups.

### Infrastructure
- **PostgreSQL**: Primary data store for Users, Projects, and Deployments.
- **Redis**: Used for BullMQ job queues, live log streaming (Pub/Sub), and cold-start wakeup signaling.
- **Docker**: Containerizes and runs user applications securely.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Docker & Docker Compose
- Pack CLI (for buildpacks)
- Git

### Installation

1. **Clone the repository:**
   ```sh
   git clone https://github.com/Ayushkumar0602/Whizan-cloud-service.git
   cd Whizan-cloud-service
   ```

2. **Install dependencies:**
   ```sh
   npm install
   ```

3. **Set up Environment Variables:**
   Copy `.env.example` to `.env` in the root and configure your database/Redis credentials.

4. **Start Infrastructure (PostgreSQL & Redis):**
   ```sh
   docker-compose up -d
   ```

5. **Run Database Migrations:**
   ```sh
   npm run db:push
   ```

6. **Start the Platform:**
   Start all microservices (Dashboard, API, Worker, Edge Router) simultaneously using Turborepo:
   ```sh
   npm start
   ```

## 🌐 How Traffic Flows

1. A user visits `https://my-project.whizan.com`.
2. The **Edge Router** intercepts the request and queries Redis/DB for `my-project`.
3. If the container is **Active**, the router seamlessly proxies the HTTP/WebSocket traffic to the internal Docker port.
4. If the container is **Asleep**, the router instantly returns a beautiful "Waking up..." HTML screen (or a 503 for WebSockets to trigger client retries). It then fires a `wakeup` event to Redis.
5. The **Build Worker** receives the wakeup event, issues a `docker start`, and updates the active port.
6. The user's browser (via the loading screen's background ping) detects the container is ready and automatically refreshes into the app!

## 📜 License
MIT License
