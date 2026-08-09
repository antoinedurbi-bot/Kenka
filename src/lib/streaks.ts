import { daysBetween, isoWeekStart } from "./dates";

/**
 * Streak en semaines calendaires (lundi→dimanche). Deux raisons de ne pas
 * compter en jours consécutifs ni en fenêtres glissantes : le split inclut
 * volontairement des jours de repos, et l'utilisateur raisonne en semaines
 * puisque son programme est hebdomadaire. Une fenêtre glissante ferait varier
 * le compteur d'un jour à l'autre sans qu'aucune séance ait été ajoutée.
 */
export function weeklyStreak(dates: string[], minPerWeek: number): number {
  if (dates.length === 0) return 0;

  const thisWeek = isoWeekStart();
  const counts = new Map<number, number>();

  for (const date of dates) {
    const weeksAgo = weeksBetweenStarts(isoWeekStart(parseISO(date)), thisWeek);
    if (weeksAgo < 0) continue;
    counts.set(weeksAgo, (counts.get(weeksAgo) ?? 0) + 1);
  }

  let streak = 0;
  const oldest = Math.max(...counts.keys(), 0);

  for (let w = 0; w <= oldest; w++) {
    if ((counts.get(w) ?? 0) >= minPerWeek) {
      streak++;
    } else if (w === 0) {
      // La semaine en cours n'est pas finie : incomplète, elle ne casse rien.
      continue;
    } else {
      break;
    }
  }
  return streak;
}

/** Séances de la semaine calendaire en cours. */
export function currentWeekCount(dates: string[]): number {
  const thisWeek = isoWeekStart();
  return dates.filter((d) => isoWeekStart(parseISO(d)) === thisWeek).length;
}

const parseISO = (iso: string) => new Date(`${iso}T00:00:00`);

const weeksBetweenStarts = (from: string, to: string) => Math.round(daysBetween(from, to) / 7);
