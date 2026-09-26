import { FastifyInstance } from "fastify";
import { PrismaClient } from "@hostify/db";
import { Redis } from "ioredis";

const prisma = new PrismaClient();
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: false });

export const adminRoutes = async function (fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  // 1. Get overall system stats + VM health from worker
  fastify.get("/stats", async (request, reply) => {
    const usersCount = await prisma.user.count();
    const projectsCount = await prisma.project.count();
    const deploymentsCount = await prisma.deployment.count();

    const allDeployments = await prisma.deployment.findMany({
      orderBy: { createdAt: "desc" },
      include: { project: true }
    });

    // Read VM stats published by the worker every 15s
    let vmStats = null;
    try {
      const raw = await redis.get("vm:stats");
      if (raw) vmStats = JSON.parse(raw);
    } catch {}

    return {
      users: usersCount,
      projects: projectsCount,
      deployments: deploymentsCount,
      allDeployments,
      vmStats,
    };
  });

  // 2. Stop/Pause a container
  fastify.post("/deployments/:id/stop", async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const deployment = await prisma.deployment.findUnique({ where: { id } });
    if (!deployment) return reply.code(404).send({ error: "Not found" });

    await prisma.deployment.update({
      where: { id },
      data: { status: "PAUSED", containerPort: null }
    });

    const project = await prisma.project.findUnique({ where: { id: deployment.projectId } });
    if (project) {
      const routerKey = `deployment:${project.slug}`;
      const raw = await redis.get(routerKey);
      if (raw) {
        const info = JSON.parse(raw);
        delete info.containerPort;
        await redis.set(routerKey, JSON.stringify(info));
      }
    }

    await redis.publish("admin:commands", JSON.stringify({
      action: "STOP_CONTAINER",
      deploymentId: id
    }));

    return { success: true };
  });

  // 3. Delete a deployment completely
  fastify.delete("/deployments/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    
    await redis.publish("admin:commands", JSON.stringify({
      action: "DELETE_CONTAINER",
      deploymentId: id
    }));

    await prisma.deployment.delete({ where: { id } }).catch(() => {});
    return { success: true };
  });

  // 4. Force-kill a specific Docker container by its container ID
  fastify.delete("/containers/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    
    await redis.publish("admin:commands", JSON.stringify({
      action: "KILL_CONTAINER_BY_ID",
      containerId: id
    }));

    return { success: true };
  });

  // 4b. Fetch logs from a specific container (RPC)
  fastify.get("/containers/:id/logs", async (request, reply) => {
    const { id } = request.params as { id: string };
    const replyChannel = `admin:rpc:logs:${id}:${Date.now()}`;
    
    return new Promise((resolve) => {
      let timeout = setTimeout(() => {
        sub.unsubscribe(replyChannel).catch(() => {});
        sub.quit().catch(() => {});
        resolve({ logs: "Timeout waiting for VM worker. Is it online?" });
      }, 5000);

      const sub = redis.duplicate();
      sub.subscribe(replyChannel, () => {
        redis.publish("admin:commands", JSON.stringify({
          action: "GET_CONTAINER_LOGS",
          containerId: id,
          replyTo: replyChannel
        }));
      });

      sub.on("message", (channel, message) => {
        if (channel === replyChannel) {
          clearTimeout(timeout);
          sub.unsubscribe(replyChannel).catch(() => {});
          sub.quit().catch(() => {});
          resolve({ logs: message });
        }
      });
    });
  });

  // 5. Delete specific file/directory on VM
  fastify.post("/files/delete", async (request, reply) => {
    const { path } = request.body as { path: string };
    
    if (!path) return reply.code(400).send({ error: "Path required" });

    await redis.publish("admin:commands", JSON.stringify({
      action: "DELETE_FILE",
      path
    }));

    return { success: true };
  });

  // 6. Get logs
  fastify.get("/logs/:service/:type", async (request, reply) => {
    const { service, type } = request.params as { service: string, type: string };
    const logs = await redis.get(`vm:logs:${service}:${type}`);
    return { logs: logs || "No logs available" };
  });

  // 7. Restart services
  fastify.post("/restart/:service", async (request, reply) => {
    const { service } = request.params as { service: string };
    if (service === "worker") {
      await redis.publish("admin:commands", JSON.stringify({ action: "RESTART_WORKER" }));
    } else if (service === "router") {
      await redis.publish("admin:commands", JSON.stringify({ action: "RESTART_ROUTER" }));
    }
    return { success: true };
  });

  // 8. Database Stats
  fastify.get("/database/stats", async (request, reply) => {
    let redisStats = null;
    try {
      const info = await redis.info();
      const getVal = (key: string) => {
        const match = info.match(new RegExp(`^${key}:(.*)`, "m"));
        return match ? match[1].trim() : null;
      };
      redisStats = {
        version: getVal("redis_version"),
        uptime: getVal("uptime_in_days"),
        connectedClients: getVal("connected_clients"),
        usedMemory: getVal("used_memory_human"),
        peakMemory: getVal("used_memory_peak_human"),
      };
    } catch {}

    let pgStats = null;
    try {
      const dbSizeRes: any = await prisma.$queryRawUnsafe(`SELECT pg_size_pretty(pg_database_size(current_database())) as size`);
      const connRes: any = await prisma.$queryRawUnsafe(`SELECT count(*) as connections FROM pg_stat_activity`);
      pgStats = {
        size: dbSizeRes?.[0]?.size || "Unknown",
        connections: Number(connRes?.[0]?.connections || 0),
      };
    } catch {}

    return { redis: redisStats, postgres: pgStats };
  });
}
