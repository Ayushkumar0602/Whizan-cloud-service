"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { deployments as deploymentsApi, type Deployment, getAccessToken } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Loader2, Clock, Terminal, StopCircle, Globe,
  PauseCircle, PlayCircle, Trash2
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { StatusBadge } from "@/components/status-badge";
import { DeployPipeline } from "@/components/deploy-pipeline";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function DeploymentPage() {
  const { id, dId } = useParams<{ id: string; dId: string }>();
  const router = useRouter();
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [projectSlug, setProjectSlug] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([]);
  const [streaming, setStreaming] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const logsRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadDeployment = useCallback(async () => {
    try {
      const d = await deploymentsApi.get(id, dId);
      setDeployment(d);
      const { projects } = await import("@/lib/api");
      const p = await projects.get(id);
      setProjectSlug(p.slug);
      return d;
    } catch {
      // ignore poll errors
    }
  }, [id, dId]);

  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [logs]);

  useEffect(() => {
    loadDeployment();
    const token = getAccessToken();
    if (!token) {
      toast.error("Not authenticated — please refresh");
      return;
    }

    const url = `${API_BASE}/api/projects/deployments/${dId}/logs?token=${token}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.log === "__DONE__") {
          setStreaming(false);
          es.close();
          loadDeployment();
          if (pollRef.current) clearInterval(pollRef.current);
          return;
        }
        setLogs(prev => [...prev, data.log]);
      } catch {
        // malformed event
      }
    };

    es.onerror = () => {
      setStreaming(false);
      es.close();
      loadDeployment();
    };

    pollRef.current = setInterval(loadDeployment, 3000);

    return () => {
      es.close();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [dId]);

  async function handleCancel() {
    setCancelling(true);
    try {
      await deploymentsApi.cancel(id, dId);
      toast.success("Deployment cancelled");
      setStreaming(false);
      esRef.current?.close();
      if (pollRef.current) clearInterval(pollRef.current);
      await loadDeployment();
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel");
    } finally {
      setCancelling(false);
    }
  }

  async function handlePause() {
    if (!confirm("Pause this deployment? The container will stop and resources will be released. You can resume anytime.")) return;
    setPausing(true);
    try {
      await deploymentsApi.pause(id, dId);
      toast.success("Deployment paused");
      await loadDeployment();
    } catch (err: any) {
      toast.error(err.message || "Failed to pause");
    } finally {
      setPausing(false);
    }
  }

  async function handleResume() {
    setResuming(true);
    try {
      await deploymentsApi.resume(id, dId);
      toast.success("Resuming deployment...");
      setStreaming(true);
      await loadDeployment();
      if (!pollRef.current) {
        pollRef.current = setInterval(loadDeployment, 3000);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to resume");
    } finally {
      setResuming(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this deployment? The container, build files, and all logs will be permanently removed.")) return;
    setRemoving(true);
    try {
      await deploymentsApi.delete(id, dId);
      toast.success("Deployment deleted");
      router.push(`/dashboard/projects/${id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
      setRemoving(false);
    }
  }

  const isActive = deployment?.status === "QUEUED" || deployment?.status === "BUILDING";
  const isReady = deployment?.status === "READY";
  const isPaused = deployment?.status === "PAUSED";
  const isDone = ["READY", "FAILED", "CANCELLED", "PAUSED"].includes(deployment?.status ?? "");

  return (
    <div className="page">
      <Link href={`/dashboard/projects/${id}`} className="breadcrumb">
        <ArrowLeft size={14} /> Back to project
      </Link>

      <div className="deploy-header">
        <div style={{ flex: 1 }}>
          <div className="service-kicker">Frontend Hosting · live pipeline</div>
          <h1 className="page-title">
            {deployment?.commitHash === "manual"
              ? "Manual deploy"
              : `Deploy ${deployment?.commitHash?.slice(0, 7) ?? "…"}`}
          </h1>
          {deployment?.commitMessage && (
            <p className="page-subtitle">{deployment.commitMessage.split("\n")[0]}</p>
          )}
          <div className="deploy-meta">
            {deployment?.status && <StatusBadge status={deployment.status} />}
            {deployment?.deploymentType && (
              <span className="meta-item"><Terminal size={12} />{deployment.deploymentType}</span>
            )}
            {deployment?.status === "READY" && deployment?.deploymentType !== "STATIC" && (deployment as any).lastAccessed && (
              <span className="meta-item" style={{ color: deployment.containerPort ? "#10b981" : "#94a3b8" }}>
                {deployment.containerPort ? "Active" : "Idle"}: {formatDistanceToNow((deployment as any).lastAccessed, { addSuffix: true })}
              </span>
            )}
            {deployment?.createdAt && (
              <span className="meta-item">
                <Clock size={12} />
                {format(new Date(deployment.createdAt), "MMM d, yyyy HH:mm:ss")}
              </span>
            )}
          </div>
        </div>

        <div className="header-actions">
          {isActive && (
            <button id="cancel-btn" className="btn btn-danger" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? <><Loader2 size={14} className="spin-icon" /> Cancelling…</> : <><StopCircle size={14} /> Cancel</>}
            </button>
          )}
          {isReady && (
            <button id="pause-btn" className="btn btn-secondary" onClick={handlePause} disabled={pausing}>
              {pausing ? <><Loader2 size={14} className="spin-icon" /> Pausing…</> : <><PauseCircle size={14} /> Pause</>}
            </button>
          )}
          {isPaused && (
            <button id="resume-btn" className="btn btn-primary" onClick={handleResume} disabled={resuming}>
              {resuming ? <><Loader2 size={14} className="spin-icon" /> Resuming…</> : <><PlayCircle size={14} /> Resume</>}
            </button>
          )}
          {isDone && (
            <button id="delete-deploy-btn" className="btn btn-danger" onClick={handleDelete} disabled={removing}>
              {removing ? <><Loader2 size={14} className="spin-icon" /> Deleting…</> : <><Trash2 size={14} /> Delete</>}
            </button>
          )}
          {isReady && deployment?.url && (
            <a
              href={deployment.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
              id="visit-deployment-btn"
            >
              <Globe size={14} /> Visit site
            </a>
          )}
        </div>
      </div>

      <div style={{ marginBottom: "1.15rem" }}>
        <DeployPipeline status={deployment?.status} logs={logs} />
      </div>

      {deployment?.errorMessage && (
        <div className="error-banner">
          <span>{deployment.errorMessage}</span>
        </div>
      )}

      <div className="logs-panel">
        <div className="logs-toolbar">
          <div className="logs-title">
            <Terminal size={14} />
            Build logs
            {streaming && isActive && <span className="live-badge">● Live</span>}
          </div>
          <span className="logs-count">{logs.length} lines · this is the raw worker output</span>
        </div>
        <div className="logs-body" ref={logsRef} id="build-logs">
          {logs.length === 0 ? (
            <div className="logs-waiting">
              {isActive || streaming
                ? <><Loader2 size={16} className="spin-icon" /> Waiting for the worker to start this step…</>
                : <span style={{ color: "var(--muted)" }}>No logs recorded for this deployment.</span>
              }
            </div>
          ) : (
            logs.map((line, i) => {
              const cls = line.startsWith("[stderr]") ? "log-stderr"
                : line.startsWith("✓") || line.startsWith("✔") ? "log-success"
                : line.startsWith("✗") || line.toLowerCase().includes("error") ? "log-error"
                : "";
              return (
                <div key={i} className={`log-line ${cls}`}>
                  <span className="log-num">{String(i + 1).padStart(4, " ")}</span>
                  <span className="log-text">{line}</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      <style>{`
        .deploy-header { display: flex; align-items: flex-start; gap: 1rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
        .deploy-meta { display: flex; align-items: center; gap: 0.75rem; margin-top: 0.5rem; flex-wrap: wrap; }
        .meta-item { display: flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; color: var(--muted); }
        .header-actions { display: flex; gap: 0.5rem; margin-left: auto; flex-wrap: wrap; }
        .error-banner {
          background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2);
          border-radius: 10px; padding: 0.875rem 1.25rem; color: var(--danger);
          font-size: 0.875rem; margin-bottom: 1.25rem;
        }
        .logs-panel { background: #070b10; border: 1px solid var(--card-border); border-radius: 12px; overflow: hidden; }
        .logs-toolbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0.625rem 1rem; background: var(--card); border-bottom: 1px solid var(--card-border);
        }
        .logs-title { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8125rem; font-weight: 500; color: var(--muted); }
        .live-badge { font-size: 0.6875rem; color: var(--success); animation: pulse 2s ease-in-out infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        .logs-count { font-size: 0.75rem; color: var(--muted); }
        .logs-body { height: 540px; overflow-y: auto; padding: 0.5rem 0; font-family: var(--font-geist-mono), Menlo, monospace; }
        .logs-waiting { display: flex; align-items: center; gap: 0.625rem; color: var(--muted); font-size: 0.8125rem; padding: 2rem 1.25rem; }
        .log-line { display: flex; font-size: 0.75rem; line-height: 1.65; }
        .log-line:hover { background: rgba(255,255,255,0.025); }
        .log-num { color: #2e3a4a; padding: 0 1rem; user-select: none; flex-shrink: 0; min-width: 4.5rem; text-align: right; white-space: pre; }
        .log-text { color: #b8c4d0; word-break: break-word; flex: 1; padding-right: 1rem; }
        .log-stderr .log-text { color: #f59e0b; }
        .log-success .log-text { color: #22c55e; }
        .log-error .log-text { color: #ef4444; }
      `}</style>
    </div>
  );
}
