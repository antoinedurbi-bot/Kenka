import type { CombatSessionLog, WorkoutLog } from "../db/types";
import { daysBetween, isoDay } from "./dates";

export type ReadinessLevel = "ok" | "surveiller" | "deload";

export interface Readiness {
  level: ReadinessLevel;
  headline: string;
  detail: string;
  /** Séances toutes disciplines confondues sur les 7 derniers jours. */
  weekLoad: number;
  consecutiveLowFeeling: number;
}

const HARD_WEEK = 7;

/**
 * Signal de fatigue. L'app ne notifie jamais, mais quand elle est ouverte elle
 * doit dire ce qu'elle voit : à 6 séances par semaine, avec une reprise de muay
 * thai et une mobilité faible, la blessure arrive avant le plateau.
 */
export function readiness(workouts: WorkoutLog[], combat: CombatSessionLog[]): Readiness {
  const today = isoDay();
  const inWeek = (d: string) => {
    const age = daysBetween(d, today);
    return age >= 0 && age < 7;
  };

  const weekLoad =
    workouts.filter((w) => w.completed && inWeek(w.date)).length +
    combat.filter((c) => inWeek(c.date)).length;

  const recentFeelings = workouts
    .filter((w) => w.completed && w.feeling !== undefined)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((w) => w.feeling!);

  let consecutiveLowFeeling = 0;
  for (const f of recentFeelings) {
    if (f <= 2) consecutiveLowFeeling++;
    else break;
  }

  if (consecutiveLowFeeling >= 3) {
    return {
      level: "deload",
      headline: "Décharge conseillée",
      detail: `${consecutiveLowFeeling} séances difficiles d'affilée. Couper le volume de moitié pendant une semaine en gardant les charges — c'est ce qui laisse la surcompensation arriver.`,
      weekLoad,
      consecutiveLowFeeling,
    };
  }

  if (consecutiveLowFeeling === 2) {
    return {
      level: "surveiller",
      headline: "Deux séances dures d'affilée",
      detail:
        "Si la prochaine est encore difficile, décharger. Vérifier d'abord le sommeil et l'apport calorique : en surplus léger, une baisse de forme vient souvent de là.",
      weekLoad,
      consecutiveLowFeeling,
    };
  }

  if (weekLoad > HARD_WEEK) {
    return {
      level: "surveiller",
      headline: "Semaine chargée",
      detail: `${weekLoad} séances sur 7 jours. Tenable ponctuellement, pas en régime permanent — surveiller les articulations et la qualité du sommeil.`,
      weekLoad,
      consecutiveLowFeeling,
    };
  }

  return {
    level: "ok",
    headline: "Charge soutenable",
    detail:
      weekLoad === 0
        ? "Aucune séance cette semaine."
        : `${weekLoad} séance(s) sur 7 jours, ressenti stable.`,
    weekLoad,
    consecutiveLowFeeling,
  };
}
