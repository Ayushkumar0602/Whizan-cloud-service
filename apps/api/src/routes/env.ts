import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { encrypt, decrypt } from "../lib/crypto.js";

const EnvSchema = z.object({
  key: z.string().min(1).regex(/^[A-Z0-9_]+$/, "Keys must be uppercase with underscores"),
  value: z.string(),
  isSecret: z.boolean().default(true),
});

export async function envRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  // GET /api/projects/:id/env
  fastify.get("/:id/env", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { userId } = request.user;

    const project = await prisma.project.findFirst({ where: { id, userId } });
    if (!project) return reply.code(404).send({ error: "Project not found" });

    const vars = await prisma.envVariable.findMany({ where: { projectId: id } });

    // Never return plaintext values — mask secrets
    return vars.map((v) => ({
      id: v.id,
      key: v.key,
      value: v.isSecret ? "***" : decrypt(v.value),
      isSecret: v.isSecret,
      createdAt: v.createdAt,
    }));
  });

  // POST /api/projects/:id/env
  fastify.post("/:id/env", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { userId } = request.user;
    const body = EnvSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const project = await prisma.project.findFirst({ where: { id, userId } });
    if (!project) return reply.code(404).send({ error: "Project not found" });

    const encryptedValue = encrypt(body.data.value);

    const envVar = await prisma.envVariable.upsert({
      where: { projectId_key: { projectId: id, key: body.data.key } },
      update: { value: encryptedValue, isSecret: body.data.isSecret },
      create: { projectId: id, key: body.data.key, value: encryptedValue, isSecret: body.data.isSecret },
    });

    return reply.code(201).send({ id: envVar.id, key: envVar.key, isSecret: envVar.isSecret });
  });

  // DELETE /api/projects/:id/env/:key
  fastify.delete("/:id/env/:key", async (request, reply) => {
    const { id, key } = request.params as { id: string; key: string };
    const { userId } = request.user;

    const project = await prisma.project.findFirst({ where: { id, userId } });
    if (!project) return reply.code(404).send({ error: "Project not found" });

    await prisma.envVariable.deleteMany({ where: { projectId: id, key } });
    return reply.send({ ok: true });
  });
}
