# Phase 1 — Low Level Design (LLD)

> **Scope:** MVP — A user can sign up, connect a GitHub repo, trigger a build, and get a live URL that serves their static OR dynamic (Next.js SSR + API routes) application.

---

## 📐 System Components (Phase 1)

Phase 1 is composed of **5 independent services** that communicate with each other:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PHASE 1 SERVICES                            │
│                                                                     │
│  ┌──────────────┐   ┌──────────────┐   ┌─────────────────────────┐ │
│  │  Dashboard   │   │  API Server  │   │    Build Worker         │ │
│  │  (Next.js)   │◄──│  (Node.js /  │──►│    (Node.js +           │ │
│  │  Port: 3000  │   │   Fastify)   │   │     Docker SDK)         │ │
│  │              │   │  Port: 8000  │   │    Port: 8001           │ │
│  └──────────────┘   └──────┬───────┘   └───────────┬─────────────┘ │
│                            │                       │               │
│                    ┌───────▼───────┐       ┌───────▼─────────────┐ │
│                    │  PostgreSQL   │       │   Redis             │ │
│                    │  (User, Proj, │       │   - Build job queue │ │
│                    │   Deploy data)│       │   - Log pub/sub     │ │
│                    └───────────────┘       │   - Domain cache    │ │
│                                            └─────────────────────┘ │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Edge Router (Go)                          │  │
│  │   - Receives ALL incoming traffic for *.ourhoster.com        │  │
│  │   - Looks up domain → deployment mapping from Redis          │  │
│  │   - Routes: static → serves from local FS / S3              │  │
│  │   - Routes: dynamic → proxies to App Runner container        │  │
│  │   Port: 80 / 443                                             │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    App Runner (Node.js)                      │  │
│  │   - Long-running containers per deployment                   │  │
│  │   - Runs `node .next/standalone/server.js`                   │  │
│  │   - One container per active SSR deployment                  │  │
│  │   Ports: dynamically assigned                                │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🗃️ Database Schema (PostgreSQL)

### Table: `users`
```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),                     -- null if GitHub OAuth only
  github_id     VARCHAR(100) UNIQUE,              -- GitHub user ID
  github_token  TEXT,                             -- encrypted OAuth token
  name          VARCHAR(255),
  avatar_url    TEXT,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);
```

### Table: `projects`
```sql
CREATE TABLE projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            VARCHAR(100) NOT NULL,
  slug            VARCHAR(100) UNIQUE NOT NULL,   -- used for <slug>.ourhoster.com
  github_repo_url TEXT NOT NULL,                  -- e.g. https://github.com/user/repo
  github_repo_id  VARCHAR(100),                   -- GitHub repo ID for webhooks
  branch          VARCHAR(100) DEFAULT 'main',    -- branch to deploy from
  build_command   VARCHAR(255) DEFAULT 'npm run build',
  install_command VARCHAR(255) DEFAULT 'npm install',
  output_dir      VARCHAR(255) DEFAULT '.next',   -- where build output lives
  framework       VARCHAR(50),                    -- 'nextjs' | 'react' | 'vite' | 'custom'
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);
```

### Table: `deployments`
```sql
CREATE TABLE deployments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  commit_hash     VARCHAR(40) NOT NULL,           -- git SHA
  commit_message  TEXT,
  branch          VARCHAR(100),
  status          VARCHAR(20) DEFAULT 'queued',   -- queued | building | ready | failed | cancelled
  deployment_type VARCHAR(20),                    -- 'static' | 'ssr' | 'hybrid'
  url             TEXT,                           -- full URL e.g. proj-abc123.ourhoster.com
  build_started_at  TIMESTAMP,
  build_finished_at TIMESTAMP,
  error_message   TEXT,
  created_at      TIMESTAMP DEFAULT NOW()
);
```

### Table: `env_variables`
```sql
CREATE TABLE env_variables (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  key         VARCHAR(255) NOT NULL,
  value       TEXT NOT NULL,                      -- AES-256 encrypted
  is_secret   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, key)
);
```

