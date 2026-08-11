import type { DailyIntake, DailyWeight, NutritionCheckIn } from "../db/types";
import { daysBetween, isoDay } from "./dates";

/** Cible de recomposition : surplus léger, +0.25 à +0.4 kg/semaine. */
export const SURPLUS_RANGE = { min: 300, max: 500 };
export const WEEKLY_GAIN_TARGET = { min: 0.25, max: 0.4 };

export function suggestTarget(maintenanceKcal: number) {
  return Math.round(maintenanceKcal + (SURPLUS_RANGE.min + SURPLUS_RANGE.max) / 2);
}

/**
 * Répartition macro pour une recomposition : protéines 2 g/kg (haut du spectre
 * utile, pas au-delà), lipides à 25 % des calories, le reste en glucides —
 * c'est le carburant de l'entraînement, on ne le coupe pas.
 */
export function suggestMacros(targetKcal: number, weightKg: number) {
  const proteinG = Math.round(weightKg * 2);
  const fatG = Math.round((targetKcal * 0.25) / 9);
  const carbsG = Math.round((targetKcal - proteinG * 4 - fatG * 9) / 4);
  return { proteinG, fatG, carbsG: Math.max(0, carbsG) };
}

export interface CalibrationResult {
  ready: boolean;
  days: number;
  avgKcal?: number;
  /** Pente de poids sur la fenêtre, en kg/semaine. */
  slopeKgPerWeek?: number;
  maintenanceKcal?: number;
  advice: string;
}

const MIN_CALIBRATION_DAYS = 7;
/** 1 kg de masse ≈ 7700 kcal : convertit une dérive de poids en écart calorique. */
const KCAL_PER_KG = 7700;

/**
 * Calibration réelle du maintien, à partir des données saisies dans l'app plutôt
 * que d'une formule théorique : apport moyen sur la fenêtre, corrigé de la
 * dérive de poids observée sur la même période.
 */
export function calibrateMaintenance(
  intake: DailyIntake[],
  weights: DailyWeight[],
  windowDays = 10,
): CalibrationResult {
  const today = isoDay();
  const inWindow = (d: string) => {
    const age = daysBetween(d, today);
    return age >= 0 && age < windowDays;
  };

  const kcals = intake.filter((i) => inWindow(i.date));
  const ws = weights.filter((w) => inWindow(w.date)).sort((a, b) => a.date.localeCompare(b.date));

  if (kcals.length < MIN_CALIBRATION_DAYS || ws.length < MIN_CALIBRATION_DAYS) {
    const missing = Math.max(
      MIN_CALIBRATION_DAYS - kcals.length,
      MIN_CALIBRATION_DAYS - ws.length,
    );
    return {
      ready: false,
      days: Math.min(kcals.length, ws.length),
      advice: `Encore ${missing} jour(s) d'apport ET de pesée pour calibrer. Manger normalement, ne rien changer pendant la mesure.`,
    };
  }

  const avgKcal = kcals.reduce((n, i) => n + i.kcal, 0) / kcals.length;
  const slope = weightSlopePerWeek(ws);
  const dailyDelta = (slope * KCAL_PER_KG) / 7;
  const maintenance = Math.round((avgKcal - dailyDelta) / 10) * 10;

  return {
    ready: true,
    days: kcals.length,
    avgKcal: Math.round(avgKcal),
    slopeKgPerWeek: slope,
    maintenanceKcal: maintenance,
    advice: `Sur ${kcals.length} jours à ${Math.round(avgKcal)} kcal, le poids évolue de ${slope >= 0 ? "+" : ""}${slope.toFixed(2)} kg/sem. Maintien estimé à ${maintenance} kcal.`,
  };
}

/** Régression linéaire simple sur les pesées, ramenée à une pente hebdomadaire. */
export function weightSlopePerWeek(weights: DailyWeight[]): number {
  if (weights.length < 2) return 0;
  const base = weights[0].date;
  const pts = weights.map((w) => ({ x: daysBetween(base, w.date), y: w.weightKg }));
  const n = pts.length;
  const sumX = pts.reduce((s, p) => s + p.x, 0);
  const sumY = pts.reduce((s, p) => s + p.y, 0);
  const sumXY = pts.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = pts.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return 0;
  return ((n * sumXY - sumX * sumY) / denom) * 7;
}

/** Mémoire longue volontaire : réagir vite au bruit d'un jour annulerait le lissage. */
const TREND_ALPHA = 0.15;

