import "fastify";
import "@fastify/jwt";

/**
 * Extend FastifyInstance to include the `authenticate` decorator
 * we add in index.ts via app.decorate().
 */
declare module "fastify" {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
  }

  interface FastifyRequest {
    user: {
      userId: string;
      email: string;
    };
  }
}

/**
 * Extend @fastify/jwt to type the JWT payload shape.
 */
declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { userId: string; email: string };
    user: { userId: string; email: string };
  }
}
