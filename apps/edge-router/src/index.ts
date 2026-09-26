import "dotenv/config";
import http from "http";
import httpProxy from "http-proxy";
import serveStatic from "serve-static";
import finalhandler from "finalhandler";
import Redis from "ioredis";
import path from "path";
import fs from "fs";

// ─── Config ──────────────────────────────────────────────────────────────────

const ROUTER_PORT = Number(process.env.ROUTER_PORT) || 8080;
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const BASE_DOMAIN = process.env.BASE_DOMAIN || "localhost"; // e.g. ourhoster.com

// ─── Redis ───────────────────────────────────────────────────────────────────

const redis = new Redis(REDIS_URL, {
  enableReadyCheck: false,
  lazyConnect: true,
});

interface DeploymentInfo {
  type: "static" | "ssr" | "hybrid";
  staticDir?: string;
  containerPort?: number;
  deploymentId: string;
}

async function lookupDeployment(slug: string): Promise<DeploymentInfo | null> {
  const raw = await redis.get(`deployment:${slug}`);
  if (!raw) return null;
  return JSON.parse(raw);
}

// ─── Proxy ───────────────────────────────────────────────────────────────────

const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  proxyTimeout: 30_000,
  timeout: 30_000,
  ws: true, // Enable WebSockets support
});

proxy.on("error", (err, req, res) => {
  console.error(`[Router] Proxy error for ${req.headers.host}${req.url}:`, err.message);
  
  // Extract slug to trigger a cold-start (wakeup)
  const host = req.headers.host || "";
  let slug = "";
  if (host.endsWith(`.${BASE_DOMAIN}`) || host.endsWith(`.${BASE_DOMAIN}:${ROUTER_PORT}`)) {
    slug = host.split(".")[0];
  } else {
    slug = host.replace(/:.*$/, "");
  }

  // Look up deployment ID from Redis and trigger a wakeup
  redis.get(`deployment:${slug}`).then(raw => {
    if (raw) {
      const dep = JSON.parse(raw);
      console.log(`[Router] Container missing for ${slug} (proxy error). Triggering wakeup...`);
      redis.publish("wakeup", dep.deploymentId).catch(() => {});
    }
  }).catch(() => {});

  if ("writeHead" in res && !res.headersSent) {
    const isHtml = req.headers.accept?.includes("text/html");
    if (isHtml) {
      res.writeHead(502, { "Content-Type": "text/html" });
      res.end(loadingScreenHtml("Starting Application...", "Your app is spinning up. This page will auto-refresh."));
    } else {
      res.writeHead(502);
      res.end("Bad Gateway - Application Starting");
    }
  } else if ("destroy" in res) {
    // It's a raw Socket
    res.destroy();
  }
});

// ─── Static file servers (cached per staticDir) ───────────────────────────────

const staticServers = new Map<string, ReturnType<typeof serveStatic>>();

function getStaticServer(staticDir: string) {
  if (!staticServers.has(staticDir)) {
    staticServers.set(staticDir, serveStatic(staticDir, { index: ["index.html"] }));
  }
  return staticServers.get(staticDir)!;
}

