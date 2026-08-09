import clsx from "clsx";
import type { AxisLevel } from "../../lib/progression";
import { InkSplash, ProgressRing } from "../../components/illustrations/Motifs";

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
  const accentText = isToji ? "text-blood-300" : "text-steel-300";
  const ringColor = isToji ? "#c8323f" : "#6f8894";
  const glow = isToji ? "k-glow-blood" : "k-glow-steel";
  const gradText = isToji ? "k-grad-blood" : "k-grad-steel";
  const pipOn = isToji ? "bg-blood-500" : "bg-steel-400";

  return (
    <div className="k-shine relative overflow-hidden border border-ink-700 bg-ink-900 px-4 py-4">
      <div
        className={clsx("k-anim-pulse pointer-events-none absolute -right-10 -top-10 h-40 w-40 blur-2xl", glow)}
        aria-hidden
      />
      <InkSplash
        className="pointer-events-none absolute -right-6 -top-8 h-32 w-32 text-ink-800"
        color="currentColor"
      />

      <div className="relative flex items-center gap-4">
        <ProgressRing progress={level.progress} color={ringColor} size={72} strokeWidth={5}>
          <span className={clsx("font-display text-2xl leading-none", gradText)}>{level.level}</span>
        </ProgressRing>

        <div className="min-w-0 flex-1">
          <div className="k-label">{isToji ? "Axe I — Toji · Physique" : "Axe II — Ippo · Skills"}</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-lg uppercase tracking-[0.08em] text-bone-50">
              {level.title}
            </span>
            <span className={clsx("font-display text-sm opacity-70", accentText)} aria-hidden>
              {kanji}
            </span>
          </div>

          <div className="mt-2.5 flex gap-1">
            {Array.from({ length: level.levelMax }, (_, i) => (
              <span key={i} className={clsx("h-1 flex-1 rounded-full", i < level.level ? pipOn : "bg-ink-700")} />
            ))}
          </div>
        </div>
      </div>

      <p className="relative mt-3 font-mono text-[10px] uppercase tracking-[0.1em] text-bone-600">
        {level.detail}
      </p>
    </div>
  );
}
