"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Setup" },
  { href: "/inspect", label: "Inspect" },
  { href: "/floor", label: "Results" },
  { href: "/qa", label: "QA" },
];

export default function LayoutNav() {
  const pathname = usePathname();

  return (
    <aside className="w-12 shrink-0 flex flex-col border-r py-3" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
      <Link href="/" className="py-2 text-center text-base font-bold">H</Link>
      <nav className="flex flex-col mt-2">
        {NAV.map(({ href, label }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className="py-2.5 text-[11px] text-center"
              style={{ color: active ? "var(--color-accent-green)" : "var(--color-text-muted)" }}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