/**
 * Poids lissé par moyenne mobile exponentielle. La balance varie de ±1-2 kg
 * d'un jour à l'autre selon l'hydratation et le contenu digestif — sans ce
 * lissage, "la tendance" ne serait que ce bruit, pas un vrai changement de
 * masse. C'est la ligne que la calibration et le graphique doivent lire, pas
 * le poids brut du jour.
 */
export function trendWeight(weights: DailyWeight[]): { date: string; value: number }[] {
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const out: { date: string; value: number }[] = [];
  let ema: number | undefined;
  for (const w of sorted) {
    ema = ema === undefined ? w.weightKg : ema + TREND_ALPHA * (w.weightKg - ema);
    out.push({ date: w.date, value: Math.round(ema * 100) / 100 });
  }
  return out;
}

export interface RecalibrationSuggestion {
  available: boolean;
  liveMaintenanceKcal?: number;
  deltaKcal?: number;
}

/** En dessous, la dérive n'est que du bruit de calibration — pas de quoi rouvrir la cible. */
const RECALIBRATION_THRESHOLD_KCAL = 100;

/**
 * Contrairement à une calibration figée jusqu'au prochain passage manuel,
 * l'estimation "vraie" du maintien bouge chaque jour avec les nouvelles
 * données. On ne réécrit jamais la valeur retenue sans confirmation — mais
 * l'app doit dire quand elle a dérivé de ce que les chiffres montrent
 * maintenant, plutôt que de laisser une cible obsolète en silence.
 */
export function recalibrationSuggestion(
  stored: number | null,
  intake: DailyIntake[],
  weights: DailyWeight[],
): RecalibrationSuggestion {
  const live = calibrateMaintenance(intake, weights);
  if (!live.ready || live.maintenanceKcal === undefined) return { available: false };
  if (stored === null) return { available: true, liveMaintenanceKcal: live.maintenanceKcal };

  const deltaKcal = live.maintenanceKcal - stored;
  return {
    available: Math.abs(deltaKcal) >= RECALIBRATION_THRESHOLD_KCAL,
    liveMaintenanceKcal: live.maintenanceKcal,
    deltaKcal,
  };
}

/** Moyenne des pesées d'une semaine donnée — sert au rollup automatique. */
export function weeklyAverage(weights: DailyWeight[], weekStart: string): number | undefined {
  const inWeek = weights.filter((w) => {
    const age = daysBetween(weekStart, w.date);
    return age >= 0 && age < 7;
  });
  if (inWeek.length === 0) return undefined;
  return (
    Math.round((inWeek.reduce((n, w) => n + w.weightKg, 0) / inWeek.length) * 100) / 100
  );
}

export type TrendVerdict = "trop-lent" | "dans-la-cible" | "trop-rapide" | "insuffisant";

export interface Trend {
  verdict: TrendVerdict;
  deltaKgPerWeek?: number;
  advice: string;
}

/** Compare les deux derniers check-ins pesés pour juger la vitesse de prise. */
export function weightTrend(checkIns: NutritionCheckIn[]): Trend {
  const weighed = checkIns
    .filter((c) => c.avgWeightKg !== undefined)
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  if (weighed.length < 2) {
    return {
      verdict: "insuffisant",
      advice: "Il faut au moins deux semaines pesées pour juger une tendance.",
    };
  }

  const last = weighed[weighed.length - 1];
  const prev = weighed[weighed.length - 2];
  const weeks = Math.max(
    1,
    Math.round(
      (new Date(last.weekStart).getTime() - new Date(prev.weekStart).getTime()) / (7 * 86_400_000),
    ),
  );
  const delta = (last.avgWeightKg! - prev.avgWeightKg!) / weeks;

  if (delta < WEEKLY_GAIN_TARGET.min) {
    return {
      verdict: "trop-lent",
      deltaKgPerWeek: delta,
      advice: "Prise trop lente : ajouter 150-200 kcal/jour et réévaluer dans deux semaines.",
    };
  }
  if (delta > WEEKLY_GAIN_TARGET.max) {
    return {
      verdict: "trop-rapide",
      deltaKgPerWeek: delta,
      advice: "Prise trop rapide, risque de gras : retirer 150-200 kcal/jour.",
    };
  }
  return {
    verdict: "dans-la-cible",
    deltaKgPerWeek: delta,
    advice: "Vitesse correcte. Ne rien changer, continuer à peser.",
  };
}
