import { daysBetween, isoDay } from "./dates";

export type DayAxis = "none" | "toji" | "ippo" | "both";

export interface CalendarDay {
  date: string;
  axis: DayAxis;
  /** Nombre de séances ce jour-là, tous axes confondus. */
  count: number;
  /** Jour futur : la grille se termine en fin de semaine, ces cases restent vides. */
  future: boolean;
}

export interface CalendarWeek {
  /** Lundi de la semaine. */
  start: string;
  days: CalendarDay[];
}

const DAY_MS = 86_400_000;

const shiftDays = (iso: string, n: number) =>
  isoDay(new Date(new Date(`${iso}T00:00:00`).getTime() + n * DAY_MS));

/** Lundi de la semaine contenant `iso`. */
function mondayOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  // getDay() : 0 = dimanche. Notre semaine commence lundi.
  return shiftDays(iso, -((d.getDay() + 6) % 7));
}

/**
 * Grille d'activité des N dernières semaines, façon calendrier de contributions.
 *
 * Les trois barres de régularité disaient « 4 semaines d'affilée » sans jamais
 * montrer *quand* on s'entraîne : un trou de dix jours et une semaine dense se
 * lisaient pareil. La grille rend visible le rythme réel — et les trous.
 *
 * La semaine en cours est affichée en entier, jours à venir compris, pour que
 * la grille ne change pas de largeur au fil de la semaine.
 */
export function trainingCalendar(
  workoutDates: string[],
  combatDates: string[],
  weeks = 12,
): CalendarWeek[] {
  const today = isoDay();
  const thisMonday = mondayOf(today);
  const firstMonday = shiftDays(thisMonday, -(weeks - 1) * 7);

  const toji = new Map<string, number>();
  for (const d of workoutDates) toji.set(d, (toji.get(d) ?? 0) + 1);
  const ippo = new Map<string, number>();
  for (const d of combatDates) ippo.set(d, (ippo.get(d) ?? 0) + 1);

  const out: CalendarWeek[] = [];
  for (let w = 0; w < weeks; w++) {
    const start = shiftDays(firstMonday, w * 7);
    const days: CalendarDay[] = [];
    for (let i = 0; i < 7; i++) {
      const date = shiftDays(start, i);
      const t = toji.get(date) ?? 0;
      const p = ippo.get(date) ?? 0;
      days.push({
        date,
        count: t + p,
        axis: t > 0 && p > 0 ? "both" : t > 0 ? "toji" : p > 0 ? "ippo" : "none",
        future: daysBetween(today, date) > 0,
      });
    }
    out.push({ start, days });
  }
  return out;
}

export interface CalendarSummary {
  activeDays: number;
  totalDays: number;
  /** Plus longue série de jours consécutifs avec au moins une séance. */
  longestRun: number;
  /** Jours consécutifs sans aucune séance, en remontant depuis aujourd'hui. */
  daysSinceLast?: number;
}

/** Chiffres qui accompagnent la grille — sinon elle est jolie mais muette. */
export function summarizeCalendar(weeks: CalendarWeek[]): CalendarSummary {
  const days = weeks.flatMap((w) => w.days).filter((d) => !d.future);

  let activeDays = 0;
  let longestRun = 0;
  let run = 0;
  for (const d of days) {
    if (d.count > 0) {
      activeDays++;
      run++;
      longestRun = Math.max(longestRun, run);
    } else {
      run = 0;
    }
  }

  let daysSinceLast: number | undefined;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].count > 0) {
      daysSinceLast = days.length - 1 - i;
      break;
    }
  }

  return { activeDays, totalDays: days.length, longestRun, daysSinceLast };
}
