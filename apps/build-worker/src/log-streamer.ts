import type { Redis } from "ioredis";

const LOG_EXPIRY_SECONDS = 60 * 60 * 24; // Keep logs for 24h in Redis list
const LOG_LIST_KEY = (deploymentId: string) => `build-logs:${deploymentId}`;
const LOG_CHANNEL = (deploymentId: string) => `logs:${deploymentId}`;

/**
 * Publishes a log line to Redis:
 *  1. Appends to a Redis list (for replay if user opens logs late)
 *  2. Publishes to Pub/Sub channel (for real-time streaming)
 */
export async function publishLog(
  redis: Redis,
  deploymentId: string,
  line: string
): Promise<void> {
  const listKey = LOG_LIST_KEY(deploymentId);
  const channel = LOG_CHANNEL(deploymentId);

  // Persist log line in list for late-joining subscribers
  await redis.rpush(listKey, line);
  await redis.expire(listKey, LOG_EXPIRY_SECONDS);

  // Broadcast to real-time SSE subscribers
  await redis.publish(channel, line);
}

/**
 * Retrieves all historical log lines for a deployment.
 * Used when a user opens the logs page after the build has finished.
 */
export async function getStoredLogs(
  redis: Redis,
  deploymentId: string
): Promise<string[]> {
  return redis.lrange(LOG_LIST_KEY(deploymentId), 0, -1);
}
