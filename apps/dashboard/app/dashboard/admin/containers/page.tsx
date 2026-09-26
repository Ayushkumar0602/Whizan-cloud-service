"use client";

import { useState, useEffect } from "react";
import { admin } from "@/lib/api";
import { Container, Terminal } from "lucide-react";
import { useAdminStats } from "../../../../hooks/useAdminStats";

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    running: { bg: "rgba(16,185,129,0.1)", text: "#10b981" },
    exited: { bg: "rgba(239,68,68,0.1)", text: "#ef4444" },
    created: { bg: "rgba(245,158,11,0.1)", text: "#f59e0b" },
  };
  const c = colors[status] || { bg: "rgba(107,114,128,0.1)", text: "#6b7280" };
  return (
    <span style={{ background: c.bg, color: c.text, padding: "0.125rem 0.5rem", borderRadius: "100px", fontSize: "0.75rem", fontWeight: 600 }}>
      {status}
    </span>
  );
}

export default function ContainersPage() {
  const { stats, loading, fetchStats } = useAdminStats();
  const [containerLogsModal, setContainerLogsModal] = useState<{id: string, name: string} | null>(null);
  const [containerLogs, setContainerLogs] = useState<string>("Loading...");

  const fetchContainerLogs = async (id: string) => {
    setContainerLogs("Fetching from VM...");
    try {
      const res = await admin.getContainerLogs(id);
      setContainerLogs(res.logs || "No logs");
    } catch {
      setContainerLogs("Failed to fetch logs");
    }
  };

  useEffect(() => {
    if (containerLogsModal) fetchContainerLogs(containerLogsModal.id);
  }, [containerLogsModal]);

  const handleKillContainer = async (id: string) => {
    if (!confirm(`Force kill and remove container ${id}?`)) return;
    try {
      await admin.killContainer(id);
      alert("Kill command sent");
      fetchStats();
    } catch { alert("Failed to kill container"); }
  };

  if (loading && !stats) {
    return <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>Loading Azure metrics...</div>;
  }

  const vm = stats?.vmStats;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Docker Containers</h1>
          <p style={{ color: "var(--muted)", margin: "0.25rem 0 0 0" }}>
            Live container status directly from Azure VM
          </p>
        </div>
      </div>

      <div>
        <h2 className="section-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Container size={18} /> Containers
          {vm && <span style={{ fontSize: "0.8125rem", fontWeight: 400, color: "var(--muted)" }}>
            ({vm.docker.runningContainers} running / {vm.docker.totalContainers} total)
          </span>}
        </h2>
        <div className="card" style={{ overflow: "hidden" }}>
          {!vm || vm.docker.containers.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>
              {!vm ? "Worker offline — cannot fetch Docker stats" : "No Docker containers on the VM"}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--card-border)" }}>
                    {["ID", "Name", "Image", "State", "Status", "Ports", "Actions"].map(h => (
                      <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", color: "var(--muted)", fontWeight: 500, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vm.docker.containers.map(c => {
                    const d = stats?.allDeployments?.find((deploy: any) => deploy.id === c.deploymentId);
                    return (
                      <tr key={c.id} style={{ borderBottom: "1px solid var(--card-border)" }}>
                        <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", fontSize: "0.75rem" }}>{c.id}</td>
                        <td style={{ padding: "0.75rem 1rem", fontWeight: 500 }}>
                          {c.name}
                          {d && <span style={{ marginLeft: "0.5rem", fontSize: "0.6875rem", color: "var(--accent)", border: "1px solid var(--accent)", padding: "0.1rem 0.4rem", borderRadius: "4px" }}>{d.project.name}</span>}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", color: "var(--muted)" }}>{c.image.slice(0, 30)}</td>
                        <td style={{ padding: "0.75rem 1rem" }}><StatusBadge status={c.state} /></td>
                        <td style={{ padding: "0.75rem 1rem", color: "var(--muted)" }}>{c.status}</td>
                        <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", fontSize: "0.75rem" }}>{c.ports?.join(", ") || "—"}</td>
                        <td style={{ padding: "0.75rem 1rem", display: "flex", gap: "0.5rem" }}>
                          <button className="btn btn-secondary" style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }} onClick={() => setContainerLogsModal({ id: c.id, name: c.name })}>
                            Logs
                          </button>
                          <button className="btn btn-danger" style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }} onClick={() => handleKillContainer(c.id)}>
                            Kill
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Container Logs Modal */}
      {containerLogsModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
          <div className="card" style={{ width: "100%", maxWidth: "900px", display: "flex", flexDirection: "column", maxHeight: "90vh" }}>
            <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--card-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Terminal size={18} /> Logs: {containerLogsModal.name}
              </h3>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button className="btn btn-secondary" style={{ padding: "0.25rem 0.75rem", fontSize: "0.8125rem" }} onClick={() => fetchContainerLogs(containerLogsModal.id)}>Refresh</button>
                <button className="btn btn-secondary" style={{ padding: "0.25rem 0.75rem", fontSize: "0.8125rem" }} onClick={() => setContainerLogsModal(null)}>Close</button>
              </div>
            </div>
            <div style={{ padding: "1rem", flex: 1, overflow: "hidden", display: "flex" }}>
              <pre style={{ margin: 0, flex: 1, background: "#0a0a0a", color: "#e5e5e5", padding: "1rem", borderRadius: "4px", overflowY: "auto", fontSize: "0.8125rem", fontFamily: "monospace", border: "1px solid rgba(255,255,255,0.1)", whiteSpace: "pre-wrap" }}>
                {containerLogs}
              </pre>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
