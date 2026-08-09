import { useLiveQuery } from "dexie-react-hooks";
import clsx from "clsx";
import { db } from "../../db/db";
import type { SplitDay } from "../../db/types";
import { DEFAULT_SPLIT, SPLIT_AXIS, SPLIT_LABELS, WEEKDAYS, weekdayOf } from "../../lib/split";
import type { Weekday } from "../../lib/split";
import { useSetting } from "../../lib/useSetting";
import { Empty, Panel, SectionTitle, Tag } from "../../components/ui";
import { isoDay } from "../../lib/dates";

const DAY_OPTIONS: SplitDay[] = [
  "push",
  "pull",
  "legs",
  "fullbody",
  "muaythai",
  "mobilite",
  "repos",
];

export function SplitTab() {
  const [split, setSplit] = useSetting<Record<Weekday, SplitDay>>("split", DEFAULT_SPLIT);
  const today = weekdayOf(new Date());

  const doneToday = useLiveQuery(
    () => db.workoutLogs.where("date").equals(isoDay()).toArray(),
    [],
  );

  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? [];
  const todaysExercises = exercises.filter((e) => e.splitDays.includes(split[today]));

  return (
    <div className="space-y-6">
      <section>
        <SectionTitle>Semaine type</SectionTitle>
        <Panel className="divide-y divide-ink-800">
          {WEEKDAYS.map((day) => {
            const value = split[day];
            const axis = SPLIT_AXIS[value];
            const isToday = day === today;
            return (
              <div
                key={day}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2.5",
                  isToday && "bg-ink-850",
                  value === "repos" && "k-hatch",
                )}
              >
                <span
                  className={clsx(
                    "w-9 font-display text-sm uppercase tracking-[0.1em]",
                    isToday ? "text-blood-300" : "text-bone-400",
                  )}
                >
                  {day}
                </span>
                <select
                  value={value}
                  onChange={(e) =>
                    setSplit({ ...split, [day]: e.target.value as SplitDay })
                  }
                  className="flex-1 border border-ink-700 bg-ink-950 px-2 py-1.5 text-sm outline-none focus:border-blood-500"
                >
                  {DAY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {SPLIT_LABELS[opt]}
                    </option>
                  ))}
                </select>
                {axis !== "neutre" && (
                  <Tag tone={axis === "toji" ? "blood" : "steel"}>
                    {axis === "toji" ? "Toji" : "Ippo"}
                  </Tag>
                )}
              </div>
            );
          })}
        </Panel>
      </section>

      <section>
        <SectionTitle
          action={
            doneToday && doneToday.length > 0 ? (
              <Tag tone="jade">{doneToday.length} séance(s) loggée(s)</Tag>
            ) : undefined
          }
        >
          Aujourd'hui — {SPLIT_LABELS[split[today]]}
        </SectionTitle>

        {todaysExercises.length === 0 ? (
          <Empty>Aucun exercice associé à ce jour. Journée libre ou repos.</Empty>
        ) : (
          <Panel className="divide-y divide-ink-800">
            {todaysExercises.map((ex) => (
              <div key={ex.id} className="px-3 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm text-bone-50">{ex.name}</span>
                  {ex.priority === "primaire" && <Tag tone="blood">Priorité</Tag>}
                </div>
                {ex.instructions && (
                  <p className="mt-1 text-xs leading-relaxed text-bone-600">{ex.instructions}</p>
                )}
              </div>
            ))}
          </Panel>
        )}
      </section>
    </div>
  );
}
