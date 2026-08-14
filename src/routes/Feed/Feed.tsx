import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import clsx from "clsx";
import { db } from "../../db/db";
import type { Exercise } from "../../db/types";
import { buildFeed } from "../../lib/feed";
import type { FeedCard } from "../../lib/feed";
import { volumeReport } from "../../lib/volume";
import { combatReport } from "../../lib/combatReport";
import { useEnabledSections } from "../../lib/sections";
import { useSetting } from "../../lib/useSetting";
import { isoDay } from "../../lib/dates";
import { KanjiSeal } from "../../components/illustrations/Motifs";
import { Empty } from "../../components/ui";
import { ExerciseDetail } from "../Physique/ExerciseDetail";

/**
 * Flux vertical à défilement calé : une carte par écran, on fait défiler
 * jusqu'à tomber sur quelque chose qu'on a envie de faire.
 *
 * Ce format n'existe pas pour l'esthétique. Les mêmes constats vivaient déjà
 * dans les onglets Volume, Analyse et Nutrition, chacun derrière deux taps —
 * donc personne n'allait les chercher. Ici ils viennent à toi un par un, et la
 * carte qui ne sert à rien se balaie en un geste.
 *
 * Hors du Shell comme le hub : une barre de navigation au-dessus d'un
 * défilement plein écran casserait le calage.
 */
