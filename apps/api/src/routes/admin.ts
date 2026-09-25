import { FastifyInstance } from "fastify";
import { PrismaClient } from "@hostify/db";
import { Redis } from "ioredis";

const prisma = new PrismaClient();
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: false });

export const adminRoutes = async function (fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  // 1. Get overall system stats
  fastify.get("/stats", async (request, reply) => {
    // Only allow admin (we'll just allow any authenticated user for this demo, 
    // but in a real app you'd check request.user.role === 'ADMIN')
    
    const usersCount = await prisma.user.count();
    const projectsCount = await prisma.project.count();
    const deploymentsCount = await prisma.deployment.count();

    const activeDeployments = await prisma.deployment.findMany({
      where: { status: "READY" },
      orderBy: { createdAt: "desc" },
      include: { project: true }
    });

    return {
      users: usersCount,
      projects: projectsCount,
      deployments: deploymentsCount,
      activeDeployments,
    };
  });

  // 2. Stop/Pause a container
  fastify.post("/deployments/:id/stop", async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const deployment = await prisma.deployment.findUnique({ where: { id } });
    if (!deployment) return reply.code(404).send({ error: "Not found" });

    // Mark it as paused in the database
    await prisma.deployment.update({
      where: { id },
      data: { status: "PAUSED", containerPort: null }
    });

    // Remove from Redis router
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

    // Publish to the Azure Worker to actually stop the Docker container
    await redis.publish("admin:commands", JSON.stringify({
      action: "STOP_CONTAINER",
      deploymentId: id
    }));

    return { success: true };
  });

  // 3. Delete a deployment completely
  fastify.delete("/deployments/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    
    // Publish to worker first so it knows what to clean up
    await redis.publish("admin:commands", JSON.stringify({
      action: "DELETE_CONTAINER",
      deploymentId: id
    }));

    await prisma.deployment.delete({ where: { id } }).catch(() => {});
    return { success: true };
  });
}
