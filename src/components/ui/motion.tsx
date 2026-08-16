import { useEffect, useRef, useState } from "react";
import { animate, motion, useInView, useReducedMotion } from "motion/react";
import type { HTMLMotionProps } from "motion/react";
import clsx from "clsx";

/**
 * Briques d'animation de KENKA.
 *
 * Portées à la main depuis les patterns de Magic UI, Aceternity et ReactBits
 * plutôt qu'installées : ces bibliothèques sont pensées pour le style
 * shadcn — coins arrondis, cartes flottantes, dégradés violets. La direction
 * artistique d'ici est l'inverse (angles nets, oxblood, encre chaude), donc on
 * garde la mécanique et on jette l'habillage.
 *
 * Règle commune : toute animation respecte `prefers-reduced-motion`, et aucune
 * ne retarde la lecture d'un chiffre — les valeurs sont exactes dès la fin de
 * l'animation, et immédiatement si elle est désactivée.
 */

/* ------------------------------------------------------------------ *
 * NumberTicker — d'après Magic UI
 * ------------------------------------------------------------------ */

export function NumberTicker({
  value,
  decimals = 0,
  className,
  /** Démarre au premier affichage à l'écran plutôt qu'au montage. */
  onView = true,
}: {
  value: number;
  decimals?: number;
  className?: string;
  onView?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const inView = useInView(ref, { once: true, margin: "0px 0px -20% 0px" });
  const [display, setDisplay] = useState(reduced || !onView ? value : 0);

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }
    if (onView && !inView) return;
    const controls = animate(display, value, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
    // `display` est volontairement hors dépendances : le relire relancerait
    // l'animation à chaque image.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, inView, reduced, onView]);

  return (
    <span ref={ref} className={clsx("tabular-nums", className)}>
      {display.toFixed(decimals)}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * BorderBeam — d'après Magic UI, en version angles nets
 * ------------------------------------------------------------------ */

/**
 * Un trait de lumière qui parcourt le bord d'un bloc. La version d'origine
 * arrondit le faisceau ; ici il suit un rectangle strict, sinon il trahirait
 * la géométrie de tout le reste de l'app.
 *
 * Réservé à ce qui doit attirer l'œil une seule fois par écran : la séance du
 * jour, un record qui tombe. Généralisé, il devient du bruit.
 */
export function BorderBeam({
  duration = 6,
  color = "#c8323f",
  className,
}: {
  duration?: number;
  color?: string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  if (reduced) return null;

  /*
   * Le masque doit porter sur l'enveloppe, pas sur le dégradé : en CSS il
   * s'applique à tout le sous-arbre, donc l'enveloppe ne laisse voir que sa
   * propre couronne d'un pixel et le dégradé tourne derrière. Masquer le
   * dégradé lui-même découperait le contour du carré en rotation — c'est-à-dire
   * n'importe où sauf sur le bord de la carte.
   */
  return (
    <span
      aria-hidden
      className={clsx("pointer-events-none absolute inset-0 overflow-hidden", className)}
      style={{
        padding: 1,
        mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
        maskComposite: "exclude",
        WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
        WebkitMaskComposite: "xor",
      }}
    >
      <motion.span
        className="absolute left-1/2 top-1/2 aspect-square w-[180%] -translate-x-1/2 -translate-y-1/2"
        style={{
          background: `conic-gradient(from 0deg, transparent 0deg, transparent 290deg, ${color} 350deg, transparent 360deg)`,
        }}
        animate={{ rotate: 360 }}
        transition={{ duration, repeat: Infinity, ease: "linear" }}
      />
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * ProgressRing — anneau animé, d'après les ring charts de Bklit
 * ------------------------------------------------------------------ */

export function ProgressRing({
  value,
  size = 64,
  stroke = 4,
  color = "#c8323f",
  track = "#1d1b19",
  children,
}: {
  /** 0 → 1. */
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const clamped = Math.max(0, Math.min(1, value));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeLinecap="butt"
          initial={{ strokeDashoffset: reduced ? circumference * (1 - clamped) : circumference }}
          animate={{ strokeDashoffset: circumference * (1 - clamped) }}
          transition={{ duration: reduced ? 0 : 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">{children}</div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Spotlight — d'après les fonds Aceternity
 * ------------------------------------------------------------------ */

/**
 * Halo fixe en haut de l'écran, très faible. Il donne une source de lumière au
 * fond au lieu d'un aplat noir uniforme, sans jamais devenir un dégradé
 * décoratif : au-delà de 0.07 d'opacité, le grain du fond disparaît.
 */
export function Spotlight({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={clsx("pointer-events-none absolute inset-x-0 top-0 h-72 overflow-hidden", className)}
    >
      <div
        className="absolute left-1/2 top-[-45%] h-[130%] w-[140%] -translate-x-1/2"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(165,38,51,0.16) 0%, rgba(165,38,51,0.05) 40%, transparent 70%)",
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Révélation au montage — d'après ReactBits
 * ------------------------------------------------------------------ */

/** Entrée sobre : 8 px vers le haut, jamais de rebond ni d'échelle. */
export function Reveal({
  delay = 0,
  className,
  children,
  ...rest
}: { delay?: number } & HTMLMotionProps<"div">) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ *
 * Barre animée
 * ------------------------------------------------------------------ */

/** Remplacement animé de `Bar` là où la valeur mérite d'être regardée grandir. */
export function AnimatedBar({
  value,
  className,
  barClassName,
}: {
  value: number;
  className?: string;
  barClassName?: string;
}) {
  const reduced = useReducedMotion();
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className={clsx("h-1 w-full bg-ink-800", className)}>
      <motion.div
        className={clsx("h-full", barClassName)}
        initial={reduced ? false : { width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: reduced ? 0 : 0.9, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}
