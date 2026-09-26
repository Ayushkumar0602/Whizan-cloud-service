"use client";

import { useEffect, useState } from "react";
import { admin } from "@/lib/api";
import { Database, Server } from "lucide-react";

export default function DatabasePage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    admin.getDatabaseStats().then(data => {
      setStats(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>Loading Database metrics...</div>;
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Database Metrics</h1>
          <p style={{ color: "var(--muted)", margin: "0.25rem 0 0 0" }}>
            Supabase Postgres and Upstash Redis Health
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        
        {/* Postgres */}
        <div>
          <h2 className="section-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Database size={18} /> Supabase Postgres
          </h2>
          <div className="card" style={{ padding: "1.5rem" }}>
            {stats?.postgres ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.5rem" }}>
                <div>
                  <div style={{ color: "var(--muted)", fontSize: "0.8125rem", marginBottom: "0.25rem" }}>Database Size</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 600 }}>{stats.postgres.size}</div>
                </div>
                <div>
                  <div style={{ color: "var(--muted)", fontSize: "0.8125rem", marginBottom: "0.25rem" }}>Active Connections</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 600 }}>{stats.postgres.connections}</div>
                </div>
              </div>
            ) : (
              <div style={{ color: "var(--muted)" }}>Could not load Postgres stats</div>
            )}
          </div>
        </div>

        {/* Redis */}
        <div>
          <h2 className="section-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Server size={18} /> Upstash Redis
          </h2>
          <div className="card" style={{ padding: "1.5rem" }}>
            {stats?.redis ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.5rem" }}>
                <div>
                  <div style={{ color: "var(--muted)", fontSize: "0.8125rem", marginBottom: "0.25rem" }}>Version</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 600 }}>{stats.redis.version}</div>
                </div>
                <div>
                  <div style={{ color: "var(--muted)", fontSize: "0.8125rem", marginBottom: "0.25rem" }}>Uptime (Days)</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 600 }}>{stats.redis.uptime}</div>
                </div>
                <div>
                  <div style={{ color: "var(--muted)", fontSize: "0.8125rem", marginBottom: "0.25rem" }}>Connected Clients</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 600 }}>{stats.redis.connectedClients}</div>
                </div>
                <div>
                  <div style={{ color: "var(--muted)", fontSize: "0.8125rem", marginBottom: "0.25rem" }}>Memory Used</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 600 }}>{stats.redis.usedMemory} <span style={{fontSize: "1rem", color: "var(--muted)"}}>(Peak: {stats.redis.peakMemory})</span></div>
                </div>
              </div>
            ) : (
              <div style={{ color: "var(--muted)" }}>Could not load Redis stats</div>
            )}
          </div>
        </div>

      </div>
    </>
  );
}
