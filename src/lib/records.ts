import type { Exercise, WorkoutSetLog } from "../db/types";

export type RecordKind = "charge" | "reps" | "e1rm" | "volume";

export const RECORD_LABELS: Record<RecordKind, string> = {
  charge: "Charge",
  reps: "Répétitions",
  e1rm: "Force estimée",
  volume: "Volume séance",
};

/**
 * 1RM estimé (formule d'Epley). Il compresse charge et répétitions en un seul
 * nombre comparable : sans lui, passer de 4×12 à 10 kg à 4×14 à 10 kg ne
 * ressemblerait à aucun progrès alors que c'en est un.
 *
 * Au poids du corps la charge vaut 0 et la formule s'effondre : on retombe
 * alors sur les répétitions, seule dimension qui progresse vraiment.
 */
export function estimatedOneRm(set: Pick<WorkoutSetLog, "weightKg" | "reps">): number | undefined {
  const reps = set.reps;
  if (!reps || reps <= 0) return undefined;
  const weight = set.weightKg ?? 0;
  if (weight <= 0) return undefined;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export interface ExerciseRecords {
  exerciseId: number;
  /** Charge maximale portée sur une série. */
  topWeightKg?: number;
  /** Répétitions maximales sur une série (à n'importe quelle charge). */
  topReps?: number;
  /** Meilleur 1RM estimé. */
  bestE1rm?: number;
  /** Meilleur volume total sur une séance (Σ charge × reps, ou Σ reps au PDC). */
  bestSessionVolume?: number;
  dates: Partial<Record<RecordKind, string>>;
}

const setVolume = (s: WorkoutSetLog) =>
  (s.weightKg && s.weightKg > 0 ? s.weightKg : 1) * (s.reps ?? 0);

/** Records d'un exercice, calculés sur l'ensemble de ses séries. */
export function exerciseRecords(exerciseId: number, sets: WorkoutSetLog[]): ExerciseRecords {
  const own = sets.filter((s) => s.exerciseId === exerciseId);
  const rec: ExerciseRecords = { exerciseId, dates: {} };

  for (const s of own) {
    if (s.weightKg !== undefined && s.weightKg > 0) {
      if (rec.topWeightKg === undefined || s.weightKg > rec.topWeightKg) {
        rec.topWeightKg = s.weightKg;
        rec.dates.charge = s.date;
      }
    }
    if (s.reps !== undefined && (rec.topReps === undefined || s.reps > rec.topReps)) {
      rec.topReps = s.reps;
      rec.dates.reps = s.date;
    }
    const e1rm = estimatedOneRm(s);
    if (e1rm !== undefined && (rec.bestE1rm === undefined || e1rm > rec.bestE1rm)) {
      rec.bestE1rm = e1rm;
      rec.dates.e1rm = s.date;
    }
  }

  const byDate = new Map<string, number>();
  for (const s of own) byDate.set(s.date, (byDate.get(s.date) ?? 0) + setVolume(s));
  for (const [date, vol] of byDate) {
    if (rec.bestSessionVolume === undefined || vol > rec.bestSessionVolume) {
      rec.bestSessionVolume = Math.round(vol);
      rec.dates.volume = date;
    }
  }

  return rec;
}

export interface PendingRecord {
  kind: RecordKind;
  value: number;
  previous?: number;
}

/**
 * Records qu'une série en cours de saisie ferait tomber. Les records de séance
 * (volume) sont exclus : ils ne se jugent qu'une fois la séance terminée.
 */
export function recordsBeatenBy(
  set: Pick<WorkoutSetLog, "weightKg" | "reps">,
  records: ExerciseRecords,
): PendingRecord[] {
  const out: PendingRecord[] = [];

  if (set.weightKg !== undefined && set.weightKg > 0) {
    if (records.topWeightKg === undefined || set.weightKg > records.topWeightKg) {
      out.push({ kind: "charge", value: set.weightKg, previous: records.topWeightKg });
    }
  }
  if (set.reps !== undefined && set.reps > 0) {
    if (records.topReps === undefined || set.reps > records.topReps) {
      out.push({ kind: "reps", value: set.reps, previous: records.topReps });
    }
  }
  const e1rm = estimatedOneRm(set);
  if (e1rm !== undefined && (records.bestE1rm === undefined || e1rm > records.bestE1rm)) {
    out.push({ kind: "e1rm", value: e1rm, previous: records.bestE1rm });
  }

  return out;
}

export interface NextTarget {
  headline: string;
  detail: string;
  /** Prescription chiffrée quand elle a un sens. */
  sets?: number;
  reps?: number;
  weightKg?: number;
}

/** Charge maximale disponible avec des haltères — au-delà, changer de levier. */
const DUMBBELL_CEILING_KG = 10;

/**
 * Objectif concret pour la prochaine séance. Le principe : tant qu'il reste de
 * la charge disponible on monte la charge ; sinon on ajoute des répétitions ;
 * et une fois le haut de fourchette atteint, la charge ne peut plus rien et il
 * faut basculer sur un autre levier.
 */
export function nextTarget(
  exercise: Exercise,
  last: { sets: WorkoutSetLog[]; topWeightKg?: number; topReps?: number } | undefined,
  plateaued: boolean,
): NextTarget {
  const levers = (exercise.progression ?? []).filter((p) => p !== "charge");
  const leverAdvice = levers.length
    ? LEVER_HINTS[levers[0]] ?? "changer de variante"
    : "changer de variante";

  if (!last || last.sets.length === 0) {
    return {
      headline: "Établir une référence",
      detail: `Première séance loggée sur cet exercice : viser ${exercise.defaultSets ?? 3} × ${exercise.defaultReps ?? "10-12"} et noter les charges. Tout le reste s'y comparera.`,
    };
  }

  const setCount = last.sets.length;
  const topReps = last.topReps ?? 0;
  const topWeight = last.topWeightKg ?? 0;
  const [, high] = repRange(exercise.defaultReps);

  // Haut de fourchette atteint avec la charge maximale disponible.
  if (topReps >= high && (exercise.bodyweight || topWeight >= DUMBBELL_CEILING_KG)) {
    return {
      headline: "Plafond atteint — changer de levier",
      detail: `${setCount} × ${topReps}${topWeight > 0 ? ` à ${topWeight} kg` : ""} : ajouter des répétitions ne construit plus grand-chose. Prochain levier — ${leverAdvice}.`,
    };
  }

  if (plateaued) {
    return {
      headline: "Progression bloquée",
      detail: `Trois séances au même niveau. Plutôt que d'insister : ${leverAdvice}.`,
    };
  }

  // Marge de charge restante : monter la charge et redescendre en répétitions.
  if (!exercise.bodyweight && topReps >= high && topWeight < DUMBBELL_CEILING_KG) {
    const next = Math.min(DUMBBELL_CEILING_KG, topWeight + 1);
    return {
      headline: `Monter à ${next} kg`,
      detail: `${topReps} répétitions atteintes : passer à ${next} kg et repartir en bas de fourchette.`,
      sets: setCount,
      reps: repRange(exercise.defaultReps)[0],
      weightKg: next,
    };
  }

  const target = topReps + 1;
  return {
    headline: `${setCount} × ${target}${topWeight > 0 ? ` à ${topWeight} kg` : ""}`,
    detail: `Dernière fois : ${setCount} × ${topReps}${topWeight > 0 ? ` à ${topWeight} kg` : ""}. Une répétition de plus sur chaque série suffit.`,
    sets: setCount,
    reps: target,
    weightKg: topWeight > 0 ? topWeight : undefined,
  };
}

const LEVER_HINTS: Partial<Record<string, string>> = {
  reps: "allonger les séries",
  tempo: "ralentir l'excentrique et marquer une pause",
  unilateral: "passer en unilatéral",
  amplitude: "augmenter l'amplitude",
  levier: "durcir le bras de levier (pieds surélevés, buste plus horizontal)",
  bande: "ajouter une bande",
  lest: "ajouter du lest",
  densite: "réduire le temps de repos",
};

/** Extrait une fourchette de répétitions d'une chaîne libre ("8-12", "max", "45 s"). */
export function repRange(spec?: string): [number, number] {
  if (!spec) return [8, 12];
  const nums = spec.match(/\d+/g);
  if (!nums || nums.length === 0) return [8, 12];
  const low = Number(nums[0]);
  const high = nums.length > 1 ? Number(nums[1]) : low;
  return [low, high];
}
