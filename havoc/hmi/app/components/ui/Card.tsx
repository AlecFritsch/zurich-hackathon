"use client";

interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export default function Card({ title, children, className = "", style: customStyle }: CardProps) {
  return (
    <div
      className={`border p-4 ${className}`}
      style={{ borderColor: "var(--color-border)", background: "var(--color-surface)", ...customStyle }}
    >
      {title && (
        <div className="text-[10px] uppercase tracking-widest mb-3" style={{ color: "var(--color-text-muted)" }}>
          {title}
        </div>
      )}
      {children}
    </div>
  );
}
