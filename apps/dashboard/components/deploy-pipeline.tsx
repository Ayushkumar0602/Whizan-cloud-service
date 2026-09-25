import {
  PIPELINE_STEPS,
  pipelineHeadline,
  pipelineStateFor,
} from "@/lib/pipeline";

export function DeployPipeline({
  status,
  logs = [],
  compact = false,
  legend = false,
}: {
  status?: string;
  logs?: string[];
  compact?: boolean;
  legend?: boolean;
}) {
  const headline = legend
    ? {
        title: "Every frontend follows this path",
        body: "When a deploy starts, this tracker lights up so you always know the current step.",
      }
    : pipelineHeadline(status, logs);

  return (
    <div className={`pipeline ${compact ? "pipeline-compact" : ""}`}>
      {!compact && (
        <div className="pipeline-now">
          <div className="pipeline-now-kicker">{legend ? "Deploy path" : "Where you are"}</div>
          <div className="pipeline-now-title">{headline.title}</div>
          <p className="pipeline-now-body">{headline.body}</p>
        </div>
      )}
      <ol className="pipeline-track">
        {PIPELINE_STEPS.map((step, i) => {
          const state = pipelineStateFor(step.id, status, logs);
          return (
            <li key={step.id} className={`pipeline-step pipeline-step-${state}`}>
              <div className="pipeline-node" aria-hidden>
                {state === "done" ? "✓" : state === "failed" ? "!" : i + 1}
              </div>
              {i < PIPELINE_STEPS.length - 1 && <span className="pipeline-line" />}
              <div className="pipeline-copy">
                <div className="pipeline-label">{step.label}</div>
                {!compact && <div className="pipeline-hint">{step.hint}</div>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function WizardSteps({
  steps,
  current,
}: {
  steps: { id: string; label: string; hint: string }[];
  current: number;
}) {
  return (
    <ol className="wizard-track">
      {steps.map((step, i) => {
        const state = i < current ? "done" : i === current ? "current" : "pending";
        return (
          <li key={step.id} className={`wizard-step wizard-step-${state}`}>
            <div className="wizard-index">{i < current ? "✓" : i + 1}</div>
            <div>
              <div className="wizard-label">{step.label}</div>
              <div className="wizard-hint">{step.hint}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
