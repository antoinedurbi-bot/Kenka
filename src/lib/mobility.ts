import type { MobilityMetric } from "../db/types";

export interface MobilityMetricDef {
  metric: MobilityMetric;
  label: string;
  unit: string;
  /** Protocole de mesure — sans lui, deux relevés ne sont pas comparables. */
  how: string;
  /** true si une valeur qui baisse est un progrès (distance au sol, prise). */
  lowerIsBetter: boolean;
  target?: number;
}

export const MOBILITY_METRICS: MobilityMetricDef[] = [
  {
    metric: "grand-ecart-facial",
    label: "Grand écart facial",
    unit: "cm",
    how: "Descendre jusqu'au seuil tolérable, jambes alignées. Mesurer la distance entre le pubis et le sol.",
    lowerIsBetter: true,
    target: 0,
  },
  {
    metric: "high-kick",
    label: "High kick",
    unit: "cm",
    how: "Contre un mur, jambe arrière. Marquer le point le plus haut atteint sans que le buste ne parte en arrière.",
    lowerIsBetter: false,
  },
  {
    metric: "epaules-baton",
    label: "Prise épaules (bâton)",
    unit: "cm",
    how: "Écart minimal entre les mains permettant de passer le bâton devant/derrière, bras tendus.",
    lowerIsBetter: true,
  },
  {
    metric: "toucher-orteils",
    label: "Toucher les orteils",
    unit: "cm",
    how: "Jambes tendues. Distance doigts-sol. Négatif si les doigts passent sous les orteils (sur une marche).",
    lowerIsBetter: true,
    target: 0,
  },
  {
    metric: "squat-profond",
    label: "Squat profond tenu",
    unit: "s",
    how: "Talons au sol, dos le plus droit possible. Durée tenue sans décoller les talons.",
    lowerIsBetter: false,
    target: 60,
  },
];

export const metricDef = (m: MobilityMetric) =>
  MOBILITY_METRICS.find((d) => d.metric === m) ?? MOBILITY_METRICS[0];

/** Progrès signé : positif = amélioration, quel que soit le sens de la métrique. */
export function mobilityDelta(def: MobilityMetricDef, first: number, last: number) {
  const raw = last - first;
  return def.lowerIsBetter ? -raw : raw;
}
