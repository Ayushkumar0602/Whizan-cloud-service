"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Container, HardDrive, Terminal, Database } from "lucide-react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const links = [
    { href: "/dashboard/admin", label: "Overview", icon: <LayoutDashboard size={18} /> },
    { href: "/dashboard/admin/containers", label: "Containers", icon: <Container size={18} /> },
    { href: "/dashboard/admin/storage", label: "Storage", icon: <HardDrive size={18} /> },
    { href: "/dashboard/admin/database", label: "Databases", icon: <Database size={18} /> },
    { href: "/dashboard/admin/logs", label: "VM Logs", icon: <Terminal size={18} /> },
  ];

  return (
    <div style={{ display: "flex", gap: "2rem", maxWidth: "1200px", margin: "0 auto", padding: "1.5rem" }}>
      <aside style={{ width: "240px", display: "flex", flexDirection: "column", gap: "0.5rem", flexShrink: 0 }}>
        <h2 className="section-title" style={{ paddingLeft: "0.5rem" }}>Admin Portal</h2>
        
        <nav style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="btn btn-secondary"
                style={{ 
                  justifyContent: "flex-start", 
                  padding: "0.75rem 1rem",
                  background: active ? "rgba(255,255,255,0.1)" : "transparent",
                  border: active ? "1px solid var(--card-border)" : "1px solid transparent",
                  color: active ? "var(--fg)" : "var(--muted)",
                }}
              >
                {link.icon} {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      
      <main style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: "2rem" }}>
        {children}
      </main>
    </div>
  );
}
