"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useHavoc } from "./context/HavocContext";
import Button from "./components/ui/Button";

const ACCEPT = ".pdf,.docx,.pptx,.png,.jpg,.jpeg,.tiff,.md";

export default function SetupPage() {
  const { policy, uploadError, processingStep, handleUpload, handleApprove, handleReject } = useHavoc();
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const onFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files;
    if (f?.length) setSelectedFiles(Array.from(f).filter((x) => x.name && x.size > 0));
  }, []);

  const processFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    for (const file of files) {
      await handleUpload(file);
    }
    setUploading(false);
  }, [handleUpload]);

  const onUpload = useCallback(() => {
    if (selectedFiles.length === 0) return;
    processFiles(selectedFiles);
    setSelectedFiles([]);
  }, [selectedFiles, processFiles]);

  const onDrop = useCallback((files: FileList | File[]) => {
    setSelectedFiles(Array.from(files).filter((f) => f.name && f.size > 0));
  }, []);

  if (policy?.status === "APPROVED") {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>Ready.</p>
          <div className="flex gap-4 justify-center">
            <Link href="/inspect"><Button variant="primary" className="px-8 py-3">Inspect</Button></Link>
            <label className="cursor-pointer">
              <span className="inline-block px-8 py-3 text-xs uppercase tracking-wider border hover:bg-[var(--color-surface-2)]" style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}>Upload new</span>
              <input type="file" className="hidden" multiple accept={ACCEPT} onChange={(e) => { const f = e.target.files; if (f?.length) processFiles(Array.from(f)); e.target.value = ""; }} />
            </label>
          </div>
          {uploadError && <p className="mt-4 text-sm" style={{ color: "var(--color-accent-red)" }}>{uploadError}</p>}
        </div>
      </div>
    );
  }

  if (policy?.status === "REJECTED") {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>Rejected.</p>
          <label className="cursor-pointer">
            <Button variant="primary" className="px-8 py-3">Upload</Button>
            <input type="file" className="hidden" multiple accept={ACCEPT} onChange={(e) => { const f = e.target.files; if (f?.length) processFiles(Array.from(f)); e.target.value = ""; }} />
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        {policy?.status === "DRAFT" ? (
          <div className="space-y-6">
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>{policy.source_documents?.[0]?.document_name || "Document"} · {policy.decision_rules.length} rules</p>
            <div className="flex gap-4">
              <Button onClick={() => handleApprove(policy.policy_id)} variant="primary" className="flex-1 py-3">Approve</Button>
              <Button onClick={() => handleReject(policy.policy_id)} variant="danger" className="flex-1 py-3">Reject</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <label className="block cursor-pointer">
              <div
                className="border-2 border-dashed p-8 text-center transition-colors"
                style={{
                  borderColor: dragging ? "var(--color-accent-green)" : "var(--color-border)",
                  background: dragging ? "rgba(0,255,102,0.04)" : "transparent",
                }}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) onDrop(e.dataTransfer.files); }}
              >
                <p className="text-sm">Drop or click to select</p>
                <p className="text-[11px] mt-1" style={{ color: "var(--color-text-muted)" }}>PDF, DOCX, PNG, JPG</p>
              </div>
              <input type="file" className="hidden" multiple accept={ACCEPT} onChange={onFileSelect} />
            </label>
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <div className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>{selectedFiles.length} file(s)</div>
                <ul className="text-xs space-y-1 max-h-20 overflow-y-auto">
                  {selectedFiles.map((f, i) => (
                    <li key={i} className="truncate" style={{ color: "var(--color-text)" }}>{f.name}</li>
                  ))}
                </ul>
                <Button onClick={onUpload} disabled={uploading} variant="primary" className="w-full py-2">
                  {uploading ? processingStep || "Processing…" : "Upload"}
                </Button>
              </div>
            )}
          </div>
        )}
        {uploadError && <p className="mt-4 text-sm text-center" style={{ color: "var(--color-accent-red)" }}>{uploadError}</p>}
      </div>
    </div>
  );
}
