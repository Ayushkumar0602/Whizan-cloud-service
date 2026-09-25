"use client";

import Link from "next/link";
import { BrandMark } from "@/components/brand";
import { CLOUD_SERVICES, DEPLOY_GUIDE } from "@/lib/services";
import { useAuth } from "@/lib/auth";
import { ArrowRight, CheckCircle2, Eye, GitBranch, Rocket } from "lucide-react";

export default function LandingPage() {
  const { user, loading } = useAuth();
  const ctaHref = !loading && user ? "/dashboard" : "/register";
  const ctaLabel = !loading && user ? "Open console" : "Start deploying";

  return (
    <div className="land">
      <header className="land-nav">
        <BrandMark />
        <nav className="land-links">
          <a href="#services">Services</a>
          <a href="#how">How it works</a>
          {user ? (
            <Link href="/dashboard" className="btn btn-primary">Console</Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-secondary">Sign in</Link>
              <Link href="/register" className="btn btn-primary">Get started</Link>
            </>
          )}
        </nav>
      </header>

      <section className="land-hero">
        <p className="land-eyebrow">Whizan Cloud Services</p>
        <h1>Cloud that tells you what it’s doing.</h1>
        <p className="land-lead">
          Frontend Hosting is live today. Connect a repo, follow every step from queue to live URL,
          and add more Whizan services as they launch — without learning a new console each time.
        </p>
        <div className="land-ctas">
          <Link href={ctaHref} className="btn btn-primary" id="hero-cta">
            {ctaLabel} <ArrowRight size={16} />
          </Link>
          <Link href="/login" className="btn btn-secondary">I already have an account</Link>
        </div>
        <div className="land-pills">
          <span><Eye size={14} /> Every deploy step is visible</span>
          <span><GitBranch size={14} /> GitHub in, URL out</span>
          <span><Rocket size={14} /> One console for future services</span>
        </div>
      </section>

      <section id="services" className="land-section">
        <div className="land-section-head">
          <h2>The catalog</h2>
          <p>Start with hosting. The rest of the cloud stack is on the way.</p>
        </div>
        <div className="service-grid">
          {CLOUD_SERVICES.map(svc => (
            <div
              key={svc.id}
              className={`service-card ${svc.available ? "" : "service-card-soon"}`}
            >
              <div className="service-kicker">{svc.available ? "Available" : svc.eta}</div>
              <div className="service-title">{svc.name}</div>
              <p className="service-desc">{svc.description}</p>
              {svc.available ? (
                <Link href={ctaHref} className="btn btn-primary" style={{ width: "fit-content" }}>
                  Use Frontend Hosting <ArrowRight size={14} />
                </Link>
              ) : (
                <span className="badge badge-queued">Coming soon</span>
              )}
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="land-section">
        <div className="land-section-head">
          <h2>You always know the next click</h2>
          <p>No hidden builds. The console walks you through deploy start to live.</p>
        </div>
        <div className="guide-grid">
          {DEPLOY_GUIDE.map(step => (
            <article key={step.n} className="guide-card">
              <div className="guide-n">{step.n}</div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="land-section">
        <div className="land-promise">
          <CheckCircle2 size={18} color="var(--accent-2)" />
          <div>
            <strong>Frontend Hosting, without the mystery.</strong>
            <p>Queue, clone, install, build, publish, live — each state has a label, a hint, and logs.</p>
          </div>
          <Link href={ctaHref} className="btn btn-primary">{ctaLabel}</Link>
        </div>
      </section>

      <footer className="land-foot">
        <BrandMark />
        <span>© {new Date().getFullYear()} Whizan Cloud Services</span>
      </footer>

      <style>{`
        .land {
          min-height: 100vh;
          background:
            radial-gradient(900px 420px at 80% -10%, rgba(61,139,255,0.18), transparent 55%),
            radial-gradient(700px 380px at -10% 20%, rgba(34,200,163,0.1), transparent 50%),
            var(--background);
        }
        .land-nav {
          display: flex; align-items: center; justify-content: space-between;
          max-width: 1120px; margin: 0 auto; padding: 1.25rem 1.5rem;
        }
        .land-links { display: flex; align-items: center; gap: 1.1rem; }
        .land-links a:not(.btn) {
          color: var(--muted); text-decoration: none; font-size: 0.9rem;
        }
        .land-links a:not(.btn):hover { color: var(--foreground); }
        .land-hero { max-width: 820px; margin: 0 auto; padding: 4.5rem 1.5rem 3rem; }
        .land-eyebrow {
          color: var(--accent-2); font-size: 0.75rem; letter-spacing: 0.12em;
          text-transform: uppercase; font-weight: 700; margin-bottom: 0.9rem;
        }
        .land-hero h1 {
          font-size: clamp(2.2rem, 5vw, 3.4rem); letter-spacing: -0.045em;
          line-height: 1.08; font-weight: 750; margin-bottom: 1rem;
        }
        .land-lead { font-size: 1.05rem; color: var(--muted); line-height: 1.6; max-width: 40rem; }
        .land-ctas { display: flex; gap: 0.75rem; flex-wrap: wrap; margin: 1.75rem 0 1.25rem; }
        .land-pills { display: flex; gap: 0.6rem; flex-wrap: wrap; }
        .land-pills span {
          display: inline-flex; align-items: center; gap: 0.4rem;
          font-size: 0.8rem; color: var(--muted);
          border: 1px solid var(--card-border); background: rgba(16,21,29,0.7);
          border-radius: 999px; padding: 0.35rem 0.75rem;
        }
        .land-section { max-width: 1120px; margin: 0 auto; padding: 1.5rem 1.5rem 3rem; }
        .land-section-head { margin-bottom: 1.25rem; }
        .land-section-head h2 { font-size: 1.45rem; letter-spacing: -0.03em; }
        .land-section-head p { color: var(--muted); margin-top: 0.35rem; }
        .guide-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.85rem; }
        .guide-card {
          background: var(--card); border: 1px solid var(--card-border);
          border-radius: 14px; padding: 1.15rem;
        }
        .guide-n { color: var(--accent); font-weight: 700; font-size: 0.8rem; margin-bottom: 0.5rem; }
        .guide-card h3 { font-size: 1rem; margin-bottom: 0.35rem; }
        .guide-card p { color: var(--muted); font-size: 0.85rem; line-height: 1.5; }
        .land-promise {
          display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
          background: var(--card); border: 1px solid var(--card-border);
          border-radius: 16px; padding: 1.25rem 1.4rem;
        }
        .land-promise { justify-content: space-between; }
        .land-promise p { color: var(--muted); font-size: 0.85rem; margin-top: 0.2rem; }
        .land-foot {
          max-width: 1120px; margin: 0 auto; padding: 1.5rem;
          display: flex; justify-content: space-between; align-items: center;
          color: var(--muted); font-size: 0.8rem; border-top: 1px solid var(--card-border);
        }
        @media (max-width: 720px) {
          .land-links a:not(.btn) { display: none; }
          .land-hero { padding-top: 2.5rem; }
        }
      `}</style>
    </div>
  );
}
