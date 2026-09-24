import { Redis } from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Main Redis client (commands)
export const redisClient = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  lazyConnect: true,
});

// Subscriber client (separate connection required for pub/sub)
export const redisSub = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
});

redisClient.on("error", (err: Error) => console.error("[Redis] Client error:", err));
redisSub.on("error", (err: Error) => console.error("[Redis] Sub error:", err));

/**
 * Store deployment routing info so the Edge Router can look it up.
 * Key: `deployment:<slug>` or `deployment:<customDomain>`
 */
export async function registerDeployment(
  slug: string,
  info: {
    type: "static" | "ssr" | "hybrid";
    staticDir?: string;
    containerPort?: number;
    deploymentId: string;
  }
) {
  await redisClient.set(`deployment:${slug}`, JSON.stringify(info));
}

export async function unregisterDeployment(slug: string) {
  await redisClient.del(`deployment:${slug}`);
}

export async function getDeploymentInfo(slug: string) {
  const raw = await redisClient.get(`deployment:${slug}`);
  if (!raw) return null;
  return JSON.parse(raw) as {
    type: "static" | "ssr" | "hybrid";
    staticDir?: string;
    containerPort?: number;
    deploymentId: string;
  };
}
