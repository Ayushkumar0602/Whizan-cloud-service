"use client";

import { useEffect, useState } from "react";
import { admin, type ProjectWithLatestDeploy } from "@/lib/api";
import { Activity, Database, Server, Trash2, PowerOff, RefreshCw } from "lucide-react";

export default function AdminPage() {
  const [stats, setStats] = useState<{
    users: number;
    projects: number;
    deployments: number;
    activeDeployments: ProjectWithLatestDeploy[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await admin.stats();
      setStats(data as any);
    } catch (err) {
      alert("Failed to load admin stats");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleStop = async (id: string) => {
    try {
      await admin.stopContainer(id);
      alert("Stop command sent to Azure worker");
      fetchStats();
    } catch (err) {
      alert("Failed to stop container");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure? This will delete the deployment and wipe its container/files.")) return;
    try {
      await admin.deleteDeployment(id);
      alert("Delete command sent to Azure worker");
      fetchStats();
    } catch (err) {
      alert("Failed to delete deployment");
    }
  };

  if (loading && !stats) {
    return <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>Loading Azure metrics...</div>;
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Admin Console</h1>
          <p style={{ color: "var(--muted)", margin: "0.25rem 0 0 0" }}>
            Real-time control over Azure Worker containers and deployments.
          </p>
        </div>
        <button onClick={fetchStats} className="btn btn-secondary">
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1.5rem" }}>
        <div className="card" style={{ padding: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem", color: "var(--muted)" }}>
            <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>Total Users</span>
            <Activity size={16} />
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700 }}>{stats?.users ?? 0}</div>
        </div>
        <div className="card" style={{ padding: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem", color: "var(--muted)" }}>
            <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>Total Projects</span>
            <Database size={16} />
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700 }}>{stats?.projects ?? 0}</div>
        </div>
        <div className="card" style={{ padding: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem", color: "var(--muted)" }}>
            <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>Total Deployments</span>
            <Server size={16} />
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700 }}>{stats?.deployments ?? 0}</div>
        </div>
      </div>

      <div>
        <h2 className="section-title">All Azure Deployments</h2>
        <div className="card" style={{ overflow: "hidden" }}>
          {stats?.activeDeployments?.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>
              No deployments exist on Azure.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {stats?.activeDeployments?.map((deploy: any, i) => (
                <div key={deploy.id} style={{ 
                  padding: "1.5rem", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "space-between",
                  borderTop: i === 0 ? "none" : "1px solid var(--card-border)"
                }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontWeight: 600, fontSize: "1.125rem" }}>{deploy.project?.name}</span>
                      <span style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10b981", padding: "0.125rem 0.5rem", borderRadius: "100px", fontSize: "0.75rem", fontWeight: 600 }}>
                        {deploy.status}
                      </span>
                      <span style={{ border: "1px solid var(--card-border)", color: "var(--muted)", padding: "0.125rem 0.5rem", borderRadius: "100px", fontSize: "0.75rem", fontWeight: 500 }}>
                        {deploy.deploymentType}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.875rem", color: "var(--muted)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span>ID: <code style={{ background: "rgba(255,255,255,0.05)", padding: "0.125rem 0.25rem", borderRadius: "4px" }}>{deploy.id.slice(0, 8)}</code></span>
                      <span>•</span>
                      <span>URL: <a href={deploy.url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", textDecoration: "none" }}>{deploy.url}</a></span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <button 
                      className="btn btn-secondary"
                      onClick={() => handleStop(deploy.id)}
                    >
                      <PowerOff size={14} />
                      Pause Container
                    </button>
                    <button 
                      className="btn btn-danger"
                      onClick={() => handleDelete(deploy.id)}
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
