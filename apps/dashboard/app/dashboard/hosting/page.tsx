"use client";
import { useEffect, useState } from "react";
import { projects, type ProjectWithLatestDeploy } from "@/lib/api";
import Link from "next/link";
import { Plus, Globe, GitBranch, Clock, Zap, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { DeployPipeline } from "@/components/deploy-pipeline";

export default function HostingPage() {
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
      <PageHeader
        title="Frontend Hosting"
        subtitle="Sites you deploy from GitHub. Open a project to follow queue → clone → install → build → live."
        actions={
          <Link href="/dashboard/projects/new" className="btn btn-primary" id="new-project-btn">
            <Plus size={16} /> New project
          </Link>
        }
      />

      <div style={{ marginBottom: "1.5rem" }}>
        <DeployPipeline legend />
      </div>

      {loading ? (
        <div className="project-grid">
          {[1, 2, 3].map(i => (
            <div key={i} className="card">
              <div className="skeleton" style={{ height: 20, width: "60%", marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 14, width: "40%" }} />
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="empty-state">
          <h2>Nothing hosted yet</h2>
          <p>Four short steps: pick this service, connect a repo, confirm the build, watch it go live.</p>
          <Link href="/dashboard/projects/new" className="btn btn-primary" style={{ marginTop: "1rem" }}>
            <Plus size={16} /> Create your first project
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
                  <div className="project-icon">{p.name[0].toUpperCase()}</div>
                  <div className="project-info">
                    <div className="project-name">{p.name}</div>
                    <div className="project-slug mono">/{p.slug}</div>
                  </div>
                  {latest && <StatusBadge status={latest.status} />}
                </div>
                <div className="project-meta">
                  <span className="meta-item"><GitBranch size={12} />{p.branch}</span>
                  <span className="meta-item"><Zap size={12} />{p.framework.toLowerCase()}</span>
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
        .project-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; }
        .project-card {
          display: block; text-decoration: none; color: inherit;
          background: var(--card); border: 1px solid var(--card-border);
          border-radius: 14px; padding: 1.25rem; transition: all 0.15s;
        }
        .project-card:hover { border-color: rgba(61,139,255,0.35); transform: translateY(-2px); box-shadow: var(--shadow); }
        .project-card-top { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
        .project-icon {
          width: 38px; height: 38px; background: var(--accent-glow);
          border: 1px solid rgba(61,139,255,0.3); color: var(--accent);
          border-radius: 10px; display: flex; align-items: center; justify-content: center;
          font-weight: 700; flex-shrink: 0;
        }
        .project-info { flex: 1; min-width: 0; }
        .project-name { font-weight: 650; }
        .project-slug { font-size: 0.75rem; color: var(--muted); margin-top: 2px; }
        .project-meta { display: flex; gap: 0.875rem; flex-wrap: wrap; }
        .meta-item { display: flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; color: var(--muted); }
        .project-url {
          display: flex; align-items: center; gap: 0.375rem; margin-top: 0.875rem;
          padding: 0.4rem 0.625rem; background: rgba(34,197,94,0.05);
          border: 1px solid rgba(34,197,94,0.15); border-radius: 8px;
          font-size: 0.75rem; color: var(--success);
        }
      `}</style>
    </div>
  );
}
