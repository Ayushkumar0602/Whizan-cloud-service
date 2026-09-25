import fs from "fs/promises";
import path from "path";

const BUILD_BASE_DIR = process.env.BUILD_BASE_DIR ?? "/tmp/hostify-builds";

/**
 * Stops & removes the Docker container for a given deployment (if any).
 * Uses a dynamic import so this module compiles cleanly on environments
 * where Docker is not available (e.g. Render API server).
 * Safe to call even if the container is already gone.
 */
export async function stopDeploymentContainer(deploymentId: string): Promise<void> {
  try {
    const Docker = (await import("dockerode")).default;
    const docker = new Docker({ socketPath: "/var/run/docker.sock" });
    const containers: any[] = await docker.listContainers({ all: true });
    const matches = containers.filter((c: any) =>
      c.Mounts?.some((m: any) => m.Source?.includes(deploymentId))
    );
    await Promise.all(
      matches.map(async (info: any) => {
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
    // Docker unavailable on this host — ignore (API doesn't manage Docker directly)
  }
}

/**
 * Deletes the build directory for a deployment from disk.
 */
export async function deleteBuildDir(deploymentId: string): Promise<void> {
  const buildDir = path.join(BUILD_BASE_DIR, deploymentId);
  await fs.rm(buildDir, { recursive: true, force: true }).catch(() => {});
}
