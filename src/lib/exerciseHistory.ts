import type { WorkoutSetLog } from "../db/types";

/**
 * Historique d'un exercice reconstitué en mémoire, à partir d'un lot de séries
 * déjà chargé.
 *
 * `performance.ts` fait le même travail par requêtes indexées, exercice par
 * exercice : c'est le bon choix quand on n'en regarde qu'un. Ici on juge la
 * bibliothèque entière d'un coup (le flux) ou tous les exercices d'une séance
 * (l'écran de séance), et N requêtes coûteraient plus cher qu'un seul parcours.
 */
export interface ExerciseHistory {
  lastDate?: string;
  /** Dates de séance, triées du plus ancien au plus récent. */
  sessions: string[];
  sets: WorkoutSetLog[];
  /** Charge et répétitions maximales de la **dernière** séance, pas de tout l'historique. */
  topWeightKg?: number;
  topReps?: number;
}

export function historyByExercise(sets: WorkoutSetLog[]): Map<number, ExerciseHistory> {
  const out = new Map<number, ExerciseHistory>();
  for (const s of sets) {
    const h = out.get(s.exerciseId) ?? { sessions: [], sets: [] };
    h.sets.push(s);
    if (!h.sessions.includes(s.date)) h.sessions.push(s.date);
    if (!h.lastDate || s.date > h.lastDate) h.lastDate = s.date;
    out.set(s.exerciseId, h);
  }
  for (const h of out.values()) {
    h.sessions.sort();
    const lastSets = h.sets.filter((s) => s.date === h.lastDate);
    h.topWeightKg = Math.max(0, ...lastSets.map((s) => s.weightKg ?? 0)) || undefined;
    h.topReps = Math.max(0, ...lastSets.map((s) => s.reps ?? 0)) || undefined;
  }
  return out;
}

/**
 * Stagnation : trois dernières séances à charge maximale identique **et** à
 * volume de répétitions identique. Les deux conditions sont nécessaires — trois
 * séances à la même charge avec des répétitions qui montent, c'est justement une
 * progression en cours, pas un blocage.
 */
export function isPlateaued(h: ExerciseHistory, lookback = 3): boolean {
  const dates = h.sessions.slice(-lookback);
  if (dates.length < lookback) return false;
  const tops = dates.map((d) =>
    Math.max(0, ...h.sets.filter((s) => s.date === d).map((s) => s.weightKg ?? 0)),
  );
  const reps = dates.map((d) =>
    h.sets.filter((s) => s.date === d).reduce((n, s) => n + (s.reps ?? 0), 0),
  );
  return tops.every((t) => t === tops[0]) && reps.every((r) => r === reps[0]);
}

/** Dernière séance d'un exercice, au format attendu par `nextTarget`. */
export function lastSessionOf(h: ExerciseHistory | undefined) {
  if (!h || !h.lastDate) return undefined;
  return {
    sets: h.sets.filter((s) => s.date === h.lastDate),
    topWeightKg: h.topWeightKg,
    topReps: h.topReps,
  };
}
