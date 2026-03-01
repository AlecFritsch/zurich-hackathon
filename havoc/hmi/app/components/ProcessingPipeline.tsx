"use client";

/**
 * Step-by-step pipeline with output per step.
 * Extract (Docling) → Generate (Gemini) → Robot
 */
interface ProcessingPipelineProps {
  step: string;
  message?: string;
  active: boolean;
  assemblyStepCount?: number;
}

const STEPS = [
  { id: "extract", label: "Extract", sub: "Docling", backendSteps: ["parse", "compile"] },
  { id: "generate", label: "Generate", sub: "Gemini", backendSteps: ["assembly"] },
  { id: "robot", label: "Robot", sub: "Ready", backendSteps: ["done"] },
] as const;

function getStepOutput(
  stepId: string,
  isActive: boolean,
  isDone: boolean,
  message: string | undefined,
  assemblyStepCount?: number
): string {
  if (isActive) return message || "…";
  if (isDone) {
    if (stepId === "extract") return "Document parsed, policy compiled";
    if (stepId === "generate") return assemblyStepCount != null ? `${assemblyStepCount} assembly steps` : "Sequence generated";
    if (stepId === "robot") return "Ready";
  }
  return "";
}

export default function ProcessingPipeline({ step, message, active, assemblyStepCount }: ProcessingPipelineProps) {
  if (!active) return null;

  const getStepState = (stepId: string) => {
    const idx = STEPS.findIndex((s) => s.id === stepId);
    if (step === "done") return { done: true, active: false };
    const effectiveStep = step || (message?.toLowerCase().includes("starting") ? "parse" : "");
    const currentIdx = STEPS.findIndex((s) => (s.backendSteps as readonly string[]).includes(effectiveStep));
    if (currentIdx < 0) return { done: false, active: idx === 0 && active };
    if (idx < currentIdx) return { done: true, active: false };
    if (idx === currentIdx) return { done: false, active: true };
    return { done: false, active: false };
  };

  const currentStepNum = step === "done" ? 3 : STEPS.findIndex((s) => (s.backendSteps as readonly string[]).includes(step || "")) + 1 || 1;

  return (
    <div className="w-full space-y-4">
      <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--color-text-muted)" }}>
        Step {currentStepNum} of 3
      </div>
      <div className="space-y-3">
        {STEPS.map((s, i) => {
          const { done, active: isActive } = getStepState(s.id);
          const output = getStepOutput(s.id, isActive, done, isActive ? message : undefined, done ? assemblyStepCount : undefined);
          const showOutput = output.length > 0;

          return (
            <div
              key={s.id}
              className="border rounded-sm overflow-hidden"
              style={{
                borderColor: isActive ? "var(--color-accent-green)" : done ? "var(--color-accent-green)" : "var(--color-border)",
                background: isActive ? "rgba(0,255,102,0.06)" : done ? "rgba(0,255,102,0.03)" : "var(--color-surface)",
              }}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <span
                  className="w-7 h-7 flex items-center justify-center text-xs font-bold rounded-full shrink-0"
                  style={{
                    color: isActive ? "var(--color-accent-green)" : done ? "var(--color-accent-green)" : "var(--color-text-muted)",
                    background: isActive ? "rgba(0,255,102,0.15)" : done ? "rgba(0,255,102,0.1)" : "var(--color-surface)",
                  }}
                >
                  {done ? "✓" : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium" style={{ color: isActive ? "var(--color-text)" : done ? "var(--color-text-muted)" : "var(--color-text-muted)" }}>
                    {s.label}
                  </div>
                  <div className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                    {s.sub}
                  </div>
                </div>
              </div>
              {showOutput && output && (
                <div
                  className="px-4 pb-3 pt-0 pl-14"
                >
                  <div
                    className="text-xs py-2 px-3 rounded"
                    style={{
                      background: "var(--color-bg)",
                      color: "var(--color-text-muted)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {output}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
