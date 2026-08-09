import { useLiveQuery } from "dexie-react-hooks";
import clsx from "clsx";
import { db } from "../../db/db";
import type { Exercise } from "../../db/types";
import { prettyDate, prettyShort } from "../../lib/dates";
import { detectPlateau, PROGRESSION_LABELS } from "../../lib/performance";
import { estimatedOneRm, exerciseRecords, nextTarget, RECORD_LABELS } from "../../lib/records";
import { ZONE_LABELS } from "../../lib/volume";
import { demoSearchUrl } from "../../lib/videoDemo";
import { TrendChart } from "../../components/charts/TrendChart";
import { Empty, Modal, Panel, Stat, Tag } from "../../components/ui";

/**
 * Fiche d'un exercice : ce qu'il vaut aujourd'hui, comment il a évolué, et quoi
 * viser la prochaine fois. Sans cette vue, les charges saisies ne servaient qu'à
 * pré-remplir la séance suivante — jamais à voir une progression.
 */
export function ExerciseDetail({
  exercise,
  onClose,
}: {
  exercise: Exercise;
  onClose: () => void;
}) {
  const id = exercise.id;

  const sets = useLiveQuery(
    () => (id ? db.workoutSets.where("exerciseId").equals(id).toArray() : []),
    [id],
  );
  const plateau = useLiveQuery(async () => detectPlateau(exercise), [id]);

  const all = sets ?? [];
  const records = exerciseRecords(exercise.id!, all);

  // Une valeur par séance : le meilleur 1RM estimé du jour, ou à défaut le
  // meilleur nombre de répétitions pour les mouvements au poids du corps.
  const byDate = new Map<string, number>();
  for (const s of all) {
    const metric = estimatedOneRm(s) ?? s.reps;
    if (metric === undefined) continue;
    byDate.set(s.date, Math.max(byDate.get(s.date) ?? 0, metric));
  }
  const series = [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({ date, value }));

  const usesLoad = all.some((s) => (s.weightKg ?? 0) > 0);
  const sessions = byDate.size;

  const last = (() => {
    const dates = [...new Set(all.map((s) => s.date))].sort();
    const lastDate = dates.at(-1);
    if (!lastDate) return undefined;
    const own = all.filter((s) => s.date === lastDate).sort((a, b) => a.setIndex - b.setIndex);
    return {
      sets: own,
      date: lastDate,
      topWeightKg: own.reduce<number | undefined>(
        (m, s) => (s.weightKg !== undefined ? Math.max(m ?? 0, s.weightKg) : m),
        undefined,
      ),
      topReps: own.reduce<number | undefined>(
        (m, s) => (s.reps !== undefined ? Math.max(m ?? 0, s.reps) : m),
        undefined,
      ),
    };
  })();

  const target = nextTarget(exercise, last, plateau?.plateaued ?? false);

  return (
    <Modal open onClose={onClose} title={exercise.name}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-1.5">
          {exercise.priority === "primaire" && <Tag tone="blood">Prioritaire Toji</Tag>}
          {exercise.zones.map((z) => (
            <Tag key={z}>{ZONE_LABELS[z]}</Tag>
          ))}
          <a
            href={demoSearchUrl(exercise.name)}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1 border border-ink-600 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-bone-400"
          >
            ▶ Démo
          </a>
        </div>

        {exercise.instructions && (
          <p className="border-l border-ink-700 pl-3 text-xs leading-relaxed text-bone-400">
            {exercise.instructions}
          </p>
        )}

        <section>
          <div className="k-label mb-2">Prochaine séance</div>
          <Panel
            className={clsx(
              "border-l-2 px-3 py-3",
              target.headline.startsWith("Plafond") || target.headline.startsWith("Progression")
                ? "border-l-gold-400"
                : "border-l-jade-400",
            )}
          >
            <div className="font-display text-sm uppercase tracking-[0.06em] text-bone-50">
              {target.headline}
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-bone-400">{target.detail}</p>
          </Panel>
        </section>

        {sessions === 0 ? (
          <Empty>Jamais loggé. Les records et la courbe apparaîtront après la première séance.</Empty>
        ) : (
          <>
            <section>
              <div className="k-label mb-2">Records</div>
              <div className="grid grid-cols-2 gap-2">
                {records.topWeightKg !== undefined && (
                  <Stat label={RECORD_LABELS.charge} value={records.topWeightKg} unit="kg" tone="gold" />
                )}
                {records.topReps !== undefined && (
                  <Stat label={RECORD_LABELS.reps} value={records.topReps} unit="rep" tone="gold" />
                )}
                {records.bestE1rm !== undefined && (
                  <Stat label="1RM estimé" value={records.bestE1rm} unit="kg" tone="blood" />
                )}
                <Stat label="Séances" value={sessions} />
              </div>
              {records.dates.charge && (
                <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-bone-600">
                  Record de charge le {prettyShort(records.dates.charge)}
                </p>
              )}
            </section>

            {series.length >= 2 && (
              <section>
                <div className="k-label mb-2">
                  {usesLoad ? "1RM estimé" : "Répétitions par séance"}
                </div>
                <TrendChart
                  data={series}
                  unit={usesLoad ? " kg" : " rep"}
                  color="#c8a54a"
                  domainPad={usesLoad ? 2 : 1}
                />
              </section>
            )}

            <section>
              <div className="k-label mb-2">Dernières séances</div>
              <Panel className="divide-y divide-ink-800">
                {[...byDate.keys()]
                  .sort((a, b) => b.localeCompare(a))
                  .slice(0, 6)
                  .map((date) => {
                    const own = all
                      .filter((s) => s.date === date)
                      .sort((a, b) => a.setIndex - b.setIndex);
                    return (
                      <div key={date} className="px-3 py-2">
                        <div className="k-label">{prettyDate(date)}</div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {own.map((s) => (
                            <span
                              key={s.id}
                              className="border border-ink-700 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-bone-300"
                            >
                              {s.reps ?? "—"}
                              {s.weightKg ? ` × ${s.weightKg}` : ""}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </Panel>
            </section>
          </>
        )}

        {exercise.progression && exercise.progression.length > 0 && (
          <section>
            <div className="k-label mb-2">Leviers de progression</div>
            <ul className="space-y-1.5">
              {exercise.progression.map((p) => (
                <li key={p} className="flex gap-2.5 text-xs leading-relaxed text-bone-400">
                  <span className="text-blood-500">—</span>
                  {PROGRESSION_LABELS[p]}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Modal>
  );
}
