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

// ─── Config ──────────────────────────────────────────────────────────────────

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const BUILD_BASE_DIR = process.env.BUILD_BASE_DIR ?? "/tmp/hostify-builds";

// ─── Shared singletons ───────────────────────────────────────────────────────

// redisPub: used for publishing logs + cancel signals
const redisPub = new Redis(REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: false });

// redisSub: dedicated subscriber for per-deployment cancel channels
const redisSub = new Redis(REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: false });

// redisSub2: dedicated subscriber for global wakeup events (separate to avoid message routing conflicts)
const redisSub2 = new Redis(REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: false });

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
        const { simpleGit } = await import("simple-git");

        // Always wipe and re-create the build dir to avoid stale leftovers
        await fs.rm(buildDir, { recursive: true, force: true }).catch(() => {});
        await fs.mkdir(buildDir, { recursive: true });

        // ── Resilient clone: try specified branch, fall back to auto-detected default ──
        // Many repos use "master" while the user typed "main", or vice-versa.
        // Instead of immediately failing, we detect the repo's actual default branch.
        let resolvedBranch = branch;
        try {
          await log(`Cloning ${repoUrl} (branch: ${branch})...`);
          await simpleGit().clone(repoUrl, buildDir, ["--depth=1", `--branch=${branch}`]);
        } catch (cloneErr: unknown) {
          const msg = cloneErr instanceof Error ? cloneErr.message : String(cloneErr);
          const isBranchNotFound = msg.includes("Remote branch") || msg.includes("Could not find remote branch") || msg.includes("not found in upstream");

          if (!isBranchNotFound) throw cloneErr; // Real error (auth, network, etc.) — re-throw

          // Auto-detect the real default branch via ls-remote
          await log(`⚠ Branch "${branch}" not found. Auto-detecting default branch...`);
          try {
            const lsResult = await simpleGit().listRemote(["--symref", repoUrl, "HEAD"]);
            // Output looks like: "ref: refs/heads/master\tHEAD"
            const match = lsResult.match(/ref: refs\/heads\/(\S+)\s+HEAD/);
            resolvedBranch = match?.[1] ?? "master"; // Fallback to "master" if parsing fails
          } catch {
            resolvedBranch = "master"; // Last resort
          }

          await log(`ℹ Retrying clone with detected default branch: "${resolvedBranch}"`);
          // Wipe the partially-cloned dir before retrying
          await fs.rm(buildDir, { recursive: true, force: true }).catch(() => {});
          await fs.mkdir(buildDir, { recursive: true });
          await simpleGit().clone(repoUrl, buildDir, ["--depth=1", `--branch=${resolvedBranch}`]);
        }

        await log(`✓ Clone complete (branch: ${resolvedBranch})`);
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
      const url = `http://${slug}.localhost`;
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
    concurrency: 3,
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

