import type { DraftExercise, Exercise, SessionDraft } from "../db/types";
import { estimatedOneRm } from "./records";
import type { ExerciseRecords, RecordKind } from "./records";

export interface SessionRecord {
  exerciseId: number;
  exerciseName: string;
  kind: RecordKind;
  value: number;
  previous?: number;
}

export interface SessionSummary {
  plannedSets: number;
  doneSets: number;
  /** Séries portant une donnée mais jamais validées — elles seront quand même enregistrées. */
  filledSets: number;
  /** Séries prévues restées entièrement vides : elles disparaîtront à l'enregistrement. */
  skippedSets: number;
  exercisesTouched: number;
  exercisesPlanned: number;
  /** Σ charge × répétitions, exercices lestés uniquement. */
  tonnageKg: number;
  /** Σ répétitions des exercices au poids du corps, où le tonnage ne veut rien dire. */
  bodyweightReps: number;
  records: SessionRecord[];
}

const num = (v: string): number | undefined => {
  if (v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/** Une série compte dès qu'elle porte une donnée, validée ou non. */
const hasData = (s: DraftExercise["sets"][number]) =>
  s.done || num(s.reps) !== undefined || num(s.weightKg) !== undefined;

/**
 * Débrief de fin de séance.
 *
 * Il sert deux rôles que l'app séparait mal : montrer ce qui vient d'être
 * accompli — le seul moment où l'effort est encore chaud — et signaler avant
 * l'enregistrement les séries prévues restées vides, qui disparaîtraient
 * silencieusement sinon.
 *
 * Les records sont dédupliqués par (exercice, type) : sur une séance où trois
 * séries battent successivement l'ancienne charge, seule la meilleure est un
 * record, et l'annoncer trois fois le banaliserait.
 */
export function summarizeSession(
  draft: SessionDraft,
  byId: Map<number, Exercise>,
  baseRecords: Map<number, ExerciseRecords>,
): SessionSummary {
  let plannedSets = 0;
  let doneSets = 0;
  let filledSets = 0;
  let tonnageKg = 0;
  let bodyweightReps = 0;
  let exercisesTouched = 0;

  const best = new Map<string, SessionRecord>();

  const consider = (candidate: SessionRecord) => {
    const key = `${candidate.exerciseId}:${candidate.kind}`;
    const current = best.get(key);
    if (!current || candidate.value > current.value) best.set(key, candidate);
  };

  for (const ex of draft.exercises) {
    const exercise = byId.get(ex.exerciseId);
    const name = exercise?.name ?? "Exercice";
    const records = baseRecords.get(ex.exerciseId);
    let touched = false;
    let sessionVolume = 0;

    for (const s of ex.sets) {
      plannedSets += 1;
      if (s.done) doneSets += 1;
      if (!hasData(s)) continue;

      filledSets += 1;
      touched = true;

      const reps = num(s.reps);
      const weight = num(s.weightKg);

      if (reps !== undefined && weight !== undefined && weight > 0) {
        tonnageKg += reps * weight;
      } else if (reps !== undefined) {
        bodyweightReps += reps;
      }

      // Le volume au poids du corps se compte en répétitions : compresser les
      // deux dans la même somme rendrait le record incomparable d'une séance
      // à l'autre selon qu'on a mis du lest ou non.
      sessionVolume += (weight && weight > 0 ? weight : 1) * (reps ?? 0);

      if (!records) continue;

      if (weight !== undefined && weight > 0) {
        if (records.topWeightKg === undefined || weight > records.topWeightKg) {
          consider({
            exerciseId: ex.exerciseId,
            exerciseName: name,
            kind: "charge",
            value: weight,
            previous: records.topWeightKg,
          });
        }
      }
      if (reps !== undefined && reps > 0) {
        if (records.topReps === undefined || reps > records.topReps) {
          consider({
            exerciseId: ex.exerciseId,
            exerciseName: name,
            kind: "reps",
            value: reps,
            previous: records.topReps,
          });
        }
      }
      const e1rm = estimatedOneRm({ reps, weightKg: weight });
      if (e1rm !== undefined && (records.bestE1rm === undefined || e1rm > records.bestE1rm)) {
        consider({
          exerciseId: ex.exerciseId,
          exerciseName: name,
          kind: "e1rm",
          value: e1rm,
          previous: records.bestE1rm,
        });
      }
    }

    if (touched) exercisesTouched += 1;

    // Le record de volume ne peut se juger qu'ici : il porte sur la séance entière.
    if (records && sessionVolume > 0) {
      const rounded = Math.round(sessionVolume);
      if (records.bestSessionVolume === undefined || rounded > records.bestSessionVolume) {
        consider({
          exerciseId: ex.exerciseId,
          exerciseName: name,
          kind: "volume",
          value: rounded,
          previous: records.bestSessionVolume,
        });
      }
    }
  }

  return {
    plannedSets,
    doneSets,
    filledSets,
    skippedSets: plannedSets - filledSets,
    exercisesTouched,
    exercisesPlanned: draft.exercises.length,
    tonnageKg: Math.round(tonnageKg),
    bodyweightReps,
    records: [...best.values()].sort((a, b) => a.exerciseName.localeCompare(b.exerciseName)),
  };
}
