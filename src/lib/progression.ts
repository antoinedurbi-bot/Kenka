import type { BodyMeasurement, CombatCheckpoint } from "../db/types";

/**
 * Cibles Toji. Le %BF et le ratio épaules/taille sont les deux marqueurs
 * qui décrivent réellement la silhouette visée ; le poids seul ne dit rien.
 */
export const TOJI_TARGET = {
  bfPercent: 9,
  bfStart: 14,
  /** Ratio épaules / taille — 1.618 est la référence classique du V-taper. */
  vTaper: 1.618,
  weightKg: 71,
};

export const DEFAULT_HEIGHT_CM = 169;

export interface AxisLevel {
  level: number;
  levelMax: number;
  progress: number; // 0-1 dans le niveau courant
  title: string;
  detail: string;
  /** Vrai tant que le niveau repose sur trop peu de mesures pour être stable. */
  provisional?: boolean;
}

const PHYSIQUE_TITLES = [
  "Civil",
  "Pratiquant",
  "Corps entraîné",
  "Sec",
  "Découpé",
  "Fonctionnel",
  "Assassin",
];

/** Nombre de mesures agrégées pour lisser le bruit de mesure. */
const SMOOTHING_WINDOW = 3;

export interface SmoothedBody {
  bfPercent?: number;
  vTaper?: number;
  weightKg?: number;
  samples: number;
}

/**
 * Moyenne des N dernières mesures. Un centimètre d'écart au mètre ruban déplace
 * l'estimation Navy d'environ 1,5 point : sans lissage, le niveau oscillerait
 * au gré de la façon dont le ruban a été tendu, ce qui détruit sa crédibilité.
 */
export function smoothBody(measurements: BodyMeasurement[]): SmoothedBody {
  const sorted = [...measurements].sort((a, b) => a.date.localeCompare(b.date));
  const window = sorted.slice(-SMOOTHING_WINDOW);

  const mean = (pick: (m: BodyMeasurement) => number | undefined) => {
    const vals = window.map(pick).filter((v): v is number => v !== undefined);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : undefined;
  };

  const ratios = window
    .map((m) => (m.shouldersCm && m.waistCm ? m.shouldersCm / m.waistCm : undefined))
    .filter((v): v is number => v !== undefined);

  return {
    bfPercent: mean((m) => m.bfPercent),
    weightKg: mean((m) => m.weightKg),
    vTaper: ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : undefined,
    samples: window.length,
  };
}

/**
 * Niveau physique : moyenne pondérée de deux scores 0-1 — la fonte de masse grasse
 * (poids 0.6, c'est le facteur dominant de la silhouette) et le V-taper (poids 0.4),
 * tous deux lissés. Sans mesure enregistrée, aucun niveau n'est attribué.
 */
export function physiqueLevel(measurements: BodyMeasurement[]): AxisLevel {
  const levelMax = PHYSIQUE_TITLES.length - 1;

  if (measurements.length === 0) {
    return {
      level: 0,
      levelMax,
      progress: 0,
      title: PHYSIQUE_TITLES[0],
      detail: "Aucune mesure enregistrée",
    };
  }

  const smooth = smoothBody(measurements);

  const bfScore =
    smooth.bfPercent === undefined
      ? 0
      : clamp01(
          (TOJI_TARGET.bfStart - smooth.bfPercent) /
            (TOJI_TARGET.bfStart - TOJI_TARGET.bfPercent),
        );

  const vScore =
    smooth.vTaper === undefined ? 0 : clamp01((smooth.vTaper - 1.2) / (TOJI_TARGET.vTaper - 1.2));

  const score = smooth.vTaper !== undefined ? bfScore * 0.6 + vScore * 0.4 : bfScore;

  const raw = score * levelMax;
  const level = Math.min(Math.floor(raw), levelMax);

  const details: string[] = [];
  if (smooth.bfPercent !== undefined) {
    details.push(`${smooth.bfPercent.toFixed(1)} % BF → cible ${TOJI_TARGET.bfPercent} %`);
  }
  if (smooth.vTaper !== undefined) {
    details.push(`V-taper ${smooth.vTaper.toFixed(2)} → ${TOJI_TARGET.vTaper}`);
  }

  return {
    level,
    levelMax,
    progress: raw - level,
    title: PHYSIQUE_TITLES[level],
    detail: details.join(" · ") || "Mesures incomplètes",
    provisional: smooth.samples < SMOOTHING_WINDOW,
  };
}

const SKILL_TITLES = [
  "Débutant",
  "Bases posées",
  "Amateur confirmé",
  "Solide",
  "Technique",
  "Combattant",
];

/** Niveau skills : proportion de checkpoints Ippo validés, tous axes confondus. */
export function skillsLevel(checkpoints: CombatCheckpoint[]): AxisLevel {
  const levelMax = SKILL_TITLES.length - 1;
  const total = checkpoints.length;
  const done = checkpoints.filter((c) => c.achieved).length;
  const score = total === 0 ? 0 : done / total;

  const raw = score * levelMax;
  const level = Math.min(Math.floor(raw), levelMax);

  return {
    level,
    levelMax,
    progress: raw - level,
    title: SKILL_TITLES[level],
    detail: `${done}/${total} checkpoints validés`,
  };
}

export const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Estimation Navy du %BF (homme) à partir du tour de cou, de taille et de la stature.
 * Approximation — utile pour suivre une tendance, pas pour une valeur absolue.
 */
export function estimateBodyFat(
  waistCm?: number,
  neckCm?: number,
  heightCm = DEFAULT_HEIGHT_CM,
) {
  if (!waistCm || !neckCm || waistCm <= neckCm) return undefined;
  const bf =
    495 /
      (1.0324 - 0.19077 * Math.log10(waistCm - neckCm) + 0.15456 * Math.log10(heightCm)) -
    450;
  return bf > 0 && bf < 60 ? Math.round(bf * 10) / 10 : undefined;
}