// ─── Main HTTP Server ─────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const host = req.headers.host || "";

  // Extract slug from subdomain: my-app.localhost → my-app
  // Also handles custom domains
  let slug: string;
  if (host.endsWith(`.${BASE_DOMAIN}`) || host.endsWith(`.${BASE_DOMAIN}:${ROUTER_PORT}`)) {
    slug = host.split(".")[0];
  } else {
    // Treat the whole host as a custom domain key
    slug = host.replace(/:.*$/, ""); // strip port
  }

  // ── Lookup deployment from Redis ──────────────────────────────────────────
  const deployment = await lookupDeployment(slug).catch(() => null);

  if (!deployment) {
    res.writeHead(404, { "Content-Type": "text/html" });
    res.end(`
      <html><body style="font-family:sans-serif;text-align:center;padding:4rem">
        <h1>404 — Not Found</h1>
        <p>No deployment found for <strong>${slug}</strong></p>
        <p><a href="http://localhost:3000">Back to Dashboard</a></p>
      </body></html>
    `);
    return;
  }

  // Track access time for scale-to-zero idle detection
  redis.set(`access:${deployment.deploymentId}`, Date.now()).catch(() => {});

  const { type, staticDir, containerPort } = deployment;
  const requestPath = req.url || "/";

  // ── STATIC: Serve files directly from disk ─────────────────────────────────
  if (type === "static" && staticDir) {
    const serve = getStaticServer(staticDir);
    const startBytes = res.socket?.bytesWritten || 0;
    serve(req as any, res as any, finalhandler(req, res) as any);
    res.on("finish", () => {
      const bytesSent = (res.socket?.bytesWritten || 0) - startBytes;
      const event = {
        projectId: (deployment as any).projectId,
        date: new Date().toISOString().split("T")[0],
        path: req.url || "/",
        bytesSent,
        ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress || "0.0.0.0",
      };
      redis.lpush("analytics:buffer", JSON.stringify(event)).catch(() => {});
    });
    return;
  }

  // ── HYBRID: Static assets go to disk, dynamic routes go to container ───────
  if (type === "hybrid") {
    const isStaticAsset =
      requestPath.startsWith("/_next/static/") ||
      requestPath.startsWith("/static/") ||
      /\.(css|js|png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf|map)$/.test(requestPath);

    if (isStaticAsset && staticDir) {
      // Map /_next/static/* to the actual static dir on disk
      const actualPath = path.join(staticDir, requestPath.replace("/_next/static", ""));
      if (fs.existsSync(actualPath)) {
        const serve = getStaticServer(staticDir);
        // Rewrite the URL so serve-static can find it
        req.url = requestPath.replace("/_next/static", "");
        serve(req as any, res as any, () => {
          // Fallback to container if file not found on disk
          if (containerPort) {
            proxy.web(req, res, { target: `http://127.0.0.1:${containerPort}` });
          } else {
            res.writeHead(404); res.end("Not found");
          }
        });
        return;
      }
    }

    // Dynamic request → forward to SSR container
    if (containerPort) {
      proxy.web(req, res, { target: `http://127.0.0.1:${containerPort}` });
      return;
    } else {
      // Scale-to-zero wakeup
      await handleWakeupAndProxy(deployment, req, res, slug);
      return;
    }
  }

  // ── SSR: All traffic → container ───────────────────────────────────────────
  if (type === "ssr") {
    if (containerPort) {
      proxy.web(req, res, { target: `http://127.0.0.1:${containerPort}` });
      // The proxy handles the response, so we track analytics in proxy.on('proxyRes')
      return;
    } else {
      // Scale-to-zero wakeup
      await handleWakeupAndProxy(deployment, req, res, slug);
      return;
    }
  }

  res.writeHead(503);
  res.end("Service Unavailable");
});

// ── Analytics Tracking ────────────────────────────────────────────────────────
proxy.on("proxyRes", (proxyRes, req, res) => {
  const host = req.headers.host || "";
  let slug = "";
  if (host.endsWith(`.${BASE_DOMAIN}`) || host.endsWith(`.${BASE_DOMAIN}:${ROUTER_PORT}`)) {
    slug = host.split(".")[0];
  } else {
    slug = host.replace(/:.*$/, "");
  }

  // Count bytes written
  let bytesSent = 0;
  proxyRes.on("data", (chunk) => { bytesSent += chunk.length; });

  proxyRes.on("end", () => {
    redis.get(`deployment:${slug}`).then(raw => {
      if (raw) {
        const dep = JSON.parse(raw);
        const event = {
          projectId: dep.projectId,
          date: new Date().toISOString().split("T")[0],
          path: req.url || "/",
          bytesSent,
          ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress || "0.0.0.0",
        };
        redis.lpush("analytics:buffer", JSON.stringify(event)).catch(() => {});
      }
    }).catch(() => {});
  });
});

