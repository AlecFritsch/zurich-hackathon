"use client";

export interface Step {
  id: string;
  label: string;
  done?: boolean;
  active?: boolean;
}

interface StepIndicatorProps {
  steps: Step[];
}

export default function StepIndicator({ steps }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-0 flex-wrap">
      {steps.map((step, i) => (
        <div key={step.id} className="flex items-center">
          <div
            className="flex items-center gap-2 px-3 py-1.5 border"
            style={{
              borderColor: step.active ? "var(--color-accent-green)" : step.done ? "var(--color-accent-green)" : "var(--color-border)",
              background: step.active ? "rgba(0,255,102,0.08)" : step.done ? "rgba(0,255,102,0.04)" : "var(--color-surface)",
            }}
          >
            <span
              className="w-5 h-5 flex items-center justify-center text-[10px] font-bold"
              style={{
                color: step.active ? "var(--color-accent-green)" : step.done ? "var(--color-accent-green)" : "var(--color-text-muted)",
              }}
            >
              {step.done ? "✓" : i + 1}
            </span>
            <span
              className="text-xs font-medium"
              style={{
                color: step.active ? "var(--color-text)" : step.done ? "var(--color-text-muted)" : "var(--color-text-muted)",
              }}
            >
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className="w-4 h-px"
              style={{
                background: step.done ? "var(--color-accent-green)" : "var(--color-border)",
                opacity: step.done ? 0.5 : 1,
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
