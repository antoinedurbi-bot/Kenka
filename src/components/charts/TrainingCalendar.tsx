import clsx from "clsx";
import { prettyDate } from "../../lib/dates";
import { summarizeCalendar, trainingCalendar } from "../../lib/trainingCalendar";
import type { CalendarDay } from "../../lib/trainingCalendar";

const WEEKDAY_INITIALS = ["L", "M", "M", "J", "V", "S", "D"];

/** Une case par jour, une colonne par semaine — lecture d'un coup d'œil du rythme réel. */
export function TrainingCalendar({
  workoutDates,
  combatDates,
  weeks = 12,
  showCombat = true,
}: {
  workoutDates: string[];
  combatDates: string[];
  weeks?: number;
  showCombat?: boolean;
}) {
  const grid = trainingCalendar(workoutDates, combatDates, weeks);
  const summary = summarizeCalendar(grid);

  return (
    <div>
      {/* La grille défile horizontalement plutôt que de comprimer les cases :
          sur un petit écran, 12 semaines écrasées deviennent illisibles. */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex gap-[3px]">
          <div className="mr-1 flex shrink-0 flex-col gap-[3px]">
            {WEEKDAY_INITIALS.map((d, i) => (
              <span
                key={i}
                className="flex h-[13px] w-3 items-center justify-center font-mono text-[8px] leading-none text-ink-500"
                aria-hidden
              >
                {i % 2 === 0 ? d : ""}
              </span>
            ))}
          </div>

          {grid.map((week) => (
            <div key={week.start} className="flex shrink-0 flex-col gap-[3px]">
              {week.days.map((day) => (
                <DayCell key={day.date} day={day} />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Legend className="bg-blood-500" label="Muscu" />
        {showCombat && <Legend className="bg-steel-400" label="Combat" />}
        {showCombat && <Legend className="bg-gold-400" label="Les deux" />}
        <span className="ml-auto font-mono text-[10px] tabular-nums text-bone-600">
          {summary.activeDays}/{summary.totalDays} j actifs
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.1em] text-bone-600">
        <span>
          Plus longue série{" "}
          <span className="tabular-nums text-bone-200">{summary.longestRun} j</span>
        </span>
        {summary.daysSinceLast !== undefined && (
          <span>
            Dernière séance{" "}
            <span
              className={clsx(
                "tabular-nums",
                summary.daysSinceLast <= 2 ? "text-jade-400" : "text-blood-300",
              )}
            >
              {summary.daysSinceLast === 0 ? "aujourd'hui" : `il y a ${summary.daysSinceLast} j`}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

const AXIS_CLASS = {
  none: "bg-ink-800",
  toji: "bg-blood-500",
  ippo: "bg-steel-400",
  both: "bg-gold-400",
};

function DayCell({ day }: { day: CalendarDay }) {
  if (day.future) {
    return <span className="h-[13px] w-[13px] border border-ink-800" aria-hidden />;
  }
  return (
    <span
      className={clsx("h-[13px] w-[13px]", AXIS_CLASS[day.axis])}
      title={`${prettyDate(day.date)} — ${day.count === 0 ? "repos" : `${day.count} séance(s)`}`}
    />
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-bone-600">
      <span className={clsx("h-2.5 w-2.5", className)} aria-hidden />
      {label}
    </span>
  );
}
