import clsx from "clsx";
import { useEffect } from "react";
import type { ReactNode } from "react";

export function Panel({
  children,
  className,
  ...rest
}: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("k-panel", className)} {...rest}>
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="text-[15px] leading-none">{children}</h2>
      {action}
    </div>
  );
}

export function Stat({
  label,
  value,
  unit,
  tone = "bone",
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  tone?: "bone" | "blood" | "steel" | "jade" | "gold";
}) {
  const toneClass = {
    bone: "text-bone-50",
    blood: "text-blood-300",
    steel: "text-steel-300",
    jade: "text-jade-400",
    gold: "text-gold-400",
  }[tone];

  return (
    <div className="border border-ink-700 bg-ink-900 px-3 py-3">
      <div className="k-label">{label}</div>
      <div className={clsx("mt-1.5 font-mono text-2xl leading-none tabular-nums", toneClass)}>
        {value}
        {unit && <span className="ml-1 text-xs text-bone-600">{unit}</span>}
      </div>
    </div>
  );
}

export function Bar({
  value,
  tone = "blood",
  className,
}: {
  value: number;
  tone?: "blood" | "steel" | "jade";
  className?: string;
}) {
  const bg = { blood: "bg-blood-500", steel: "bg-steel-400", jade: "bg-jade-400" }[tone];
  return (
    <div className={clsx("h-1 w-full bg-ink-800", className)}>
      <div
        className={clsx("h-full transition-[width] duration-500", bg)}
        style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
      />
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="k-label block pb-1.5">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-bone-600">{hint}</span>}
    </label>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="k-hatch border border-dashed border-ink-700 px-4 py-8 text-center text-sm text-bone-600">
      {children}
    </div>
  );
}

export function Tag({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "blood" | "steel" | "jade" | "gold";
}) {
  const cls = {
    neutral: "border-ink-600 text-bone-400",
    blood: "border-blood-600 text-blood-300",
    steel: "border-steel-600 text-steel-300",
    jade: "border-jade-400/40 text-jade-400",
    gold: "border-gold-400/40 text-gold-400",
  }[tone];
  return (
    <span
      className={clsx(
        "inline-block border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]",
        cls,
      )}
    >
      {children}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    // Sans ce verrou, le contenu derrière la modale défile sous le doigt sur
    // mobile et la position de lecture est perdue à la fermeture.
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="safe-bottom relative max-h-[88vh] w-full overflow-y-auto border border-ink-700 bg-ink-900 sm:max-w-lg">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-700 bg-ink-900 px-4 py-3">
          <h3 className="text-sm">{title}</h3>
          <button
            onClick={onClose}
            className="px-2 font-mono text-lg leading-none text-bone-600 hover:text-bone-50"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>
        <div className="px-4 py-4">{children}</div>
      </div>
    </div>
  );
}
