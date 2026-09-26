"use client";

import { useState, useEffect } from "react";
import { admin } from "@/lib/api";
import { Terminal } from "lucide-react";

export default function LogsPage() {
  const [logType, setLogType] = useState<{service: "worker"|"router", type: "out"|"err"} | null>(null);
  const [logs, setLogs] = useState<string>("Loading logs...");
  const [isLive, setIsLive] = useState(true);

  useEffect(() => {
    if (!logType || !isLive) return;
    setLogs("Loading logs...");
    admin.getLogs(logType.service, logType.type).then(data => setLogs(data.logs)).catch(() => setLogs("Failed to load logs"));
    const interval = setInterval(() => {
      admin.getLogs(logType.service, logType.type).then(data => setLogs(data.logs));
    }, 2000);
    return () => clearInterval(interval);
  }, [logType, isLive]);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>VM Logs</h1>
          <p style={{ color: "var(--muted)", margin: "0.25rem 0 0 0" }}>
            Live PM2 logs from the Azure worker and edge router
          </p>
        </div>
      </div>

      <div>
        <h2 className="section-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Terminal size={18} /> Stream
            {logType && (
              <button 
                onClick={() => setIsLive(!isLive)} 
                style={{ marginLeft: "1rem", fontSize: "0.75rem", padding: "0.2rem 0.5rem", borderRadius: "4px", background: isLive ? "#10b98122" : "var(--card)", color: isLive ? "#10b981" : "var(--muted)", border: `1px solid ${isLive ? "#10b981" : "var(--card-border)"}`, cursor: "pointer" }}
              >
                {isLive ? "Live: ON" : "Live: OFF"}
              </button>
            )}
          </div>
          <select className="input" style={{ padding: "0.25rem 0.5rem", fontSize: "0.8125rem", width: "auto" }} value={logType ? `${logType.service}:${logType.type}` : ""} onChange={(e) => {
            if (!e.target.value) setLogType(null);
            else {
              const [s, t] = e.target.value.split(":");
              setLogType({ service: s as "worker"|"router", type: t as "out"|"err" });
            }
          }}>
            <option value="">Select log stream...</option>
            <option value="worker:out">Worker (Stdout)</option>
            <option value="worker:err">Worker (Errors)</option>
            <option value="router:out">Edge Router (Stdout)</option>
            <option value="router:err">Edge Router (Errors)</option>
          </select>
        </h2>
        {logType ? (
          <pre style={{ background: "#0a0a0a", color: "#10b981", padding: "1.25rem", borderRadius: "8px", height: "600px", overflowY: "auto", fontSize: "0.8125rem", fontFamily: "monospace", border: "1px solid rgba(255,255,255,0.1)", whiteSpace: "pre-wrap" }}>
            {logs || "No logs available"}
          </pre>
        ) : (
          <div className="card" style={{ padding: "3rem", textAlign: "center", color: "var(--muted)" }}>
            Select a log stream from the dropdown above to view live PM2 logs from the Azure VM.
          </div>
        )}
      </div>
    </>
  );
}
