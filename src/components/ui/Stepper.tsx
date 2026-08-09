import clsx from "clsx";

/**
 * Saisie au pouce : incrémenter bat toujours taper un nombre au clavier après
 * une séance. Le champ reste éditable pour les valeurs éloignées.
 */
export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 999,
  suffix,
  ghost,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  /** Valeur affichée en filigrane quand le champ est vide (dernière séance). */
  ghost?: number;
  ariaLabel: string;
}) {
  const current = value === "" ? (ghost ?? 0) : Number(value);

  const bump = (delta: number) => {
    const next = Math.max(min, Math.min(max, Math.round((current + delta) * 100) / 100));
    onChange(String(next));
  };

  return (
    <div className="flex items-stretch border border-ink-700 bg-ink-950">
      <button
        type="button"
        onClick={() => bump(-step)}
        aria-label={`${ariaLabel} : diminuer`}
        className="w-9 shrink-0 font-mono text-base text-bone-400 active:bg-ink-800"
      >
        −
      </button>
      <div className="relative flex-1">
        <input
          type="number"
          inputMode="decimal"
          step={step}
          value={value}
          aria-label={ariaLabel}
          onChange={(e) => onChange(e.target.value)}
          placeholder={ghost !== undefined ? String(ghost) : ""}
          className={clsx(
            // Réserve symétrique de chaque côté : sans elle, une valeur à deux
            // ou trois chiffres vient toucher le suffixe.
            "w-full bg-transparent px-6 py-2 text-center font-mono tabular-nums outline-none",
            value === "" ? "placeholder:text-ink-500" : "text-bone-50",
          )}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 font-mono text-[9px] text-bone-600">
            {suffix}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => bump(step)}
        aria-label={`${ariaLabel} : augmenter`}
        className="w-9 shrink-0 font-mono text-base text-bone-400 active:bg-ink-800"
      >
        +
      </button>
    </div>
  );
}
