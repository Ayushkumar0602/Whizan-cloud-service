"use client";
import { useEffect, useState } from "react";
import { projects, type ProjectWithLatestDeploy } from "@/lib/api";
import { CLOUD_SERVICES } from "@/lib/services";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { ArrowRight, Plus, Activity, HardDrive, Cpu, CreditCard, BookOpen, GitPullRequest } from "lucide-react";
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
        title={`Welcome, ${firstName}`}
        subtitle="Manage your frontend deployments, monitor traffic, and configure your cloud architecture all in one place."
        actions={
          <Link href="/dashboard/projects/new" className="btn btn-primary" id="new-project-btn">
            <Plus size={16} /> Deploy New App
          </Link>
        }
      />

      <h2 className="block-title">Usage & Performance (Last 30 Days)</h2>
      <div className="stats-row" style={{ marginBottom: "2rem" }}>
        <div className="stat-card">
          <div className="stat-label"><Activity size={14} /> Total Bandwidth</div>
          <div className="stat-value">124.5 GB</div>
          <div className="stat-sub">+14% from last month</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><GitPullRequest size={14} /> Deployments</div>
          <div className="stat-value">{list.reduce((acc, p) => acc + p.deployments.length, 0)}</div>
          <div className="stat-sub">Across {list.length} projects</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><Cpu size={14} /> Active Edge Nodes</div>
          <div className="stat-value">3 Regions</div>
          <div className="stat-sub">Routing 100% traffic</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "2rem", marginBottom: "2rem" }}>
        <div>
          <div className="page-header" style={{ marginBottom: "1rem" }}>
            <h2 className="block-title" style={{ margin: 0 }}>Recent Deployments</h2>
            <Link href="/dashboard/hosting" style={{ fontSize: "0.8125rem", color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}>
              View all
            </Link>
          </div>

          {loading ? (
            <div className="skeleton" style={{ height: 120 }} />
          ) : list.length === 0 ? (
            <div className="empty-state" style={{ padding: "3rem 1.5rem" }}>
              <div style={{ marginBottom: "0.5rem" }}><HardDrive size={24} style={{ color: "var(--muted)"}} /></div>
              <h2>No sites deployed</h2>
              <p>Deploy your first Next.js or React app in seconds.</p>
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
                      <div className="mono" style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: "2px" }}>{p.slug}.20.2.136.11.nip.io</div>
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
        </div>

        <div>
          <h2 className="block-title" style={{ marginBottom: "1rem" }}>Quick Actions</h2>
          <div className="quick-actions">
            <Link href="/dashboard/projects/new" className="quick-action-card">
              <GitPullRequest size={16} style={{ color: "var(--accent)" }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>Deploy from GitHub</div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "2px" }}>Connect your repo</div>
              </div>
            </Link>
            <div className="quick-action-card">
              <BookOpen size={16} style={{ color: "var(--accent-2)" }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>Documentation</div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "2px" }}>Read the guides</div>
              </div>
            </div>
            <div className="quick-action-card">
              <CreditCard size={16} style={{ color: "var(--warning)" }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>Billing & Usage</div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "2px" }}>Manage subscription</div>
              </div>
            </div>
          </div>
        </div>
      </div>

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



      <style>{`
        .block-title { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); margin-bottom: 0.75rem; font-weight: 600; }
        .open-link { display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.8rem; color: var(--accent); font-weight: 600; }
        
        .stats-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; }
        .stat-card { background: var(--card); border: 1px solid var(--card-border); border-radius: var(--radius); padding: 1.25rem; box-shadow: var(--shadow); }
        .stat-label { font-size: 0.75rem; color: var(--muted); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.35rem; font-weight: 500; }
        .stat-value { font-size: 1.75rem; font-weight: 700; color: var(--foreground); letter-spacing: -0.02em; }
        .stat-sub { font-size: 0.7rem; color: var(--success); margin-top: 0.35rem; }

        .recent-list {
          border: 1px solid var(--card-border); border-radius: var(--radius); overflow: hidden; background: var(--card); box-shadow: var(--shadow);
        }
        .recent-row {
          display: grid; grid-template-columns: 1fr auto auto; gap: 1rem; align-items: center;
          padding: 1rem 1.25rem; border-bottom: 1px solid var(--card-border);
          text-decoration: none; color: inherit; transition: background 0.1s;
        }
        .recent-row:last-child { border-bottom: none; }
        .recent-row:hover { background: var(--card-hover); }
        .recent-name { font-weight: 600; font-size: 0.9rem; }
        .recent-when { font-size: 0.75rem; color: var(--muted); width: 80px; text-align: right; }

        .quick-actions { display: flex; flex-direction: column; gap: 0.75rem; }
        .quick-action-card {
          display: flex; align-items: center; gap: 1rem; padding: 1rem;
          background: var(--card); border: 1px solid var(--card-border); border-radius: var(--radius);
          text-decoration: none; color: inherit; box-shadow: var(--shadow); transition: border-color 0.15s;
          cursor: pointer;
        }
        .quick-action-card:hover { border-color: var(--muted); }
        
        @media (max-width: 900px) {
          .page > div[style*="grid-template-columns"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
