"use client";
import { useState } from "react";
import { projects, type CreateProjectData } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, GitBranch, Terminal, FolderOpen, Globe } from "lucide-react";
import { toast } from "sonner";
import { WizardSteps } from "@/components/deploy-pipeline";
import { PageHeader } from "@/components/page-header";

const FRAMEWORKS = [
  { value: "NEXTJS", label: "Next.js", icon: "▲" },
  { value: "REACT", label: "React", icon: "⚛" },
  { value: "VITE", label: "Vite", icon: "⚡" },
  { value: "ASTRO", label: "Astro", icon: "🚀" },
  { value: "CUSTOM", label: "Custom", icon: "⚙" },
];

const FRAMEWORK_DEFAULTS: Record<string, Partial<CreateProjectData>> = {
  NEXTJS: { buildCommand: "npm run build", installCommand: "npm install", outputDir: ".next" },
  REACT: { buildCommand: "npm run build", installCommand: "npm install", outputDir: "build" },
  VITE: { buildCommand: "npm run build", installCommand: "npm install", outputDir: "dist" },
  ASTRO: { buildCommand: "npm run build", installCommand: "npm install", outputDir: "dist" },
  CUSTOM: { buildCommand: "npm run build", installCommand: "npm install", outputDir: "dist" },
};

const STEPS = [
  { id: "service", label: "Service", hint: "Confirm Frontend Hosting" },
  { id: "repo", label: "Repository", hint: "Name + GitHub URL" },
  { id: "build", label: "Build", hint: "Commands & output" },
  { id: "review", label: "Review", hint: "Create and deploy" },
];

