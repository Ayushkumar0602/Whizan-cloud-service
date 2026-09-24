"use client";
import { useEffect, useState } from "react";
import { projects, deployments as deploymentsApi, type ProjectWithDeployments, type Deployment } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Globe, GitBranch, Play, RotateCcw,
  Clock, Zap, ExternalLink, CheckCircle2, XCircle,
  Loader2, AlertCircle, Settings2, Trash2, PauseCircle
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
    READY:     { cls: "badge-ready",    icon: <CheckCircle2 size={12} />, label: "Ready" },
    BUILDING:  { cls: "badge-building", icon: <Loader2 size={12} className="spin-icon" />, label: "Building…" },
    QUEUED:    { cls: "badge-queued",   icon: <Clock size={12} />,        label: "Queued" },
    FAILED:    { cls: "badge-failed",   icon: <XCircle size={12} />,      label: "Failed" },
    CANCELLED: { cls: "badge-failed",   icon: <AlertCircle size={12} />,  label: "Cancelled" },
    PAUSED:    { cls: "badge-paused",   icon: <PauseCircle size={12} />,  label: "Paused" },
  };
  const c = config[status] || config.QUEUED;
  return <span className={`badge ${c.cls}`}>{c.icon}{c.label}</span>;
}

function buildDuration(d: Deployment) {
  if (!d.buildStartedAt) return null;
  const end = d.buildFinishedAt ? new Date(d.buildFinishedAt) : new Date();
  const secs = Math.round((end.getTime() - new Date(d.buildStartedAt).getTime()) / 1000);
  return secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<ProjectWithDeployments | null>(null);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    try {
      const p = await projects.get(id);
      setProject(p);
    } catch {
      toast.error("Project not found");
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  // Poll for status updates when a build is active
  useEffect(() => {
    const active = project?.deployments.some(
      d => d.status === "QUEUED" || d.status === "BUILDING"
    );
    if (!active) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [project]);

  async function triggerDeploy() {
    setDeploying(true);
    try {
      await deploymentsApi.trigger(id);
      toast.success("Deployment triggered!");
      await load();
    } catch (err: any) {
      toast.error(err.message || "Deploy failed");
    } finally {
      setDeploying(false);
    }
  }

  async function handleDeleteProject() {
    if (!confirm(`Delete "${project?.name}"? This will permanently remove ALL deployments, containers, build files, and data. This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await projects.delete(id);
      toast.success("Project deleted");
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Delete failed");
      setDeleting(false);
    }
  }

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;
  if (!project) return null;

  const latestDeploy = project.deployments[0];
  const isActive = latestDeploy?.status === "QUEUED" || latestDeploy?.status === "BUILDING";

  return (
    <div className="page">
      {/* Breadcrumb */}
      <Link href="/dashboard" className="breadcrumb">
        <ArrowLeft size={14} /> Projects
      </Link>

      {/* Project header */}
      <div className="proj-header">
        <div className="proj-icon">{project.name[0].toUpperCase()}</div>
        <div className="proj-title-group">
          <h1 className="page-title">{project.name}</h1>
          <div className="proj-meta-row">
            <span className="meta-item"><GitBranch size={13} />{project.branch}</span>
            <span className="meta-item"><Zap size={13} />{project.framework.toLowerCase()}</span>
            {latestDeploy && <StatusBadge status={latestDeploy.status} />}
          </div>
        </div>
        <div className="proj-actions">
          {latestDeploy?.status === "READY" && (
            <a
              href={`http://${project.slug}.localhost:8080`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              id="visit-site-btn"
            >
              <Globe size={15} /> Visit site <ExternalLink size={13} />
            </a>
          )}
          <Link href={`/dashboard/projects/${id}/settings`} className="btn btn-secondary">
            <Settings2 size={15} /> Settings
          </Link>
          <button
            id="deploy-btn"
            className="btn btn-primary"
            onClick={triggerDeploy}
            disabled={deploying || isActive}
          >
            {deploying || isActive
              ? <><Loader2 size={15} className="spin-icon" /> Deploying…</>
              : <><Play size={15} /> Deploy</>}
          </button>
          <button
            id="delete-project-btn"
            className="btn btn-danger"
            onClick={handleDeleteProject}
            disabled={deleting}
          >
            {deleting ? <><Loader2 size={15} className="spin-icon" /> Deleting…</> : <><Trash2 size={15} /> Delete</>}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">Repository</div>
          <a href={project.githubRepoUrl} target="_blank" rel="noopener" className="stat-value stat-link">
            {project.githubRepoUrl.replace("https://github.com/", "")}
            <ExternalLink size={12} />
          </a>
        </div>
        <div className="stat-card">
          <div className="stat-label">Deploy URL</div>
          <div className="stat-value mono">{project.slug}.localhost:8080</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Deployments</div>
          <div className="stat-value">{project.deployments.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Last Updated</div>
          <div className="stat-value">
            {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
          </div>
        </div>
      </div>

      {/* Deployments list */}
      <div className="section-header">
        <h2 className="section-title-large">Deployments</h2>
      </div>

      {project.deployments.length === 0 ? (
        <div className="empty-state-sm">
          <p>No deployments yet. Hit <strong>Deploy</strong> to get started.</p>
        </div>
      ) : (
        <div className="deploy-list">
          {project.deployments.map((d, idx) => (
            <Link
              key={d.id}
              href={`/dashboard/projects/${id}/deployments/${d.id}`}
              className="deploy-row"
              id={`deployment-${d.id}`}
            >
              <div className="deploy-row-left">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <StatusBadge status={d.status} />
                  {d.status === "READY" && d.deploymentType !== "STATIC" && d.containerPort === null && (
                    <span className="badge" style={{ backgroundColor: '#1e293b', color: '#94a3b8', border: '1px solid #334155' }}>Asleep</span>
                  )}
                </div>
                <div>
                  <div className="deploy-commit mono">
                    {d.commitHash === "manual" ? "Manual deploy" : d.commitHash.slice(0, 7)}
                    {idx === 0 && <span className="current-tag">Current</span>}
                  </div>
                  {d.commitMessage && (
                    <div className="deploy-message">{d.commitMessage.split("\n")[0].slice(0, 80)}</div>
                  )}
                </div>
              </div>
              <div className="deploy-row-right">
                {d.deploymentType && (
                  <span className="deploy-type">{d.deploymentType}</span>
                )}
                {d.status === "READY" && d.deploymentType !== "STATIC" && (d as any).lastAccessed && (
                  <span className="meta-item" style={{ color: d.containerPort ? '#10b981' : '#94a3b8' }}>
                    {d.containerPort ? "Active" : "Idle"}: {formatDistanceToNow((d as any).lastAccessed, { addSuffix: true })}
                  </span>
                )}
                {buildDuration(d) && (
                  <span className="meta-item"><Clock size={12} />{buildDuration(d)}</span>
                )}
                <span className="meta-item">
                  {format(new Date(d.createdAt), "MMM d, HH:mm")}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <style>{`
        .page { padding: 2rem 2.5rem; max-width: 1000px; }
        .page-loading {
          display: flex; align-items: center; justify-content: center;
          min-height: 60vh;
        }
        .spinner {
          width: 32px; height: 32px;
          border: 2px solid var(--card-border);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin-icon { animation: spin 1s linear infinite; }

        .breadcrumb {
          display: inline-flex; align-items: center; gap: 0.375rem;
          font-size: 0.8125rem; color: var(--muted);
          text-decoration: none; margin-bottom: 1.5rem;
          transition: color 0.15s;
        }
        .breadcrumb:hover { color: var(--foreground); }

        .proj-header {
          display: flex; align-items: flex-start; gap: 1rem;
          margin-bottom: 1.5rem; flex-wrap: wrap;
        }
        .proj-icon {
          width: 48px; height: 48px;
          background: var(--accent-glow);
          border: 1px solid rgba(99,102,241,0.3);
          color: var(--accent);
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.25rem; font-weight: 700; flex-shrink: 0;
        }
        .proj-title-group { flex: 1; }
        .page-title { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em; }
        .proj-meta-row {
          display: flex; align-items: center; gap: 0.75rem;
          margin-top: 0.375rem; flex-wrap: wrap;
        }
        .meta-item {
          display: flex; align-items: center; gap: 0.25rem;
          font-size: 0.75rem; color: var(--muted);
        }
        .proj-actions { display: flex; gap: 0.625rem; flex-wrap: wrap; margin-left: auto; }

        .stats-row {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 0.75rem;
          margin-bottom: 2rem;
        }
        .stat-card {
          background: var(--card);
          border: 1px solid var(--card-border);
          border-radius: 10px;
          padding: 1rem;
        }
        .stat-label { font-size: 0.75rem; color: var(--muted); margin-bottom: 0.375rem; }
        .stat-value { font-size: 0.9rem; font-weight: 500; word-break: break-all; }
        .stat-link {
          display: flex; align-items: center; gap: 0.375rem;
          color: var(--accent); text-decoration: none; font-size: 0.875rem;
        }

        .section-header { margin-bottom: 0.875rem; }
        .section-title-large { font-size: 1rem; font-weight: 600; }

        .deploy-list {
          display: flex; flex-direction: column;
          border: 1px solid var(--card-border);
          border-radius: 12px;
          overflow: hidden;
        }
        .deploy-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 1rem 1.25rem;
          background: var(--card);
          border-bottom: 1px solid var(--card-border);
          text-decoration: none; color: inherit;
          transition: background 0.15s; gap: 1rem;
        }
        .deploy-row:last-child { border-bottom: none; }
        .deploy-row:hover { background: rgba(255,255,255,0.02); }
        .deploy-row-left { display: flex; align-items: center; gap: 0.875rem; }
        .deploy-row-right { display: flex; align-items: center; gap: 1rem; flex-shrink: 0; }
        .deploy-commit { font-size: 0.875rem; font-weight: 500; display: flex; align-items: center; gap: 0.5rem; }
        .deploy-message { font-size: 0.75rem; color: var(--muted); margin-top: 2px; }
        .current-tag {
          font-size: 0.6875rem; font-weight: 500;
          background: var(--accent-glow); color: var(--accent);
          padding: 0.1rem 0.4rem; border-radius: 4px;
          font-family: inherit;
        }
        .deploy-type {
          font-size: 0.6875rem; padding: 0.15rem 0.5rem;
          border-radius: 4px; background: rgba(255,255,255,0.05);
          color: var(--muted); border: 1px solid var(--card-border);
        }
        .empty-state-sm {
          text-align: center; padding: 3rem;
          background: var(--card); border: 1px solid var(--card-border);
          border-radius: 12px; color: var(--muted); font-size: 0.9rem;
        }
      `}</style>
    </div>
  );
}
