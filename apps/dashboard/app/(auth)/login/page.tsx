"use client";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 700, letterSpacing: "-0.03em" }}>
        Welcome back
      </h1>
      <p style={{ color: "var(--muted)", margin: "0.4rem 0 1.5rem", fontSize: "0.9rem" }}>
        Sign in to the Whizan Cloud Services console
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <label className="form-label">Email</label>
          <input
            id="email"
            type="email"
            className="input"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div>
          <label className="form-label">Password</label>
          <input
            id="password"
            type="password"
            className="input"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </div>
        <button
          id="login-btn"
          type="submit"
          className="btn btn-primary"
          disabled={loading}
          style={{ marginTop: "0.35rem", width: "100%", padding: "0.8rem" }}
        >
          {loading ? "Signing in…" : "Open console"}
        </button>
      </form>

      <p style={{ marginTop: "1.35rem", textAlign: "center", fontSize: "0.875rem", color: "var(--muted)" }}>
        New here?{" "}
        <Link href="/register" style={{ color: "var(--accent)", textDecoration: "none" }}>
          Create a free account
        </Link>
      </p>
      <style>{`
        .form-label {
          display: block; font-size: 0.75rem; font-weight: 600; color: var(--muted);
          margin-bottom: 0.4rem; letter-spacing: 0.04em; text-transform: uppercase;
        }
      `}</style>
    </>
  );
}
