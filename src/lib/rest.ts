import type { Exercise } from "../db/types";
import { repRange } from "./records";

export const REST_PRESETS = [60, 90, 120, 180];

/**
 * Temps de repos proposé pour un exercice.
 *
 * Le minuteur démarrait toujours à 90 s, quel que soit le mouvement : trop long
 * pour des élévations latérales, trop court derrière une série lourde. Comme le
 * réglage se fait entre deux séries, essoufflé, il n'était en pratique jamais
 * corrigé — le repos réel ne correspondait donc à rien.
 *
 * La règle suit la charge relative : plus la série est lourde et courte, plus la
 * récupération nerveuse est longue.
 */
export function suggestedRestSeconds(exercise: Exercise | undefined): number {
  if (!exercise) return 90;

  const [low] = repRange(exercise.defaultReps);

  // Séries courtes : c'est du travail lourd, la récupération prime.
  if (low <= 6) return exercise.priority === "primaire" ? 180 : 120;
  if (low <= 10) return exercise.priority === "primaire" ? 120 : 90;

  // Séries longues (gainage, avant-bras, cou) : la densité fait partie du stimulus.
  return exercise.priority === "primaire" ? 90 : 60;
}
