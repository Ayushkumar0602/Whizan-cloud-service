import "dotenv/config";
import { Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import { PrismaClient } from "@hostify/db";
import { runBuild, type BuildJob } from "./docker-runner.js";
import { analyzeOutput } from "./output-analyzer.js";
import { registerDeployment } from "./router-registrar.js";
import { AppRunner } from "./app-runner.js";
import { publishLog } from "./log-streamer.js";
import path from "path";
import fs from "fs/promises";
import os from "os";

// ─── Config ──────────────────────────────────────────────────────────────────

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const BUILD_BASE_DIR = process.env.BUILD_BASE_DIR ?? "/tmp/hostify-builds";
const BASE_DOMAIN = process.env.BASE_DOMAIN ?? "localhost";

// ─── Shared singletons ───────────────────────────────────────────────────────

// redisPub: used for publishing logs + cancel signals
const redisPub = new Redis(REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: false });

// redisSub: dedicated subscriber connection (ioredis requirement)
const redisSub = new Redis(REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: false });

const prisma = new PrismaClient();

const appRunner = new AppRunner();

// Shared queue for adding jobs programmatically
import { Queue } from "bullmq";
const buildQueue = new Queue<BuildJob>("build", { connection: redisPub });

// ─── Worker ──────────────────────────────────────────────────────────────────

