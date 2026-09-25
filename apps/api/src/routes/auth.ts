import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { redisClient } from "../lib/redis.js";
import crypto from "crypto";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateRefreshToken() {
  return crypto.randomBytes(48).toString("hex");
}

const REFRESH_TOKEN_TTL_DAYS = 7;
const COOKIE_NAME = "refreshToken";

async function issueTokens(
  fastify: FastifyInstance,
  reply: any,
  userId: string,
  email: string
) {
  // Access token — short-lived JWT
  const accessToken = fastify.jwt.sign({ userId, email });

  // Refresh token — opaque, stored in DB + HttpOnly cookie
  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(
    Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
  );

  await prisma.refreshToken.create({
    data: { userId, token: refreshToken, expiresAt },
  });

  reply.setCookie(COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: true, // Must be true for sameSite none
    sameSite: "none", // Required for cross-domain cookies (Vercel frontend -> Render API)
    path: "/",
    maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
  });

  return { accessToken };
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function authRoutes(fastify: FastifyInstance) {
  // POST /api/auth/register
  fastify.post("/register", async (request, reply) => {
    const body = RegisterSchema.safeParse(request.body);
    if (!body.success)
      return reply.code(400).send({ error: body.error.flatten() });

    const { email, password, name } = body.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return reply.code(409).send({ error: "Email already in use" });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, name },
    });

    const { accessToken } = await issueTokens(fastify, reply, user.id, user.email);
    return reply.code(201).send({
      accessToken,
      user: { id: user.id, email: user.email, name: user.name },
    });
  });

  // POST /api/auth/login
  fastify.post("/login", async (request, reply) => {
    const body = LoginSchema.safeParse(request.body);
    if (!body.success)
      return reply.code(400).send({ error: body.error.flatten() });

    const { email, password } = body.data;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash)
      return reply.code(401).send({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return reply.code(401).send({ error: "Invalid credentials" });

    const { accessToken } = await issueTokens(fastify, reply, user.id, user.email);
    return reply.send({
      accessToken,
      user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl },
    });
  });

  // POST /api/auth/refresh
  fastify.post("/refresh", async (request, reply) => {
    const token = request.cookies[COOKIE_NAME];
    if (!token) return reply.code(401).send({ error: "No refresh token" });

    const stored = await prisma.refreshToken.findUnique({ where: { token } });
    if (!stored || stored.expiresAt < new Date()) {
      return reply.code(401).send({ error: "Invalid or expired refresh token" });
    }

    // Rotate the refresh token
    await prisma.refreshToken.delete({ where: { token } });

    const user = await prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user) return reply.code(401).send({ error: "User not found" });

    const { accessToken } = await issueTokens(fastify, reply, user.id, user.email);
    return reply.send({ accessToken });
  });

  // POST /api/auth/logout
  fastify.post("/logout", async (request, reply) => {
    const token = request.cookies[COOKIE_NAME];
    if (token) {
      await prisma.refreshToken.deleteMany({ where: { token } }).catch(() => {});
    }
    reply.clearCookie(COOKIE_NAME, { path: "/" });
    return reply.send({ ok: true });
  });

  // GET /api/auth/me
  fastify.get(
    "/me",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, avatarUrl: true, createdAt: true },
      });
      if (!user) return reply.code(404).send({ error: "User not found" });
      return reply.send(user);
    }
  );
}
