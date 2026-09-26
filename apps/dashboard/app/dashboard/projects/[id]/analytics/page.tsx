"use client";

import { useEffect, useState } from "react";
import { projects } from "@/lib/api";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Globe, Users, Activity } from "lucide-react";

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export default function AnalyticsPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    projects.getAnalytics(id)
      .then(setData)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  const totalPageViews = data.reduce((acc, curr) => acc + curr.pageViews, 0);
  const totalBandwidth = data.reduce((acc, curr) => acc + curr.bandwidth, 0);
  const totalVisitors = data.reduce((acc, curr) => acc + curr.visitors, 0);

  return (
    <div className="page">
      <Link href={`/dashboard/projects/${id}`} className="breadcrumb">
        <ArrowLeft size={14} /> Back to Project
      </Link>

      <div style={{ marginBottom: "2rem" }}>
        <h1 className="page-title">Edge Analytics</h1>
        <p style={{ color: "var(--muted)" }}>View real-time traffic and bandwidth consumption across the edge network.</p>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}><Globe size={14} /> Page Views</div>
          <div className="stat-value" style={{ fontSize: "2rem" }}>{totalPageViews.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}><Users size={14} /> Unique Visitors</div>
          <div className="stat-value" style={{ fontSize: "2rem" }}>{totalVisitors.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}><Activity size={14} /> Bandwidth Used</div>
          <div className="stat-value" style={{ fontSize: "2rem" }}>{formatBytes(totalBandwidth)}</div>
        </div>
      </div>

      <div className="card" style={{ padding: "1.5rem" }}>
        <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.1rem" }}>Daily Traffic (Last 30 Days)</h3>
        {data.length === 0 ? (
          <div style={{ color: "var(--muted)", padding: "2rem 0", textAlign: "center" }}>
            No traffic data available yet. Deploy your project and visit the site to start collecting analytics.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {data.map((day, idx) => (
              <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "0.75rem 0", borderBottom: "1px solid var(--card-border)" }}>
                <div style={{ fontWeight: 500 }}>{new Date(day.date).toLocaleDateString()}</div>
                <div style={{ display: "flex", gap: "2rem", color: "var(--muted)" }}>
                  <span style={{ width: "80px", textAlign: "right" }}>{day.pageViews} views</span>
                  <span style={{ width: "80px", textAlign: "right" }}>{day.visitors} visits</span>
                  <span style={{ width: "80px", textAlign: "right" }}>{formatBytes(day.bandwidth)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .stats-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
        .stat-card { background: var(--card); border: 1px solid var(--card-border); border-radius: 12px; padding: 1.5rem; }
        .stat-label { font-size: 0.875rem; color: var(--muted); margin-bottom: 0.5rem; }
        .stat-value { font-size: 1.5rem; font-weight: 600; }
      `}</style>
    </div>
  );
}
