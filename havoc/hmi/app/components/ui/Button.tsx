"use client";

import Link from "next/link";

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  className?: string;
}

export default function Button({
  children,
  onClick,
  href,
  variant = "primary",
  disabled = false,
  className = "",
}: ButtonProps) {
  const base = "px-4 py-2 text-xs font-medium uppercase tracking-widest border transition-colors inline-block text-center";
  const variants = {
    primary: {
      border: "var(--color-accent-green)",
      color: "var(--color-accent-green)",
      hover: "hover:bg-[var(--color-accent-green)] hover:text-black",
    },
    secondary: {
      border: "var(--color-border)",
      color: "var(--color-text-muted)",
      hover: "hover:bg-[var(--color-surface-2)]",
    },
    danger: {
      border: "var(--color-accent-red)",
      color: "var(--color-accent-red)",
      hover: "hover:bg-[var(--color-accent-red)] hover:text-black",
    },
    ghost: {
      border: "var(--color-border)",
      color: "var(--color-text)",
      hover: "hover:bg-[var(--color-surface-2)]",
    },
  };
  const v = variants[variant];
  const style = {
    borderColor: disabled ? "var(--color-border)" : v.border,
    color: disabled ? "var(--color-text-muted)" : v.color,
    background: "transparent",
    cursor: disabled ? "not-allowed" : "pointer",
  };

  const cn = `${base} ${!disabled ? v.hover : ""} ${className}`;

  if (href && !disabled) {
    return (
      <Link href={href} className={cn} style={style}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cn} style={style}>
      {children}
    </button>
  );
}
