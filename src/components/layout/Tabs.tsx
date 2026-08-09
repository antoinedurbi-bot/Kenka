import clsx from "clsx";

export function Tabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <div className="mb-5 flex gap-0 overflow-x-auto border-b border-ink-800">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={clsx(
            "shrink-0 border-b-2 px-3 py-2 font-display text-xs uppercase tracking-[0.12em] transition-colors",
            value === opt.value
              ? "border-blood-500 text-bone-50"
              : "border-transparent text-bone-600 hover:text-bone-200",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
