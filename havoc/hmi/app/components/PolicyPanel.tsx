"use client";

import { useCallback, useState } from "react";
import { ExecutablePolicy } from "../lib/types";

interface AssemblyStep {
  PHASE: number;
  PART_ID: string;
  ACTION: string;
  TARGET_LOCATION: string;
  TOOL: string;
}

interface PolicyPanelProps {
  policy: ExecutablePolicy | null;
  assemblySequence?: AssemblyStep[] | null;
  assemblyError?: string | null;
  uploadError?: string | null;
  processingStep?: string;
  onUpload: (file: File) => Promise<void>;
  onApprove: (policyId: string) => void;
  onReject: (policyId: string) => void;
}

export default function PolicyPanel({ policy, assemblySequence, assemblyError, uploadError, processingStep, onUpload, onApprove, onReject }: PolicyPanelProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        setUploading(true);
        setUploadedFile(file.name);
        try {
          await onUpload(file);
        } finally {
          setUploading(false);
        }
      }
    },
    [onUpload]
  );

  const handleFileInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setUploading(true);
        setUploadedFile(file.name);
        try {
          await onUpload(file);
        } finally {
          setUploading(false);
        }
      }
    },
    [onUpload]
  );

  return (
    <div className="p-4 border-b flex flex-col gap-3" style={{ borderColor: "var(--color-border)" }}>
      <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--color-text-muted)" }}>
        Document Input
      </div>

      <div
        className="border border-dashed p-6 text-center cursor-pointer transition-colors"
        style={{
          borderColor: dragging
            ? "var(--color-accent-green)"
            : uploading
              ? "var(--color-accent-yellow)"
              : "var(--color-border)",
          background: dragging ? "rgba(0,255,102,0.03)" : "transparent",
          color: uploading ? "var(--color-accent-yellow)" : "var(--color-text-muted)",
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <div className="text-[10px] uppercase tracking-widest">
          {uploading ? (processingStep || `Processing ${uploadedFile}...`) : "Drop Document"}
        </div>
        <div className="text-[10px] mt-1" style={{ color: "var(--color-text-muted)" }}>
          {uploading ? "PDF kann 1–2 Min. dauern…" : "PDF, DOCX, PPTX, Image"}
        </div>
        <input
          id="file-input"
          type="file"
          className="hidden"
          onChange={handleFileInput}
          accept=".pdf,.docx,.pptx,.png,.jpg,.jpeg,.tiff,.md"
        />
      </div>

      {uploadError && (
        <div className="text-[10px] p-2" style={{ color: "var(--color-accent-red)", background: "rgba(255,51,51,0.1)" }}>
          {uploadError}
        </div>
      )}

      {policy && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest" style={{ color: "var(--color-text-muted)" }}>
              Active Policy
            </span>
            <StatusBadge status={policy.status} />
          </div>

          <div className="text-[10px] font-medium" style={{ color: "var(--color-text-muted)" }}>
            {policy.policy_id}
            <span className="ml-2">v{policy.version}</span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <MiniStat label="Rules" value={policy.decision_rules.length.toString()} />
            <MiniStat label="Safety" value={policy.safety_constraints.length.toString()} />
            <MiniStat label="Assembly" value={assemblySequence?.length ? `${assemblySequence.length}` : assemblyError ? "Fehler" : "—"} title={assemblyError || undefined} />
          </div>

          {assemblySequence && assemblySequence.length > 0 && (
            <div className="space-y-1 max-h-24 overflow-y-auto">
              <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--color-accent-green)" }}>
                Assembly Sequence (auto)
              </div>
              {assemblySequence.slice(0, 5).map((s, i) => (
                <div key={i} className="text-[10px] truncate" style={{ color: "var(--color-text-muted)" }}>
                  P{s.PHASE}: {s.PART_ID} → {s.TARGET_LOCATION}
                </div>
              ))}
              {assemblySequence.length > 5 && (
                <div className="text-[9px]" style={{ color: "var(--color-text-muted)" }}>
                  +{assemblySequence.length - 5} more
                </div>
              )}
            </div>
          )}

          {policy.status === "DRAFT" && (
            <div className="flex gap-2">
              <button
                onClick={() => onApprove(policy.policy_id)}
                className="flex-1 py-2 text-[10px] uppercase tracking-widest border font-bold transition-colors hover:bg-[var(--color-accent-green)] hover:text-black"
                style={{
                  borderColor: "var(--color-accent-green)",
                  color: "var(--color-accent-green)",
                  background: "transparent",
                }}
              >
                Approve
              </button>
              <button
                onClick={() => onReject(policy.policy_id)}
                className="flex-1 py-2 text-[10px] uppercase tracking-widest border transition-colors hover:bg-[var(--color-accent-red)] hover:text-black"
                style={{
                  borderColor: "var(--color-accent-red)",
                  color: "var(--color-accent-red)",
                  background: "transparent",
                }}
              >
                Reject
              </button>
            </div>
          )}

          {policy.decision_rules.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--color-text-muted)" }}>
                Decision Rules
              </div>
              {policy.decision_rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center gap-2 text-[11px] py-0.5 border-l-2 pl-2"
                  style={{ borderColor: rule.action === "REJECT" ? "var(--color-accent-red)" : "var(--color-accent-green)" }}
                >
                  <span className="shrink-0 w-14" style={{ color: "var(--color-text-muted)" }}>
                    {rule.id}
                  </span>
                  <span className="flex-1 truncate">{rule.condition}</span>
                  <span style={{ color: "var(--color-accent-green)" }}>→</span>
                  <span className="shrink-0 font-medium">
                    {rule.target_bin}
                  </span>
                </div>
              ))}
            </div>
          )}

          {policy.safety_constraints.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--color-text-muted)" }}>
                Safety Constraints
              </div>
              {policy.safety_constraints.map((c) => (
                <div key={c.id} className="text-[11px] flex gap-2" style={{ color: "var(--color-accent-yellow)" }}>
                  <span>⚠</span>
                  <span>{c.parameter} {c.operator} {c.value}{c.unit}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    DRAFT: "var(--color-accent-yellow)",
    APPROVED: "var(--color-accent-green)",
    SUSPENDED: "var(--color-accent-red)",
    REJECTED: "var(--color-accent-red)",
  };
  return (
    <span
      className="text-[10px] uppercase tracking-widest px-2 py-0.5 border"
      style={{ borderColor: colors[status] || "var(--color-text-muted)", color: colors[status] || "var(--color-text-muted)" }}
    >
      {status}
    </span>
  );
}

function MiniStat({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="border p-2" style={{ borderColor: "var(--color-border)" }} title={title}>
      <div className="text-sm font-bold tabular-nums">{value}</div>
      <div className="text-[9px] uppercase tracking-widest" style={{ color: "var(--color-text-muted)" }}>
        {label}
      </div>
    </div>
  );
}