// 1. Listen for wakeups from Edge Router (on a dedicated connection to avoid conflicts with cancel channels)
redisSub2.subscribe("wakeup").catch(() => {});
redisSub2.on("message", async (channel, message) => {
  if (channel !== "wakeup") return;

  const dId = message;

  // ── Guard 1: DB status check ─────────────────────────────────────────────
  // Only wake up deployments that are READY (live but asleep) or PAUSED.
  // If status is BUILDING, a wakeup job is already in-flight — do nothing.
  const d = await prisma.deployment.findUnique({
    where: { id: dId },
    include: { project: true },
  });

  if (!d || (d.status !== "READY" && d.status !== "PAUSED")) {
    console.log(`[Scaler] Wakeup ignored for ${dId} — status: ${d?.status ?? "not found"}`);
    return;
  }

  // ── Guard 2: BullMQ jobId deduplication ──────────────────────────────────
  // Using a deterministic jobId means BullMQ silently discards any duplicate
  // add() calls for a deployment that already has a wakeup job queued/active.
  // This is the primary defense against the Thundering Herd: 50 concurrent
  // publish("wakeup") calls → 50 add() calls → only 1 job ever created.
  const jobId = `wakeup:${dId}`;
  console.log(`[Scaler] Triggering cold-start for ${d.id} (jobId: ${jobId})`);

  await buildQueue.add(
    "build",
    {
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
    },
    {
      jobId, // ← The key: BullMQ will reject duplicates with the same jobId
      // Do not retry wakeup jobs — if the container fails to start, the
      // next user request will trigger a fresh wakeup attempt anyway.
      attempts: 1,
    }
  );
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


// ─── Startup Reconciliation (Zombie Container Healer) ────────────────────────
//
// Runs ONCE on boot. Scans all READY/BUILDING deployments in the DB and
// compares them against actually-running Docker containers.
//
// Scenarios handled:
//   A) Container is RUNNING  → all good, update DB/Redis with actual port
//   B) Container is STOPPED  → mark as asleep (containerPort = null), the next
//                              user request will trigger a clean wakeup
//   C) Deployment is BUILDING but worker just booted → it was orphaned by a
//      previous crash; mark as FAILED so the user can retry
//   D) No container found at all for a READY deployment → same as (B)

async function reconcileOnStartup(): Promise<void> {
  console.log("[Worker] Running startup reconciliation...");

  try {
    const Docker = (await import("dockerode")).default;
    const docker = new Docker({ socketPath: "/var/run/docker.sock" });

    // Fetch all containers once — avoid N docker calls in a loop
    const allContainers = await docker.listContainers({ all: true }).catch(() => [] as Awaited<ReturnType<typeof docker.listContainers>>);

    // All deployments that could have live containers
    const activeDeploys = await prisma.deployment.findMany({
      where: { status: { in: ["READY", "BUILDING", "PAUSED"] } },
      include: { project: true },
    });

    console.log(`[Worker] Reconciling ${activeDeploys.length} deployment(s)...`);

    for (const d of activeDeploys) {
      // ── Case C: Orphaned BUILDING job from a previous worker crash ──────────
      // If the worker crashed mid-build, the deployment is stuck as BUILDING
      // forever. Mark it FAILED so the user can push a new deployment.
      if (d.status === "BUILDING") {
        console.log(`[Worker] Orphaned build detected for ${d.id} — marking FAILED`);
        await prisma.deployment.update({
          where: { id: d.id },
          data: {
            status: "FAILED",
            errorMessage: "Build was interrupted by a server restart. Please redeploy.",
            buildFinishedAt: new Date(),
          },
        }).catch(() => {});
        continue;
      }

      // ── Cases A, B, D: Check if the container is actually running ──────────
      const match = allContainers.find((c) =>
        c.Mounts?.some((m) => m.Source?.includes(d.id))
      );

      const isRunning = match?.State === "running";

      if (isRunning && match) {
        // Case A: Container is alive — sync the actual port back to DB + Redis
        const portBinding = match.Ports?.find((p) => p.PrivatePort === 3000);
        const actualPort = portBinding?.PublicPort;

        if (actualPort && actualPort !== d.containerPort) {
          console.log(`[Worker] Syncing port for ${d.id}: DB had ${d.containerPort}, Docker has ${actualPort}`);
          await prisma.deployment.update({
            where: { id: d.id },
            data: { containerPort: actualPort },
          }).catch(() => {});

          // Update Edge Router Redis key with correct port
          const routerKey = `deployment:${d.project.slug}`;
          const raw = await redisPub.get(routerKey);
          if (raw) {
            const info = JSON.parse(raw);
            info.containerPort = actualPort;
            await redisPub.set(routerKey, JSON.stringify(info));
          }
        }
      } else {
        // Cases B & D: Container is dead or missing — mark as asleep
        if (d.containerPort !== null) {
          console.log(`[Worker] Zombie container for ${d.id} — marking asleep`);

          // Clear containerPort in DB — dashboard will show "Sleeping"
          await prisma.deployment.update({
            where: { id: d.id },
            data: { containerPort: null },
          }).catch(() => {});

          // Clear containerPort in Edge Router Redis key so next request
          // triggers the wakeup flow instead of proxying to a dead port
          const routerKey = `deployment:${d.project.slug}`;
          const raw = await redisPub.get(routerKey);
          if (raw) {
            const info = JSON.parse(raw);
            delete info.containerPort;
            await redisPub.set(routerKey, JSON.stringify(info));
          }

          // Remove the dead container if it still exists in Docker
          if (match) {
            await docker.getContainer(match.Id).remove({ force: true }).catch(() => {});
          }
        }
      }
    }

    console.log("[Worker] Reconciliation complete.");
  } catch (err) {
    // Non-fatal — log and continue. The worker should still start even if
    // Docker is temporarily unavailable during reconciliation.
    console.error("[Worker] Reconciliation error (non-fatal):", err);
  }
}

// ─── Startup ─────────────────────────────────────────────────────────────────

console.log("[Worker] Build worker started — waiting for jobs...");

// Run reconciliation asynchronously on boot — don't block the worker from
// accepting new jobs while it runs.
reconcileOnStartup();

// ─── Graceful shutdown ───────────────────────────────────────────────────────

async function shutdown(): Promise<void> {
  console.log("[Worker] Shutting down gracefully...");
  clearInterval(scalerInterval);
  await worker.close();
  await redisPub.quit();
  await redisSub.quit();
  await redisSub2.quit();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
