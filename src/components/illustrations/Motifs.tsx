/**
 * Motifs décoratifs SVG maison — pas d'illustration stock, pas d'emoji.
 * Tout reste dans la palette encre/sang/acier définie dans index.css, pour que
 * l'ajout visuel renforce l'identité "affiche de combat" plutôt qu'il ne la dilue.
 */

export function BrushStroke({ className, color = "currentColor" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 240 24" fill="none" className={className} aria-hidden>
      <path
        d="M2 14C40 4 90 2 130 10C165 17 200 6 238 12"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.8"
      />
      <path
        d="M2 18C50 22 100 20 150 16C185 13 210 18 238 15"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.35"
      />
    </svg>
  );
}

/** Éclaboussure d'encre utilisée comme fond décoratif derrière un chiffre héros. */
export function InkSplash({ className, color = "currentColor" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 200 200" fill="none" className={className} aria-hidden>
      <path
        d="M100 8C120 8 128 28 150 30C176 32 190 52 182 74C176 90 190 100 186 120C182 142 160 148 154 168C148 188 122 194 100 182C82 172 62 190 42 176C22 162 24 138 12 122C0 106 8 82 24 70C38 60 34 38 54 26C72 16 82 8 100 8Z"
        fill={color}
      />
    </svg>
  );
}

/** Sceau kanji circulaire — utilisé comme accent de badge / réussite. */
export function KanjiSeal({
  kanji,
  className,
  color = "currentColor",
}: {
  kanji: string;
  className?: string;
  color?: string;
}) {
  return (
    <svg viewBox="0 0 80 80" className={className} aria-hidden>
      <circle cx="40" cy="40" r="37" stroke={color} strokeWidth="2.5" fill="none" opacity="0.9" />
      <circle cx="40" cy="40" r="30" stroke={color} strokeWidth="1" fill="none" opacity="0.4" />
      <text
        x="40"
        y="40"
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize="34"
        fontFamily="Oswald, sans-serif"
      >
        {kanji}
      </text>
    </svg>
  );
}

/**
 * Silhouette de combattant en garde, tracée au trait — motif héros pour
 * l'onboarding et les états vides. Volontairement anguleuse (pas de courbes
 * douces) pour rester cohérente avec la géométrie nette du reste de l'UI.
 */
export function FighterMark({ className, color = "currentColor" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 120 160" fill="none" className={className} aria-hidden>
      <path
        d="M60 14L68 26L64 40L74 46L86 40L92 52L80 62L82 78L96 92L92 106L74 96L68 108L72 130L64 156L56 130L60 108L54 96L36 106L32 92L46 78L48 62L36 52L42 40L52 46L56 40L52 26L60 14Z"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
        fill="none"
        opacity="0.9"
      />
      <circle cx="60" cy="10" r="6" stroke={color} strokeWidth="2.5" fill="none" />
    </svg>
  );
}

/** Anneau de progression circulaire — remplace la simple barre pour les niveaux. */
export function ProgressRing({
  progress,
  size = 88,
  strokeWidth = 6,
  color,
  trackColor = "#262320",
  children,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  trackColor?: string;
  children?: React.ReactNode;
}) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          style={{ transition: "stroke-dashoffset 700ms cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">{children}</div>
      )}
    </div>
  );
}
