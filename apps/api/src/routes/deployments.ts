import type { FastifyInstance } from "fastify";
import { Queue } from "bullmq";
import { prisma } from "../lib/prisma.js";
import { redisClient, redisSub } from "../lib/redis.js";
import { stopDeploymentContainer, deleteBuildDir } from "../lib/resource-cleaner.js";

// Shared build queue — the build-worker consumes from this
export const buildQueue = new Queue("build", {
  connection: redisClient,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

export async function deploymentRoutes(fastify: FastifyInstance) {
  // ── GET /api/projects/:id/deployments ───────────────────────────────────────
  fastify.get(
    "/:id/deployments",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { userId } = request.user;

      const project = await prisma.project.findFirst({ where: { id, userId } });
      if (!project) return reply.code(404).send({ error: "Project not found" });

      const deployments = await prisma.deployment.findMany({
        where: { projectId: id },
        orderBy: { createdAt: "desc" },
        take: 20,
      });

      for (const d of deployments) {
        if (d.status === "READY" && d.deploymentType !== "STATIC") {
          const val = await redisClient.get(`access:${d.id}`);
          (d as any).lastAccessed = val ? parseInt(val) : (d.buildFinishedAt?.getTime() ?? d.createdAt.getTime());
        }
      }
      return deployments;
    }
  );

  // ── GET /api/projects/:id/deployments/:dId ──────────────────────────────────
  fastify.get(
    "/:id/deployments/:dId",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id, dId } = request.params as { id: string; dId: string };
      const { userId } = request.user;

      const project = await prisma.project.findFirst({ where: { id, userId } });
      if (!project) return reply.code(404).send({ error: "Project not found" });

      const deployment = await prisma.deployment.findFirst({ where: { id: dId, projectId: id } });
      if (!deployment) return reply.code(404).send({ error: "Deployment not found" });

      if (deployment.status === "READY" && deployment.deploymentType !== "STATIC") {
        const val = await redisClient.get(`access:${deployment.id}`);
        (deployment as any).lastAccessed = val ? parseInt(val) : (deployment.buildFinishedAt?.getTime() ?? deployment.createdAt.getTime());
      }

      return deployment;
    }
  );

  // ── POST /api/projects/:id/deployments — Manual trigger ─────────────────────
  fastify.post(
    "/:id/deployments",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { userId } = request.user;

      const project = await prisma.project.findFirst({ where: { id, userId } });
      if (!project) return reply.code(404).send({ error: "Project not found" });

      // Prevent double-deploy
      const inProgress = await prisma.deployment.findFirst({
        where: { projectId: id, status: { in: ["QUEUED", "BUILDING"] } },
      });
      if (inProgress) {
        return reply.code(409).send({ error: "A deployment is already in progress", deployment: inProgress });
      }

      const deployment = await prisma.deployment.create({
        data: {
          projectId: id,
          commitHash: "manual",
          commitMessage: "Manual deploy",
          branch: project.branch,
          status: "QUEUED",
        },
      });

      await buildQueue.add("build", {
        deploymentId: deployment.id,
        projectId: project.id,
        repoUrl: project.githubRepoUrl,
        branch: project.branch,
        buildCommand: project.buildCommand,
        installCommand: project.installCommand,
        outputDir: project.outputDir,
        framework: project.framework,
        slug: project.slug,
      });

      return reply.code(201).send(deployment);
    }
  );

  // ── POST /api/projects/:id/deployments/:dId/cancel ──────────────────────────
  fastify.post(
    "/:id/deployments/:dId/cancel",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id, dId } = request.params as { id: string; dId: string };
      const { userId } = request.user;

      const project = await prisma.project.findFirst({ where: { id, userId } });
      if (!project) return reply.code(404).send({ error: "Project not found" });

      await prisma.deployment.updateMany({
        where: { id: dId, projectId: id, status: { in: ["QUEUED", "BUILDING"] } },
        data: { status: "CANCELLED", buildFinishedAt: new Date(), errorMessage: "Cancelled by user" },
      });

      // Tell build-worker to kill Docker build container immediately
      await redisClient.publish(`cancel:${dId}`, "CANCEL");
      // Close any SSE log streams
      await redisClient.publish(`logs:${dId}`, "__DONE__");

      return reply.send({ ok: true });
    }
  );

  // ── POST /api/projects/:id/deployments/:dId/pause ───────────────────────────
  // Stops the SSR container (releases CPU/RAM/port) but keeps all data on disk.
  // The deployment can be resumed later.
  fastify.post(
    "/:id/deployments/:dId/pause",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id, dId } = request.params as { id: string; dId: string };
      const { userId } = request.user;

      const project = await prisma.project.findFirst({ where: { id, userId } });
      if (!project) return reply.code(404).send({ error: "Project not found" });

      const deployment = await prisma.deployment.findFirst({ where: { id: dId, projectId: id } });
      if (!deployment) return reply.code(404).send({ error: "Deployment not found" });
      if (deployment.status !== "READY") {
        return reply.code(400).send({ error: "Only READY deployments can be paused" });
      }

      // Stop the SSR Docker container — releases port + CPU/RAM
      await stopDeploymentContainer(dId);

      // Remove from edge router so traffic stops being proxied
      await redisClient.del(`deployment:${project.slug}`);

      await prisma.deployment.update({
        where: { id: dId },
        data: { status: "PAUSED" },
      });

      return reply.send({ ok: true });
    }
  );

  // ── POST /api/projects/:id/deployments/:dId/resume ──────────────────────────
  // Re-triggers a full build for a PAUSED deployment (clean restart).
  fastify.post(
    "/:id/deployments/:dId/resume",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id, dId } = request.params as { id: string; dId: string };
      const { userId } = request.user;

      const project = await prisma.project.findFirst({ where: { id, userId } });
      if (!project) return reply.code(404).send({ error: "Project not found" });

      const deployment = await prisma.deployment.findFirst({ where: { id: dId, projectId: id } });
      if (!deployment) return reply.code(404).send({ error: "Deployment not found" });
      if (deployment.status !== "PAUSED") {
        return reply.code(400).send({ error: "Only PAUSED deployments can be resumed" });
      }

      // Reuse existing deployment ID, clear old logs, and mark QUEUED
      await prisma.deployment.update({
        where: { id: dId },
        data: { status: "QUEUED", buildFinishedAt: null, errorMessage: null },
      });
      await redisClient.del(`build-logs:${dId}`);

      await buildQueue.add("build", {
        deploymentId: dId,
        projectId: project.id,
        repoUrl: project.githubRepoUrl,
        branch: project.branch,
        buildCommand: project.buildCommand,
        installCommand: project.installCommand,
        outputDir: project.outputDir,
        framework: project.framework,
        slug: project.slug,
        isResume: true,
      });

      const updated = await prisma.deployment.findUnique({ where: { id: dId } });
      return reply.code(201).send(updated);
    }
  );

  // ── DELETE /api/projects/:id/deployments/:dId ───────────────────────────────
  // Fully removes a deployment: DB row + Docker container + build files + Redis key
  fastify.delete(
    "/:id/deployments/:dId",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id, dId } = request.params as { id: string; dId: string };
      const { userId } = request.user;

      const project = await prisma.project.findFirst({ where: { id, userId } });
      if (!project) return reply.code(404).send({ error: "Project not found" });

      const deployment = await prisma.deployment.findFirst({ where: { id: dId, projectId: id } });
      if (!deployment) return reply.code(404).send({ error: "Deployment not found" });

      // If it's still building — cancel it first
      if (deployment.status === "QUEUED" || deployment.status === "BUILDING") {
        await redisClient.publish(`cancel:${dId}`, "CANCEL");
        await redisClient.publish(`logs:${dId}`, "__DONE__");
      }

      // Stop container + delete build files + remove from router
      await Promise.all([
        stopDeploymentContainer(dId),
        deleteBuildDir(dId),
        redisClient.del(`deployment:${project.slug}`),
        redisClient.del(`build-logs:${dId}`),
      ]);

      // Delete from DB
      await prisma.deployment.delete({ where: { id: dId } });

      return reply.send({ ok: true });
    }
  );

  // ── GET /api/projects/deployments/:dId/logs — SSE (token auth) ─────────────
  fastify.get(
    "/deployments/:dId/logs",
    async (request, reply) => {
      const { dId } = request.params as { dId: string };
      const { token } = request.query as { token?: string };

      if (!token) return reply.code(401).send({ error: "Missing token" });
      try {
        await request.jwtVerify({ onlyCookie: false });
      } catch {
        try {
          fastify.jwt.verify(token);
        } catch {
          return reply.code(401).send({ error: "Invalid token" });
        }
      }

      const channel = `logs:${dId}`;
      const listKey = `build-logs:${dId}`;

      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "X-Accel-Buffering": "no",
      });

      const sendEvent = (line: string) => {
        reply.raw.write(`data: ${JSON.stringify({ log: line })}\n\n`);
      };

      // Replay stored logs first
      const stored = await redisClient.lrange(listKey, 0, -1);
      for (const line of stored) sendEvent(line);

      // If already done, close immediately
      const deployment = await prisma.deployment.findUnique({ where: { id: dId } });
      if (deployment && ["READY", "FAILED", "CANCELLED", "PAUSED"].includes(deployment.status)) {
        sendEvent("__DONE__");
        reply.raw.end();
        return;
      }

      // Subscribe to live channel
      const sub = redisSub.duplicate();
      await sub.subscribe(channel);

      sub.on("message", (_ch: string, message: string) => {
        sendEvent(message);
        if (message === "__DONE__") {
          sub.unsubscribe(channel).catch(() => {});
          sub.quit().catch(() => {});
          reply.raw.end();
        }
      });

      request.raw.on("close", () => {
        sub.unsubscribe(channel).catch(() => {});
        sub.quit().catch(() => {});
      });
    }
  );
}
