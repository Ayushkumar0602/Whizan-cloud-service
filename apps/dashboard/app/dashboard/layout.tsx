"use client";
import { useAuth } from "@/lib/auth";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand";
import {
  LayoutDashboard,
  Globe,
  Settings,
  LogOut,
  ShieldAlert,
  Layers,
  Moon,
  Sun
} from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light") {
      setTheme("light");
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      setTheme("dark");
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  }

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
          <nav className="sidebar-nav" style={{ marginTop: '1.5rem' }}>
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
          <div style={{ display: "flex", gap: "0.2rem" }}>
            <button onClick={toggleTheme} className="icon-btn" title="Toggle theme">
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button onClick={handleLogout} className="icon-btn" id="logout-btn" title="Sign out" style={{ color: "var(--danger)" }}>
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      <main className="dash-main">{children}</main>

      <style>{`
        .dash-shell { display: flex; min-height: 100vh; background: var(--background); }
        .sidebar {
          width: 240px;
          min-height: 100vh;
          background: var(--card);
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
          display: flex; align-items: center; gap: 0.5rem;
          padding: 0.5rem 0.65rem; border-radius: 4px;
          font-size: 0.8125rem; font-weight: 500; color: var(--muted); text-decoration: none;
        }
        .nav-item:hover { background: var(--card-hover); color: var(--foreground); }
        .nav-item-active {
          background: var(--accent-glow); color: var(--accent); font-weight: 600;
        }
        .nav-item-disabled {
          opacity: 0.5;
          cursor: not-allowed;
          filter: grayscale(1);
        }
        .badge-soon {
          margin-left: auto;
          font-size: 0.65rem;
          text-transform: uppercase;
          background: rgba(255,255,255,0.1);
          padding: 2px 6px;
          border-radius: 4px;
          letter-spacing: 0.5px;
        }
        .sidebar-group {
          margin-top: 1.5rem;
        }
        .sidebar-group-label {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--muted);
          padding: 0 0.8rem;
          margin-bottom: 0.5rem;
          font-weight: 600;
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
        .icon-btn {
          background: transparent; border: none; cursor: pointer; color: var(--muted);
          padding: 0.35rem; border-radius: 4px; display: flex; transition: all 0.1s;
        }
        .icon-btn:hover { background: var(--card-hover); color: var(--foreground); }
        .dash-main { flex: 1; overflow: auto; }
        @media (max-width: 720px) {
          .dash-shell { flex-direction: column; }
          .sidebar { width: 100%; height: auto; min-height: 0; position: relative; }
        }
      `}</style>
    </div>
  );
}
