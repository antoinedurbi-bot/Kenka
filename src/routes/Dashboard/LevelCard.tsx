import clsx from "clsx";
import type { AxisLevel } from "../../lib/progression";

export function LevelCard({
  axis,
  level,
  kanji,
}: {
  axis: "toji" | "ippo";
  level: AxisLevel;
  kanji: string;
}) {
  const isToji = axis === "toji";
  const accent = isToji ? "text-blood-300" : "text-steel-300";
  const barColor = isToji ? "bg-blood-500" : "bg-steel-400";
  const pipOn = isToji ? "bg-blood-500" : "bg-steel-400";

  return (
    <div className="relative overflow-hidden border border-ink-700 bg-ink-900 px-4 py-4">
      <span
        className="pointer-events-none absolute -right-3 -top-4 select-none font-display text-[88px] leading-none text-ink-800"
        aria-hidden
      >
        {kanji}
      </span>

      <div className="relative">
        <div className="k-label">{isToji ? "Axe I — Toji · Physique" : "Axe II — Ippo · Skills"}</div>

        <div className="mt-2 flex items-baseline gap-2.5">
          <span className={clsx("font-display text-4xl leading-none", accent)}>
            {level.level}
          </span>
          <span className="font-display text-lg uppercase tracking-[0.08em] text-bone-50">
            {level.title}
          </span>
        </div>

        <div className="mt-3 flex gap-1">
          {Array.from({ length: level.levelMax }, (_, i) => (
            <span
              key={i}
              className={clsx("h-1 flex-1", i < level.level ? pipOn : "bg-ink-700")}
            />
          ))}
        </div>

        <div className="mt-2 h-0.5 w-full bg-ink-800">
          <div
            className={clsx("h-full transition-[width] duration-700", barColor)}
            style={{ width: `${level.progress * 100}%` }}
          />
        </div>

        <p className="mt-2.5 font-mono text-[10px] uppercase tracking-[0.1em] text-bone-600">
          {level.detail}
        </p>
      </div>
    </div>
  );
}
