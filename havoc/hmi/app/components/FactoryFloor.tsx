"use client";

interface BinData {
  id: string;
  count: number;
  color: string;
}

interface FactoryFloorProps {
  bins: BinData[];
  totalInspected: number;
  passRate: number;
  avgConfidence: number;
  lastAnimation?: { target?: string; part_color?: string } | null;
}

const BIN_META: Record<string, { label: string; accent: string }> = {
  BIN_A: { label: "A", accent: "var(--color-accent-red)" },
  BIN_B: { label: "B", accent: "var(--color-accent-blue)" },
  BIN_C: { label: "C", accent: "var(--color-accent-green)" },
  REJECT_BIN: { label: "REJ", accent: "var(--color-accent-red)" },
};

export default function FactoryFloor({
  bins,
  totalInspected,
  passRate,
  avgConfidence,
  lastAnimation,
}: FactoryFloorProps) {
  const activeBin = lastAnimation?.target;

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <span
          className="text-[10px] uppercase tracking-widest"
          style={{ color: "var(--color-text-muted)" }}
        >
          Pipeline
        </span>
        <span
          className="text-[10px] uppercase tracking-widest tabular-nums"
          style={{ color: totalInspected > 0 ? "var(--color-accent-green)" : "var(--color-text-muted)" }}
        >
          {totalInspected > 0 ? "ACTIVE" : "IDLE"}
        </span>
      </div>

      <div className="flex items-stretch gap-2 flex-1 min-h-0">
        <FlowNode label="CAM" sub="ZED 2i" />
        <Arrow />
        <FlowNode label="INSPECT" sub="Gemini ER" highlight />
        <Arrow />

        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          {bins.map((bin) => {
            const meta = BIN_META[bin.id] || { label: bin.id, accent: "var(--color-text-muted)" };
            const isActive = activeBin === bin.id;
            const isReject = bin.id === "REJECT_BIN";

            return (
              <div
                key={bin.id}
                className="flex items-center gap-2 border px-2.5 py-1.5 transition-all duration-300"
                style={{
                  borderColor: isActive ? meta.accent : "var(--color-border)",
                  background: isActive ? `${meta.accent}08` : "transparent",
                }}
              >
                <div
                  className="w-1.5 h-1.5 shrink-0"
                  style={{ background: meta.accent }}
                />
                <span
                  className="text-[10px] font-bold uppercase tracking-wider flex-1"
                  style={{ color: isReject ? meta.accent : "var(--color-text)" }}
                >
                  {meta.label}
                </span>
                <span
                  className="text-xs font-bold tabular-nums"
                  style={{ color: bin.count > 0 ? "var(--color-text)" : "var(--color-text-muted)" }}
                >
                  {bin.count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-3 border-t pt-3" style={{ borderColor: "var(--color-border)" }}>
        <Metric label="Inspected" value={totalInspected.toString()} />
        <Metric
          label="Pass Rate"
          value={totalInspected > 0 ? `${(passRate * 100).toFixed(0)}%` : "—"}
          color={passRate >= 0.9 ? "var(--color-accent-green)" : passRate >= 0.7 ? "var(--color-accent-yellow)" : undefined}
        />
        <Metric
          label="Avg Conf"
          value={totalInspected > 0 ? `${(avgConfidence * 100).toFixed(0)}%` : "—"}
        />
      </div>
    </div>
  );
}

function FlowNode({ label, sub, highlight }: { label: string; sub?: string; highlight?: boolean }) {
  return (
    <div
      className="border flex flex-col items-center justify-center px-3 shrink-0"
      style={{
        borderColor: highlight ? "var(--color-accent-green)" : "var(--color-border)",
        minWidth: "64px",
      }}
    >
      <span
        className="text-[10px] font-bold uppercase tracking-wider"
        style={{ color: highlight ? "var(--color-accent-green)" : "var(--color-text)" }}
      >
        {label}
      </span>
      {sub && (
        <span className="text-[8px] uppercase tracking-wider mt-0.5" style={{ color: "var(--color-text-muted)" }}>
          {sub}
        </span>
      )}
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex items-center shrink-0" style={{ color: "var(--color-text-muted)" }}>
      <div className="w-4 h-px" style={{ background: "var(--color-border)" }} />
      <span className="text-[10px]">&gt;</span>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="text-center">
      <div className="text-lg font-bold tabular-nums" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="text-[9px] uppercase tracking-widest" style={{ color: "var(--color-text-muted)" }}>
        {label}
      </div>
    </div>
  );
}
