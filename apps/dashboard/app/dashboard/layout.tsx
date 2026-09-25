"use client";
import { useAuth } from "@/lib/auth";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  FolderGit2,
  Settings,
  LogOut,
  Boxes,
  ExternalLink,
  ShieldAlert,
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
      <div className="dash-loading">
        <div className="spinner" />
      </div>
    );
  }

  const navItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Projects" },
    { href: "/dashboard/settings", icon: Settings, label: "Settings" },
    { href: "/dashboard/admin", icon: ShieldAlert, label: "Admin" },
  ];

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <div className="dash-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-top">
          <Link href="/dashboard" className="sidebar-brand">
            <span className="sidebar-logo">⬡</span>
            <span className="sidebar-logo-text">Hostify</span>
          </Link>

          <nav className="sidebar-nav">
            {navItems.map(item => {
              const Icon = item.icon;
              const active = pathname === item.href;
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
          <button onClick={handleLogout} className="logout-btn" id="logout-btn">
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="dash-main">
        {children}
      </main>

      <style>{`
        .dash-shell {
          display: flex;
          min-height: 100vh;
          background: var(--background);
        }
        .dash-loading {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--background);
        }
        .spinner {
          width: 32px; height: 32px;
          border: 2px solid var(--card-border);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Sidebar */
        .sidebar {
          width: 220px;
          min-height: 100vh;
          background: var(--card);
          border-right: 1px solid var(--card-border);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 1.25rem;
          position: sticky;
          top: 0;
          height: 100vh;
          flex-shrink: 0;
        }
        .sidebar-top { display: flex; flex-direction: column; gap: 2rem; }
        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          text-decoration: none;
          padding: 0.25rem 0;
        }
        .sidebar-logo { font-size: 1.5rem; color: var(--accent); }
        .sidebar-logo-text {
          font-size: 1.125rem;
          font-weight: 700;
          color: var(--foreground);
          letter-spacing: -0.02em;
        }
        .sidebar-nav { display: flex; flex-direction: column; gap: 0.25rem; }
        .nav-item {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          padding: 0.5rem 0.75rem;
          border-radius: 8px;
          font-size: 0.875rem;
          color: var(--muted);
          text-decoration: none;
          transition: all 0.15s;
        }
        .nav-item:hover { background: rgba(255,255,255,0.05); color: var(--foreground); }
        .nav-item-active {
          background: var(--accent-glow);
          color: var(--accent);
          font-weight: 500;
        }

        /* Bottom user section */
        .sidebar-bottom {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding-top: 1rem;
          border-top: 1px solid var(--card-border);
        }
        .user-info { display: flex; align-items: center; gap: 0.5rem; flex: 1; min-width: 0; }
        .user-avatar {
          width: 32px; height: 32px;
          background: var(--accent);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.875rem;
          font-weight: 600;
          color: white;
          flex-shrink: 0;
        }
        .user-details { min-width: 0; }
        .user-name { font-size: 0.8125rem; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .user-email { font-size: 0.6875rem; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .logout-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--muted);
          padding: 0.375rem;
          border-radius: 6px;
          transition: all 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .logout-btn:hover { color: var(--danger); background: rgba(239,68,68,0.1); }

        /* Main content */
        .dash-main { flex: 1; overflow: auto; }
      `}</style>
    </div>
  );
}
