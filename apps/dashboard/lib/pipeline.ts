export type PipelineStepId =
  | "queued"
  | "clone"
  | "install"
  | "build"
  | "publish"
  | "ready";

export type PipelineStepState = "pending" | "current" | "done" | "failed" | "skipped";

export type PipelineStep = {
  id: PipelineStepId;
  label: string;
  hint: string;
};

export const PIPELINE_STEPS: PipelineStep[] = [
  { id: "queued", label: "Queued", hint: "Waiting for a free build worker" },
  { id: "clone", label: "Clone", hint: "Pulling the repository" },
  { id: "install", label: "Install", hint: "Installing dependencies" },
  { id: "build", label: "Build", hint: "Compiling your frontend" },
  { id: "publish", label: "Publish", hint: "Serving the build on the edge" },
  { id: "ready", label: "Live", hint: "Your site is available" },
];

const ORDER: PipelineStepId[] = PIPELINE_STEPS.map(s => s.id);

function inferBuildingStep(logs: string[]): PipelineStepId {
  const text = logs.join("\n").toLowerCase();
  if (
    text.includes("published") ||
    text.includes("deploying") ||
    text.includes("serving") ||
    text.includes("routing")
  ) {
    return "publish";
  }
  if (
    text.includes("npm run build") ||
    text.includes("compiled") ||
    text.includes("building") ||
    text.includes("vite") ||
    text.includes("next.js")
  ) {
    return "build";
  }
  if (
    text.includes("npm install") ||
    text.includes("installing") ||
    text.includes("added ") ||
    text.includes("pnpm") ||
    text.includes("yarn")
  ) {
    return "install";
  }
  if (text.includes("clon") || text.includes("git ") || text.includes("checkout")) {
    return "clone";
  }
  return "clone";
}

export function currentPipelineStep(
  status?: string,
  logs: string[] = []
): PipelineStepId | null {
  if (!status) return null;
  if (status === "QUEUED") return "queued";
  if (status === "READY" || status === "PAUSED") return "ready";
  if (status === "BUILDING") return inferBuildingStep(logs);
  if (status === "FAILED" || status === "CANCELLED") return inferBuildingStep(logs);
  return "queued";
}

export function pipelineStateFor(
  stepId: PipelineStepId,
  status?: string,
  logs: string[] = []
): PipelineStepState {
  if (!status) return "pending";
  if (status === "CANCELLED" && stepId !== "queued") return "skipped";

  const current = currentPipelineStep(status, logs);
  if (!current) return "pending";

  const stepIndex = ORDER.indexOf(stepId);
  const currentIndex = ORDER.indexOf(current);

  if (status === "READY" || status === "PAUSED") {
    return "done";
  }

  if (status === "FAILED") {
    if (stepIndex < currentIndex) return "done";
    if (stepIndex === currentIndex) return "failed";
    return "pending";
  }

  if (stepIndex < currentIndex) return "done";
  if (stepIndex === currentIndex) return "current";
  return "pending";
}

export function pipelineHeadline(status?: string, logs: string[] = []) {
  const step = PIPELINE_STEPS.find(s => s.id === currentPipelineStep(status, logs));
  if (!status) return { title: "Waiting", body: "Deployment has not started yet." };
  if (status === "READY") return { title: "Live", body: "Build finished. Your frontend is being served." };
  if (status === "PAUSED") return { title: "Paused", body: "The deployment is stopped. Resume to bring it back." };
  if (status === "FAILED") return { title: "Failed", body: step ? `Stopped during ${step.label.toLowerCase()}. Check the logs below.` : "The deployment did not finish." };
  if (status === "CANCELLED") return { title: "Cancelled", body: "This deployment was stopped before it went live." };
  if (status === "QUEUED") return { title: "Queued", body: "You’re in line. A worker will pick this up next." };
  if (step) return { title: step.label, body: step.hint };
  return { title: "Deploying", body: "Follow the steps — we’ll mark each one as it completes." };
}
