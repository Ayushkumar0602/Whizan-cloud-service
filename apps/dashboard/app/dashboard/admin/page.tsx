"use client";

import { admin } from "@/lib/api";
import {
  Activity, Database, Server, Trash2, PowerOff, RefreshCw,
  Cpu, HardDrive, Wifi, WifiOff, Layers
} from "lucide-react";
import { useAdminStats } from "../../../hooks/useAdminStats";

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function ProgressBar({ percent, color }: { percent: number; color: string }) {
  return (
    <div style={{ width: "100%", height: "8px", background: "rgba(255,255,255,0.05)", borderRadius: "4px", overflow: "hidden" }}>
      <div style={{
        width: `${Math.min(percent, 100)}%`, height: "100%",
        background: color,
        borderRadius: "4px",
        transition: "width 0.5s ease"
      }} />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    READY: { bg: "rgba(16,185,129,0.1)", text: "#10b981" },
    BUILDING: { bg: "rgba(59,130,246,0.1)", text: "#3b82f6" },
    QUEUED: { bg: "rgba(245,158,11,0.1)", text: "#f59e0b" },
    FAILED: { bg: "rgba(239,68,68,0.1)", text: "#ef4444" },
    PAUSED: { bg: "rgba(107,114,128,0.1)", text: "#6b7280" },
    CANCELLED: { bg: "rgba(107,114,128,0.1)", text: "#6b7280" },
  };
  const c = colors[status] || { bg: "rgba(107,114,128,0.1)", text: "#6b7280" };
  return (
    <span style={{ background: c.bg, color: c.text, padding: "0.125rem 0.5rem", borderRadius: "100px", fontSize: "0.75rem", fontWeight: 600 }}>
      {status}
    </span>
  );
}

