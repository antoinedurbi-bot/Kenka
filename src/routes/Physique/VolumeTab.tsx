import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import clsx from "clsx";
import { db } from "../../db/db";
import { volumeReport, ZONE_LABELS } from "../../lib/volume";
import { detectPlateau } from "../../lib/performance";
import type { PlateauVerdict } from "../../lib/performance";
import type { Exercise } from "../../db/types";
import { Empty, Panel, SectionTitle, Stat, Tag } from "../../components/ui";

const WINDOWS = [
  { days: 14, label: "14 j" },
  { days: 28, label: "28 j" },
  { days: 84, label: "12 sem" },
];

export function VolumeTab() {
  const [windowDays, setWindowDays] = useState(28);
  const sets = useLiveQuery(() => db.workoutSets.toArray(), []) ?? [];
  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? [];

  const report = volumeReport(sets, exercises, windowDays);
  const max = Math.max(1, ...report.byZone.map((z) => z.sets));

  return (
    <div className="space-y-5">
      <SectionTitle>Répartition du volume</SectionTitle>
      <p className="-mt-3 text-xs leading-relaxed text-bone-600">
        La silhouette Toji se décide ici : le volume doit aller aux épaules, au dos et à la
        ceinture, pas aux pecs et aux bras. Une série comptant plusieurs zones est comptée dans
        chacune.
      </p>

      <div className="flex gap-1">
        {WINDOWS.map((w) => (
          <button
            key={w.days}
            onClick={() => setWindowDays(w.days)}
            aria-pressed={windowDays === w.days}
            className={clsx(
              "flex-1 border py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
              windowDays === w.days
                ? "border-blood-500 bg-blood-900 text-bone-50"
                : "border-ink-700 text-bone-600",
            )}
          >
            {w.label}
          </button>
        ))}
      </div>

      {report.verdict === "insuffisant" ? (
        <Empty>{report.advice}</Empty>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Séries" value={report.totalSets} />
            <Stat label="Prioritaires" value={report.prioritySets} tone="blood" />
            <Stat
              label="Ratio"
              value={report.ratio ? `${report.ratio.toFixed(1)}:1` : "—"}
              tone={report.ratio && report.ratio >= 2 ? "jade" : "steel"}
            />
          </div>

          <Panel
            className={clsx(
              "border-l-2 px-3 py-3",
              report.verdict === "aligne" ? "border-l-jade-400" : "border-l-blood-500",
            )}
          >
            <div className="flex items-center gap-2">
              <Tag tone={report.verdict === "aligne" ? "jade" : "blood"}>
                {report.verdict === "aligne" ? "Aligné" : "À corriger"}
              </Tag>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-bone-400">{report.advice}</p>
          </Panel>

          <section>
            <SectionTitle>Par zone</SectionTitle>
            <Panel className="divide-y divide-ink-800">
              {report.byZone.map((z) => (
                <div key={z.zone} className="px-3 py-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={clsx(
                        "text-sm",
                        z.priority ? "text-bone-50" : z.counter ? "text-blood-300" : "text-bone-400",
                      )}
                    >
                      {ZONE_LABELS[z.zone]}
                      {z.priority && <span className="ml-1.5 text-blood-400">★</span>}
                    </span>
                    <span className="font-mono text-xs tabular-nums text-bone-600">
                      {z.sets} · {(z.sets / (windowDays / 7)).toFixed(1)}/sem
                    </span>
                  </div>
                  <div className="mt-1 h-1 w-full bg-ink-800">
                    <div
                      className={clsx(
                        "h-full",
                        z.priority ? "bg-blood-500" : z.counter ? "bg-steel-600" : "bg-ink-600",
                      )}
                      style={{ width: `${(z.sets / max) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </Panel>
          </section>
        </>
      )}

      <PlateauSection exercises={exercises} />
    </div>
  );
}

function PlateauSection({ exercises }: { exercises: Exercise[] }) {
  const plateaus = useLiveQuery(async () => {
    const priority = exercises.filter((e) => e.priority === "primaire" && e.id);
    const out: Array<{ exercise: Exercise; verdict: PlateauVerdict }> = [];
    for (const ex of priority) {
      const verdict = await detectPlateau(ex);
      if (verdict.plateaued) out.push({ exercise: ex, verdict });
    }
    return out;
  }, [exercises.length]);

  if (!plateaus || plateaus.length === 0) return null;

  return (
    <section>
      <SectionTitle>Plafonds détectés</SectionTitle>
      <p className="-mt-1 mb-3 text-xs leading-relaxed text-bone-600">
        Même charge et pas de gain de volume sur les 3 dernières séances. Avec des haltères à
        10 kg c'est attendu — le progrès doit alors venir d'un autre levier.
      </p>
      <Panel className="divide-y divide-ink-800">
        {plateaus.map(({ exercise, verdict }) => (
          <div key={exercise.id} className="px-3 py-2.5">
            <div className="text-sm text-bone-50">{exercise.name}</div>
            <div className="mt-1 flex items-center gap-2">
              <Tag tone="gold">Prochain levier</Tag>
              <span className="text-xs text-bone-400">{verdict.advice}</span>
            </div>
          </div>
        ))}
      </Panel>
    </section>
  );
}
