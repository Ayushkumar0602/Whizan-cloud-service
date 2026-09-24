"use client";
import { useState } from "react";
import { projects, type CreateProjectData } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, GitBranch, Terminal, FolderOpen, Zap } from "lucide-react";
import { toast } from "sonner";

const FRAMEWORKS = [
  { value: "NEXTJS", label: "Next.js", icon: "▲" },
  { value: "REACT", label: "React", icon: "⚛" },
  { value: "VITE", label: "Vite", icon: "⚡" },
  { value: "ASTRO", label: "Astro", icon: "🚀" },
  { value: "CUSTOM", label: "Custom", icon: "⚙" },
];

const FRAMEWORK_DEFAULTS: Record<string, Partial<CreateProjectData>> = {
  NEXTJS:  { buildCommand: "npm run build", installCommand: "npm install", outputDir: ".next" },
  REACT:   { buildCommand: "npm run build", installCommand: "npm install", outputDir: "build" },
  VITE:    { buildCommand: "npm run build", installCommand: "npm install", outputDir: "dist" },
  ASTRO:   { buildCommand: "npm run build", installCommand: "npm install", outputDir: "dist" },
  CUSTOM:  { buildCommand: "npm run build", installCommand: "npm install", outputDir: "dist" },
};

export default function NewProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<CreateProjectData>({
    name: "",
    slug: "",
    githubRepoUrl: "",
    branch: "main",
    framework: "NEXTJS",
    buildCommand: "npm run build",
    installCommand: "npm install",
    outputDir: ".next",
  });

  function setField<K extends keyof CreateProjectData>(key: K, value: CreateProjectData[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function handleNameChange(name: string) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    setForm(prev => ({ ...prev, name, slug }));
  }

  function handleFrameworkChange(fw: string) {
    const defaults = FRAMEWORK_DEFAULTS[fw] || {};
    setForm(prev => ({ ...prev, framework: fw, ...defaults }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const project = await projects.create(form);
      toast.success("Project created!");
      router.push(`/dashboard/projects/${project.id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create project");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <Link href="/dashboard" className="btn btn-secondary" style={{ width: "fit-content" }}>
          <ArrowLeft size={15} /> Back
        </Link>
        <h1 className="page-title" style={{ marginTop: "1rem" }}>New Project</h1>
        <p className="page-subtitle">Connect a GitHub repo and deploy your app</p>
      </div>

      <form onSubmit={handleSubmit} className="new-project-form">
        {/* Framework selector */}
        <section className="form-section">
          <h2 className="section-title"><Zap size={15} /> Framework</h2>
          <div className="framework-grid">
            {FRAMEWORKS.map(fw => (
              <button
                key={fw.value}
                type="button"
                id={`framework-${fw.value.toLowerCase()}`}
                className={`framework-btn ${form.framework === fw.value ? "framework-btn-active" : ""}`}
                onClick={() => handleFrameworkChange(fw.value)}
              >
                <span className="framework-icon">{fw.icon}</span>
                <span>{fw.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Project info */}
        <section className="form-section">
          <h2 className="section-title"><FolderOpen size={15} /> Project Details</h2>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Project Name *</label>
              <input
                id="project-name"
                className="input"
                placeholder="my-awesome-app"
                value={form.name}
                onChange={e => handleNameChange(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Slug *</label>
              <input
                id="project-slug"
                className="input mono"
                placeholder="my-awesome-app"
                value={form.slug}
                onChange={e => setField("slug", e.target.value)}
                required
                pattern="[-a-z0-9]+"
              />
              <span className="input-hint">Used for your deploy URL: <span className="mono">{form.slug || "slug"}.localhost</span></span>
            </div>
          </div>
        </section>

        {/* Repository */}
        <section className="form-section">
          <h2 className="section-title"><GitBranch size={15} /> Repository</h2>
          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label className="form-label">GitHub Repository URL *</label>
              <input
                id="repo-url"
                className="input"
                placeholder="https://github.com/username/repo"
                value={form.githubRepoUrl}
                onChange={e => setField("githubRepoUrl", e.target.value)}
                required
                type="url"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Branch</label>
              <input
                id="branch"
                className="input"
                placeholder="main"
                value={form.branch}
                onChange={e => setField("branch", e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Build settings */}
        <section className="form-section">
          <h2 className="section-title"><Terminal size={15} /> Build Settings</h2>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Install Command</label>
              <input id="install-cmd" className="input mono" value={form.installCommand}
                onChange={e => setField("installCommand", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Build Command</label>
              <input id="build-cmd" className="input mono" value={form.buildCommand}
                onChange={e => setField("buildCommand", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Output Directory</label>
              <input id="output-dir" className="input mono" value={form.outputDir}
                onChange={e => setField("outputDir", e.target.value)} />
            </div>
          </div>
        </section>

        <div className="form-actions">
          <Link href="/dashboard" className="btn btn-secondary">Cancel</Link>
          <button id="create-project-btn" type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Creating…" : "Create & Deploy →"}
          </button>
        </div>
      </form>

      <style>{`
        .page { padding: 2rem 2.5rem; max-width: 800px; }
        .page-header { margin-bottom: 2rem; }
        .page-title { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em; }
        .page-subtitle { color: var(--muted); font-size: 0.875rem; margin-top: 0.25rem; }

        .new-project-form { display: flex; flex-direction: column; gap: 0; }
        .form-section {
          background: var(--card);
          border: 1px solid var(--card-border);
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 1rem;
        }
        .section-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 1.25rem;
        }
        .form-row { display: flex; gap: 1rem; flex-wrap: wrap; }
        .form-group { display: flex; flex-direction: column; gap: 0.375rem; flex: 1; min-width: 200px; }
        .form-label { font-size: 0.8125rem; font-weight: 500; color: var(--muted); }
        .input-hint { font-size: 0.75rem; color: var(--muted); }

        .framework-grid { display: flex; gap: 0.625rem; flex-wrap: wrap; }
        .framework-btn {
          display: flex; align-items: center; gap: 0.5rem;
          padding: 0.5rem 1rem;
          border: 1px solid var(--card-border);
          border-radius: 8px;
          background: transparent;
          color: var(--muted);
          cursor: pointer;
          font-size: 0.875rem;
          transition: all 0.15s;
        }
        .framework-btn:hover { border-color: var(--accent); color: var(--foreground); }
        .framework-btn-active { border-color: var(--accent); color: var(--accent); background: var(--accent-glow); font-weight: 500; }
        .framework-icon { font-size: 1rem; }

        .form-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 0.5rem; }
      `}</style>
    </div>
  );
}
