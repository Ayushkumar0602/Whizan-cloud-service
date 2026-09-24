import type { FastifyInstance } from "fastify";
import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import { buildQueue } from "./deployments.js";

export async function webhookRoutes(fastify: FastifyInstance) {
  // POST /api/webhooks/github
  fastify.post(
    "/github",
    {
      config: { rawBody: true }, // We need the raw body to verify HMAC
    },
    async (request, reply) => {
      const signature = request.headers["x-hub-signature-256"] as string;
      const event = request.headers["x-github-event"] as string;
      const body = request.body as any;

      // We only care about push events
      if (event !== "push") return reply.send({ ignored: true });

      const repoUrl = body?.repository?.html_url as string;
      const ref = body?.ref as string; // e.g. "refs/heads/main"
      const branch = ref?.split("/").pop();
      const commitHash = body?.after as string;
      const commitMessage = body?.head_commit?.message as string;

      if (!repoUrl || !branch || !commitHash) {
        return reply.code(400).send({ error: "Invalid payload" });
      }

      // Find the project for this repo + branch
      const project = await prisma.project.findFirst({
        where: { githubRepoUrl: repoUrl, branch },
      });

      if (!project) return reply.send({ ignored: "No project matched" });

      // ── Verify HMAC signature ────────────────────────────────────────────
      const rawBody = (request as any).rawBody as Buffer;
      const expectedSig =
        "sha256=" +
        crypto
          .createHmac("sha256", project.webhookSecret)
          .update(rawBody)
          .digest("hex");

      if (
        !signature ||
        !crypto.timingSafeEqual(
          Buffer.from(signature),
          Buffer.from(expectedSig)
        )
      ) {
        return reply.code(401).send({ error: "Invalid signature" });
      }
      // ────────────────────────────────────────────────────────────────────

      // Create deployment record
      const deployment = await prisma.deployment.create({
        data: {
          projectId: project.id,
          commitHash,
          commitMessage,
          branch,
          status: "QUEUED",
        },
      });

      // Enqueue build job
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

      fastify.log.info(
        `[Webhook] Build queued for project ${project.slug} @ ${commitHash.slice(0, 7)}`
      );

      return reply.send({ queued: true, deploymentId: deployment.id });
    }
  );
}
