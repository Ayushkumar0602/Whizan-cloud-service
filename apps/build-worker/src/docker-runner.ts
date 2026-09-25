import Docker from "dockerode";
import path from "path";

export interface BuildJob {
  deploymentId: string;
  projectId: string;
  repoUrl: string;
  branch: string;
  buildCommand: string;
  installCommand: string;
  outputDir: string;
  framework: string;
  slug: string;
  isResume?: boolean;
}

interface RunBuildOptions {
  buildDir: string;
  installCommand: string;
  buildCommand: string;
  envVars: Record<string, string>;
  onLog: (line: string) => Promise<void>;
  abortSignal?: AbortSignal;
}

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

const BUILD_IMAGE = "node:18-slim";
const BUILD_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes max per build

/**
 * Runs the user's build inside an isolated Docker container.
 * Returns the container exit code (0 = success).
 */
export async function runBuild(opts: RunBuildOptions): Promise<number> {
  let { buildDir, installCommand, buildCommand, envVars, onLog, abortSignal } = opts;

  // Force Node to garbage collect and not use excessive RAM
  envVars["NODE_OPTIONS"] = "--max_old_space_size=2048";
  
  if (installCommand === "npm install") {
    // Prevent network hang-ups and RAM bloat during install
    installCommand = "npm install --no-fund --no-audit";
  }

  // Format env vars for Docker
  const env = Object.entries(envVars).map(([k, v]) => `${k}=${v}`);

  const cmd = [
    "sh",
    "-c",
    // chmod first so root-owned mount is writable, then install + build
    `set -e && chmod -R 777 /app && echo "--- Installing dependencies ---" && ${installCommand} && echo "--- Building ---" && ${buildCommand}`,
  ];

  await onLog(`Container image: ${BUILD_IMAGE}`);
  await onLog(`Command: ${installCommand} && ${buildCommand}`);

  // Pull image if not present
  await ensureImage(BUILD_IMAGE);

  const container = await docker.createContainer({
    Image: BUILD_IMAGE,
    Cmd: cmd,
    WorkingDir: "/app",
    Env: env,
    HostConfig: {
      // Mount only the cloned repo.
      Binds: [
        `${path.resolve(buildDir)}:/app`
      ],
      // We explicitly removed the 2GB Memory cap so Docker is allowed to use 
      // the VM's free 3GB of RAM and the Swap file you created.
      // Security hardening
      ReadonlyRootfs: false,            // Build needs to write node_modules
      CapDrop: ["ALL"],                 // Drop all Linux capabilities
      CapAdd: [],
      // Use default network mode so npm install can reach the internet
      AutoRemove: false,                // We remove manually after log capture
    },
    // Run as root so we can write to the host-mounted /app directory
    User: "root",
  });

  try {
    // Attach to container logs before starting so we don't miss early output
    const stream = await container.attach({
      stream: true,
      stdout: true,
      stderr: true,
    });

    await container.start();

    // Stream logs line by line
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        container.kill().catch(() => {});
        reject(new Error(`Build timed out after ${BUILD_TIMEOUT_MS / 60000} minutes`));
      }, BUILD_TIMEOUT_MS);

      docker.modem.demuxStream(
        stream,
        // stdout handler
        {
          write(chunk: Buffer) {
            const lines = chunk.toString().split("\n").filter(Boolean);
            lines.forEach((l) => onLog(l));
          },
        } as any,
        // stderr handler
        {
          write(chunk: Buffer) {
            const lines = chunk.toString().split("\n").filter(Boolean);
            lines.forEach((l) => onLog(`[stderr] ${l}`));
          },
        } as any
      );

      stream.on("end", () => { clearTimeout(timeout); resolve(); });
      stream.on("error", (err: Error) => { clearTimeout(timeout); reject(err); });

      if (abortSignal) {
        abortSignal.addEventListener("abort", () => {
          clearTimeout(timeout);
          container.kill().catch(() => {});
          reject(new Error("Build cancelled by user"));
        }, { once: true });
      }
    });

    const info = await container.inspect();
    return info.State.ExitCode;
  } finally {
    await container.remove({ force: true }).catch(() => {});
  }
}

/**
 * Pulls a Docker image if it's not already available locally.
 */
async function ensureImage(imageName: string): Promise<void> {
  try {
    await docker.getImage(imageName).inspect();
  } catch {
    // Image not found locally — pull it
    await new Promise<void>((resolve, reject) => {
      docker.pull(imageName, (err: Error, stream: NodeJS.ReadableStream) => {
        if (err) return reject(err);
        docker.modem.followProgress(stream, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }
}