const worker = new Worker<BuildJob>(
  "build",
  async (job: Job<BuildJob>) => {
    const {
      deploymentId,
      projectId,
      repoUrl,
      branch,
      buildCommand,
      installCommand,
      framework,
      slug,
      isResume,
    } = job.data;

    const buildDir = path.join(BUILD_BASE_DIR, deploymentId);

    // ── Helpers ─────────────────────────────────────────────────────────────

    const log = async (msg: string): Promise<void> => {
      console.log(`[${deploymentId.slice(0, 8)}] ${msg}`);
      await publishLog(redisPub, deploymentId, msg);
    };

    const markFailed = async (msg: string): Promise<void> => {
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: "FAILED", buildFinishedAt: new Date(), errorMessage: msg },
      });
    };

    // ── Cancellation via Redis Pub/Sub ───────────────────────────────────────

    const abortController = new AbortController();
    const cancelChannel = `cancel:${deploymentId}`;

    const onCancelMessage = (channel: string, message: string): void => {
      if (channel === cancelChannel && message === "CANCEL") {
        abortController.abort();
      }
    };

    await redisSub.subscribe(cancelChannel);
    redisSub.on("message", onCancelMessage);

    try {
      // ── 1. Mark BUILDING ─────────────────────────────────────────────────
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: "BUILDING", buildStartedAt: new Date() },
      });

      // ── 2. Clone repo (always start clean) ──────────────────────────────
      if (!isResume) {
        await log(`Cloning ${repoUrl} (branch: ${branch})...`);
        const { simpleGit } = await import("simple-git");

        // Always wipe and re-create the build dir to avoid stale leftovers
        await fs.rm(buildDir, { recursive: true, force: true }).catch(() => {});
        await fs.mkdir(buildDir, { recursive: true });

        await simpleGit().clone(repoUrl, buildDir, ["--depth=1", `--branch=${branch}`]);
        await log("✓ Clone complete");
      }

      // ── 3. Load & decrypt env vars ───────────────────────────────────────
      const envRows = await prisma.envVariable.findMany({ where: { projectId } });
      const { decrypt } = await import("./crypto.js");
      const envVars: Record<string, string> = {};
      for (const row of envRows) {
        envVars[row.key] = decrypt(row.value);
      }

      // ── 4. Build inside Docker ───────────────────────────────────────────
      if (!isResume) {
        await log("Starting build container...");
        const exitCode = await runBuild({
          buildDir,
          installCommand,
          buildCommand,
          envVars,
          onLog: log,
          abortSignal: abortController.signal,
        });

        if (exitCode !== 0) {
          throw new Error(`Build failed with exit code ${exitCode}`);
        }
        await log("✓ Build successful");
      } else {
        await log("✓ Build skipped (resuming existing build)");
      }

      // ── 5. Analyze output ────────────────────────────────────────────────
      await log("Analyzing build output...");
      const analysis = await analyzeOutput(buildDir, framework);
      await log(`✓ Detected type: ${analysis.type}`);

      // ── 6. Start SSR container if needed ────────────────────────────────
      let containerPort: number | undefined;
      if (analysis.type === "ssr" || analysis.type === "hybrid") {
        await log("Starting SSR container...");
        containerPort = await appRunner.startApp(
          deploymentId,
          buildDir,
          envVars,
          analysis.serverEntry
        );
        await log(`✓ SSR container started on port ${containerPort}`);
      }

      // ── 7. Register with edge router ─────────────────────────────────────
      await registerDeployment(redisPub, slug, {
        type: analysis.type,
        staticDir: analysis.staticDir ? path.join(buildDir, analysis.staticDir) : undefined,
        containerPort,
        deploymentId,
      });

      // ── 8. Mark READY ────────────────────────────────────────────────────
      const url = `http://${slug}.${BASE_DOMAIN}`;
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: {
          status: "READY",
          buildFinishedAt: new Date(),
          deploymentType: analysis.type.toUpperCase() as "STATIC" | "SSR" | "HYBRID",
          url,
          containerPort,
        },
      });

      await log(`✓ Deployment live at ${url}`);

      // ── 9. Zero-downtime cleanup of old deployments ──────────────────────
      if (!isResume) {
        await log("Cleaning up previous deployments...");
        const oldDeployments = await prisma.deployment.findMany({
          where: { projectId, id: { not: deploymentId } },
        });

        if (oldDeployments.length > 0) {
          const Docker = (await import("dockerode")).default;
          const docker = new Docker({ socketPath: "/var/run/docker.sock" });
          const containers = await docker.listContainers({ all: true }).catch(() => []);

          for (const old of oldDeployments) {
            // Stop old containers
            const matches = containers.filter((c) => c.Mounts?.some((m) => m.Source?.includes(old.id)));
            for (const info of matches) {
              try {
                const container = docker.getContainer(info.Id);
                if (info.State === "running") await container.stop({ t: 5 });
                await container.remove({ force: true });
              } catch {}
            }
            // Delete old build files
            await fs.rm(path.join(BUILD_BASE_DIR, old.id), { recursive: true, force: true }).catch(() => {});
            // Clear old logs
            await redisPub.del(`build-logs:${old.id}`);
            // Remove from DB to enforce 1-build rule
            await prisma.deployment.delete({ where: { id: old.id } }).catch(() => {});
          }
          await log(`✓ Cleaned up ${oldDeployments.length} old deployment(s)`);
        }
      }

      await publishLog(redisPub, deploymentId, "__DONE__");

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      const wasCancelled = abortController.signal.aborted;

      await log(wasCancelled ? "⚡ Deployment cancelled by user" : `✗ Build failed: ${msg}`);
      await publishLog(redisPub, deploymentId, "__DONE__");
      await markFailed(wasCancelled ? "Cancelled by user" : msg);

      // Clean up build dir on failure / cancellation (no app to serve)
      if (!isResume) {
        await fs.rm(buildDir, { recursive: true, force: true }).catch(() => {});
      }

      if (!wasCancelled) {
        throw err; // Re-throw so BullMQ marks job as failed
      }
    } finally {
      // Always unsubscribe from cancel channel to free Redis resources
      redisSub.off("message", onCancelMessage);
      await redisSub.unsubscribe(cancelChannel).catch(() => {});
    }
  },
  {
    connection: redisPub,
    concurrency: 1, // Strictly 1 build at a time
    limiter: { max: 10, duration: 60_000 },
  }
);

// ─── Worker events ───────────────────────────────────────────────────────────

