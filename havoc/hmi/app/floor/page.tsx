"use client";

import Link from "next/link";
import { useHavoc } from "../context/HavocContext";
import DoclingTraceView from "../components/DoclingTraceView";

const BINS = [
  { id: "BIN_A", label: "A", color: "var(--color-accent-red)" },
  { id: "BIN_B", label: "B", color: "var(--color-accent-blue)" },
  { id: "BIN_C", label: "C", color: "var(--color-accent-green)" },
  { id: "REJECT_BIN", label: "Rej", color: "var(--color-accent-red)" },
];

export default function FloorPage() {
  const { bins, stats, lastAnimation, events, selectedEvent, setSelectedEvent } = useHavoc();
  const activeBin = lastAnimation?.target;

  return (
    <div className="flex-1 flex flex-col min-h-0 p-6 lg:p-8">
      <div className="flex items-center gap-6 mb-6">
        {BINS.map(({ id, label, color }) => {
          const bin = bins.find((b) => b.id === id);
          const count = bin?.count ?? 0;
          const active = activeBin === id;
          return (
            <div key={id} className="flex items-center gap-2 px-4 py-2 border" style={{ borderColor: active ? color : "var(--color-border)", background: active ? `${color}20` : "var(--color-surface)" }}>
              <span className="w-2 h-2" style={{ background: color }} />
              <span className="text-sm font-medium">{label}</span>
              <span className="text-lg font-bold tabular-nums">{count}</span>
            </div>
          );
        })}
        <div className="flex gap-6 ml-auto">
          <span className="text-sm font-bold tabular-nums">{stats.total}</span>
          <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>inspected</span>
          <span className="text-sm font-bold tabular-nums" style={{ color: stats.passRate >= 0.9 ? "var(--color-accent-green)" : undefined }}>
            {stats.total > 0 ? `${(stats.passRate * 100).toFixed(0)}%` : "—"}
          </span>
          <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>pass</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto border" style={{ borderColor: "var(--color-border)" }}>
        {events.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No inspections yet</p>
            <Link href="/" className="text-xs mt-2 inline-block underline" style={{ color: "var(--color-accent-green)" }}>Setup first</Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left" style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}>
                <th className="px-4 py-2 font-normal">Time</th>
                <th className="px-4 py-2 font-normal">Part</th>
                <th className="px-4 py-2 font-normal">Class</th>
                <th className="px-4 py-2 font-normal">Target</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev, i) => (
                <tr
                  key={i}
                  onClick={() => setSelectedEvent(ev)}
                  className="border-b cursor-pointer hover:bg-[var(--color-surface-2)]"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <td className="px-4 py-2 tabular-nums" style={{ color: "var(--color-text-muted)" }}>{new Date(ev.timestamp).toLocaleTimeString("en-GB", { hour12: false })}</td>
                  <td className="px-4 py-2">{ev.part_id.replace("part-", "#")}</td>
                  <td className="px-4 py-2 flex items-center gap-1">
                    <span className="w-3 h-3 border shrink-0" style={{ backgroundColor: ev.classification.color_hex, borderColor: "var(--color-border)" }} />
                    {ev.classification.color} {ev.classification.size_mm}mm
                  </td>
                  <td className="px-4 py-2 font-medium" style={{ color: ev.decision.action === "REJECT" ? "var(--color-accent-red)" : undefined }}>{ev.decision.target_bin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <DoclingTraceView event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  );
}
