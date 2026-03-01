"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useHavoc } from "../context/HavocContext";
import Button from "../components/ui/Button";
import type { InspectionResult } from "../lib/types";

const SNAPSHOT_URL = "/api/camera/snapshot";
const POLL_MS = 34;

export default function InspectPage() {
  const { lastResult, handleInspect, handleVerify, isInspecting, policy, verification } = useHavoc();
  const policyActive = policy?.status === "APPROVED";

  const [streamError, setStreamError] = useState(false);
  const [frameDataUrl, setFrameDataUrl] = useState<string | null>(null);
  const errorCountRef = useRef(0);
  const maxErrors = 10;

  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      if (!mounted) return;
      try {
        const res = await fetch(SNAPSHOT_URL, { cache: "no-store" });
        if (!res.ok) throw new Error(`Snapshot ${res.status}`);
        const data = await res.json();
        const b64 = data?.image_base64;
        if (b64) {
          setFrameDataUrl(`data:image/jpeg;base64,${b64}`);
          setStreamError(false);
          errorCountRef.current = 0;
        } else {
          throw new Error("No image");
        }
      } catch {
        errorCountRef.current++;
        if (errorCountRef.current >= maxErrors) setStreamError(true);
      }
      if (mounted) timer = setTimeout(poll, POLL_MS);
    }

    poll();
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [streamError]);

  if (!policyActive) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          <Link href="/" className="underline" style={{ color: "var(--color-accent-green)" }}>Approve policy</Link> first.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex p-6 lg:p-8 gap-6">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="aspect-video relative bg-black flex-1 min-h-0">
                {!streamError && frameDataUrl ? (
                  <img
                    src={frameDataUrl}
                    alt="Camera"
                    className="w-full h-full object-contain"
                    onError={() => setStreamError(true)}
                  />
                ) : streamError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                    <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>No camera</span>
                    <button className="text-xs px-3 py-1 border" style={{ borderColor: "var(--color-border)" }} onClick={() => { errorCountRef.current = 0; setStreamError(false); }}>Retry</button>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ color: "var(--color-text-muted)" }}>
                    Connecting…
                  </div>
                )}
                {isInspecting && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="border-2 w-16 h-16 animate-pulse" style={{ borderColor: "var(--color-accent-green)" }} />
                  </div>
                )}
        </div>
        {verification && !verification.available && verification.missing.length > 0 && (
          <div className="mt-4 p-3 text-sm border" style={{ borderColor: "var(--color-accent-red)", background: "rgba(255,51,51,0.08)", color: "var(--color-accent-red)" }}>
            Notify: Missing components — {verification.missing.join(", ")}
          </div>
        )}
        <div className="flex gap-2 mt-4">
          <button
            onClick={handleVerify}
            className="flex-1 py-3 text-xs uppercase tracking-wider border hover:bg-[var(--color-surface-2)]"
            style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
          >
            Verify
          </button>
          <Button onClick={handleInspect} disabled={isInspecting} variant="primary" className="flex-1 py-4">
            {isInspecting ? "Inspecting…" : "Inspect"}
          </Button>
        </div>
      </div>
      {lastResult && (
        <div className="w-64 shrink-0">
          <InspectionResultCard result={lastResult} />
        </div>
      )}
    </div>
  );
}

function InspectionResultCard({ result }: { result: InspectionResult }) {
  const r = result;
  return (
    <div className="border p-4" style={{ borderColor: "var(--color-border)" }}>
      <div className="text-xs space-y-2" style={{ color: "var(--color-text-muted)" }}>
        <div className="flex justify-between"><span>Color</span><span style={{ color: "var(--color-text)" }}>{r.classification.color}</span></div>
        <div className="flex justify-between"><span>Size</span><span style={{ color: "var(--color-text)" }}>{r.classification.size_mm}mm</span></div>
        <div className="flex justify-between"><span>Defect</span><span style={{ color: r.defect_inspection.defect_detected ? "var(--color-accent-red)" : "var(--color-accent-green)" }}>{r.defect_inspection.defect_detected ? "Yes" : "No"}</span></div>
      </div>
      <div className="mt-4 pt-4 border-t flex justify-between items-center" style={{ borderColor: "var(--color-border)" }}>
        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>→</span>
        <span className="font-bold">{r.decision.target_bin}</span>
      </div>
    </div>
  );
}
