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
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
        Welcome back
      </h1>
      <p style={{ color: "var(--muted)", marginBottom: "1.75rem", fontSize: "0.9rem" }}>
        Sign in to your Hostify account
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
          style={{ marginTop: "0.5rem", width: "100%", justifyContent: "center", padding: "0.75rem" }}
        >
          {loading ? "Signing in…" : "Sign in →"}
        </button>
      </form>

      <p style={{ marginTop: "1.5rem", textAlign: "center", fontSize: "0.875rem", color: "var(--muted)" }}>
        Don&apos;t have an account?{" "}
        <Link href="/register" style={{ color: "var(--accent)", textDecoration: "none" }}>
          Create one
        </Link>
      </p>

      <style>{`
        .form-label {
          display: block;
          font-size: 0.8125rem;
          font-weight: 500;
          color: var(--muted);
          margin-bottom: 0.4rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
      `}</style>
    </>
  );
}
