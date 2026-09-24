"use client";
import { useEffect, useState } from "react";
import { projects, envVars, type ProjectWithDeployments, type EnvVariable } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Eye, EyeOff, Lock, Save } from "lucide-react";
import { toast } from "sonner";

export default function ProjectSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<ProjectWithDeployments | null>(null);
  const [envList, setEnvList] = useState<EnvVariable[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newSecret, setNewSecret] = useState(false);
  const [addingEnv, setAddingEnv] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  async function load() {
    try {
      const [p, envs] = await Promise.all([
        projects.get(id),
        envVars.list(id),
      ]);
      setProject(p);
      setEnvList(envs);
    } catch {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function handleAddEnv(e: React.FormEvent) {
    e.preventDefault();
    if (!newKey.trim() || !newValue.trim()) return;
    setAddingEnv(true);
    try {
      await envVars.set(id, { key: newKey.trim(), value: newValue.trim(), isSecret: newSecret });
      toast.success(`${newKey} saved`);
      setNewKey(""); setNewValue(""); setNewSecret(false);
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setAddingEnv(false);
    }
  }

  async function handleDeleteEnv(key: string) {
    if (!confirm(`Delete ${key}?`)) return;
    try {
      await envVars.delete(id, key);
      toast.success(`${key} deleted`);
      await load();
    } catch {
      toast.error("Failed to delete");
    }
  }

  async function handleDeleteProject() {
    if (!confirm(`Delete "${project?.name}"? This cannot be undone.`)) return;
    try {
      await projects.delete(id);
      toast.success("Project deleted");
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  }

  function toggleReveal(varId: string) {
    setRevealed(prev => {
      const next = new Set(prev);
      next.has(varId) ? next.delete(varId) : next.add(varId);
      return next;
    });
  }

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;
  if (!project) return null;

  return (
    <div className="page">
      <Link href={`/dashboard/projects/${id}`} className="breadcrumb">
        <ArrowLeft size={14} /> {project.name}
      </Link>
      <h1 className="page-title">Settings</h1>
      <p className="page-subtitle" style={{ marginBottom: "2rem" }}>Manage environment variables and project configuration</p>

      {/* Env Vars */}
      <section className="settings-section">
        <div className="settings-section-header">
          <div>
            <h2 className="settings-section-title">Environment Variables</h2>
            <p className="settings-section-desc">These are injected at build time and runtime.</p>
          </div>
        </div>

        {/* Existing env vars */}
        {envList.length > 0 && (
          <div className="env-list">
            {envList.map(v => (
              <div key={v.id} className="env-row">
                <div className="env-key">
                  {v.isSecret && <Lock size={12} />}
                  <span className="mono">{v.key}</span>
                </div>
                <div className="env-value-cell">
                  <span className="mono env-value">
                    {v.isSecret && !revealed.has(v.id)
                      ? "••••••••••••"
                      : v.value}
                  </span>
                  {v.isSecret && (
                    <button
                      className="icon-btn"
                      onClick={() => toggleReveal(v.id)}
                      title={revealed.has(v.id) ? "Hide" : "Show"}
                    >
                      {revealed.has(v.id) ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  )}
                </div>
                <button
                  className="icon-btn icon-btn-danger"
                  onClick={() => handleDeleteEnv(v.key)}
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add new env var */}
        <form onSubmit={handleAddEnv} className="env-add-form">
          <input
            id="env-key"
            className="input mono"
            placeholder="KEY"
            value={newKey}
            onChange={e => setNewKey(e.target.value.toUpperCase())}
            style={{ flex: "0 0 200px" }}
          />
          <input
            id="env-value"
            className="input mono"
            placeholder="value"
            value={newValue}
            onChange={e => setNewValue(e.target.value)}
            type={newSecret ? "password" : "text"}
            style={{ flex: 1 }}
          />
          <label className="secret-toggle">
            <input
              type="checkbox"
              checked={newSecret}
              onChange={e => setNewSecret(e.target.checked)}
              id="env-secret"
            />
            <Lock size={13} />
            Secret
          </label>
          <button
            id="add-env-btn"
            type="submit"
            className="btn btn-secondary"
            disabled={addingEnv || !newKey || !newValue}
          >
            <Plus size={15} />
            {addingEnv ? "Saving…" : "Add"}
          </button>
        </form>
      </section>

      {/* Danger zone */}
      <section className="settings-section danger-section">
        <h2 className="settings-section-title" style={{ color: "var(--danger)" }}>Danger Zone</h2>
        <div className="danger-row">
          <div>
            <div style={{ fontWeight: 500, fontSize: "0.9rem" }}>Delete this project</div>
            <div style={{ color: "var(--muted)", fontSize: "0.8125rem", marginTop: 4 }}>
              All deployments, env vars, and config will be permanently deleted.
            </div>
          </div>
          <button
            id="delete-project-btn"
            className="btn btn-danger"
            onClick={handleDeleteProject}
          >
            <Trash2 size={14} />
            Delete project
          </button>
        </div>
      </section>

      <style>{`
        .page { padding: 2rem 2.5rem; max-width: 800px; }
        .page-loading { display: flex; align-items: center; justify-content: center; min-height: 60vh; }
        .spinner { width: 32px; height: 32px; border: 2px solid var(--card-border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .breadcrumb { display: inline-flex; align-items: center; gap: 0.375rem; font-size: 0.8125rem; color: var(--muted); text-decoration: none; margin-bottom: 1.25rem; transition: color 0.15s; }
        .breadcrumb:hover { color: var(--foreground); }
        .page-title { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em; }
        .page-subtitle { color: var(--muted); font-size: 0.875rem; margin-top: 0.25rem; }

        .settings-section {
          background: var(--card);
          border: 1px solid var(--card-border);
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 1.25rem;
        }
        .danger-section { border-color: rgba(239,68,68,0.2); }
        .settings-section-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1.25rem; }
        .settings-section-title { font-size: 1rem; font-weight: 600; margin-bottom: 0.25rem; }
        .settings-section-desc { font-size: 0.8125rem; color: var(--muted); }

        .env-list { display: flex; flex-direction: column; gap: 0; margin-bottom: 1rem; border: 1px solid var(--card-border); border-radius: 8px; overflow: hidden; }
        .env-row { display: flex; align-items: center; gap: 0.75rem; padding: 0.625rem 0.875rem; border-bottom: 1px solid var(--card-border); background: rgba(0,0,0,0.2); }
        .env-row:last-child { border-bottom: none; }
        .env-key { display: flex; align-items: center; gap: 0.375rem; min-width: 180px; font-size: 0.8125rem; font-weight: 500; color: var(--foreground); flex-shrink: 0; }
        .env-value-cell { flex: 1; display: flex; align-items: center; gap: 0.5rem; min-width: 0; }
        .env-value { font-size: 0.8125rem; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .icon-btn { background: none; border: none; cursor: pointer; color: var(--muted); padding: 0.25rem; border-radius: 4px; transition: all 0.15s; display: flex; align-items: center; }
        .icon-btn:hover { color: var(--foreground); background: rgba(255,255,255,0.05); }
        .icon-btn-danger:hover { color: var(--danger); background: rgba(239,68,68,0.08); }

        .env-add-form { display: flex; gap: 0.625rem; flex-wrap: wrap; align-items: center; }
        .secret-toggle { display: flex; align-items: center; gap: 0.375rem; font-size: 0.8125rem; color: var(--muted); cursor: pointer; white-space: nowrap; padding: 0 0.25rem; }

        .danger-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
      `}</style>
    </div>
  );
}
