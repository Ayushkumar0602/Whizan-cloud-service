import type { Redis } from "ioredis";

interface DeploymentInfo {
  type: "static" | "ssr" | "hybrid";
  staticDir?: string;
  containerPort?: number;
  deploymentId: string;
  projectId: string;
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
  console.log(`[RouterRegistrar] Registered deployment for slug: ${slug} (type: ${info.type})`);
}

export async function unregisterDeployment(
  redis: Redis,
  slug: string
): Promise<void> {
  await redis.del(`deployment:${slug}`);
}
