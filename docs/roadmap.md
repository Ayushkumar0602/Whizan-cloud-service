# Project Roadmap: Building a Hosting Platform (like Firebase + Supabase)

> **Goal:** Build a full-featured hosting platform that allows users to deploy frontend apps, backend services, and other infrastructure — similar to Firebase and Supabase.

---

## 🧠 What Are We Actually Building?

Firebase and Supabase are **Backend-as-a-Service (BaaS)** platforms. They provide:
- Hosting for frontend apps (HTML/JS/CSS served via CDN)
- Backend services (Auth, Database, Storage, Functions)
- A beautiful dashboard to manage all of the above
- CLI tools for local development and deployment

We will build a platform with the same essential capabilities.

---

## 🗺️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      USER / BROWSER                      │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              DASHBOARD (Web App - Next.js)               │
│  - Login / Signup                                        │
│  - Create Projects                                       │
│  - Configure Services (DB, Auth, Storage, Functions)     │
│  - View Logs, Monitor Usage, Manage Domains              │
└──────────────┬──────────────────────────┬───────────────┘
               │                          │
               ▼                          ▼
┌──────────────────────┐     ┌────────────────────────────┐
│   CONTROL PLANE API   │     │       CLI TOOL             │
│  (Node.js / Go REST)  │     │  (npm package: `hoster`)   │
│  - Auth & Billing     │     │  - `hoster deploy`         │
│  - Project CRUD       │     │  - `hoster login`          │
│  - Trigger Builds     │     │  - `hoster logs`           │
│  - Domain Mgmt        │     │  - `hoster env set`        │
└──────────┬───────────┘     └────────────────────────────┘
           │
           │ triggers
           ▼
