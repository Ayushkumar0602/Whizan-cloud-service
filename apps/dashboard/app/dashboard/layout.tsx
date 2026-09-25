"use client";
import { useAuth } from "@/lib/auth";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand";
import {
  LayoutDashboard,
  Globe,
  Settings,
  LogOut,
  ShieldAlert,
  Layers,
} from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="page-loading" style={{ minHeight: "100vh" }}>
        <div className="spinner" />
      </div>
    );
  }

  const navItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Console", match: (p: string) => p === "/dashboard" },
    { href: "/dashboard/services", icon: Layers, label: "Services", match: (p: string) => p.startsWith("/dashboard/services") },
    { href: "/dashboard/hosting", icon: Globe, label: "Frontend Hosting", match: (p: string) => p.startsWith("/dashboard/hosting") || p.startsWith("/dashboard/projects") },
    { href: "/dashboard/settings", icon: Settings, label: "Settings", match: (p: string) => p.startsWith("/dashboard/settings") },
    { href: "/dashboard/admin", icon: ShieldAlert, label: "Admin", match: (p: string) => p.startsWith("/dashboard/admin") },
  ];

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <div className="dash-shell">
      <aside className="sidebar">
        <div>
          <BrandMark href="/dashboard" />
          <p className="sidebar-hint">Cloud console</p>
          <nav className="sidebar-nav">
            {navItems.map(item => {
              const Icon = item.icon;
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item ${active ? "nav-item-active" : ""}`}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="sidebar-bottom">
          <div className="user-info">
            <div className="user-avatar">
              {(user.name || user.email)[0].toUpperCase()}
            </div>
            <div className="user-details">
              <div className="user-name">{user.name || "User"}</div>
              <div className="user-email">{user.email}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="logout-btn" id="logout-btn" title="Sign out">
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      <main className="dash-main">{children}</main>

      <style>{`
        .dash-shell { display: flex; min-height: 100vh; background: var(--background); }
        .sidebar {
          width: 248px;
          min-height: 100vh;
          background: #0c1118;
          border-right: 1px solid var(--card-border);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 1.2rem 1rem;
          position: sticky;
          top: 0;
          height: 100vh;
          flex-shrink: 0;
        }
        .sidebar-hint {
          font-size: 0.68rem; color: var(--muted); letter-spacing: 0.08em;
          text-transform: uppercase; margin: 1.35rem 0.5rem 0.45rem; font-weight: 650;
        }
        .sidebar-nav { display: flex; flex-direction: column; gap: 0.2rem; }
        .nav-item {
          display: flex; align-items: center; gap: 0.625rem;
          padding: 0.55rem 0.75rem; border-radius: 10px;
          font-size: 0.875rem; color: var(--muted); text-decoration: none;
        }
        .nav-item:hover { background: rgba(255,255,255,0.04); color: var(--foreground); }
        .nav-item-active {
          background: var(--accent-glow); color: var(--accent); font-weight: 600;
        }
        .sidebar-bottom {
          display: flex; align-items: center; gap: 0.5rem;
          padding-top: 1rem; border-top: 1px solid var(--card-border);
        }
        .user-info { display: flex; align-items: center; gap: 0.5rem; flex: 1; min-width: 0; }
        .user-avatar {
          width: 32px; height: 32px; background: linear-gradient(135deg, var(--accent), var(--accent-2));
          border-radius: 50%; display: flex; align-items: center; justify-content: center;
          font-size: 0.8rem; font-weight: 700; color: white; flex-shrink: 0;
        }
        .user-name { font-size: 0.8125rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .user-email { font-size: 0.6875rem; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .logout-btn {
          background: none; border: none; cursor: pointer; color: var(--muted);
          padding: 0.375rem; border-radius: 6px; display: flex;
        }
        .logout-btn:hover { color: var(--danger); background: rgba(239,68,68,0.1); }
        .dash-main { flex: 1; overflow: auto; }
        @media (max-width: 720px) {
          .dash-shell { flex-direction: column; }
          .sidebar { width: 100%; height: auto; min-height: 0; position: relative; }
        }
      `}</style>
    </div>
  );
}
