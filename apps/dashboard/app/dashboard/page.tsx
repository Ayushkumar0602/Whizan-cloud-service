"use client";
import { useEffect, useState } from "react";
import { projects, type ProjectWithLatestDeploy } from "@/lib/api";
import { CLOUD_SERVICES } from "@/lib/services";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { ArrowRight, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export default function ConsolePage() {
  const { user } = useAuth();
  const [list, setList] = useState<ProjectWithLatestDeploy[]>([]);
  const [loading, setLoading] = useState(true);
  const firstName = (user?.name || user?.email || "there").split(" ")[0];

  useEffect(() => {
    projects.list()
      .then(setList)
      .catch(() => toast.error("Could not load projects"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <PageHeader
        title={`Good to see you, ${firstName}`}
        subtitle="This is the Whizan Cloud Services console. Frontend Hosting is live — every other service below will appear here when it ships."
        actions={
          <Link href="/dashboard/projects/new" className="btn btn-primary" id="new-project-btn">
            <Plus size={16} /> New frontend
          </Link>
        }
      />

      <h2 className="block-title">Services</h2>
      <div className="service-grid" style={{ marginBottom: "2rem" }}>
        {CLOUD_SERVICES.map(svc => {
          const inner = (
            <>
              <div className="service-kicker">{svc.available ? "Available now" : `Coming ${svc.eta?.toLowerCase()}`}</div>
              <div className="service-title">{svc.name}</div>
              <p className="service-desc">{svc.description}</p>
              {svc.available ? (
                <span className="open-link">Open <ArrowRight size={14} /></span>
              ) : (
                <span className="badge badge-queued">Not yet available</span>
              )}
            </>
          );
          return svc.available ? (
            <Link key={svc.id} href="/dashboard/hosting" className="service-card">
              {inner}
            </Link>
          ) : (
            <div key={svc.id} className="service-card service-card-soon">{inner}</div>
          );
        })}
      </div>

      <div className="page-header" style={{ marginBottom: "0.9rem" }}>
        <h2 className="block-title" style={{ margin: 0 }}>Recent frontends</h2>
        <Link href="/dashboard/hosting" style={{ fontSize: "0.85rem", color: "var(--accent)", textDecoration: "none" }}>
          View all
        </Link>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 88 }} />
      ) : list.length === 0 ? (
        <div className="empty-state">
          <h2>No sites yet</h2>
          <p>Create a Frontend Hosting project — we’ll walk you through repo, build, and go-live.</p>
          <Link href="/dashboard/projects/new" className="btn btn-primary" style={{ marginTop: "1rem" }}>
            <Plus size={16} /> Start first deploy
          </Link>
        </div>
      ) : (
        <div className="recent-list">
          {list.slice(0, 5).map(p => {
            const latest = p.deployments[0];
            return (
              <Link key={p.id} href={`/dashboard/projects/${p.id}`} className="recent-row">
                <div>
                  <div className="recent-name">{p.name}</div>
                  <div className="mono" style={{ color: "var(--muted)", fontSize: "0.75rem" }}>/{p.slug}</div>
                </div>
                {latest ? <StatusBadge status={latest.status} /> : <span className="badge badge-queued">No deploys</span>}
                <span className="recent-when">
                  {formatDistanceToNow(new Date(p.updatedAt), { addSuffix: true })}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <style>{`
        .block-title { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin-bottom: 0.75rem; }
        .open-link { display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.8rem; color: var(--accent); font-weight: 600; }
        .recent-list {
          border: 1px solid var(--card-border); border-radius: 14px; overflow: hidden; background: var(--card);
        }
        .recent-row {
          display: grid; grid-template-columns: 1fr auto auto; gap: 1rem; align-items: center;
          padding: 0.95rem 1.15rem; border-bottom: 1px solid var(--card-border);
          text-decoration: none; color: inherit;
        }
        .recent-row:last-child { border-bottom: none; }
        .recent-row:hover { background: var(--card-hover); }
        .recent-name { font-weight: 600; }
        .recent-when { font-size: 0.75rem; color: var(--muted); }
      `}</style>
    </div>
  );
}
