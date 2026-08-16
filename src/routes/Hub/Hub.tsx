import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link, useNavigate } from "react-router-dom";
import clsx from "clsx";
import { db } from "../../db/db";
import { SECTION_PATH, SECTIONS, useEnabledSections } from "../../lib/sections";
import {
  DEFAULT_SPLIT,
  LOGGABLE_SPLIT_DAYS,
  SPLIT_LABELS,
  weekdayOf,
} from "../../lib/split";
import type { Weekday } from "../../lib/split";
import type { Exercise, SplitDay } from "../../db/types";
import { useSetting } from "../../lib/useSetting";
import { sessionTemplate } from "../../lib/performance";
import { startDraft } from "../../lib/sessionDraft";
import { isoDay } from "../../lib/dates";
import { useCoachingContext, dailyTip } from "../../lib/coaching";
import { KanjiSeal } from "../../components/illustrations/Motifs";
import { Tag } from "../../components/ui";
import { BorderBeam, Spotlight } from "../../components/ui/motion";
import { usePressScale } from "../../components/ui/motionHooks";
import { motion } from "motion/react";

const BASE_TILE = {
  to: "/base",
  label: "Base",
  kanji: "拳",
  blurb: "Niveaux, régularité, badges — l'état général.",
};

const NO_EXERCISES: Exercise[] = [];

/**
 * Placée juste après « Base » : c'est l'entrée sans objectif précis — celle
 * qu'on prend quand on ouvre l'app sans savoir quoi y faire. Sans elle, ces
 * ouvertures-là se terminaient par une fermeture immédiate.
 */
const FEED_TILE = {
  to: "/decouvrir",
  label: "Découvrir",
  kanji: "発",
  blurb: "Constats, exercices à tester, principes — un par écran.",
};

const CHAT_TILE = {
  to: "/chat",
  label: "Chat",
  kanji: "話",
  blurb: "Coach IA — questions sur ta progression.",
};

const TIP_TONE_CLASS = {
  blood: "border-l-blood-500",
  gold: "border-l-gold-400",
  jade: "border-l-jade-400",
  steel: "border-l-steel-400",
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
  const ctx = useCoachingContext();
  const tip = dailyTip(ctx, enabled);

  const tiles = [
    BASE_TILE,
    FEED_TILE,
    ...SECTIONS.filter((s) => enabled.includes(s.id)).map((s) => ({
      to: SECTION_PATH[s.id],
      label: s.label,
      kanji: s.kanji,
      blurb: s.blurb,
    })),
    CHAT_TILE,
  ];

  return (
    <div className="relative mx-auto flex min-h-dvh max-w-md flex-col px-5 py-8">
      <Spotlight />
      <div className="relative mb-7 flex items-center justify-between">
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

      {draft ? (
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
      ) : (
        <TodaySessionCard physiqueOn={enabled.includes("physique")} combatOn={enabled.includes("combat")} />
      )}

      <div className={clsx("k-anim-in mb-6 border-l-2 px-3 py-2.5", TIP_TONE_CLASS[tip.tone])}>
        <div className="k-label">Conseil</div>
        {tip.to ? (
          <Link to={tip.to} className="mt-1 block">
            <div className="text-sm text-bone-50">{tip.headline}</div>
            <p className="mt-1 text-xs leading-relaxed text-bone-400">{tip.detail}</p>
          </Link>
        ) : (
          <>
            <div className="mt-1 text-sm text-bone-50">{tip.headline}</div>
            <p className="mt-1 text-xs leading-relaxed text-bone-400">{tip.detail}</p>
          </>
        )}
      </div>

      <p className="mb-3 text-sm leading-relaxed text-bone-400">Qu'est-ce qu'on fait ?</p>

      <div className="relative flex-1 space-y-2.5">
        {tiles.map((tile, i) => (
          <TileLink key={tile.to} tile={tile} index={i} />
        ))}
      </div>
    </div>
  );
}

/**
 * La cascade d'entrée est calée sur l'ordre de lecture : 40 ms par tuile,
 * assez pour que l'œil suive la liste de haut en bas, trop court pour qu'on
 * attende quoi que ce soit avant de pouvoir taper.
 */
function TileLink({
  tile,
  index,
}: {
  tile: { to: string; label: string; kanji: string; blurb: string };
  index: number;
}) {
  const press = usePressScale();
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.04 * index, ease: [0.16, 1, 0.3, 1] }}
      {...press}
    >
      <Link
        to={tile.to}
        className={clsx(
          "relative flex items-center gap-4 overflow-hidden border border-ink-700 bg-ink-950 px-4 py-4 transition-colors active:border-blood-500 active:bg-blood-900/20",
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
    </motion.div>
  );
}

/**
 * La séance du jour en grand, avant même les tuiles : c'est la raison la
 * plus fréquente d'ouvrir l'app, elle ne mérite pas d'être noyée dans une
 * liste de sections au même niveau que « Photos ».
 */
function TodaySessionCard({ physiqueOn, combatOn }: { physiqueOn: boolean; combatOn: boolean }) {
  const navigate = useNavigate();
  const [split] = useSetting<Record<Weekday, SplitDay>>("split", DEFAULT_SPLIT);
  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? NO_EXERCISES;
  const [starting, setStarting] = useState(false);

  const today = weekdayOf(new Date());
  const splitDay = split[today];
  const isMuscuDay = physiqueOn && LOGGABLE_SPLIT_DAYS.includes(splitDay);
  const isCombatDay = combatOn && splitDay === "muaythai";

  const planned = useMemo(
    () => exercises.filter((e) => e.splitDays.includes(splitDay)),
    [exercises, splitDay],
  );

  const begin = async () => {
    setStarting(true);
    try {
      const template = await sessionTemplate(splitDay, planned);
      await startDraft({
        date: isoDay(),
        splitDay,
        fromHistory: template.some((t) => t.fromHistory),
        exercises: template.map((t) => ({
          exerciseId: t.exerciseId,
          sets: Array.from({ length: t.sets }, () => ({ reps: "", weightKg: "", done: false })),
        })),
      });
      navigate("/seance");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="k-anim-in relative mb-5 border border-ink-700 bg-ink-950 px-4 py-5">
      {/* Un seul faisceau dans toute l'app, et seulement quand il y a
          effectivement une séance à lancer : c'est le geste que l'écran
          existe pour provoquer. */}
      {isMuscuDay && planned.length > 0 && <BorderBeam />}
      <div className="k-label text-blood-500">Aujourd'hui</div>
      <div className="mt-1 font-display text-2xl uppercase tracking-[0.04em] text-bone-50">
        {SPLIT_LABELS[splitDay]}
      </div>

      {isMuscuDay && (
        <>
          <p className="mt-1.5 text-xs text-bone-600">
            {planned.length} exercice{planned.length > 1 ? "s" : ""} au programme.
          </p>
          <button
            className="k-btn-primary mt-4 w-full !text-base"
            disabled={starting || planned.length === 0}
            onClick={begin}
          >
            {starting ? "…" : "Commencer la séance"}
          </button>
        </>
      )}

      {isCombatDay && (
        <>
          <p className="mt-1.5 text-xs text-bone-600">
            Séance combat — se logge depuis l'axe Combat, séries et charges n'y sont pas
            applicables.
          </p>
          <Link
            to="/combat"
            className="k-btn-primary mt-4 block w-full text-center !text-base no-underline"
          >
            Aller à Combat
          </Link>
        </>
      )}

      {!isMuscuDay && !isCombatDay && (
        <Tag tone="neutral">Repos ou axe masqué — rien à démarrer aujourd'hui</Tag>
      )}
    </div>
  );
}