async function handleWakeupAndProxy(deployment: DeploymentInfo, req: http.IncomingMessage, res: http.ServerResponse, slug: string) {
  console.log(`[Router] Cold start: waking up deployment ${deployment.deploymentId}...`);
  // Publish wakeup
  redis.publish("wakeup", deployment.deploymentId).catch(() => {});

  // Instantly return the loading screen so the user sees feedback immediately, instead of a hanging browser tab
  const isHtml = req.headers.accept?.includes("text/html");
  if (isHtml) {
    res.writeHead(202, { "Content-Type": "text/html" });
    res.end(loadingScreenHtml("Waking up...", "Your app was asleep to save resources. It is spinning up now..."));
  } else {
    res.writeHead(202);
    res.end("Application is waking up. Please retry in a few seconds.");
  }
}

function loadingScreenHtml(title: string, message: string) {
  return `
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; text-align: center; padding: 6rem 2rem; color: #f8fafc; background: #0f172a; margin: 0; }
          .spinner { width: 32px; height: 32px; border: 3px solid #334155; border-top-color: #38bdf8; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 2rem; }
          h1 { font-size: 1.5rem; font-weight: 500; margin-bottom: 0.5rem; }
          p { color: #94a3b8; max-width: 400px; margin: 0 auto; line-height: 1.5; }
          @keyframes spin { to { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <div class="spinner"></div>
        <h1>${title}</h1>
        <p>${message}</p>
        <script>
          // Poll every 1.5 seconds in the background
          setInterval(() => {
            fetch(window.location.href, { method: 'HEAD' })
              .then(res => {
                if (res.status !== 502 && res.status !== 202) {
                  window.location.reload();
                }
              }).catch(() => {});
          }, 1500);
        </script>
      </body>
    </html>
  `;
}

// ─── WebSocket Support (Upgrade Event) ────────────────────────────────────────

server.on("upgrade", async (req, socket, head) => {
  const host = req.headers.host || "";
  let slug: string;
  
  if (host.endsWith(`.${BASE_DOMAIN}`) || host.endsWith(`.${BASE_DOMAIN}:${ROUTER_PORT}`)) {
    slug = host.split(".")[0];
  } else {
    slug = host.replace(/:.*$/, "");
  }

  const deployment = await lookupDeployment(slug).catch(() => null);
  
  if (!deployment) {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
    return;
  }

  // Update access time for scale-to-zero tracking
  redis.set(`access:${deployment.deploymentId}`, Date.now().toString(), "EX", 30 * 24 * 60 * 60).catch(() => {});

  if (deployment.type === "static" || (deployment as any).deploymentType === "STATIC") {
    // Static sites don't support WebSockets
    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
    socket.destroy();
    return;
  }

  if (deployment.containerPort) {
    // Container is awake! Proxy the WebSocket connection directly
    proxy.ws(req, socket, head, { target: `http://127.0.0.1:${deployment.containerPort}` });
  } else {
    // Cold start for WebSockets. We can't render an auto-refresh HTML screen on a raw TCP socket.
    // We publish a wakeup event, then instantly reject the socket so the client app's reconnection logic kicks in.
    console.log(`[Router] Cold start (WS): waking up deployment ${deployment.deploymentId}...`);
    redis.publish("wakeup", deployment.deploymentId).catch(() => {});
    socket.write('HTTP/1.1 503 Service Unavailable\r\nRetry-After: 3\r\n\r\n');
    socket.destroy();
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

server.listen(ROUTER_PORT, () => {
  console.log(`[Router] Edge Router running on port ${ROUTER_PORT}`);
  console.log(`[Router] Base domain: *.${BASE_DOMAIN}`);
  console.log(`[Router] Redis: ${REDIS_URL}`);
});

process.on("SIGTERM", () => {
  server.close(() => {
    redis.quit();
    process.exit(0);
  });
});
