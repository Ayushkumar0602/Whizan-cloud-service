import type { Redis } from "ioredis";

const LOG_EXPIRY_SECONDS = 60 * 60 * 24; // Keep logs for 24h in Redis list
const LOG_LIST_KEY = (deploymentId: string) => `build-logs:${deploymentId}`;
const LOG_CHANNEL = (deploymentId: string) => `logs:${deploymentId}`;

/**
 * Maximum number of log lines to retain per deployment.
 * If a build emits more than this (e.g. 100k npm deprecation warnings),
 * the oldest lines are silently dropped to prevent Redis OOM.
 */
const MAX_LOG_LINES = 2000;

/**
 * Publishes a log line to Redis:
 *  1. Appends to a Redis list (for replay if user opens logs late)
 *  2. Trims the list to MAX_LOG_LINES (anti-OOM guard)
 *  3. Publishes to Pub/Sub channel (for real-time streaming)
 *
 * All three operations run in a single pipeline — no extra round trips.
 */
export async function publishLog(
  redis: Redis,
  deploymentId: string,
  line: string
): Promise<void> {
  const listKey = LOG_LIST_KEY(deploymentId);
  const channel = LOG_CHANNEL(deploymentId);

  // Pipeline: rpush + ltrim + expire in one round trip
  await redis
    .pipeline()
    .rpush(listKey, line)
    .ltrim(listKey, -MAX_LOG_LINES, -1) // Keep only the last MAX_LOG_LINES entries
    .expire(listKey, LOG_EXPIRY_SECONDS)
    .exec();

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
