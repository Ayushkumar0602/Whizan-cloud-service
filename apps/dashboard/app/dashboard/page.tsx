"use client";
import { useEffect, useState } from "react";
import { projects, type ProjectWithLatestDeploy } from "@/lib/api";
import Link from "next/link";
import { Plus, Globe, GitBranch, Clock, Zap, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    READY: "badge-ready",
    BUILDING: "badge-building",
    QUEUED: "badge-queued",
    FAILED: "badge-failed",
    CANCELLED: "badge-failed",
  };
  const labels: Record<string, string> = {
    READY: "Ready", BUILDING: "Building…", QUEUED: "Queued",
    FAILED: "Failed", CANCELLED: "Cancelled",
  };
  return (
    <span className={`badge ${map[status] || "badge-queued"}`}>
      <span className="dot" />
      {labels[status] || status}
    </span>
  );
}

export default function DashboardPage() {
  const [list, setList] = useState<ProjectWithLatestDeploy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    projects.list()
      .then(setList)
      .catch(() => toast.error("Failed to load projects"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">Deploy, manage, and monitor your applications</p>
        </div>
        <Link href="/dashboard/projects/new" className="btn btn-primary" id="new-project-btn">
          <Plus size={16} />
          New Project
        </Link>
      </div>

      {/* Project grid */}
      {loading ? (
        <div className="project-grid">
          {[1, 2, 3].map(i => (
            <div key={i} className="project-card-skeleton">
              <div className="skeleton" style={{ height: 20, width: "60%", marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 14, width: "40%" }} />
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🚀</div>
          <h2>No projects yet</h2>
          <p>Connect a GitHub repo and deploy your first project in seconds.</p>
          <Link href="/dashboard/projects/new" className="btn btn-primary" style={{ marginTop: "1rem" }}>
            <Plus size={16} />
            Create your first project
          </Link>
        </div>
      ) : (
        <div className="project-grid">
          {list.map(p => {
            const latest = p.deployments[0];
            return (
              <Link
                key={p.id}
                href={`/dashboard/projects/${p.id}`}
                className="project-card"
                id={`project-${p.id}`}
              >
                <div className="project-card-top">
                  <div className="project-icon">
                    {p.name[0].toUpperCase()}
                  </div>
                  <div className="project-info">
                    <div className="project-name">{p.name}</div>
                    <div className="project-slug mono">/{p.slug}</div>
                  </div>
                  {latest && <StatusDot status={latest.status} />}
                </div>

                <div className="project-meta">
                  <span className="meta-item">
                    <GitBranch size={12} />
                    {p.branch}
                  </span>
                  <span className="meta-item">
                    <Zap size={12} />
                    {p.framework.toLowerCase()}
                  </span>
                  <span className="meta-item">
                    <Clock size={12} />
                    {formatDistanceToNow(new Date(p.updatedAt), { addSuffix: true })}
                  </span>
                </div>

                {latest?.url && latest.status === "READY" && (
                  <div className="project-url">
                    <Globe size={12} />
                    <span className="mono">{latest.url}</span>
                    <ExternalLink size={11} />
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}

      <style>{`
        .page {
          padding: 2rem 2.5rem;
          max-width: 1100px;
        }
        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 2rem;
        }
        .page-title {
          font-size: 1.5rem;
          font-weight: 700;
          letter-spacing: -0.02em;
        }
        .page-subtitle {
          color: var(--muted);
          font-size: 0.875rem;
          margin-top: 0.25rem;
        }
        .project-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1rem;
        }
        .project-card {
          display: block;
          text-decoration: none;
          color: inherit;
          background: var(--card);
          border: 1px solid var(--card-border);
          border-radius: 12px;
          padding: 1.25rem;
          transition: all 0.15s;
          animation: fade-in 0.3s ease-out;
        }
        .project-card:hover {
          border-color: #2e2e42;
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        }
        .project-card-skeleton {
          background: var(--card);
          border: 1px solid var(--card-border);
          border-radius: 12px;
          padding: 1.25rem;
        }
        .project-card-top {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }
        .project-icon {
          width: 38px; height: 38px;
          background: var(--accent-glow);
          border: 1px solid rgba(99,102,241,0.3);
          color: var(--accent);
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-weight: 700;
          font-size: 1rem;
          flex-shrink: 0;
        }
        .project-info { flex: 1; min-width: 0; }
        .project-name { font-weight: 600; font-size: 0.9375rem; }
        .project-slug { font-size: 0.75rem; color: var(--muted); margin-top: 2px; }
        .project-meta {
          display: flex;
          gap: 0.875rem;
          flex-wrap: wrap;
        }
        .meta-item {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.75rem;
          color: var(--muted);
        }
        .project-url {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          margin-top: 0.875rem;
          padding: 0.4rem 0.625rem;
          background: rgba(34,197,94,0.05);
          border: 1px solid rgba(34,197,94,0.15);
          border-radius: 6px;
          font-size: 0.75rem;
          color: var(--success);
        }
        .dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: currentColor;
          display: inline-block;
        }
        .empty-state {
          text-align: center;
          padding: 5rem 2rem;
          color: var(--muted);
        }
        .empty-icon { font-size: 3rem; margin-bottom: 1rem; }
        .empty-state h2 { color: var(--foreground); font-size: 1.25rem; margin-bottom: 0.5rem; }
        .empty-state p { font-size: 0.9rem; }
      `}</style>
    </div>
  );
}
