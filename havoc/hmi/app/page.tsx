"use client";

import { useCallback, useState } from "react";
import { useHavoc } from "./context/HavocContext";
import Button from "./components/ui/Button";
import ProcessingPipeline from "./components/ProcessingPipeline";

const ACCEPT = ".pdf,.docx,.pptx,.png,.jpg,.jpeg,.tiff,.md";

export default function StepBasedPage() {
  const { policy, uploadError, processingStep, processingStepId, handleUpload, handleApprove, handleReject, assemblySequence } = useHavoc();
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const processFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    for (const file of files) {
      await handleUpload(file);
    }
    setUploading(false);
  }, [handleUpload]);

  const isProcessing = uploading || !!processingStep;

  // ─── Step 1: Upload ─────────────────────────────────────────────────────
  const renderUpload = () => (
    <div className="w-full max-w-md space-y-6">
      <label className="block cursor-pointer">
        <div
          className="border-2 border-dashed p-8 text-center transition-colors"
          style={{
            borderColor: dragging ? "var(--color-accent-green)" : "var(--color-border)",
            background: dragging ? "rgba(0,255,102,0.04)" : "var(--color-surface)",
          }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const files = e.dataTransfer.files;
            if (files.length) processFiles(Array.from(files));
          }}
        >
          <p className="text-sm">Drop or click to select</p>
          <p className="text-[11px] mt-1" style={{ color: "var(--color-text-muted)" }}>PDF, DOCX, PNG, JPG</p>
        </div>
        <input type="file" className="hidden" multiple accept={ACCEPT} onChange={(e) => { const f = e.target.files; if (f?.length) processFiles(Array.from(f)); e.target.value = ""; }} />
      </label>
      {isProcessing && (
        <ProcessingPipeline
          step={processingStepId}
          message={processingStep || undefined}
          active={true}
          assemblyStepCount={assemblySequence?.length}
        />
      )}
    </div>
  );

  // Approve-Bar nur bei DRAFT, sonst nur Upload
  const showApproveBar = policy?.status === "DRAFT";

  // ─── Main render: nur Upload-Input ───────────────────────────────────────
  let content: React.ReactNode = renderUpload();
  if (showApproveBar) {
    content = (
      <div className="w-full max-w-md space-y-4">
        <div className="flex gap-3 p-3 rounded border" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
          <span className="text-xs flex-1 truncate" style={{ color: "var(--color-text-muted)" }}>{policy?.source_documents?.[0]?.document_name || "Document"}</span>
          <Button onClick={() => policy && handleApprove(policy.policy_id)} variant="primary" className="shrink-0 py-2 px-3 text-xs">Approve</Button>
          <Button onClick={() => policy && handleReject(policy.policy_id)} variant="danger" className="shrink-0 py-2 px-3 text-xs">Reject</Button>
        </div>
        {renderUpload()}
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        {content}
        {uploadError && <p className="mt-4 text-sm text-center" style={{ color: "var(--color-accent-red)" }}>{uploadError}</p>}
      </div>
    </div>
  );
}
