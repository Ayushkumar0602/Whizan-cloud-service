"use client";
import { useEffect, useState } from "react";
import { projects, deployments as deploymentsApi, type ProjectWithDeployments, type Deployment } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Globe, GitBranch, Play,
  Clock, Zap, ExternalLink, Settings2, Trash2, Loader2
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import { StatusBadge } from "@/components/status-badge";
import { DeployPipeline } from "@/components/deploy-pipeline";

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
      router.push("/dashboard/hosting");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

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
      const d = await deploymentsApi.trigger(id);
      toast.success("Deploy started — watch the pipeline");
      await load();
      router.push(`/dashboard/projects/${id}/deployments/${d.id}`);
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
      router.push("/dashboard/hosting");
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
      <Link href="/dashboard/hosting" className="breadcrumb">
        <ArrowLeft size={14} /> Frontend Hosting
      </Link>

      <div className="proj-header">
        <div className="proj-icon">{project.name[0].toUpperCase()}</div>
        <div className="proj-title-group">
          <div className="service-kicker">Frontend Hosting</div>
          <h1 className="page-title">{project.name}</h1>
          <div className="proj-meta-row">
            <span className="meta-item"><GitBranch size={13} />{project.branch}</span>
            <span className="meta-item"><Zap size={13} />{project.framework.toLowerCase()}</span>
            {latestDeploy && <StatusBadge status={latestDeploy.status} />}
            {latestDeploy?.status === "READY" && latestDeploy?.deploymentType !== "STATIC" && (
              <span className="meta-item" style={{ marginLeft: "0.5rem", fontWeight: 500, color: latestDeploy.containerPort ? "var(--success)" : "var(--muted)" }}>
                <span className={`status-dot ${latestDeploy.containerPort ? "status-active" : "status-idle"}`} />
                {latestDeploy.containerPort ? "Active (Running)" : "Asleep (Scaled to zero)"}
              </span>
            )}
          </div>
        </div>
        <div className="proj-actions">
          {latestDeploy?.status === "READY" && (
            <a
              href={latestDeploy.url || `http://${project.slug}.localhost:8080`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              id="visit-site-btn"
            >
              <Globe size={15} /> Visit site <ExternalLink size={13} />
            </a>
          )}
          <Link href={`/dashboard/projects/${id}/analytics`} className="btn btn-secondary">
            <Globe size={15} /> Analytics
          </Link>
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
              ? <><Loader2 size={15} className="spin-icon" /> In progress</>
              : <><Play size={15} /> Deploy now</>}
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

      {latestDeploy ? (
        <div style={{ marginBottom: "1.25rem" }}>
          <DeployPipeline status={latestDeploy.status} />
          {isActive && (
            <p className="follow-hint">
              Build is running. Open the latest deployment for live logs.
              {" "}
              <Link href={`/dashboard/projects/${id}/deployments/${latestDeploy.id}`}>
                Watch logs →
              </Link>
            </p>
          )}
        </div>
      ) : (
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <strong>Ready when you are</strong>
          <p style={{ color: "var(--muted)", marginTop: 6, fontSize: "0.875rem" }}>
            Press <em style={{ fontStyle: "normal", color: "var(--foreground)" }}>Deploy now</em> to
            queue the first build. You’ll see queued → clone → install → build → publish → live.
          </p>
        </div>
      )}

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">Repository</div>
          <a href={project.githubRepoUrl} target="_blank" rel="noopener" className="stat-link">
            {project.githubRepoUrl.replace("https://github.com/", "")}
            <ExternalLink size={12} />
          </a>
        </div>
        <div className="stat-card">
          <div className="stat-label">Deploy URL</div>
          <div className="stat-value mono">{latestDeploy?.url?.replace('http://', '') || `${project.slug}.whizan.app`}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Deployments</div>
          <div className="stat-value">{project.deployments.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Last updated</div>
          <div className="stat-value">
            {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
          </div>
        </div>
      </div>

      <h2 className="section-title-large">Deployment history</h2>
      {project.deployments.length === 0 ? (
        <div className="empty-state" style={{ padding: "2.5rem" }}>
          <p>No deployments yet. Hit Deploy now to get started.</p>
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
                <StatusBadge status={d.status} />
                <div>
                  <div className="deploy-commit mono">
                    {d.commitHash === "manual" ? "Manual deploy" : d.commitHash.slice(0, 7)}
                    {idx === 0 && <span className="current-tag">Latest</span>}
                  </div>
                  {d.commitMessage && (
                    <div className="deploy-message">{d.commitMessage.split("\n")[0].slice(0, 80)}</div>
                  )}
                </div>
              </div>
              <div className="deploy-row-right">
                {d.deploymentType && <span className="deploy-type">{d.deploymentType}</span>}
                {buildDuration(d) && (
                  <span className="meta-item"><Clock size={12} />{buildDuration(d)}</span>
                )}
                <span className="meta-item">{format(new Date(d.createdAt), "MMM d, HH:mm")}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <style>{`
        .proj-header { display: flex; align-items: flex-start; gap: 1rem; margin-bottom: 1.35rem; flex-wrap: wrap; }
        .proj-icon {
          width: 48px; height: 48px; background: var(--accent-glow);
          border: 1px solid rgba(61,139,255,0.3); color: var(--accent);
          border-radius: 12px; display: flex; align-items: center; justify-content: center;
          font-size: 1.25rem; font-weight: 700; flex-shrink: 0;
        }
        .proj-title-group { flex: 1; }
        .proj-meta-row { display: flex; align-items: center; gap: 0.75rem; margin-top: 0.375rem; flex-wrap: wrap; }
        .meta-item { display: flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; color: var(--muted); }
        .proj-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-left: auto; }
        .follow-hint { color: var(--muted); font-size: 0.85rem; margin-top: 0.75rem; }
        .follow-hint a { color: var(--accent); }
        .stats-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.75rem; margin-bottom: 1.75rem; }
        .stat-card { background: var(--card); border: 1px solid var(--card-border); border-radius: 12px; padding: 1rem; }
        .stat-label { font-size: 0.75rem; color: var(--muted); margin-bottom: 0.375rem; }
        .stat-value { font-size: 0.9rem; font-weight: 500; word-break: break-all; }
        .stat-link { display: flex; align-items: center; gap: 0.375rem; color: var(--accent); text-decoration: none; font-size: 0.875rem; }
        .section-title-large { font-size: 0.8rem; font-weight: 650; text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted); margin-bottom: 0.75rem; }
        .deploy-list { display: flex; flex-direction: column; border: 1px solid var(--card-border); border-radius: 12px; overflow: hidden; }
        .deploy-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 1rem 1.25rem; background: var(--card); border-bottom: 1px solid var(--card-border);
          text-decoration: none; color: inherit; gap: 1rem;
        }
        .deploy-row:last-child { border-bottom: none; }
        .deploy-row:hover { background: var(--card-hover); }
        .deploy-row-left { display: flex; align-items: center; gap: 0.875rem; }
        .deploy-row-right { display: flex; align-items: center; gap: 1rem; flex-shrink: 0; }
        .deploy-commit { font-size: 0.875rem; font-weight: 500; display: flex; align-items: center; gap: 0.5rem; }
        .deploy-message { font-size: 0.75rem; color: var(--muted); margin-top: 2px; }
        .current-tag {
          font-size: 0.6875rem; font-weight: 600; background: var(--accent-glow); color: var(--accent);
          padding: 0.1rem 0.4rem; border-radius: 4px; font-family: inherit;
        }
        .deploy-type {
          font-size: 0.6875rem; padding: 0.15rem 0.5rem; border-radius: 4px;
          background: rgba(255,255,255,0.05); color: var(--muted); border: 1px solid var(--card-border);
        }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 4px; }
        .status-active { background: var(--success); box-shadow: 0 0 8px var(--success); animation: pulse 2s infinite; }
        .status-idle { background: var(--muted); }
        @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); } 70% { box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); } 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); } }

        @media (max-width: 768px) {
          .proj-header { flex-direction: column; align-items: stretch; }
          .proj-actions { margin-left: 0; width: 100%; justify-content: stretch; }
          .proj-actions .btn { flex: 1; justify-content: center; }
          .deploy-row { flex-direction: column; align-items: flex-start; gap: 0.75rem; }
          .deploy-row-right { width: 100%; justify-content: space-between; }
        }
      `}</style>
    </div>
  );
}
