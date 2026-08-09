import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { db } from "../../db/db";
import type { SplitDay } from "../../db/types";
import { DEFAULT_SPLIT, SPLIT_LABELS, weekdayOf } from "../../lib/split";
import type { Weekday } from "../../lib/split";
import { useSetting } from "../../lib/useSetting";
import { physiqueLevel, skillsLevel } from "../../lib/progression";
import { computeBadges } from "../../lib/badges";
import { currentWeekCount, weeklyStreak } from "../../lib/streaks";
import { readiness } from "../../lib/readiness";
import { volumeReport } from "../../lib/volume";
import { PageHeader } from "../../components/layout/Shell";
import { Bar, Panel, SectionTitle, Tag } from "../../components/ui";
import { DataSafetyBanner } from "../../components/DataSafetyBanner";
import { LevelCard } from "./LevelCard";
import { MonthlyReview } from "./MonthlyReview";

export function Dashboard() {
  const [split] = useSetting<Record<Weekday, SplitDay>>("split", DEFAULT_SPLIT);
  const today = weekdayOf(new Date());

  const measurements = useLiveQuery(() => db.measurements.orderBy("date").toArray(), []) ?? [];
  const checkpoints = useLiveQuery(() => db.combatCheckpoints.toArray(), []) ?? [];
  const workouts = useLiveQuery(() => db.workoutLogs.toArray(), []) ?? [];
  const combat = useLiveQuery(() => db.combatLogs.toArray(), []) ?? [];
  const photoCount = useLiveQuery(() => db.photos.count(), []) ?? 0;
  const sets = useLiveQuery(() => db.workoutSets.toArray(), []) ?? [];
  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? [];
  const dailyWeights = useLiveQuery(() => db.dailyWeights.toArray(), []) ?? [];
  const draft = useLiveQuery(() => db.sessionDraft.get("current"), []);

  const physique = physiqueLevel(measurements);
  const skills = skillsLevel(checkpoints);

  const workoutDates = workouts.filter((w) => w.completed).map((w) => w.date);
  const combatDates = combat.map((c) => c.date);
  // La régularité nutrition se lit désormais sur les pesées, pas sur un check-in à ressaisir.
  const nutritionDates = dailyWeights.map((w) => w.date);

  const load = readiness(workouts, combat);
  const volume = volumeReport(sets, exercises, 28);

  const workoutStreak = weeklyStreak(workoutDates, 3);
  const combatStreak = weeklyStreak(combatDates, 2);
  const nutritionStreak = weeklyStreak(nutritionDates, 3);

  const badges = computeBadges({
    workouts,
    combat,
    measurements,
    checkpoints,
    photoCount,
    workoutStreak,
    combatStreak,
  });
  const earned = badges.filter((b) => b.earned);
  const nextUp = badges
    .filter((b) => !b.earned)
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 3);

  return (
    <>
      <PageHeader eyebrow={SPLIT_LABELS[split[today]]} title="Base">
        Deux axes qui tournent en parallèle. Le corps ne dit rien de la technique, la technique ne
        dit rien du corps.
      </PageHeader>

      {draft && (
        <Link
          to="/seance"
          className="mb-4 block border border-blood-500 bg-blood-900/30 px-3 py-3 transition-colors hover:border-blood-400"
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

      <DataSafetyBanner />

      <div className="space-y-3">
        <LevelCard axis="toji" level={physique} kanji="体" />
        <LevelCard axis="ippo" level={skills} kanji="闘" />
      </div>

      {load.level !== "ok" && (
        <section className="mt-5">
          <Panel
            className={clsx(
              "border-l-2 px-3 py-3",
              load.level === "deload" ? "border-l-blood-500" : "border-l-gold-400",
            )}
          >
            <div className="flex items-center gap-2">
              <Tag tone={load.level === "deload" ? "blood" : "gold"}>{load.headline}</Tag>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-bone-400">{load.detail}</p>
          </Panel>
        </section>
      )}

      {volume.verdict === "a-corriger" && (
        <section className="mt-5">
          <Link to="/physique" className="block">
            <Panel className="border-l-2 border-l-blood-500 px-3 py-3">
              <div className="flex items-center gap-2">
                <Tag tone="blood">Répartition à corriger</Tag>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-bone-400">{volume.advice}</p>
            </Panel>
          </Link>
        </section>
      )}

      <section className="mt-7">
        <SectionTitle>Régularité</SectionTitle>
        <Panel className="divide-y divide-ink-800">
          <StreakRow
            label="Musculation"
            streak={workoutStreak}
            thisWeek={currentWeekCount(workoutDates)}
            goal={3}
            tone="blood"
          />
          <StreakRow
            label="Combat"
            streak={combatStreak}
            thisWeek={currentWeekCount(combatDates)}
            goal={2}
            tone="steel"
          />
          <StreakRow
            label="Pesées"
            streak={nutritionStreak}
            thisWeek={currentWeekCount(nutritionDates)}
            goal={3}
            tone="jade"
          />
        </Panel>
      </section>

      <section className="mt-7">
        <SectionTitle>Suivi</SectionTitle>
        <MonthlyReview />
      </section>

      <section className="mt-7">
        <SectionTitle action={<Tag tone="gold">{earned.length}/{badges.length}</Tag>}>
          Badges
        </SectionTitle>

        {earned.length > 0 && (
          <div className="mb-3 grid grid-cols-2 gap-2">
            {earned.map((b) => (
              <div
                key={b.id}
                className={clsx(
                  "border px-2.5 py-2",
                  b.axis === "toji"
                    ? "border-blood-600/60 bg-blood-900/25"
                    : b.axis === "ippo"
                      ? "border-steel-600 bg-steel-600/15"
                      : "border-gold-400/40 bg-gold-400/5",
                )}
              >
                <div className="font-display text-xs uppercase tracking-[0.08em] text-bone-50">
                  {b.name}
                </div>
                <div className="mt-0.5 text-[11px] leading-tight text-bone-600">
                  {b.description}
                </div>
              </div>
            ))}
          </div>
        )}

        <Panel className="divide-y divide-ink-800">
          {nextUp.map((b) => (
            <div key={b.id} className="px-3 py-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-bone-400">{b.name}</span>
                <span className="font-mono text-[10px] tabular-nums text-bone-600">
                  {Math.round(b.progress * 100)} %
                </span>
              </div>
              <div className="mt-0.5 text-[11px] text-bone-600">{b.description}</div>
              <Bar
                value={b.progress}
                tone={b.axis === "ippo" ? "steel" : "blood"}
                className="mt-2"
              />
            </div>
          ))}
        </Panel>
      </section>

      <section className="mt-7">
        <SectionTitle>Logger</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <Link to="/physique" className="k-btn-ghost">
            Séance muscu
          </Link>
          <Link to="/combat" className="k-btn-ghost">
            Séance combat
          </Link>
          <Link to="/physique" className="k-btn-ghost">
            Mesures
          </Link>
          <Link to="/photos" className="k-btn-ghost">
            Photos
          </Link>
        </div>
      </section>
    </>
  );
}

function StreakRow({
  label,
  streak,
  thisWeek,
  goal,
  tone,
}: {
  label: string;
  streak: number;
  thisWeek: number;
  goal: number;
  tone: "blood" | "steel" | "jade";
}) {
  return (
    <div className="px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-bone-50">{label}</span>
        <span className="font-mono text-sm tabular-nums text-bone-50">
          {streak}
          <span className="ml-1 text-[10px] uppercase tracking-[0.1em] text-bone-600">
            {streak > 1 ? "semaines" : "semaine"}
          </span>
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <Bar value={Math.min(1, thisWeek / goal)} tone={tone} className="flex-1" />
        <span className="font-mono text-[10px] tabular-nums text-bone-600">
          {thisWeek}/{goal}
        </span>
      </div>
    </div>
  );
}
