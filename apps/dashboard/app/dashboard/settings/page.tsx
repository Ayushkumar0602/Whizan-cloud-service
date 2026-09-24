"use client";
import { useAuth } from "@/lib/auth";

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="page">
      <h1 className="page-title">Account Settings</h1>
      <p className="page-subtitle" style={{ marginBottom: "2rem" }}>
        Manage your profile and preferences
      </p>

      <section className="settings-section">
        <h2 className="settings-section-title">Profile</h2>
        <div className="profile-row">
          <div className="user-avatar-lg">
            {((user?.name || user?.email || "U")[0]).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>{user?.name || "—"}</div>
            <div style={{ color: "var(--muted)", fontSize: "0.875rem" }}>{user?.email}</div>
            <div style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: "0.25rem" }}>
              Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
            </div>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">Local Development</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {[
            { label: "API Server", value: "http://localhost:8000" },
            { label: "Dashboard", value: "http://localhost:3000" },
            { label: "Edge Router", value: "http://localhost:8080" },
            { label: "PostgreSQL", value: "postgresql://localhost:5432/hostify" },
            { label: "Redis", value: "redis://localhost:6379" },
          ].map(row => (
            <div key={row.label} className="info-row">
              <span className="info-label">{row.label}</span>
              <span className="info-value mono">{row.value}</span>
            </div>
          ))}
        </div>
      </section>

      <style>{`
        .page { padding: 2rem 2.5rem; max-width: 700px; }
        .page-title { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em; }
        .page-subtitle { color: var(--muted); font-size: 0.875rem; margin-top: 0.25rem; }
        .settings-section {
          background: var(--card);
          border: 1px solid var(--card-border);
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 1.25rem;
        }
        .settings-section-title { font-size: 1rem; font-weight: 600; margin-bottom: 1.25rem; }
        .profile-row { display: flex; align-items: center; gap: 1.25rem; }
        .user-avatar-lg {
          width: 56px; height: 56px;
          background: var(--accent);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.5rem; font-weight: 700; color: white; flex-shrink: 0;
        }
        .info-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0.625rem 0;
          border-bottom: 1px solid var(--card-border);
        }
        .info-row:last-child { border-bottom: none; }
        .info-label { font-size: 0.875rem; color: var(--muted); }
        .info-value { font-size: 0.8125rem; color: var(--foreground); }
      `}</style>
    </div>
  );
}