export function Feed() {
  const [enabled] = useEnabledSections();
  const [seen, setSeen] = useSetting<Record<string, string>>("feedSeen", {});
  const [detail, setDetail] = useState<Exercise | null>(null);
  const [index, setIndex] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);

  const exercises = useLiveQuery(() => db.exercises.toArray(), []);
  const sets = useLiveQuery(() => db.workoutSets.toArray(), []);
  const combatLogs = useLiveQuery(() => db.combatLogs.toArray(), []);
  const mobilityLogs = useLiveQuery(() => db.mobilityLogs.toArray(), []);
  const weights = useLiveQuery(() => db.dailyWeights.orderBy("date").toArray(), []);
  // Seules les dates servent : charger les blobs de toutes les photos juste
  // pour compter les jours écoulés remplirait la mémoire pour rien. `keys()`
  // lit l'index `date` sans toucher aux enregistrements.
  const photoDates = useLiveQuery(
    () => db.photos.orderBy("date").keys().then((ks) => ks.map((d) => ({ date: String(d) }))),
    [],
  );

  const loading =
    !exercises || !sets || !combatLogs || !mobilityLogs || !weights || !photoDates;

  const cards = useMemo(() => {
    if (loading) return [];
    return buildFeed({
      exercises,
      sets,
      combatLogs,
      mobilityLogs,
      photos: photoDates,
      weights,
      volume: volumeReport(sets, exercises, 28),
      combat: combatReport(combatLogs, 28),
      enabled,
      seen,
    });
  }, [loading, exercises, sets, combatLogs, mobilityLogs, photoDates, weights, enabled, seen]);

  const hide = (id: string) => setSeen({ ...seen, [id]: isoDay() });

  // La position vient du défilement réel plutôt que d'un compteur maison :
  // on peut arriver au milieu du flux en balayant vite, ou remonter.
  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const next = Math.round(el.scrollTop / el.clientHeight);
    if (next !== index) setIndex(next);
  };

  return (
    <div className="relative mx-auto h-dvh max-w-md overflow-hidden bg-ink-950">
      <header className="safe-top absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-ink-950 via-ink-950/90 to-transparent px-5 pb-6 pt-4">
        <Link
          to="/"
          className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-bone-500 hover:text-bone-200"
        >
          <span aria-hidden>←</span> Sections
        </Link>
        <span className="font-mono text-[10px] tabular-nums tracking-[0.16em] text-bone-600">
          {cards.length === 0 ? "—" : `${Math.min(index + 1, cards.length)} / ${cards.length}`}
        </span>
      </header>

      {loading ? (
        <div className="flex h-full items-center justify-center">
          <span className="font-display text-sm tracking-[0.3em] text-bone-600">…</span>
        </div>
      ) : cards.length === 0 ? (
        <div className="flex h-full items-center px-6">
          <Empty>
            Plus rien à proposer pour l'instant — tout ce que le flux savait dire a été vu. Logge
            quelques séances, il se remplira tout seul.
          </Empty>
        </div>
      ) : (
        <div
          ref={scroller}
          onScroll={onScroll}
          className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain"
          data-testid="feed-scroller"
        >
          {cards.map((card) => (
            <FeedCardView
              key={card.id}
              card={card}
              onHide={() => hide(card.id)}
              onOpenExercise={(id) => {
                const ex = exercises.find((e) => e.id === id);
                if (ex) setDetail(ex);
              }}
            />
          ))}
          <div className="flex h-dvh snap-start items-center justify-center px-8 text-center">
            <div>
              <div className="font-display text-3xl text-blood-500/60" aria-hidden>
                終
              </div>
              <p className="mt-4 text-sm leading-relaxed text-bone-500">
                Fin du flux. Il se recompose chaque jour, et chaque séance loggée lui donne de
                nouvelles cartes à te montrer.
              </p>
              <Link to="/" className="k-btn-ghost mt-6 inline-block !text-xs no-underline">
                Retour aux sections
              </Link>
            </div>
          </div>
        </div>
      )}

      {detail && <ExerciseDetail exercise={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

const KIND_ACCENT: Record<FeedCard["kind"], string> = {
  exercice: "text-blood-400",
  levier: "text-gold-400",
  drill: "text-steel-300",
  mobilite: "text-jade-400",
  constat: "text-blood-300",
  principe: "text-bone-300",
  defi: "text-gold-400",
};

function FeedCardView({
  card,
  onHide,
  onOpenExercise,
}: {
  card: FeedCard;
  onHide: () => void;
  onOpenExercise: (id: number) => void;
}) {
  const navigate = useNavigate();

  return (
    <article
      className="relative flex h-dvh snap-start flex-col justify-center px-6 pb-20 pt-20"
      data-kind={card.kind}
    >
      <KanjiSeal
        kanji={card.kanji}
        color="#c8323f"
        className="pointer-events-none absolute -right-10 top-16 h-56 w-56 opacity-[0.06]"
      />

      <div className="relative">
        <div className="flex items-center gap-2">
          <span className={clsx("font-display text-lg", KIND_ACCENT[card.kind])} aria-hidden>
            {card.kanji}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone-600">
            {card.eyebrow}
          </span>
          {card.personal && (
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-blood-400/80">
              · tes données
            </span>
          )}
        </div>

        <h2 className="mt-4 text-2xl leading-tight text-bone-50">{card.title}</h2>

        <p className="mt-4 text-[15px] leading-relaxed text-bone-300">{card.body}</p>

        {card.metric && (
          <p className="mt-5 border-l-2 border-ink-700 pl-3 font-mono text-[11px] leading-relaxed text-bone-500">
            {card.metric}
          </p>
        )}

        <div className="mt-8 flex items-center gap-3">
          {card.action && (
            <button
              className="k-btn-primary flex-1"
              onClick={() =>
                card.action!.type === "exercise"
                  ? onOpenExercise(card.action!.exerciseId)
                  : navigate(card.action!.to)
              }
            >
              {card.action.label}
            </button>
          )}
          <button
            className="k-btn-ghost !px-3 !text-[10px]"
            onClick={onHide}
            aria-label={`Masquer : ${card.title}`}
          >
            Masquer
          </button>
        </div>
      </div>

      <span
        className="pointer-events-none absolute inset-x-0 bottom-8 text-center font-mono text-[10px] tracking-[0.16em] text-bone-700"
        aria-hidden
      >
        ↓
      </span>
    </article>
  );
}
