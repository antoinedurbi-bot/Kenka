import Dexie from "dexie";
import { db } from "../db/db";
import type { Exercise, ProgressionMethod, WorkoutSetLog } from "../db/types";
import { isoDay } from "./dates";

export const PROGRESSION_LABELS: Record<ProgressionMethod, string> = {
  charge: "Monter la charge",
  reps: "Ajouter des répétitions",
  tempo: "Ralentir l'excentrique, marquer la pause",
  unilateral: "Passer en unilatéral",
  amplitude: "Augmenter l'amplitude",
  levier: "Durcir le bras de levier",
  bande: "Ajouter de la tension élastique",
  lest: "Ajouter du lest",
  densite: "Réduire le temps de repos",
};

export interface LastPerformance {
  date: string;
  sets: WorkoutSetLog[];
  /** Meilleure série de la séance, au tonnage (charge × reps). */
  best?: WorkoutSetLog;
  topWeightKg?: number;
  topReps?: number;
}

/**
 * Dernière séance où cet exercice a été chargé. S'appuie sur l'index composé
 * [exerciseId+date] : on lit la dernière date puis les séries de ce jour-là.
 */
export async function lastPerformance(exerciseId: number): Promise<LastPerformance | undefined> {
  const latest = await db.workoutSets
    .where("[exerciseId+date]")
    .between([exerciseId, Dexie.minKey], [exerciseId, Dexie.maxKey])
    .last();

  if (!latest) return undefined;

  const sets = await db.workoutSets
    .where("[exerciseId+date]")
    .equals([exerciseId, latest.date])
    .toArray();

  return summarise(latest.date, sets);
}

/** Charge toutes les dernières performances d'un coup — évite N requêtes au montage. */
export async function lastPerformances(
  exerciseIds: number[],
): Promise<Map<number, LastPerformance>> {
  const out = new Map<number, LastPerformance>();
  await Promise.all(
    exerciseIds.map(async (id) => {
      const perf = await lastPerformance(id);
      if (perf) out.set(id, perf);
    }),
  );
  return out;
}

function summarise(date: string, sets: WorkoutSetLog[]): LastPerformance {
  const scored = sets.filter((s) => s.reps || s.weightKg);
  const best = scored.reduce<WorkoutSetLog | undefined>((top, s) => {
    if (!top) return s;
    const tonnage = (s.weightKg ?? 0) * (s.reps ?? 1) + (s.reps ?? 0);
    const topTonnage = (top.weightKg ?? 0) * (top.reps ?? 1) + (top.reps ?? 0);
    return tonnage > topTonnage ? s : top;
  }, undefined);

  return {
    date,
    sets: sets.sort((a, b) => a.setIndex - b.setIndex),
    best,
    topWeightKg: scored.reduce<number | undefined>(
      (m, s) => (s.weightKg !== undefined ? Math.max(m ?? 0, s.weightKg) : m),
      undefined,
    ),
    topReps: scored.reduce<number | undefined>(
      (m, s) => (s.reps !== undefined ? Math.max(m ?? 0, s.reps) : m),
      undefined,
    ),
  };
}

export interface SessionTemplate {
  exerciseId: number;
  sets: number;
  /** Vrai si le modèle vient d'une séance réellement effectuée. */
  fromHistory: boolean;
}

/** Nombre d'exercices proposés quand aucun historique n'existe pour ce jour. */
const FIRST_TIME_EXERCISE_CAP = 6;

/**
 * Modèle de séance. La meilleure référence est ce qui a réellement été fait la
 * dernière fois sur ce jour de split : `splitDays` ne dit que quels exercices
 * sont éligibles, et tout pré-remplir donnerait une séance de 16 exercices.
 */
export async function sessionTemplate(
  splitDay: string,
  eligible: Exercise[],
): Promise<SessionTemplate[]> {
  // Trié par date, pas par `.last()` : l'ordre d'un index simple suit la clé
  // primaire, donc une séance saisie après coup mais antérieure servirait de
  // modèle à la place de la vraie dernière séance.
  const logs = await db.workoutLogs
    .where("splitDay")
    .equals(splitDay)
    .filter((l) => l.completed)
    .toArray();
  const lastLog = logs.sort((a, b) => a.date.localeCompare(b.date)).at(-1);

  if (lastLog?.id) {
    const sets = await db.workoutSets.where("workoutLogId").equals(lastLog.id).toArray();
    if (sets.length > 0) {
      const counts = new Map<number, number>();
      for (const s of sets) counts.set(s.exerciseId, (counts.get(s.exerciseId) ?? 0) + 1);
      return [...counts.entries()].map(([exerciseId, n]) => ({
        exerciseId,
        sets: n,
        fromHistory: true,
      }));
    }
  }

  // Première séance de ce type : les exercices prioritaires d'abord, plafonnés.
  const ranked = [...eligible].sort((a, b) => {
    const pa = a.priority === "primaire" ? 0 : 1;
    const pb = b.priority === "primaire" ? 0 : 1;
    return pa - pb;
  });

  return ranked.slice(0, FIRST_TIME_EXERCISE_CAP).map((ex) => ({
    exerciseId: ex.id!,
    sets: ex.defaultSets ?? 3,
    fromHistory: false,
  }));
}

/** Un plafond ne se juge que sur de l'entraînement récent. */
const PLATEAU_WINDOW_DAYS = 60;

export interface PlateauVerdict {
  plateaued: boolean;
  sessions: number;
  advice?: string;
}

/**
 * Détecte un plafond : même charge maximale sur les N dernières séances de cet
 * exercice. Avec des haltères à 10 kg, c'est la situation normale, pas
 * l'exception — d'où le conseil orienté vers un autre levier que la charge.
 */
export async function detectPlateau(
  exercise: Exercise,
  lookback = 3,
  windowDays = PLATEAU_WINDOW_DAYS,
): Promise<PlateauVerdict> {
  // Fenêtre bornée : sans elle, trois séances identiques abandonnées il y a un an
  // signaleraient un plafond pour toujours, et la requête grossirait sans fin.
  const since = isoDay(new Date(Date.now() - windowDays * 86_400_000));
  const sets = await db.workoutSets
    .where("[exerciseId+date]")
    .between([exercise.id!, since], [exercise.id!, Dexie.maxKey])
    .toArray();

  if (sets.length === 0) return { plateaued: false, sessions: 0 };

  const byDate = new Map<string, WorkoutSetLog[]>();
  for (const s of sets) {
    byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);
  }

  const dates = [...byDate.keys()].sort().reverse().slice(0, lookback);
  if (dates.length < lookback) return { plateaued: false, sessions: dates.length };

  const tops = dates.map((d) =>
    Math.max(...byDate.get(d)!.map((s) => s.weightKg ?? 0), 0),
  );
  const volumes = dates.map((d) =>
    byDate.get(d)!.reduce((n, s) => n + (s.reps ?? 0), 0),
  );

  const sameLoad = tops.every((t) => t === tops[0]);
  const noVolumeGain = volumes[0] <= volumes[volumes.length - 1];

  if (!sameLoad || !noVolumeGain) return { plateaued: false, sessions: dates.length };

  const nextLever = (exercise.progression ?? []).find((p) => p !== "charge");
  return {
    plateaued: true,
    sessions: dates.length,
    advice: nextLever
      ? PROGRESSION_LABELS[nextLever]
      : "Changer de variante pour relancer la progression",
  };
}
