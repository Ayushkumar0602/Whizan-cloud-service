"use client";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      await register(email, password, name);
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 700, letterSpacing: "-0.03em" }}>
        Create your workspace
      </h1>
      <p style={{ color: "var(--muted)", margin: "0.4rem 0 1.5rem", fontSize: "0.9rem" }}>
        You’ll land in Frontend Hosting — other Whizan services join this console later.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <label className="form-label">Name</label>
          <input
            id="name"
            type="text"
            className="input"
            placeholder="Your name"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />
        </div>
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
          />
        </div>
        <div>
          <label className="form-label">Password</label>
          <input
            id="password"
            type="password"
            className="input"
            placeholder="Min. 8 characters"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </div>
        <button
          id="register-btn"
          type="submit"
          className="btn btn-primary"
          disabled={loading}
          style={{ marginTop: "0.35rem", width: "100%", padding: "0.8rem" }}
        >
          {loading ? "Creating workspace…" : "Create workspace"}
        </button>
      </form>

      <p style={{ marginTop: "1.35rem", textAlign: "center", fontSize: "0.875rem", color: "var(--muted)" }}>
        Already have an account?{" "}
        <Link href="/login" style={{ color: "var(--accent)", textDecoration: "none" }}>
          Sign in
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