### Table: `custom_domains`
```sql
CREATE TABLE custom_domains (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  domain        VARCHAR(255) UNIQUE NOT NULL,     -- e.g. www.myapp.com
  verified      BOOLEAN DEFAULT FALSE,
  ssl_status    VARCHAR(20) DEFAULT 'pending',    -- pending | active | failed
  created_at    TIMESTAMP DEFAULT NOW()
);
```

---

## 🔌 API Endpoints (Control Plane — Fastify)

### Auth
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register with email + password |
| `POST` | `/api/auth/login` | Login, returns JWT access + refresh token |
| `POST` | `/api/auth/logout` | Invalidate refresh token |
| `GET`  | `/api/auth/github` | Redirect to GitHub OAuth |
| `GET`  | `/api/auth/github/callback` | Handle GitHub OAuth callback |
| `POST` | `/api/auth/refresh` | Exchange refresh token for new access token |
| `GET`  | `/api/auth/me` | Get current user profile |

### Projects
| Method | Path | Description |
|---|---|---|
| `GET`    | `/api/projects` | List all projects for logged-in user |
| `POST`   | `/api/projects` | Create new project |
| `GET`    | `/api/projects/:id` | Get project details |
| `PATCH`  | `/api/projects/:id` | Update project settings |
| `DELETE` | `/api/projects/:id` | Delete project + all deployments |
| `GET`    | `/api/projects/:id/repos` | List user's GitHub repos (via GitHub API) |

### Deployments
| Method | Path | Description |
|---|---|---|
| `GET`  | `/api/projects/:id/deployments` | List all deployments for a project |
| `POST` | `/api/projects/:id/deployments` | Manually trigger a new deployment |
| `GET`  | `/api/projects/:id/deployments/:dId` | Get single deployment details |
| `POST` | `/api/projects/:id/deployments/:dId/cancel` | Cancel a queued/building deployment |

### Logs (Streaming)
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/deployments/:dId/logs` | SSE stream — real-time build logs |

### Webhooks (GitHub → Our server)
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/webhooks/github` | GitHub push event receiver |

### Environment Variables
| Method | Path | Description |
|---|---|---|
| `GET`    | `/api/projects/:id/env` | List env var keys (values masked) |
| `POST`   | `/api/projects/:id/env` | Create/update env var |
| `DELETE` | `/api/projects/:id/env/:key` | Delete env var |

---

## ⚙️ Build Pipeline — Step by Step

```
GitHub Push Event
      │
      ▼
[Webhook Listener]  POST /api/webhooks/github
  - Verify HMAC signature (X-Hub-Signature-256)
  - Parse payload: repo, branch, commit SHA, commit message
  - Match to a Project in DB
  - Create a Deployment record (status: 'queued')
  - Push job to Redis build queue (BullMQ)
      │
      ▼
[Build Worker — BullMQ Consumer]
  - Picks up job from queue
  - Updates deployment status → 'building'
  - Clones repo: `git clone --depth=1 --branch <branch> <repo_url>`
  - Fetches env vars from DB, decrypts them
  - Spins up Docker container:
      docker run --rm \
        --memory="512m" --cpus="1.0" \   ← resource limits
        --network="none" \               ← no internet access during build
        -e KEY=VALUE \                   ← inject env vars
        -v /tmp/build/<id>:/app \        ← mount source code
        node:20-alpine \
        sh -c "cd /app && npm install && npm run build"
  - Streams stdout/stderr → publishes to Redis channel: `logs:<deploymentId>`
  - On exit code 0:
      → Runs Output Analyzer
      → Uploads build artifacts to S3
      → Registers deployment in Edge Router (via Redis key)
      → Updates deployment status → 'ready'
  - On exit code != 0:
      → Updates deployment status → 'failed'
      → Saves error_message to DB
```

---

## 🔍 Output Analyzer — How We Detect Static vs Dynamic

After the build completes, we inspect the output directory to classify the deployment:

