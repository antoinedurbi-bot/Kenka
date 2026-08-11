import type { CSSProperties } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { db } from "../../db/db";
import { SECTION_PATH, SECTIONS, useEnabledSections } from "../../lib/sections";
import { SPLIT_LABELS } from "../../lib/split";
import { KanjiSeal } from "../../components/illustrations/Motifs";

const BASE_TILE = {
  to: "/base",
  label: "Base",
  kanji: "拳",
  blurb: "Niveaux, régularité, badges — l'état général.",
};

/**
 * Passage obligé à chaque ouverture : plutôt qu'un tableau de bord chargé de
 * tout, l'app demande d'abord ce qu'on est venu y faire. Un tap suffit pour
 * atterrir directement dans la section choisie — pas de barre du bas à lire,
 * pas d'écran à faire défiler pour trouver ce qu'on cherche.
 */
export function Hub() {
  const [enabled] = useEnabledSections();
  const draft = useLiveQuery(() => db.sessionDraft.get("current"), []);

  const tiles = [
    BASE_TILE,
    ...SECTIONS.filter((s) => enabled.includes(s.id)).map((s) => ({
      to: SECTION_PATH[s.id],
      label: s.label,
      kanji: s.kanji,
      blurb: s.blurb,
    })),
  ];

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-xl tracking-[0.2em] text-bone-50">KENKA</span>
          <span className="font-mono text-[10px] tracking-[0.16em] text-blood-500">喧嘩</span>
        </div>
        <Link
          to="/reglages"
          className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone-600 hover:text-bone-200"
        >
          Réglages
        </Link>
      </div>

      {draft && (
        <Link
          to="/seance"
          className="k-anim-in mb-5 block border border-blood-500 bg-blood-900/30 px-3 py-3 transition-colors hover:border-blood-400"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="font-display text-sm uppercase tracking-[0.08em] text-bone-50">
                Séance en cours
              </div>
              <div className="k-label mt-0.5">
                {SPLIT_LABELS[draft.splitDay]} · reprendre là où tu t'es arrêté
              </div>
            </div>
            <span className="font-mono text-bone-300">→</span>
          </div>
        </Link>
      )}

      <p className="mb-6 text-sm leading-relaxed text-bone-400">Qu'est-ce qu'on fait ?</p>

      <div className="flex-1 space-y-2.5">
        {tiles.map((tile, i) => (
          <Link
            key={tile.to}
            to={tile.to}
            style={{ "--k-stagger": i } as CSSProperties}
            className={clsx(
              "k-anim-in relative flex items-center gap-4 overflow-hidden border border-ink-700 bg-ink-950 px-4 py-4 transition-colors active:border-blood-500 active:bg-blood-900/20",
            )}
          >
            <KanjiSeal
              kanji={tile.kanji}
              color="#c8323f"
              className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 opacity-[0.08]"
            />
            <span className="font-display text-2xl text-blood-400" aria-hidden>
              {tile.kanji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base text-bone-50">{tile.label}</span>
              <span className="mt-0.5 block text-xs leading-snug text-bone-600">{tile.blurb}</span>
            </span>
            <span className="font-mono text-bone-600" aria-hidden>
              →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
