import type { FastifyRequest, FastifyReply } from "fastify";

/**
 * Authentication middleware — verifies the JWT Bearer token.
 * Attaches the decoded user payload to request.user.
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    reply.code(401).send({ error: "Unauthorized" });
  }
}

// Extend FastifyRequest with typed user payload
declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { userId: string; email: string };
    user: { userId: string; email: string };
  }
}
