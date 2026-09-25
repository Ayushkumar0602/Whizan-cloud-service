"use client";
import Link from "next/link";
import { CLOUD_SERVICES, DEPLOY_GUIDE } from "@/lib/services";
import { PageHeader } from "@/components/page-header";
import { ArrowRight } from "lucide-react";

export default function ServicesPage() {
  return (
    <div className="page">
      <PageHeader
        title="Cloud services"
        subtitle="One catalog, one console. Use Frontend Hosting now — backend, databases, and storage will land in this same list."
      />

      <div className="service-grid" style={{ marginBottom: "2rem" }}>
        {CLOUD_SERVICES.map(svc => (
          svc.available ? (
            <Link key={svc.id} href="/dashboard/hosting" className="service-card">
              <div className="service-kicker">Available</div>
              <div className="service-title">{svc.name}</div>
              <p className="service-desc">{svc.description}</p>
              <span className="btn btn-primary" style={{ width: "fit-content" }}>
                Open hosting <ArrowRight size={14} />
              </span>
            </Link>
          ) : (
            <div key={svc.id} className="service-card service-card-soon">
              <div className="service-kicker">{svc.eta}</div>
              <div className="service-title">{svc.name}</div>
              <p className="service-desc">{svc.description}</p>
              <span className="badge badge-queued">We’ll notify this console when it ships</span>
            </div>
          )
        ))}
      </div>

      <h2 className="page-title" style={{ fontSize: "1.1rem", marginBottom: "0.85rem" }}>How Frontend Hosting works</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.8rem" }}>
        {DEPLOY_GUIDE.map(s => (
          <div key={s.n} className="card">
            <div style={{ color: "var(--accent)", fontWeight: 700, fontSize: "0.75rem", marginBottom: 8 }}>{s.n}</div>
            <div style={{ fontWeight: 650, marginBottom: 6 }}>{s.title}</div>
            <p style={{ color: "var(--muted)", fontSize: "0.82rem", lineHeight: 1.45 }}>{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