export default function NewProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
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

  function canContinue() {
    if (step === 1) return Boolean(form.name && form.slug && form.githubRepoUrl);
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step < 3) {
      if (!canContinue()) {
        toast.error("Fill project name, slug, and GitHub URL first");
        return;
      }
      setStep(s => s + 1);
      return;
    }
    setLoading(true);
    try {
      const project = await projects.create(form);
      toast.success("Project created — opening the deploy pipeline");
      router.push(`/dashboard/projects/${project.id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create project");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page" style={{ maxWidth: 860 }}>
      <Link href="/dashboard/hosting" className="breadcrumb">
        <ArrowLeft size={14} /> Frontend Hosting
      </Link>
      <PageHeader
        title="New frontend deploy"
        subtitle="Four steps. You can go back at any time — nothing deploys until you confirm on the last screen."
      />

      <WizardSteps steps={STEPS} current={step} />

      <form onSubmit={handleSubmit}>
        {step === 0 && (
          <section className="form-section">
            <h2 className="section-title"><Globe size={15} /> You’re using Frontend Hosting</h2>
            <p className="section-copy">
              This service clones your GitHub repo, installs dependencies, builds the app, and publishes a URL.
              Backend APIs and databases are not in this flow yet — they will show up as separate services.
            </p>
            <div className="confirm-box">
              <strong>What happens after you continue</strong>
              <ol>
                <li>You connect a public or accessible GitHub repository</li>
                <li>We pre-fill install / build commands from the framework you pick</li>
                <li>Creating the project starts the first deployment immediately</li>
              </ol>
            </div>
          </section>
        )}

        {step === 1 && (
          <>
            <section className="form-section">
              <h2 className="section-title"><FolderOpen size={15} /> Name the site</h2>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Project name *</label>
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
                  <span className="input-hint">Live URL: <span className="mono">{form.slug || "slug"}.localhost:8080</span></span>
                </div>
              </div>
            </section>
            <section className="form-section">
              <h2 className="section-title"><GitBranch size={15} /> Repository</h2>
              <p className="section-copy">Paste the repo Whizan should clone. Use the branch you want to ship.</p>
              <div className="form-row">
                <div className="form-group" style={{ flex: 2 }}>
                  <label className="form-label">GitHub repository URL *</label>
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
          </>
        )}

        {step === 2 && (
          <section className="form-section">
            <h2 className="section-title"><Terminal size={15} /> Build settings</h2>
            <p className="section-copy">Pick a framework to fill the commands. Change anything if your repo is custom.</p>
            <div className="framework-grid">
              {FRAMEWORKS.map(fw => (
                <button
                  key={fw.value}
                  type="button"
                  id={`framework-${fw.value.toLowerCase()}`}
                  className={`framework-btn ${form.framework === fw.value ? "framework-btn-active" : ""}`}
                  onClick={() => handleFrameworkChange(fw.value)}
                >
                  <span>{fw.icon}</span>
                  <span>{fw.label}</span>
                </button>
              ))}
            </div>
            <div className="form-row" style={{ marginTop: "1.1rem" }}>
              <div className="form-group">
                <label className="form-label">Install command</label>
                <input id="install-cmd" className="input mono" value={form.installCommand}
                  onChange={e => setField("installCommand", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Build command</label>
                <input id="build-cmd" className="input mono" value={form.buildCommand}
                  onChange={e => setField("buildCommand", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Output directory</label>
                <input id="output-dir" className="input mono" value={form.outputDir}
                  onChange={e => setField("outputDir", e.target.value)} />
              </div>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="form-section">
            <h2 className="section-title">Review before we start</h2>
            <p className="section-copy">Creating this project triggers the first deploy. You’ll land on the live pipeline next.</p>
            <dl className="review">
              {[
                ["Service", "Frontend Hosting"],
                ["Name", form.name || "—"],
                ["Slug", form.slug || "—"],
                ["Repository", form.githubRepoUrl || "—"],
                ["Branch", form.branch || "main"],
                ["Framework", form.framework || ""],
                ["Install", form.installCommand || ""],
                ["Build", form.buildCommand || ""],
                ["Output", form.outputDir || ""],
              ].map(([k, v]) => (
                <div key={k} className="review-row">
                  <dt>{k}</dt>
                  <dd className="mono">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <div className="form-actions">
          {step > 0 ? (
            <button type="button" className="btn btn-secondary" onClick={() => setStep(s => s - 1)}>
              Back
            </button>
          ) : (
            <Link href="/dashboard/hosting" className="btn btn-secondary">Cancel</Link>
          )}
          <button id="create-project-btn" type="submit" className="btn btn-primary" disabled={loading}>
            {step < 3 ? <>Continue <ArrowRight size={15} /></> : loading ? "Creating…" : "Create & start deploy"}
          </button>
        </div>
      </form>

      <style>{`
        .form-section {
          background: var(--card); border: 1px solid var(--card-border);
          border-radius: 14px; padding: 1.4rem; margin-bottom: 1rem;
        }
        .section-title {
          display: flex; align-items: center; gap: 0.5rem;
          font-size: 0.95rem; font-weight: 650; margin-bottom: 0.5rem;
        }
        .section-copy { color: var(--muted); font-size: 0.85rem; line-height: 1.5; margin-bottom: 1rem; }
        .confirm-box {
          background: #0b1016; border: 1px solid var(--card-border); border-radius: 12px; padding: 1rem 1.1rem;
        }
        .confirm-box strong { display: block; margin-bottom: 0.5rem; font-size: 0.85rem; }
        .confirm-box ol { padding-left: 1.1rem; color: var(--muted); font-size: 0.85rem; line-height: 1.7; }
        .form-row { display: flex; gap: 1rem; flex-wrap: wrap; }
        .form-group { display: flex; flex-direction: column; gap: 0.375rem; flex: 1; min-width: 200px; }
        .form-label { font-size: 0.75rem; font-weight: 650; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
        .input-hint { font-size: 0.75rem; color: var(--muted); }
        .framework-grid { display: flex; gap: 0.5rem; flex-wrap: wrap; }
        .framework-btn {
          display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem;
          border: 1px solid var(--card-border); border-radius: 10px; background: transparent;
          color: var(--muted); cursor: pointer; font-size: 0.875rem; font-family: inherit;
        }
        .framework-btn-active { border-color: var(--accent); color: var(--accent); background: var(--accent-glow); font-weight: 600; }
        .form-actions { display: flex; justify-content: space-between; gap: 0.75rem; margin-top: 0.35rem; }
        .review { display: flex; flex-direction: column; }
        .review-row {
          display: grid; grid-template-columns: 140px 1fr; gap: 0.75rem;
          padding: 0.65rem 0; border-bottom: 1px solid var(--card-border); font-size: 0.85rem;
        }
        .review-row dt { color: var(--muted); }
        .review-row dd { word-break: break-all; }
      `}</style>
    </div>
  );
}
