"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useHavoc } from "../context/HavocContext";
import Button from "../components/ui/Button";
import { API_URL } from "../lib/config";

function CameraPreview() {
  const [streamError, setStreamError] = useState(false);
  const [frameDataUrl, setFrameDataUrl] = useState<string | null>(null);
  const errorCountRef = useRef(0);
  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      if (!mounted) return;
      try {
        const res = await fetch("/api/camera/snapshot", { cache: "no-store" });
        if (!res.ok) throw new Error("Snapshot");
        const data = await res.json();
        const b64 = data?.image_base64;
        if (b64) {
          setFrameDataUrl(`data:image/jpeg;base64,${b64}`);
          setStreamError(false);
          errorCountRef.current = 0;
        } else throw new Error("No image");
      } catch {
        errorCountRef.current++;
        if (errorCountRef.current >= 10) setStreamError(true);
      }
      if (mounted) timer = setTimeout(poll, 100);
    }
    poll();
    return () => { mounted = false; clearTimeout(timer); };
  }, [streamError]);
  return (
    <div className="aspect-video relative bg-black rounded overflow-hidden">
      {!streamError && frameDataUrl ? (
        <img src={frameDataUrl} alt="Robot" className="w-full h-full object-contain" onError={() => setStreamError(true)} />
      ) : streamError ? (
        <div className="absolute inset-0 flex items-center justify-center" style={{ color: "var(--color-text-muted)" }}>No camera</div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center" style={{ color: "var(--color-text-muted)" }}>Connecting…</div>
      )}
    </div>
  );
}

export default function AssemblyPage() {
  const { policy, assemblySequence } = useHavoc();
  const [status, setStatus] = useState<{ step_index: number; total_steps: number; status: string; current_step: Record<string, unknown> | null; plan: Record<string, unknown>[]; mismatch: string | null } | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStatus = useCallback(() => {
    fetch(`${API_URL}/assembly/status`).then((r) => r.json()).then(setStatus).catch(() => setStatus(null));
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
        <div className="w-full max-w-md space-y-4">
          <Link href="/" className="text-xs" style={{ color: "var(--color-text-muted)" }}>← Back</Link>
          <CameraPreview />
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Approve policy first.</p>
        </div>
      </div>
    );
  }

  if (!hasPlan) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-4">
          <Link href="/" className="text-xs" style={{ color: "var(--color-text-muted)" }}>← Back</Link>
          <CameraPreview />
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No assembly plan. Upload a PDF with assembly instructions.</p>
        </div>
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
      await fetch(`${API_URL}/assembly/execute-step`, { method: "POST" });
      fetchStatus();
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
      await fetch(`${API_URL}/assembly/check-placement`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ use_camera: true }) });
      fetchStatus();
    } finally {
      setLoading(false);
    }
  };

  const s = status;
  const step = s?.current_step as { PART_ID?: string; ACTION?: string; TARGET_LOCATION?: string } | null;
  const isHandover = s?.status === "handover";
  const isComplete = s?.status === "complete";
  const isRunning = s?.status === "running";

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-4">
        <Link href="/" className="text-xs" style={{ color: "var(--color-text-muted)" }}>← Back</Link>
        <CameraPreview />
        <div className="flex justify-between">
          <span className="text-sm font-bold">Assembly</span>
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>{s?.step_index ?? 0} / {s?.total_steps ?? 0}</span>
        </div>
        {s?.mismatch && (
          <div className="p-3 text-sm border" style={{ borderColor: "var(--color-accent-red)", background: "rgba(255,51,51,0.08)", color: "var(--color-accent-red)" }}>
            {s.mismatch}
          </div>
        )}
        {s?.status === "idle" && (
          <Button onClick={handleStart} disabled={loading} variant="primary" className="w-full py-4">Start Assembly</Button>
        )}
        {isRunning && step && (
          <>
            <div className="border p-4" style={{ borderColor: "var(--color-border)" }}>
              <div className="text-xs space-y-2" style={{ color: "var(--color-text-muted)" }}>
                <div><span>Part</span> <span style={{ color: "var(--color-text)" }}>{step.PART_ID}</span></div>
                <div><span>Action</span> <span style={{ color: "var(--color-text)" }}>{step.ACTION}</span></div>
                <div><span>Target</span> <span style={{ color: "var(--color-text)" }}>{step.TARGET_LOCATION}</span></div>
              </div>
            </div>
            <Button onClick={handleExecute} disabled={loading} variant="primary" className="w-full py-4">{loading ? "…" : "Robot Execute"}</Button>
            {s && s.step_index > 0 && (
              <button onClick={handleCheckPlacement} disabled={loading} className="w-full py-2 text-xs uppercase tracking-wider border" style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}>Check Placement</button>
            )}
          </>
        )}
        {isHandover && step && (
          <>
            <div className="p-4 border" style={{ borderColor: "var(--color-accent-yellow)", background: "rgba(255,204,0,0.08)" }}>
              <p className="text-sm font-medium">Handover to Human</p>
              <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>{step.PART_ID} → {step.TARGET_LOCATION}</p>
            </div>
            <Button onClick={handleHandoverDone} disabled={loading} variant="primary" className="w-full py-4">{loading ? "…" : "Human Done"}</Button>
          </>
        )}
        {isComplete && (
          <div className="p-6 text-center border" style={{ borderColor: "var(--color-accent-green)", background: "rgba(0,255,102,0.08)" }}>
            <p className="text-sm font-medium" style={{ color: "var(--color-accent-green)" }}>Process Complete</p>
          </div>
        )}
        {s?.plan && s.plan.length > 0 && (
          <div className="mt-4">
            <div className="text-[11px] uppercase mb-2" style={{ color: "var(--color-text-muted)" }}>Plan</div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {s.plan.map((st: Record<string, unknown>, i: number) => (
                <div key={i} className="text-xs py-1 flex gap-2" style={{ color: i < (s.step_index ?? 0) ? "var(--color-text-muted)" : "var(--color-text)" }}>
                  <span className="w-6">{i + 1}.</span>
                  <span>{String(st.PART_ID ?? "")}</span>
                  <span style={{ color: "var(--color-accent-green)" }}>→</span>
                  <span>{String(st.TARGET_LOCATION ?? "")}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
