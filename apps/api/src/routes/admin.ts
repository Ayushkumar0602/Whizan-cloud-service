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
}
