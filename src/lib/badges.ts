import type { BodyMeasurement, CombatCheckpoint, CombatSessionLog, WorkoutLog } from "../db/types";
import { smoothBody, TOJI_TARGET } from "./progression";

/**
 * Meilleure valeur lissée jamais atteinte. Prendre le minimum brut décernerait
 * les badges de masse grasse sur le bruit de mesure : sur un an de relevés, le
 * plus bas d'une estimation à ±1,5 point tombe forcément sous n'importe quel
 * seuil, badge acquis sans que le corps ait changé.
 */
function bestSmoothed(
  measurements: BodyMeasurement[],
  pick: (s: ReturnType<typeof smoothBody>) => number | undefined,
  better: (a: number, b: number) => number,
): number | undefined {
  const sorted = [...measurements].sort((a, b) => a.date.localeCompare(b.date));
  let best: number | undefined;
  for (let i = 1; i <= sorted.length; i++) {
    const value = pick(smoothBody(sorted.slice(0, i)));
    if (value === undefined) continue;
    best = best === undefined ? value : better(best, value);
  }
  return best;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  axis: "toji" | "ippo" | "meta";
  earned: boolean;
  /** Progression 0-1 vers l'obtention, pour afficher un badge non débloqué. */
  progress: number;
}

interface BadgeInput {
  workouts: WorkoutLog[];
  combat: CombatSessionLog[];
  measurements: BodyMeasurement[];
  checkpoints: CombatCheckpoint[];
  photoCount: number;
  workoutStreak: number;
  combatStreak: number;
}

export function computeBadges(input: BadgeInput): Badge[] {
  const done = input.workouts.filter((w) => w.completed).length;
  const combatCount = input.combat.length;
  const rounds = input.combat.reduce((n, c) => n + (c.rounds ?? 0), 0);
  const sparring = input.combat.filter((c) => c.kind === "sparring").length;
  const checkDone = input.checkpoints.filter((c) => c.achieved).length;
  const lowestBf = bestSmoothed(input.measurements, (s) => s.bfPercent, Math.min) ?? Infinity;
  const bestV = bestSmoothed(input.measurements, (s) => s.vTaper, Math.max) ?? 0;

  const defs: Array<Omit<Badge, "earned" | "progress"> & { value: number; goal: number }> = [
    { id: "first-blood", name: "Premier sang", description: "Première séance loggée", axis: "meta", value: done + combatCount, goal: 1 },
    { id: "w10", name: "Dix rounds", description: "10 séances de musculation", axis: "toji", value: done, goal: 10 },
    { id: "w50", name: "Discipline", description: "50 séances de musculation", axis: "toji", value: done, goal: 50 },
    { id: "w150", name: "Forgé", description: "150 séances de musculation", axis: "toji", value: done, goal: 150 },
    { id: "streak4", name: "Un mois plein", description: "4 semaines consécutives à 3+ séances", axis: "toji", value: input.workoutStreak, goal: 4 },
    { id: "streak12", name: "Trimestre tenu", description: "12 semaines consécutives à 3+ séances", axis: "toji", value: input.workoutStreak, goal: 12 },
    { id: "bf12", name: "La couche part", description: "Passer sous 12 % de masse grasse", axis: "toji", value: lowestBf === Infinity ? 0 : Math.max(0, 14 - lowestBf), goal: 2 },
    { id: "bf10", name: "Découpé", description: "Passer sous 10 % de masse grasse", axis: "toji", value: lowestBf === Infinity ? 0 : Math.max(0, 14 - lowestBf), goal: 4 },
    { id: "vtaper", name: "Carrure en V", description: `Ratio épaules/taille à ${TOJI_TARGET.vTaper}`, axis: "toji", value: Math.max(0, bestV - 1.2), goal: TOJI_TARGET.vTaper - 1.2 },
    { id: "photo12", name: "Archives", description: "12 semaines de suivi photo", axis: "meta", value: input.photoCount, goal: 36 },
    { id: "c10", name: "Le tapis", description: "10 séances de combat", axis: "ippo", value: combatCount, goal: 10 },
    { id: "c50", name: "Régulier au club", description: "50 séances de combat", axis: "ippo", value: combatCount, goal: 50 },
    { id: "r100", name: "Cent rounds", description: "100 rounds cumulés", axis: "ippo", value: rounds, goal: 100 },
    { id: "r500", name: "Cinq cents rounds", description: "500 rounds cumulés", axis: "ippo", value: rounds, goal: 500 },
    { id: "spar10", name: "Encaisser", description: "10 séances de sparring", axis: "ippo", value: sparring, goal: 10 },
    { id: "combatstreak8", name: "Deux mois au tapis", description: "8 semaines consécutives à 2+ séances combat", axis: "ippo", value: input.combatStreak, goal: 8 },
    { id: "cp-half", name: "Mi-parcours technique", description: "Moitié des checkpoints validés", axis: "ippo", value: checkDone, goal: Math.max(1, Math.ceil(input.checkpoints.length / 2)) },
    { id: "cp-all", name: "Programme technique bouclé", description: "Tous les checkpoints validés", axis: "ippo", value: checkDone, goal: Math.max(1, input.checkpoints.length) },
  ];

  return defs.map(({ value, goal, ...rest }) => ({
    ...rest,
    earned: value >= goal,
    progress: goal === 0 ? 0 : Math.max(0, Math.min(1, value / goal)),
  }));
}
