import "dotenv/config";
import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyJwt from "@fastify/jwt";
import fastifyCors from "@fastify/cors";
import fastifyRateLimit from "@fastify/rate-limit";

import { authRoutes } from "./routes/auth.js";
import { projectRoutes } from "./routes/projects.js";
import { deploymentRoutes } from "./routes/deployments.js";
import { envRoutes } from "./routes/env.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { adminRoutes } from "./routes/admin.js";
import { redisClient } from "./lib/redis.js";
import { prisma } from "./lib/prisma.js";

const app = Fastify({
  logger: {
    transport: {
      target: "pino-pretty",
      options: { colorize: true, translateTime: "SYS:standard" },
    },
  },
  trustProxy: true,
});

// ─── Plugins ─────────────────────────────────────────────────────────────────

await app.register(fastifyCors, {
  origin: (origin, cb) => {
    // Allow:
    // - No origin (server-to-server / curl)
    // - Configured DASHBOARD_URL (e.g. Render production URL)
    // - Any *.onrender.com subdomain (Render preview deploys)
    // - Any localhost / 127.0.0.1 (local dev)
    const allowed =
      !origin ||
      origin === (process.env.DASHBOARD_URL || "http://localhost:3000") ||
      /^https?:\/\/[a-z0-9-]+\.onrender\.com$/.test(origin) ||
      /^https?:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin) ||
      /^http:\/\/localhost(:\d+)?$/.test(origin) ||
      /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin);
    cb(null, allowed);
  },
  credentials: true,
});

await app.register(fastifyCookie, {
  secret: process.env.COOKIE_SECRET!,
});

await app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET!,
  sign: { expiresIn: "15m" },
});

// Decorator so routes can use fastify.authenticate as a preHandler
app.decorate("authenticate", async (request: any, reply: any) => {
  try {
    await request.jwtVerify();
  } catch {
    reply.code(401).send({ error: "Unauthorized" });
  }
});

await app.register(fastifyRateLimit, {
  max: 100,
  timeWindow: "1 minute",
  redis: redisClient,
});

// ─── Routes ──────────────────────────────────────────────────────────────────

await app.register(authRoutes, { prefix: "/api/auth" });
await app.register(projectRoutes, { prefix: "/api/projects" });
await app.register(deploymentRoutes, { prefix: "/api/projects" });
await app.register(envRoutes, { prefix: "/api/projects" });
await app.register(webhookRoutes, { prefix: "/api/webhooks" });
await app.register(adminRoutes, { prefix: "/api/admin" });

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get("/health", async () => ({ status: "ok", ts: Date.now() }));

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = Number(process.env.API_PORT) || 8000;

try {
  await app.listen({ port: PORT, host: "0.0.0.0" });
  app.log.info(`API running on http://0.0.0.0:${PORT}`);
} catch (err) {
  app.log.error(err);
  await prisma.$disconnect();
  process.exit(1);
}
