import type { Redis } from "ioredis";

interface DeploymentInfo {
  type: "static" | "ssr" | "hybrid";
  staticDir?: string;
  containerPort?: number;
  deploymentId: string;
}

/**
 * Writes deployment routing info to Redis.
 * The Edge Router reads from this to route incoming requests.
 *
 * Key pattern: deployment:<slug>
 */
export async function registerDeployment(
  redis: Redis,
  slug: string,
  info: DeploymentInfo
): Promise<void> {
  await redis.set(`deployment:${slug}`, JSON.stringify(info));
  // Clear the Thundering Herd lock so a future scale-to-zero + cold-start cycle works correctly
  await redis.del(`waking:${info.deploymentId}`);
  console.log(`[RouterRegistrar] Registered deployment for slug: ${slug} (type: ${info.type})`);
}

export async function unregisterDeployment(
  redis: Redis,
  slug: string
): Promise<void> {
  await redis.del(`deployment:${slug}`);
}
