import type { Exercise, MuscleZone, WorkoutSetLog } from "../db/types";
import { daysBetween, isoDay } from "./dates";

/** Zones qui construisent la silhouette Toji. */
export const PRIORITY_ZONES: MuscleZone[] = [
  "epaules",
  "dos",
  "trapezes",
  "avant-bras",
  "abdos",
  "obliques",
  "cou",
];

/** Zones dont un excès éloigne de la cible (physique de bodybuilder). */
export const COUNTER_ZONES: MuscleZone[] = ["pecs", "bras"];

export const ZONE_LABELS: Record<MuscleZone, string> = {
  epaules: "Épaules",
  dos: "Dos",
  trapezes: "Trapèzes",
  "avant-bras": "Avant-bras",
  abdos: "Abdos",
  obliques: "Obliques",
  cou: "Cou",
  jambes: "Jambes",
  pecs: "Pecs",
  bras: "Bras",
  fessiers: "Fessiers",
  mollets: "Mollets",
};

export interface ZoneVolume {
  zone: MuscleZone;
  sets: number;
  priority: boolean;
  counter: boolean;
}

export interface VolumeReport {
  windowDays: number;
  totalSets: number;
  byZone: ZoneVolume[];
  prioritySets: number;
  counterSets: number;
  /** Séries prioritaires par série "contre-cible". Sous 2, la silhouette dérive. */
  ratio?: number;
  verdict: "aligne" | "a-corriger" | "insuffisant";
  advice: string;
  /** Zones prioritaires sous le seuil de 8 séries hebdo. */
  neglected: MuscleZone[];
}

const WEEKLY_MIN_SETS = 8;

/**
 * Répartit le volume des N derniers jours par zone. Une série qui touche
 * plusieurs zones compte pour chacune : l'objectif est de comparer l'attention
 * portée à chaque zone, pas de conserver un total exact.
 */
export function volumeReport(
  sets: WorkoutSetLog[],
  exercises: Exercise[],
  windowDays = 28,
): VolumeReport {
  const today = isoDay();
  const byId = new Map(exercises.map((e) => [e.id!, e]));

  const recent = sets.filter((s) => {
    const age = daysBetween(s.date, today);
    return age >= 0 && age < windowDays;
  });

  const counts = new Map<MuscleZone, number>();
  for (const set of recent) {
    const ex = byId.get(set.exerciseId);
    if (!ex) continue;
    for (const zone of ex.zones) {
      counts.set(zone, (counts.get(zone) ?? 0) + 1);
    }
  }

  const byZone: ZoneVolume[] = [...counts.entries()]
    .map(([zone, sets]) => ({
      zone,
      sets,
      priority: PRIORITY_ZONES.includes(zone),
      counter: COUNTER_ZONES.includes(zone),
    }))
    .sort((a, b) => b.sets - a.sets);

  const prioritySets = byZone.filter((z) => z.priority).reduce((n, z) => n + z.sets, 0);
  const counterSets = byZone.filter((z) => z.counter).reduce((n, z) => n + z.sets, 0);
  const weeks = windowDays / 7;

  const neglected = PRIORITY_ZONES.filter(
    (z) => (counts.get(z) ?? 0) / weeks < WEEKLY_MIN_SETS,
  );

  if (recent.length < 10) {
    return {
      windowDays,
      totalSets: recent.length,
      byZone,
      prioritySets,
      counterSets,
      verdict: "insuffisant",
      advice:
        "Pas encore assez de séries loggées sur la période pour juger la répartition.",
      neglected: [],
    };
  }

  const ratio = counterSets === 0 ? undefined : prioritySets / counterSets;
  const aligned = ratio === undefined || ratio >= 2;

  return {
    windowDays,
    totalSets: recent.length,
    byZone,
    prioritySets,
    counterSets,
    ratio,
    verdict: aligned && neglected.length === 0 ? "aligne" : "a-corriger",
    advice: buildAdvice(ratio, neglected),
    neglected,
  };
}

function buildAdvice(ratio: number | undefined, neglected: MuscleZone[]): string {
  if (ratio !== undefined && ratio < 2) {
    return `Trop de volume sur pecs/bras par rapport aux zones prioritaires (${ratio.toFixed(1)}:1). Viser au moins 2:1 — retirer une série de poussée, ajouter du tirage ou des élévations.`;
  }
  if (neglected.length > 0) {
    const names = neglected.map((z) => ZONE_LABELS[z].toLowerCase()).join(", ");
    return `Sous le seuil de ${WEEKLY_MIN_SETS} séries hebdo sur : ${names}. Ce sont des zones qui définissent la silhouette cible.`;
  }
  return "Répartition cohérente avec la cible : le volume va bien vers les épaules, le dos et la ceinture.";
}
