import Docker from "dockerode";
import fs from "fs/promises";
import path from "path";

const docker = new Docker({ socketPath: "/var/run/docker.sock" });
const BUILD_BASE_DIR = process.env.BUILD_BASE_DIR ?? "/tmp/hostify-builds";

/**
 * Stops & removes the Docker container for a given deployment (if any).
 * Safe to call even if the container is already gone.
 */
export async function stopDeploymentContainer(deploymentId: string): Promise<void> {
  try {
    const containers = await docker.listContainers({ all: true });
    // Identify containers mounted to this deployment's build directory.
    // We use .includes(deploymentId) because Docker Desktop on Mac prefixes mount paths with /host_mnt/private/...
    const matches = containers.filter((c) =>
      c.Mounts?.some((m) => m.Source?.includes(deploymentId))
    );

    await Promise.all(
      matches.map(async (info) => {
        try {
          const container = docker.getContainer(info.Id);
          if (info.State === "running") await container.stop({ t: 5 });
          await container.remove({ force: true });
        } catch {
          // already gone
        }
      })
    );
  } catch {
    // Docker unavailable — ignore
  }
}

/**
 * Deletes the build directory for a deployment from disk.
 */
export async function deleteBuildDir(deploymentId: string): Promise<void> {
  const buildDir = path.join(BUILD_BASE_DIR, deploymentId);
  await fs.rm(buildDir, { recursive: true, force: true }).catch(() => {});
}
