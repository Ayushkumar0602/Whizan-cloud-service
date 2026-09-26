"use client";

import { admin } from "@/lib/api";
import { HardDrive } from "lucide-react";
import { useAdminStats } from "../../../../hooks/useAdminStats";

export default function StoragePage() {
  const { stats, loading, fetchStats } = useAdminStats();

  const handleFileDelete = async (path: string) => {
    if (!confirm(`Are you sure you want to delete ${path}? This cannot be undone.`)) return;
    try {
      await admin.deleteFile(path);
      alert("Delete command sent to worker");
      fetchStats();
    } catch { alert("Failed to delete file"); }
  };

  if (loading && !stats) {
    return <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>Loading Azure metrics...</div>;
  }

  const vm = stats?.vmStats;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Storage Management</h1>
          <p style={{ color: "var(--muted)", margin: "0.25rem 0 0 0" }}>
            Build cache and log files on the VM
          </p>
        </div>
      </div>

      {vm && vm.files && (
        <div>
          <h2 className="section-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <HardDrive size={18} /> Disk Files
            <span style={{ fontSize: "0.8125rem", fontWeight: 400, color: "var(--muted)" }}>
              ({vm.files.length} items found)
            </span>
          </h2>
          <div className="card" style={{ overflow: "hidden" }}>
            {vm.files.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>No build or log files found.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--card-border)", background: "var(--card-bg)" }}>
                      <th style={{ padding: "0.75rem 1rem", textAlign: "left", color: "var(--muted)", fontWeight: 500, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Path</th>
                      <th style={{ padding: "0.75rem 1rem", textAlign: "left", color: "var(--muted)", fontWeight: 500, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Type</th>
                      <th style={{ padding: "0.75rem 1rem", textAlign: "left", color: "var(--muted)", fontWeight: 500, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Size (MB)</th>
                      <th style={{ padding: "0.75rem 1rem", textAlign: "left", color: "var(--muted)", fontWeight: 500, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vm.files.map((file, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--card-border)" }}>
                        <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", fontSize: "0.75rem" }}>{file.path}</td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <span style={{ background: file.type === "build" ? "rgba(59,130,246,0.1)" : "rgba(245,158,11,0.1)", color: file.type === "build" ? "#3b82f6" : "#f59e0b", padding: "0.125rem 0.5rem", borderRadius: "100px", fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase" }}>
                            {file.type}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem", fontWeight: 500 }}>{file.sizeMB} MB</td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <button className="btn btn-danger" style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }} onClick={() => handleFileDelete(file.path)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
