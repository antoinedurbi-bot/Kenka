import { useEffect } from "react";
import { useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";

/**
 * Hooks d'animation, séparés des composants : les mélanger dans le même
 * fichier casse le rafraîchissement à chaud de Vite.
 */

/**
 * Retour d'appui sur les grandes cibles. Volontairement discret (0.985) : sur
 * une tuile pleine largeur, un scale plus marqué donne l'impression que
 * l'écran recule.
 */
export function usePressScale() {
  const reduced = useReducedMotion();
  return reduced ? {} : { whileTap: { scale: 0.985 } };
}

/** Compteur lissé pour une valeur qui change en continu (tonnage en séance). */
export function useSmoothNumber(value: number) {
  const mv = useMotionValue(value);
  const spring = useSpring(mv, { stiffness: 120, damping: 20 });
  const rounded = useTransform(spring, (v) => Math.round(v));
  useEffect(() => {
    mv.set(value);
  }, [value, mv]);
  return rounded;
}
