import { redisClient } from "./redis.js";

/**
 * Publishes a command to the VM worker to stop and remove the Docker container.
 */
export async function stopDeploymentContainer(deploymentId: string): Promise<void> {
  await redisClient.publish(
    "admin:commands",
    JSON.stringify({ action: "STOP_CONTAINER", deploymentId })
  ).catch(() => {});
}

/**
 * Publishes a command to the VM worker to delete the build directory and container.
 */
export async function deleteBuildDir(deploymentId: string): Promise<void> {
  await redisClient.publish(
    "admin:commands",
    JSON.stringify({ action: "DELETE_CONTAINER", deploymentId })
  ).catch(() => {});
}