export default function AdminOverviewPage() {
  const { stats, loading, fetchStats } = useAdminStats();

  const handleStop = async (id: string) => {
    try {
      await admin.stopContainer(id);
      alert("Stop command sent to Azure worker");
      fetchStats();
    } catch { alert("Failed to stop container"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this deployment and wipe its container/files?")) return;
    try {
      await admin.deleteDeployment(id);
      alert("Delete command sent");
      fetchStats();
    } catch { alert("Failed to delete"); }
  };

  const handleRestartService = async (service: "worker" | "router") => {
    if (!confirm(`Are you sure you want to restart the ${service}?`)) return;
    try {
      await admin.restartService(service);
      alert(`${service} restart command sent to PM2`);
    } catch { alert(`Failed to restart ${service}`); }
  };

  if (loading && !stats) {
    return <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>Loading Azure metrics...</div>;
  }

  const vm = stats?.vmStats;
  const isWorkerOnline = vm && (Date.now() - vm.timestamp) < 60_000;

  return (
    <>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Overview</h1>
          <p style={{ color: "var(--muted)", margin: "0.25rem 0 0 0" }}>
            Whizan Cloud Services · Platform health and deployments
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button onClick={fetchStats} className="btn btn-secondary">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Worker Status Banner */}
      <div className="card" style={{ padding: "1rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", borderLeft: `3px solid ${isWorkerOnline ? "#10b981" : "#ef4444"}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {isWorkerOnline ? <Wifi size={18} color="#10b981" /> : <WifiOff size={18} color="#ef4444" />}
          <div>
            <span style={{ fontWeight: 600 }}>{isWorkerOnline ? "Worker Online" : "Worker Offline"}</span>
            <span style={{ color: "var(--muted)", fontSize: "0.8125rem", marginLeft: "0.75rem" }}>
              {vm ? `${vm.hostname} • ${vm.platform} • uptime ${formatUptime(vm.uptime)}` : "No stats received from Azure VM"}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn btn-secondary" style={{ fontSize: "0.75rem", padding: "0.25rem 0.75rem" }} onClick={() => handleRestartService("worker")}>Restart Worker</button>
          <button className="btn btn-secondary" style={{ fontSize: "0.75rem", padding: "0.25rem 0.75rem" }} onClick={() => handleRestartService("router")}>Restart Router</button>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem" }}>
        <div className="card" style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem", color: "var(--muted)" }}>
            <span style={{ fontSize: "0.8125rem", fontWeight: 500 }}>Users</span>
            <Activity size={14} />
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{stats?.users ?? 0}</div>
        </div>
        <div className="card" style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem", color: "var(--muted)" }}>
            <span style={{ fontSize: "0.8125rem", fontWeight: 500 }}>Projects</span>
            <Database size={14} />
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{stats?.projects ?? 0}</div>
        </div>
        <div className="card" style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem", color: "var(--muted)" }}>
            <span style={{ fontSize: "0.8125rem", fontWeight: 500 }}>Deployments</span>
            <Server size={14} />
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{stats?.deployments ?? 0}</div>
        </div>
        <div className="card" style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem", color: "var(--muted)" }}>
            <span style={{ fontSize: "0.8125rem", fontWeight: 500 }}>Build Queue</span>
            <Layers size={14} />
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>
            {vm ? `${vm.queue.waiting}w / ${vm.queue.active}a` : "—"}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.25rem" }}>
            {vm ? `${vm.queue.completed} done • ${vm.queue.failed} failed` : ""}
          </div>
        </div>
      </div>

      {/* VM Resources */}
      {vm && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
          {/* CPU */}
          <div className="card" style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Cpu size={16} color="var(--accent)" />
                <span style={{ fontWeight: 600 }}>CPU</span>
              </div>
              <span style={{ fontSize: "1.25rem", fontWeight: 700 }}>{vm.cpu.usagePercent}%</span>
            </div>
            <ProgressBar percent={vm.cpu.usagePercent} color={vm.cpu.usagePercent > 80 ? "#ef4444" : vm.cpu.usagePercent > 50 ? "#f59e0b" : "#10b981"} />
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.5rem" }}>
              {vm.cpu.cores} cores • {vm.cpu.model.slice(0, 40)}
            </div>
          </div>

          {/* Memory */}
          <div className="card" style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <HardDrive size={16} color="var(--accent)" />
                <span style={{ fontWeight: 600 }}>Memory</span>
              </div>
              <span style={{ fontSize: "1.25rem", fontWeight: 700 }}>{vm.memory.usagePercent}%</span>
            </div>
            <ProgressBar percent={vm.memory.usagePercent} color={vm.memory.usagePercent > 80 ? "#ef4444" : vm.memory.usagePercent > 50 ? "#f59e0b" : "#10b981"} />
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.5rem" }}>
              {vm.memory.usedMB} MB / {vm.memory.totalMB} MB • {vm.memory.freeMB} MB free
            </div>
          </div>
        </div>
      )}

      {/* All Deployments */}
      <div>
        <h2 className="section-title">All Deployments</h2>
        <div className="card" style={{ overflow: "hidden" }}>
          {stats?.allDeployments?.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>No deployments.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {stats?.allDeployments?.map((deploy: any, i: number) => (
                <div key={deploy.id} style={{
                  padding: "1.25rem 1.5rem",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  borderTop: i === 0 ? "none" : "1px solid var(--card-border)"
                }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontWeight: 600 }}>{deploy.project?.name || "Unknown Project"}</span>
                      <StatusBadge status={deploy.status} />
                      {deploy.deploymentType && (
                        <span style={{ border: "1px solid var(--card-border)", color: "var(--muted)", padding: "0.125rem 0.5rem", borderRadius: "100px", fontSize: "0.6875rem" }}>
                          {deploy.deploymentType}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "0.8125rem", color: "var(--muted)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <code style={{ background: "rgba(255,255,255,0.05)", padding: "0.125rem 0.375rem", borderRadius: "4px", fontSize: "0.75rem" }}>{deploy.id.slice(0, 8)}</code>
                      <span>•</span>
                      <span>{deploy.branch}</span>
                      {deploy.url && <>
                        <span>•</span>
                        <a href={deploy.url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", textDecoration: "none" }}>{deploy.url}</a>
                      </>}
                      {deploy.errorMessage && <>
                        <span>•</span>
                        <span style={{ color: "#ef4444" }}>{deploy.errorMessage.slice(0, 60)}</span>
                      </>}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                    {deploy.status === "READY" && (
                      <button className="btn btn-secondary" onClick={() => handleStop(deploy.id)}>
                        <PowerOff size={14} /> Pause
                      </button>
                    )}
                    <button className="btn btn-danger" onClick={() => handleDelete(deploy.id)}>
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
