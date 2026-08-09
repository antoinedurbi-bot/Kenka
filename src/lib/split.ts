import type { SplitDay } from "../db/types";

export const WEEKDAYS = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const DEFAULT_SPLIT: Record<Weekday, SplitDay> = {
  lun: "push",
  mar: "muaythai",
  mer: "pull",
  jeu: "legs",
  ven: "muaythai",
  sam: "fullbody",
  dim: "mobilite",
};

export const SPLIT_LABELS: Record<SplitDay, string> = {
  push: "Push",
  pull: "Pull",
  legs: "Legs",
  fullbody: "Full body — explosivité",
  muaythai: "Muay thai",
  mobilite: "Mobilité / repos actif",
  repos: "Repos",
};

export const SPLIT_AXIS: Record<SplitDay, "toji" | "ippo" | "neutre"> = {
  push: "toji",
  pull: "toji",
  legs: "toji",
  fullbody: "toji",
  muaythai: "ippo",
  mobilite: "neutre",
  repos: "neutre",
};

/** JS getDay() : 0 = dimanche. Notre semaine commence lundi. */
export function weekdayOf(date: Date): Weekday {
  return WEEKDAYS[(date.getDay() + 6) % 7];
}

/** Jours qu'une séance de musculation peut porter. */
export const LOGGABLE_SPLIT_DAYS: SplitDay[] = [
  "push",
  "pull",
  "legs",
  "fullbody",
  "mobilite",
];

/**
 * Jour à proposer par défaut dans le log muscu. Un mardi (muay thai), proposer
 * "muay thai" donnerait une valeur absente de la liste et une séance vide :
 * on remonte alors au dernier jour de musculation du split.
 */
export function defaultLoggableDay(
  split: Record<Weekday, SplitDay>,
  today: Weekday = weekdayOf(new Date()),
): SplitDay {
  const start = WEEKDAYS.indexOf(today);
  for (let i = 0; i < WEEKDAYS.length; i++) {
    const day = WEEKDAYS[(start - i + WEEKDAYS.length) % WEEKDAYS.length];
    if (LOGGABLE_SPLIT_DAYS.includes(split[day])) return split[day];
  }
  return "fullbody";
}
