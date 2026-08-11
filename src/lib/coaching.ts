import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import type { SectionId } from "./sections";
import { physiqueLevel, skillsLevel } from "./progression";
import type { AxisLevel } from "./progression";
import { readiness } from "./readiness";
import type { Readiness } from "./readiness";
import { volumeReport } from "./volume";
import type { VolumeReport } from "./volume";
import { combatReport } from "./combatReport";
import type { CombatReport } from "./combatReport";
import { recalibrationSuggestion } from "./nutrition";
import type { RecalibrationSuggestion } from "./nutrition";
import { useSetting } from "./useSetting";
import { dayOfYear } from "./dates";

export interface CoachingContext {
  physique: AxisLevel;
  skills: AxisLevel;
  readiness: Readiness;
  volume: VolumeReport;
  combat: CombatReport;
  maintenanceKcal: number | null;
  recalibration: RecalibrationSuggestion;
}

/**
 * Rassemble en un seul endroit ce qui nourrit à la fois le conseil du jour du
 * hub et le contexte donné au coach IA — les deux lisent le même état,
 * calculé de la même façon, plutôt que deux lectures qui pourraient diverger.
 */
export function useCoachingContext(): CoachingContext {
  const measurements = useLiveQuery(() => db.measurements.orderBy("date").toArray(), []) ?? [];
  const checkpoints = useLiveQuery(() => db.combatCheckpoints.toArray(), []) ?? [];
  const workouts = useLiveQuery(() => db.workoutLogs.toArray(), []) ?? [];
  const combatLogs = useLiveQuery(() => db.combatLogs.toArray(), []) ?? [];
  const sets = useLiveQuery(() => db.workoutSets.toArray(), []) ?? [];
  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? [];
  const weights = useLiveQuery(() => db.dailyWeights.toArray(), []) ?? [];
  const intake = useLiveQuery(() => db.dailyIntake.toArray(), []) ?? [];
  const [maintenanceKcal] = useSetting<number | null>("maintenanceKcal", null);

  return {
    physique: physiqueLevel(measurements),
    skills: skillsLevel(checkpoints),
    readiness: readiness(workouts, combatLogs),
    volume: volumeReport(sets, exercises, 28),
    combat: combatReport(combatLogs, 28),
    maintenanceKcal,
    recalibration: recalibrationSuggestion(maintenanceKcal, intake, weights),
  };
}

/** Contexte compact injecté dans le prompt système du coach IA. */
export function summarizeContext(ctx: CoachingContext): string {
  const lines = [
    `Niveau physique (Toji) : ${ctx.physique.title} — ${ctx.physique.detail}.`,
    `Niveau combat (Ippo) : ${ctx.skills.title} — ${ctx.skills.detail}.`,
    `Charge d'entraînement : ${ctx.readiness.headline} (${ctx.readiness.detail})`,
    ctx.volume.verdict === "insuffisant"
      ? "Volume musculation : pas encore assez de données sur 28 jours."
      : `Volume musculation (28 j) : ${ctx.volume.verdict === "aligne" ? "aligné" : "à corriger"} — ${ctx.volume.advice}`,
    ctx.combat.verdict === "insuffisant"
      ? "Combat : pas encore assez de données sur 28 jours."
      : `Combat (28 j) : ${ctx.combat.verdict === "aligne" ? "aligné" : "à corriger"} — ${ctx.combat.advice}`,
    ctx.maintenanceKcal
      ? `Maintien calorique calibré : ${ctx.maintenanceKcal} kcal/j.`
      : "Maintien calorique : pas encore calibré.",
  ];
  return lines.join("\n");
}

export interface DailyTip {
  headline: string;
  detail: string;
  tone: "blood" | "gold" | "jade" | "steel";
  to?: string;
}

/**
 * Conseils génériques quand rien d'urgent ne ressort des données — évite un
 * hub qui n'a rien à dire tant que tout va bien. Choisi de façon stable sur
 * la journée (indexé sur le jour de l'année) plutôt qu'aléatoire à chaque
 * ouverture, pour ne pas donner l'impression que l'app se contredit.
 */
const FALLBACK_TIPS = [
  "Une série de plus en fin de séance ne construit rien qu'une bonne technique n'ait déjà construit.",
  "Le sparring est le seul test qui dit si une technique tient sous pression — le sac et le shadow entretiennent, ils ne corrigent pas.",
  "La bascule vient de la répétition ennuyeuse, pas de la séance parfaite occasionnelle.",
  "Peser à jeun, toujours dans les mêmes conditions : la tendance ne vaut que si le protocole ne varie pas.",
  "Un exercice qui plafonne n'a pas besoin de plus de volume, il a besoin d'un autre levier.",
];

/**
 * Le hub n'a qu'une place pour un conseil : celui qui pointe vers le
 * problème le plus urgent gagne. La fatigue prime sur tout — pousser plus
 * fort pendant une décharge conseillée aggrave un vrai risque, alors qu'une
 * répartition de volume à corriger peut attendre un jour de plus.
 */
export function dailyTip(ctx: CoachingContext, enabled: SectionId[]): DailyTip {
  if (ctx.readiness.level === "deload") {
    return { headline: ctx.readiness.headline, detail: ctx.readiness.detail, tone: "blood", to: "/base" };
  }
  if (enabled.includes("physique") && ctx.volume.verdict === "a-corriger") {
    return { headline: "Répartition à corriger", detail: ctx.volume.advice, tone: "blood", to: "/physique" };
  }
  if (enabled.includes("combat") && ctx.combat.verdict === "a-corriger") {
    return { headline: "Combat à rééquilibrer", detail: ctx.combat.advice, tone: "blood", to: "/combat" };
  }
  if (enabled.includes("nutrition") && ctx.recalibration.available) {
    return {
      headline: "Nouvelle estimation de maintien",
      detail: `Les derniers jours pointent vers ${ctx.recalibration.liveMaintenanceKcal} kcal.`,
      tone: "gold",
      to: "/nutrition",
    };
  }
  if (ctx.readiness.level === "surveiller") {
    return { headline: ctx.readiness.headline, detail: ctx.readiness.detail, tone: "gold", to: "/base" };
  }
  const idx = dayOfYear() % FALLBACK_TIPS.length;
  return { headline: "Conseil du jour", detail: FALLBACK_TIPS[idx], tone: "steel" };
}
