"use client";

import Link from "next/link";
import { useHavoc } from "../context/HavocContext";

export default function AppHeader() {
  const { policy } = useHavoc();
  const canNavigate = policy?.status === "APPROVED";

  return (
    <header className="px-6 py-3 border-b shrink-0 flex items-center justify-between" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
      <Link href="/" className="text-lg font-bold">HAVOC</Link>
      {canNavigate && (
        <nav className="flex gap-4 text-xs">
          <Link href="/inspect" style={{ color: "var(--color-text-muted)" }}>Inspect</Link>
          <Link href="/assembly" style={{ color: "var(--color-text-muted)" }}>Assembly</Link>
        </nav>
      )}
    </header>
  );
}