worker.on("completed", (job) => {
  console.log(`[Worker] Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err.message);
});

// ─── Scale-to-Zero Idle Scaler & Wakeup ──────────────────────────────────────

// 1. Listen for wakeups from Edge Router
redisSub.subscribe("wakeup", "admin:commands").catch(() => {});
redisSub.on("message", async (channel, message) => {
  if (channel === "wakeup") {
    const dId = message;
    const d = await prisma.deployment.findUnique({
      where: { id: dId },
      include: { project: true }
    });
    // If it's already READY, it just needs its container started
    if (d && (d.status === "READY" || d.status === "PAUSED")) {
      console.log(`[Scaler] Triggering cold-start for ${d.id}`);
      await buildQueue.add("build", {
        deploymentId: d.id,
        projectId: d.projectId,
        repoUrl: d.project.githubRepoUrl,
        branch: d.project.branch,
        buildCommand: d.project.buildCommand,
        installCommand: d.project.installCommand,
        outputDir: d.project.outputDir,
        framework: d.project.framework,
        slug: d.project.slug,
        isResume: true,
      });
    }
  }

  if (channel === "admin:commands") {
    try {
      const payload = JSON.parse(message);
      
      const Docker = (await import("dockerode")).default;
      const docker = new Docker({ socketPath: "/var/run/docker.sock" });

      if (payload.action === "KILL_CONTAINER_BY_ID") {
        const cId = payload.containerId;
        console.log(`[Admin] Killing orphaned container ${cId}`);
        const container = docker.getContainer(cId);
        try {
          const info = await container.inspect();
          if (info.State.Running) await container.stop({ t: 2 }).catch(() => {});
          await container.remove({ force: true }).catch(() => {});
          console.log(`[Admin] Successfully removed container ${cId}`);
        } catch (err) {
          console.error(`[Admin] Failed to kill container ${cId}`, err);
        }
        return;
      }

      if (payload.action === "DELETE_FILE") {
        const targetPath = payload.path;
        if (targetPath.startsWith("/opt/whizan-builds/") || targetPath.startsWith("/var/log/whizan/")) {
          console.log(`[Admin] Deleting file/directory: ${targetPath}`);
          await fs.rm(targetPath, { recursive: true, force: true }).catch(() => {});
        }
        return;
      }

      if (payload.action === "STOP_CONTAINER" || payload.action === "DELETE_CONTAINER") {
        const dId = payload.deploymentId;
        console.log(`[Admin] Received ${payload.action} for deployment ${dId}`);
        
        const containers = await docker.listContainers({ all: true }).catch(() => []);
        
        const matches = containers.filter((c) => c.Mounts?.some((m) => m.Source?.includes(dId)));
        for (const info of matches) {
          const container = docker.getContainer(info.Id);
          if (info.State === "running") await container.stop({ t: 2 }).catch(() => {});
          await container.remove({ force: true }).catch(() => {});
          console.log(`[Admin] Removed container ${info.Id} for deployment ${dId}`);
        }

        if (payload.action === "DELETE_CONTAINER") {
          await fs.rm(path.join(BUILD_BASE_DIR, dId), { recursive: true, force: true }).catch(() => {});
          await redisPub.del(`build-logs:${dId}`);
          console.log(`[Admin] Cleaned up files for deployment ${dId}`);
        }
      }
    } catch (err) {
      console.error("[Admin] Error executing command:", err);
    }
  }
});

// 2. Idle Scaler (Checks every minute)
const scalerInterval = setInterval(async () => {
  try {
    const activeDeploys = await prisma.deployment.findMany({
      where: { status: "READY", deploymentType: { in: ["SSR", "HYBRID"] } },
      include: { project: true }
    });

    for (const d of activeDeploys) {
      const lastAccessRaw = await redisPub.get(`access:${d.id}`);
      // Default to buildFinishedAt if never accessed yet
      const lastAccess = lastAccessRaw ? parseInt(lastAccessRaw) : (d.buildFinishedAt?.getTime() ?? d.createdAt.getTime());
      const idleMs = Date.now() - lastAccess;

      // Spin down if idle for > 10 minutes
      if (idleMs > 10 * 60 * 1000) {
        console.log(`[Scaler] Deployment ${d.id} idle for ${Math.round(idleMs/60000)}m. Scaling to zero...`);
        
        const Docker = (await import("dockerode")).default;
        const docker = new Docker({ socketPath: "/var/run/docker.sock" });
        const containers = await docker.listContainers({ all: true }).catch(() => []);
        
        const matches = containers.filter((c) => c.Mounts?.some((m) => m.Source?.includes(d.id)));
        for (const info of matches) {
          const container = docker.getContainer(info.Id);
          if (info.State === "running") await container.stop({ t: 2 }).catch(() => {});
          await container.remove({ force: true }).catch(() => {});
        }

        // Remove containerPort from Edge Router to trigger wakeup on next request
        const routerKey = `deployment:${d.project.slug}`;
        const raw = await redisPub.get(routerKey);
        if (raw) {
          const info = JSON.parse(raw);
          delete info.containerPort;
          await redisPub.set(routerKey, JSON.stringify(info));
        }

        // Remove containerPort from DB so the Dashboard UI knows it is spun down
        await prisma.deployment.update({
          where: { id: d.id },
          data: { containerPort: null }
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.error("[Scaler] Error:", err);
  }
}, 60 * 1000);


// ─── VM Health Stats Reporter ────────────────────────────────────────────────

const statsInterval = setInterval(async () => {
  try {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    // CPU usage averaged across all cores
    const cpuUsage = cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      const idle = cpu.times.idle;
      return acc + ((total - idle) / total) * 100;
    }, 0) / cpus.length;

    // Docker container stats
    let dockerContainers: any[] = [];
    try {
      const Docker = (await import("dockerode")).default;
      const docker = new Docker({ socketPath: "/var/run/docker.sock" });
      const containers = await docker.listContainers({ all: true });
      dockerContainers = containers.map((c) => ({
        id: c.Id.slice(0, 12),
        name: c.Names?.[0]?.replace(/^\//, "") ?? "unknown",
        image: c.Image,
        state: c.State,
        status: c.Status,
        created: c.Created,
        ports: c.Ports?.map((p) => `${p.PublicPort || "?"}:${p.PrivatePort}`).filter(Boolean),
      }));
    } catch {}

    // BullMQ queue stats
    let queueStats = { waiting: 0, active: 0, completed: 0, failed: 0 };
    try {
      queueStats = {
        waiting: await buildQueue.getWaitingCount(),
        active: await buildQueue.getActiveCount(),
        completed: await buildQueue.getCompletedCount(),
        failed: await buildQueue.getFailedCount(),
      };
    } catch {}

    // Disk space stats
    let diskStats = { totalMB: 0, usedMB: 0, freeMB: 0, usagePercent: 0 };
    try {
      const disk = await fs.statfs("/");
      const totalMB = Math.round((disk.blocks * disk.bsize) / 1024 / 1024);
      const freeMB = Math.round((disk.bfree * disk.bsize) / 1024 / 1024);
      const usedMB = totalMB - freeMB;
      diskStats = {
        totalMB,
        usedMB,
        freeMB,
        usagePercent: totalMB > 0 ? Math.round((usedMB / totalMB) * 1000) / 10 : 0,
      };
    } catch {}

    // Disk files (Builds and Logs)
    let diskFiles: { path: string; type: string; sizeMB: number }[] = [];
    try {
      const { exec } = await import("child_process");
      const util = await import("util");
      const execAsync = util.promisify(exec);
      
      const { stdout } = await execAsync("du -sm /opt/whizan-builds/* /var/log/whizan/* 2>/dev/null || true");
      diskFiles = stdout.trim().split("\n").filter(Boolean).map((line) => {
        const [size, filePath] = line.split(/\s+/);
        return {
          path: filePath,
          type: filePath.startsWith("/opt/whizan-builds") ? "build" : "log",
          sizeMB: parseInt(size) || 0
        };
      }).sort((a, b) => b.sizeMB - a.sizeMB);
    } catch {}

    const stats = {
      timestamp: Date.now(),
      hostname: os.hostname(),
      platform: os.platform(),
      uptime: os.uptime(),
      cpu: {
        cores: cpus.length,
        model: cpus[0]?.model ?? "unknown",
        usagePercent: Math.round(cpuUsage * 10) / 10,
      },
      memory: {
        totalMB: Math.round(totalMem / 1024 / 1024),
        usedMB: Math.round(usedMem / 1024 / 1024),
        freeMB: Math.round(freeMem / 1024 / 1024),
        usagePercent: Math.round((usedMem / totalMem) * 1000) / 10,
      },
      disk: diskStats,
      docker: {
        containers: dockerContainers,
        totalContainers: dockerContainers.length,
        runningContainers: dockerContainers.filter((c) => c.state === "running").length,
      },
      queue: queueStats,
      files: diskFiles,
    };

    await redisPub.set("vm:stats", JSON.stringify(stats), "EX", 60);
  } catch (err) {
    console.error("[Stats] Error publishing stats:", err);
  }
}, 15_000);

// ─── Startup ─────────────────────────────────────────────────────────────────

console.log("[Worker] Build worker started — waiting for jobs...");

// ─── Graceful shutdown ───────────────────────────────────────────────────────

async function shutdown(): Promise<void> {
  console.log("[Worker] Shutting down gracefully...");
  clearInterval(scalerInterval);
  await worker.close();
  await redisPub.quit();
  await redisSub.quit();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