┌─────────────────────────────────────────────────────────┐
│                   BUILD PIPELINE                         │
│                                                          │
│  Git Webhook → Build Queue (Redis/BullMQ)                │
│       → Build Worker (Docker container)                  │
│       → `npm install` → `npm run build`                  │
│       → Artifacts uploaded to Object Storage (S3)        │
│       → Build logs streamed via WebSockets               │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    DATA PLANE                            │
│                                                          │
│  Edge Router (Go / Nginx) ← Domain lookup (Redis)        │
│       ├── Static files → CDN (CloudFront / Cloudflare)   │
│       └── Dynamic routes → Function Runner (Node.js)     │
└─────────────────────────────────────────────────────────┘
```

---

## 🧩 Core Features to Build (Phase by Phase)

### ✅ Phase 1 — Foundation (MVP)
> Get one user able to deploy a **static or dynamic** frontend app end-to-end (React SPA, Next.js SSR, Next.js API routes — all supported).

#### 📦 How We Handle Static vs. Dynamic

When a user deploys a Next.js project, our build worker **auto-detects** what the output contains:

| Output Type | Example | How We Serve It |
|---|---|---|
| **Pure Static (HTML/CSS/JS)** | `next export`, plain React/Vite | Uploaded to S3 → served by CDN (instant, no cold start) |
| **Server-Side Rendered (SSR)** | `getServerSideProps`, App Router | Runs inside a long-lived **Node.js container** on our servers |
| **API Routes / Edge Functions** | `pages/api/*`, `app/api/*` | Deployed as isolated **Serverless Functions** (per-request execution) |
| **Hybrid (static + SSR + API)** | Most real Next.js apps | We split — static parts go to CDN, dynamic parts go to containers |

> This is exactly how Vercel works under the hood. We replicate this split-deployment model.

#### 🔨 Phase 1 Feature List

| Feature | Description |
|---|---|
| **User Auth** | Email/password signup & login with JWT sessions |
| **Project Creation** | Create a named project, connect a GitHub repo |
| **GitHub OAuth** | Integrate GitHub to pull repos via OAuth |
| **Webhook Listener** | Listen for GitHub push events to trigger builds |
| **Build Worker** | Run `npm install && npm run build` inside an isolated Docker container |
| **Output Analyzer** | Auto-detect if output is static, SSR, API routes, or hybrid |
| **Static Asset Serving** | Upload static files to S3 + serve via CDN edge nodes |
| **Dynamic App Runner** | Run SSR Next.js apps inside a persistent Node.js container |
| **Serverless Function Runner** | Execute API routes in isolated, per-request containers |
| **Unified Edge Router** | Single entry point that routes requests to CDN or dynamic runner based on the path |
| **Auto Deploy URL** | Assign `<project>.ourhoster.com` on every deploy |
| **Build Logs** | Stream real-time build output to the dashboard via WebSockets |

---

### ✅ Phase 2 — Developer Experience
> Make it feel like a real product developers love to use.

| Feature | Description |
|---|---|
| **Environment Variables** | Encrypted env var management in the dashboard & injected at build time |
| **Preview Deployments** | Every PR/branch gets its own preview URL |
| **Rollbacks** | One-click rollback to any previous deployment |
| **Custom Domains** | User maps their own domain + auto-SSL via Let's Encrypt |
| **Team Collaboration** | Invite members to projects with role-based access |
| **CLI Tool** | `npm install -g our-hoster-cli` for deploying from terminal |

---

### ✅ Phase 3 — Backend Services (Supabase-like)
> Provide managed backend infrastructure so users don't need to set up their own servers.

| Feature | Description |
|---|---|
| **Managed Database** | Provision a PostgreSQL database per project |
| **Database Studio** | A web-based GUI for browsing and querying tables |
| **Authentication Service** | Built-in auth (email, Google OAuth, GitHub OAuth) for *user's* app |
| **File Storage** | S3-compatible file/image upload storage with public/private buckets |
| **Serverless Functions** | Deploy isolated Node.js / Python functions as HTTP endpoints |
| **Realtime Subscriptions** | WebSocket-based data sync (like Firestore `onSnapshot`) |

---

### ✅ Phase 4 — Production Hardening
> Make it reliable, observable, and scalable.

| Feature | Description |
|---|---|
| **Usage Analytics** | Bandwidth, function invocations, DB connections per project |
| **Billing & Quotas** | Free tier with limits, paid tiers with Stripe integration |
| **Zero-Downtime Deploys** | Atomic edge router updates, health checks before cutover |
| **Multi-Region Support** | Deploy closer to users for lower latency |
| **Admin Panel** | Internal dashboard to manage all users/projects |
| **API Rate Limiting** | Protect against abuse |

---

## 🛠️ Tech Stack Decisions

| Layer | Technology | Why |
|---|---|---|
| **Dashboard** | Next.js (TypeScript) | Full-stack, great DX, SSR + static hybrid |
| **Control Plane API** | Node.js + Express / Fastify | Fast to build, great ecosystem |
| **Build Worker** | Docker + Node.js orchestrator | Isolated, reproducible build environments |
| **Queue** | BullMQ + Redis | Reliable job queue for build jobs |
| **Edge Router** | Go or Caddy | High performance, handles millions of requests |
| **Database (Platform)** | PostgreSQL | Reliable, structured storage for user/project data |
| **Cache** | Redis | Fast domain-to-deployment lookups |
| **Object Storage** | AWS S3 / MinIO (self-hosted) | Store build artifacts and static files |
| **CDN** | Cloudflare / AWS CloudFront | Global static asset delivery |
| **SSL Certificates** | Let's Encrypt + Caddy | Auto-provisioned TLS for custom domains |
| **Realtime** | WebSockets (ws / Socket.io) | Live build logs, realtime subscriptions |
| **Auth (Platform)** | JWT + Refresh Tokens | Stateless, scalable authentication |
| **CLI** | Node.js (commander.js) | Cross-platform CLI tool |
| **Monorepo** | Turborepo or Nx | Manage multiple packages (dashboard, api, cli, worker) |

---

## 📁 Suggested Project Structure

```
hosting-platform/
├── apps/
│   ├── dashboard/          # Next.js web dashboard
│   ├── api/                # Control Plane REST API (Node.js)
│   ├── build-worker/       # Docker-based build execution service
│   ├── edge-router/        # Go-based reverse proxy / edge routing
│   └── cli/                # npm CLI tool
├── packages/
│   ├── db/                 # Shared DB schema & migrations (Prisma)
│   ├── ui/                 # Shared UI component library
│   └── config/             # Shared ESLint, TypeScript configs
├── docs/
│   ├── project_q_and_a.md
│   └── roadmap.md          # (this file)
├── docker/
│   └── build-sandbox/      # Dockerfile for isolated build environments
├── infra/
│   └── terraform/          # Infrastructure-as-code (optional, later)
└── package.json            # Root workspace config (npm workspaces / turbo)
```

---

## 🚀 Recommended Build Order

```
Step 1 → Set up monorepo (Turborepo)
Step 2 → Build Dashboard (auth, project CRUD UI)
Step 3 → Build Control Plane API (auth endpoints, project endpoints)
Step 4 → Set up PostgreSQL + Prisma schema
Step 5 → GitHub OAuth + Webhook listener
Step 6 → Build Worker (Docker build execution + log streaming)
Step 7 → Object Storage + Static file serving
Step 8 → Edge Router (subdomain routing + custom domain + SSL)
Step 9 → Environment Variables (encrypted)
Step 10 → CLI Tool
Step 11 → Backend services (DB, Auth, Storage, Functions)
Step 12 → Billing, Analytics, Production hardening
```

---

## ⚠️ Biggest Challenges to Anticipate

| Challenge | Why It's Hard | Mitigation |
|---|---|---|
| **Security Isolation** | User code can be malicious | Docker + seccomp profiles + resource limits |
| **Cold Starts** | Serverless functions sleep, slow first response | Warm pool of containers / edge functions |
| **Custom Domain + SSL at Scale** | Thousands of domains, certs must be provisioned fast | Caddy handles this automatically |
| **Build Parallelism** | Many users pushing at once | Horizontal scaling of build worker fleet |
| **Realtime Log Streaming** | WebSockets at scale are complex | Redis Pub/Sub to decouple producers from consumers |

---

*Document created: 2026-09-25*
*Status: Planning Phase*
