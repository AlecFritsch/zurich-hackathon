"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useHavoc } from "../context/HavocContext";
import Button from "../components/ui/Button";
import { API_URL } from "../lib/config";

interface AssemblyStep {
  PHASE?: number;
  PART_ID?: string;
  ACTION?: string;
  TARGET_LOCATION?: string;
  TOOL?: string;
}

interface AssemblyStatus {
  step_index: number;
  total_steps: number;
  status: string;
  current_step: AssemblyStep | null;
  plan: AssemblyStep[];
  mismatch: string | null;
}

export default function AssemblyPage() {
  const { policy, assemblySequence } = useHavoc();
  const [status, setStatus] = useState<AssemblyStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStatus = useCallback(() => {
    fetch(`${API_URL}/assembly/status`)
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 3000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  const hasPlan = (assemblySequence?.length ?? 0) > 0 || (status?.total_steps ?? 0) > 0;

  if (!policy || policy.status !== "APPROVED") {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          <Link href="/" className="underline" style={{ color: "var(--color-accent-green)" }}>Approve policy</Link> first.
        </p>
      </div>
    );
  }

  if (!hasPlan) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          No assembly plan. Upload a PDF with assembly instructions.
        </p>
      </div>
    );
  }

  const handleStart = async () => {
    setLoading(true);
    try {
      await fetch(`${API_URL}/assembly/start`, { method: "POST" });
      fetchStatus();
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/assembly/execute-step`, { method: "POST" });
      const data = await res.json();
      if (data.status === "handover") {
        fetchStatus();
      } else {
        fetchStatus();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleHandoverDone = async () => {
    setLoading(true);
    try {
      await fetch(`${API_URL}/assembly/handover-done`, { method: "POST" });
      fetchStatus();
    } finally {
      setLoading(false);
    }
  };

  const handleCheckPlacement = async () => {
    setLoading(true);
    try {
      await fetch(`${API_URL}/assembly/check-placement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ use_camera: true }),
      });
      fetchStatus();
    } finally {
      setLoading(false);
    }
  };

  const s = status;
  const step = s?.current_step;
  const isHandover = s?.status === "handover";
  const isComplete = s?.status === "complete";
  const isRunning = s?.status === "running";

  return (
    <div className="flex-1 flex flex-col p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-bold">Assembly</h1>
        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          {s?.step_index ?? 0} / {s?.total_steps ?? 0}
        </span>
      </div>

      {s?.mismatch && (
        <div className="mb-4 p-3 text-sm border" style={{ borderColor: "var(--color-accent-red)", background: "rgba(255,51,51,0.08)", color: "var(--color-accent-red)" }}>
          Notify: Missing/Mismatched parts — {s.mismatch}
        </div>
      )}

      {s?.status === "idle" && (
        <Button onClick={handleStart} disabled={loading} variant="primary" className="w-full py-4">
          Start Assembly
        </Button>
      )}

      {isRunning && step && (
        <div className="space-y-4">
          <div className="border p-4" style={{ borderColor: "var(--color-border)" }}>
            <div className="text-xs space-y-2" style={{ color: "var(--color-text-muted)" }}>
              <div><span>Step {s.step_index + 1}</span></div>
              <div><span>Part</span> <span style={{ color: "var(--color-text)" }}>{step.PART_ID}</span></div>
              <div><span>Action</span> <span style={{ color: "var(--color-text)" }}>{step.ACTION}</span></div>
              <div><span>Target</span> <span style={{ color: "var(--color-text)" }}>{step.TARGET_LOCATION}</span></div>
            </div>
          </div>
          <Button onClick={handleExecute} disabled={loading} variant="primary" className="w-full py-4">
            {loading ? "…" : "Robot Execute"}
          </Button>
        </div>
      )}

      {isHandover && step && (
        <div className="space-y-4">
          <div className="p-4 border" style={{ borderColor: "var(--color-accent-yellow)", background: "rgba(255,204,0,0.08)" }}>
            <p className="text-sm font-medium">Handover to Human</p>
            <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
              {step.PART_ID} → {step.TARGET_LOCATION}
            </p>
          </div>
          <Button onClick={handleHandoverDone} disabled={loading} variant="primary" className="w-full py-4">
            {loading ? "…" : "Human Done"}
          </Button>
        </div>
      )}

      {isRunning && s && s.step_index > 0 && (
        <button
          onClick={handleCheckPlacement}
          disabled={loading}
          className="mt-4 w-full py-2 text-xs uppercase tracking-wider border hover:bg-[var(--color-surface-2)]"
          style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
        >
          {loading ? "…" : "Check Placement"}
        </button>
      )}

      {isComplete && (
        <div className="p-6 text-center border" style={{ borderColor: "var(--color-accent-green)", background: "rgba(0,255,102,0.08)" }}>
          <p className="text-sm font-medium" style={{ color: "var(--color-accent-green)" }}>Process Complete</p>
        </div>
      )}

      {s?.plan && s.plan.length > 0 && (
        <div className="mt-8">
          <div className="text-[11px] uppercase mb-2" style={{ color: "var(--color-text-muted)" }}>Plan</div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {s.plan.map((st, i) => (
              <div
                key={i}
                className="text-xs py-1 flex gap-2"
                style={{ color: i < (s.step_index ?? 0) ? "var(--color-text-muted)" : "var(--color-text)" }}
              >
                <span className="w-6">{i + 1}.</span>
                <span>{st.PART_ID}</span>
                <span style={{ color: "var(--color-accent-green)" }}>→</span>
                <span>{st.TARGET_LOCATION}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
