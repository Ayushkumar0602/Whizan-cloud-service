"use client";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { BrandMark } from "@/components/brand";
import { DEPLOY_GUIDE } from "@/lib/services";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="page-loading" style={{ minHeight: "100vh" }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <aside className="auth-aside">
        <BrandMark href="/" />
        <h1>A console that stays out of your way.</h1>
        <p>
          Frontend Hosting is ready. Sign in, pick the service, and follow the pipeline —
          you will never wonder whether the deploy actually started.
        </p>
        <ul>
          {DEPLOY_GUIDE.map(s => (
            <li key={s.n}>
              <span>{s.n}</span>
              <div>
                <strong>{s.title}</strong>
                <em>{s.body}</em>
              </div>
            </li>
          ))}
        </ul>
      </aside>
      <main className="auth-main">
        <div className="auth-card">{children}</div>
      </main>
      <style>{`
        .auth-shell {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1.05fr 0.95fr;
        }
        .auth-aside {
          padding: 2.25rem 2.5rem;
          background:
            radial-gradient(600px 280px at 20% 0%, rgba(61,139,255,0.16), transparent 60%),
            #0a0e14;
          border-right: 1px solid var(--card-border);
          display: flex; flex-direction: column;
        }
        .auth-aside h1 {
          font-size: 2rem; letter-spacing: -0.04em; margin: 2.5rem 0 0.75rem; line-height: 1.15;
        }
        .auth-aside > p { color: var(--muted); line-height: 1.55; max-width: 28rem; }
        .auth-aside ul { list-style: none; margin-top: auto; display: flex; flex-direction: column; gap: 1rem; }
        .auth-aside li { display: flex; gap: 0.8rem; }
        .auth-aside li span {
          font-size: 0.75rem; font-weight: 700; color: var(--accent); width: 1.6rem; padding-top: 0.15rem;
        }
        .auth-aside strong { display: block; font-size: 0.9rem; }
        .auth-aside em { font-style: normal; color: var(--muted); font-size: 0.8rem; line-height: 1.4; }
        .auth-main {
          display: flex; align-items: center; justify-content: center; padding: 2rem;
        }
        .auth-card {
          width: 100%; max-width: 420px;
          background: var(--card); border: 1px solid var(--card-border);
          border-radius: 16px; padding: 2rem;
          box-shadow: var(--shadow);
        }
        @media (max-width: 860px) {
          .auth-shell { grid-template-columns: 1fr; }
          .auth-aside { display: none; }
        }
      `}</style>
    </div>
  );
}