```javascript
// pseudo-code: output-analyzer.js

async function analyzeOutput(buildDir, framework) {

  // 1. Check for Next.js standalone output (SSR capable)
  if (exists(`${buildDir}/.next/standalone`)) {
    // Check if it also has static pages
    const hasStaticPages = exists(`${buildDir}/.next/static`);
    const hasApiRoutes   = glob(`${buildDir}/.next/server/app/api/**`).length > 0
                        || glob(`${buildDir}/.next/server/pages/api/**`).length > 0;

    return {
      type: 'hybrid',           // static + ssr + api
      staticDir: '.next/static',
      serverEntry: '.next/standalone/server.js',
      hasApiRoutes,
    };
  }

  // 2. Check for static export (next export / pure SPA)
  if (exists(`${buildDir}/out`) || exists(`${buildDir}/dist`)) {
    return {
      type: 'static',
      staticDir: exists(`${buildDir}/out`) ? 'out' : 'dist',
    };
  }

  // 3. Fallback — try to serve whatever is in the output dir
  return { type: 'static', staticDir: 'build' };
}
```

---

## 🚦 Edge Router — Request Routing Logic

The Edge Router is a **Go HTTP server** that runs on port 80/443 and handles ALL incoming web traffic.

```
Incoming Request: GET https://my-project.ourhoster.com/api/users

  Step 1 → Extract hostname: "my-project.ourhoster.com"
  Step 2 → Strip subdomain: slug = "my-project"
  Step 3 → Redis lookup: GET deployment:<slug>
           Returns: { type: "hybrid", staticDir: "/artifacts/abc123/static", containerPort: 4521 }
  Step 4 → Match request path:
           - Path starts with /_next/static/ → serve from staticDir (CDN/local)
           - Path starts with /api/           → proxy to container on port 4521
           - All other paths                 → proxy to container on port 4521 (SSR)
  Step 5 → Send response back to user
```

**Redis key structure:**
```
deployment:<slug>         → { type, staticDir, containerPort, deploymentId }
deployment:<customdomain> → { type, staticDir, containerPort, deploymentId }
```

---

## 📡 Real-Time Log Streaming

```
Build Worker                    Redis                    Dashboard (Browser)
    │                             │                              │
    │─── PUBLISH logs:<dId> ─────►│                              │
    │    "Step 1: Cloning repo"   │                              │
    │                             │◄── SUBSCRIBE logs:<dId> ────│
    │                             │                              │
    │                             │──── PUSH log line ──────────►│
    │                             │    (Server-Sent Events)      │
    │                             │                              │
```

**API endpoint:** `GET /api/deployments/:dId/logs`
- Uses **Server-Sent Events (SSE)** — a simple, one-directional HTTP stream
- The API server subscribes to `logs:<deploymentId>` channel in Redis
- Each new log line received from Redis is immediately flushed to the browser

---

## 🔐 Auth Flow — JWT + Refresh Tokens

```
1. User POSTs /api/auth/login
2. Server validates credentials
3. Server returns:
   - accessToken  (JWT, expires in 15 min, stored in memory/JS)
   - refreshToken (opaque string, expires in 7 days, stored in HttpOnly cookie)

4. Every API request includes: Authorization: Bearer <accessToken>
5. When accessToken expires → client POSTs /api/auth/refresh with the HttpOnly cookie
6. Server validates refreshToken in DB, issues new accessToken
7. On logout → refreshToken deleted from DB, cookie cleared
```

---

## 📁 Monorepo Folder Structure (Phase 1)

```
hosting-platform/
├── apps/
│   ├── dashboard/               # Next.js 14 (App Router)
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/page.tsx
│   │   │   │   └── register/page.tsx
│   │   │   ├── dashboard/
│   │   │   │   ├── page.tsx           # Project list
│   │   │   │   ├── projects/
│   │   │   │   │   ├── new/page.tsx   # Create project
│   │   │   │   │   └── [id]/
│   │   │   │   │       ├── page.tsx            # Project overview
│   │   │   │   │       ├── deployments/page.tsx
│   │   │   │   │       └── settings/page.tsx
│   │   │   └── layout.tsx
│   │   └── package.json
│   │
│   ├── api/                     # Fastify REST API
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── projects.ts
│   │   │   │   ├── deployments.ts
│   │   │   │   ├── env.ts
│   │   │   │   └── webhooks.ts
│   │   │   ├── services/
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── build.service.ts    # Enqueues builds
│   │   │   │   ├── github.service.ts   # GitHub API calls
│   │   │   │   └── crypto.service.ts   # Encrypt/decrypt env vars
│   │   │   ├── middleware/
│   │   │   │   └── auth.middleware.ts  # JWT verification
│   │   │   ├── db/
│   │   │   │   └── client.ts           # Prisma client
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── build-worker/            # BullMQ worker process
│   │   ├── src/
│   │   │   ├── worker.ts             # BullMQ consumer
│   │   │   ├── docker-runner.ts      # Docker SDK — run build containers
│   │   │   ├── output-analyzer.ts    # Detect static vs SSR vs hybrid
│   │   │   ├── uploader.ts           # Upload artifacts to S3
│   │   │   ├── log-streamer.ts       # Publish logs to Redis
│   │   │   └── router-registrar.ts   # Write deployment info to Redis
│   │   └── package.json
│   │
│   └── edge-router/             # Go reverse proxy
│       ├── main.go
│       ├── router/
│       │   ├── router.go             # Core routing logic
│       │   ├── redis_lookup.go       # Domain → deployment lookup
│       │   └── proxy.go              # Reverse proxy to containers
│       ├── static/
│       │   └── server.go             # Serve static files from S3/local
│       └── go.mod
│
├── packages/
│   ├── db/                      # Prisma schema + migrations (shared)
│   │   ├── schema.prisma
│   │   └── package.json
│   └── ui/                      # Shared React component library
│       ├── src/
│       └── package.json
│
├── docs/
│   ├── project_q_and_a.md
│   ├── roadmap.md
│   └── phase1_lld.md            # (this file)
│
├── docker/
│   └── build-sandbox/
│       └── Dockerfile           # Secure build environment image
│
├── turbo.json                   # Turborepo config
└── package.json                 # Root workspace (npm workspaces)
```

---

## 🐳 Build Sandbox Dockerfile

```dockerfile
# docker/build-sandbox/Dockerfile
# This is the container we run USER code inside — must be locked down

FROM node:20-alpine

# Create a non-root user for security
RUN addgroup -S builder && adduser -S builder -G builder

# Set working directory
WORKDIR /app

# Switch to non-root user
USER builder

# The actual build command is passed as CMD at runtime
# CMD ["sh", "-c", "npm install && npm run build"]
```

---

## 🏁 Phase 1 — Task Breakdown & Build Order

| # | Task | Service | Est. Complexity |
|---|---|---|---|
| 1 | Initialize Turborepo monorepo | Root | 🟢 Low |
| 2 | Set up Prisma schema + PostgreSQL | `packages/db` | 🟢 Low |
| 3 | Build Fastify API skeleton + auth routes | `apps/api` | 🟡 Medium |
| 4 | GitHub OAuth integration | `apps/api` | 🟡 Medium |
| 5 | Build Dashboard (login, register, project list) | `apps/dashboard` | 🟡 Medium |
| 6 | GitHub webhook listener | `apps/api` | 🟡 Medium |
| 7 | BullMQ build queue setup | `apps/build-worker` | 🟡 Medium |
| 8 | Docker build runner (exec user builds) | `apps/build-worker` | 🔴 High |
| 9 | Real-time log streaming (Redis SSE) | `apps/api` + `apps/build-worker` | 🔴 High |
| 10 | Output Analyzer (static vs SSR detection) | `apps/build-worker` | 🟡 Medium |
| 11 | S3 artifact upload | `apps/build-worker` | 🟢 Low |
| 12 | App Runner (manage SSR containers) | `apps/build-worker` | 🔴 High |
| 13 | Edge Router in Go | `apps/edge-router` | 🔴 High |
| 14 | Dashboard — deployments page + live logs UI | `apps/dashboard` | 🟡 Medium |
| 15 | End-to-end integration test | All | 🟡 Medium |

---

*Document created: 2026-09-25*
*Phase: 1 — MVP*
*Status: Planning Complete — Ready to Build*
