import Dexie, { type Table } from "dexie";
import type {
  AppSetting,
  BodyMeasurement,
  CombatAssessment,
  CombatCheckpoint,
  CombatSessionLog,
  CombatSkill,
  DailyIntake,
  DailyWeight,
  Exercise,
  GlowUpEntry,
  MobilityLog,
  NutritionCheckIn,
  ProgressPhoto,
  ReferenceImage,
  SessionDraft,
  WorkoutLog,
  WorkoutSetLog,
} from "./types";

export class KenkaDB extends Dexie {
  exercises!: Table<Exercise, number>;
  workoutLogs!: Table<WorkoutLog, number>;
  workoutSets!: Table<WorkoutSetLog, number>;
  measurements!: Table<BodyMeasurement, number>;
  nutrition!: Table<NutritionCheckIn, number>;
  dailyIntake!: Table<DailyIntake, number>;
  dailyWeights!: Table<DailyWeight, number>;
  mobilityLogs!: Table<MobilityLog, number>;
  combatSkills!: Table<CombatSkill, number>;
  combatCheckpoints!: Table<CombatCheckpoint, number>;
  combatAssessments!: Table<CombatAssessment, number>;
  combatLogs!: Table<CombatSessionLog, number>;
  photos!: Table<ProgressPhoto, number>;
  glowUp!: Table<GlowUpEntry, number>;
  settings!: Table<AppSetting, string>;
  sessionDraft!: Table<SessionDraft, string>;
  referenceImages!: Table<ReferenceImage, number>;

  constructor() {
    super("kenka");

    this.version(1).stores({
      exercises: "++id, name, type, priority, *zones, *splitDays",
      workoutLogs: "++id, date, type, splitDay, completed",
      workoutSets: "++id, workoutLogId, exerciseId",
      measurements: "++id, date",
      nutrition: "++id, weekStart",
      combatSkills: "++id, category",
      combatCheckpoints: "++id, skillId, achieved",
      combatAssessments: "++id, skillId, date",
      combatLogs: "++id, date, kind",
      photos: "++id, date, angle",
      glowUp: "++id, category, order",
      settings: "key",
    });

    this.version(2)
      .stores({
        workoutSets: "++id, workoutLogId, exerciseId, date, [exerciseId+date]",
        dailyIntake: "++id, &date",
        dailyWeights: "++id, &date",
        mobilityLogs: "++id, date, metric, [metric+date]",
      })
      .upgrade(async (tx) => {
        // workoutSets.date est nouveau : le renseigner depuis la séance parente,
        // sinon la recherche de dernière performance ignorerait l'historique v1.
        const logs = await tx.table("workoutLogs").toArray();
        const dateById = new Map<number, string>(logs.map((l) => [l.id, l.date]));
        await tx
          .table("workoutSets")
          .toCollection()
          .modify((set) => {
            set.date ??= dateById.get(set.workoutLogId) ?? "1970-01-01";
          });
      });

    // La séance en cours vit dans sa propre table : une seule ligne, écrasée à
    // chaque frappe, sans toucher aux tables d'historique.
    this.version(3).stores({ sessionDraft: "id" });

    this.version(4).stores({ referenceImages: "++id, category, order" });
  }
}

export const db = new KenkaDB();
