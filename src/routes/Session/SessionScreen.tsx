import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import clsx from "clsx";
import { db } from "../../db/db";
import type { DraftExercise, Exercise, SessionDraft } from "../../db/types";
import { SPLIT_LABELS } from "../../lib/split";
import { isoDay, prettyShort } from "../../lib/dates";
import { lastPerformances, PROGRESSION_LABELS } from "../../lib/performance";
import type { LastPerformance } from "../../lib/performance";
import {
  clearDraft,
  draftFilledSets,
  loadDraft,
  sessionMinutes,
  usePersistedDraft,
} from "../../lib/sessionDraft";
import { exerciseRecords, recordsBeatenBy, RECORD_LABELS } from "../../lib/records";
import { demoSearchUrl } from "../../lib/videoDemo";
import type { ExerciseRecords } from "../../lib/records";
import { summarizeSession } from "../../lib/sessionSummary";
import { REST_PRESETS, suggestedRestSeconds } from "../../lib/rest";
import { useWakeLock } from "../../lib/wakeLock";
import { hapticRecord, hapticSuccess, hapticTap } from "../../lib/haptics";
import { Field, Modal, Panel, Tag } from "../../components/ui";
import { Stepper } from "../../components/ui/Stepper";
import { useRestTimer } from "../../components/ui/useRestTimer";
import { ExercisePicker } from "./ExercisePicker";
import { SessionDebrief } from "./SessionDebrief";

const FEELINGS = [
  { value: 1, label: "Vidé" },
  { value: 2, label: "Dur" },
  { value: 3, label: "Correct" },
  { value: 4, label: "Bon" },
  { value: 5, label: "Fort" },
] as const;

const NO_SETS: never[] = [];

export function SessionScreen() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<SessionDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<Map<number, LastPerformance>>(new Map());
  const [adding, setAdding] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [debriefing, setDebriefing] = useState(false);

  const exercises = useLiveQuery(() => db.exercises.toArray(), []);
  const allSets = useLiveQuery(() => db.workoutSets.toArray(), []) ?? NO_SETS;
  const rest = useRestTimer();

  // L'écran doit rester allumé tant qu'une séance est ouverte : c'est la
  // friction qui décide si les séries sont saisies au fil de l'eau ou reconstituées
  // de mémoire à la fin.
  const screenAwake = useWakeLock(draft !== null);

  const { cancelPendingWrite } = usePersistedDraft(draft);

  const byId = useMemo(() => new Map((exercises ?? []).map((e) => [e.id!, e])), [exercises]);

  useEffect(() => {
    loadDraft().then((d) => {
      if (!d) navigate("/physique", { replace: true });
      else setDraft(d);
      setLoading(false);
    });
  }, [navigate]);

  const exerciseIds = draft?.exercises.map((e) => e.exerciseId).join(",") ?? "";
  useEffect(() => {
    if (!draft) return;
    let cancelled = false;
    lastPerformances(draft.exercises.map((e) => e.exerciseId)).then((h) => {
      if (!cancelled) setHistory(h);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseIds]);

  // Les records sont figés à l'ouverture : les comparer aux séries de la séance
  // en cours ferait disparaître le repère au moment même où il est battu.
  const baseRecords = useMemo(() => {
    const map = new Map<number, ExerciseRecords>();
    for (const ex of draft?.exercises ?? []) {
      map.set(ex.exerciseId, exerciseRecords(ex.exerciseId, allSets));
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseIds, allSets.length]);

  if (loading || !draft) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span className="font-display text-sm tracking-[0.3em] text-bone-600">…</span>
      </div>
    );
  }

  const patch = (next: Partial<SessionDraft>) => setDraft({ ...draft, ...next });

  const setExercise = (index: number, next: DraftExercise) =>
    patch({ exercises: draft.exercises.map((e, i) => (i === index ? next : e)) });

  const totalSets = draft.exercises.reduce((n, e) => n + e.sets.length, 0);
  const doneSets = draft.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);

  // Calcul volontairement non mémoïsé : il ne parcourt qu'une vingtaine de séries,
  // et le mémoïser sur un brouillon muté à chaque frappe coûterait plus cher.
  const summary = summarizeSession(draft, byId, baseRecords);

  const finish = async () => {
    setFinishing(true);
    try {
      const logId = await db.workoutLogs.add({
        date: draft.date,
        type: draft.splitDay === "mobilite" ? "mobilite" : "musculation",
        splitDay: draft.splitDay,
        completed: true,
        feeling: draft.feeling,
        durationMin: sessionMinutes(draft.startedAt),
        notes: draft.notes?.trim() || undefined,
      });

      const rows = draft.exercises.flatMap((ex) =>
        ex.sets
          .map((s, i) => ({ s, i }))
          .filter(({ s }) => s.done || s.reps || s.weightKg)
          .map(({ s, i }) => ({
            workoutLogId: logId,
            exerciseId: ex.exerciseId,
            setIndex: i,
            date: draft.date,
            reps: s.reps ? Number(s.reps) : undefined,
            weightKg: s.weightKg ? Number(s.weightKg) : undefined,
          })),
      );
      if (rows.length) await db.workoutSets.bulkAdd(rows);

      cancelPendingWrite();
      await clearDraft();
      hapticSuccess();
      setDebriefing(false);
      setDraft(null);
      navigate("/physique", { replace: true });
    } finally {
      setFinishing(false);
    }
  };

  const available = (exercises ?? []).filter(
    (e) => !draft.exercises.some((d) => d.exerciseId === e.id),
  );

  return (
    <div className="mx-auto min-h-dvh max-w-md px-4 pb-40 pt-5">
      <header className="mb-4">
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <div className="k-label text-blood-500">Séance en cours</div>
            <h1 className="mt-0.5 font-display text-2xl uppercase tracking-[0.06em]">
              {SPLIT_LABELS[draft.splitDay]}
            </h1>
          </div>
          <div className="shrink-0 text-right">
            <Elapsed startedAt={draft.startedAt} />
            {screenAwake && (
              <div className="k-label mt-0.5 !text-jade-400">Écran maintenu</div>
            )}
          </div>
        </div>

        {draft.date !== isoDay() && (
          <p className="mt-2 border border-gold-400/40 px-2.5 py-1.5 text-[11px] leading-relaxed text-gold-400">
            Séance datée du {prettyShort(draft.date)}, laissée ouverte. La durée enregistrée sera
            plafonnée — corrige-la après coup si besoin.
          </p>
        )}

        <div className="mt-3 flex items-center gap-2">
          <div className="h-0.5 flex-1 bg-ink-800">
            <div
              className="h-full bg-blood-500 transition-[width] duration-300"
              style={{ width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%` }}
            />
          </div>
          <span className="font-mono text-[10px] tabular-nums text-bone-600">
            {doneSets}/{totalSets}
          </span>
        </div>
      </header>

      <div className="space-y-3">
        {draft.exercises.map((ex, i) => {
          const exercise = byId.get(ex.exerciseId);
          if (!exercise) return null;
          return (
            <ExerciseCard
              key={ex.exerciseId}
              exercise={exercise}
              draft={ex}
              last={history.get(ex.exerciseId)}
              records={baseRecords.get(ex.exerciseId)}
              onChange={(next) => setExercise(i, next)}
              onRemove={() =>
                patch({ exercises: draft.exercises.filter((_, j) => j !== i) })
              }
              onSetDone={() => rest.start(suggestedRestSeconds(exercise))}
            />
          );
        })}
      </div>

      <button className="k-btn-ghost mt-3 w-full !text-xs" onClick={() => setAdding(true)}>
        + Ajouter un exercice
      </button>

      <ExercisePicker
        open={adding}
        onClose={() => setAdding(false)}
        exercises={available}
        onPick={(ex) =>
          patch({
            exercises: [
              ...draft.exercises,
              {
                exerciseId: ex.id!,
                sets: Array.from({ length: ex.defaultSets ?? 3 }, () => ({
                  reps: "",
                  weightKg: "",
                  done: false,
                })),
              },
            ],
          })
        }
      />

      <section className="mt-6 space-y-3">
        <Field label="Ressenti">
          <div className="grid grid-cols-5 gap-1">
            {FEELINGS.map((f) => (
              <button
                key={f.value}
                onClick={() => patch({ feeling: f.value })}
                aria-pressed={draft.feeling === f.value}
                className={clsx(
                  "border py-2 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors",
                  draft.feeling === f.value
                    ? "border-blood-500 bg-blood-900 text-bone-50"
                    : "border-ink-700 text-bone-600",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Notes">
          <textarea
            className="k-field min-h-16"
            value={draft.notes ?? ""}
            onChange={(e) => patch({ notes: e.target.value })}
            placeholder="Sensations, douleurs, records…"
          />
        </Field>
      </section>

      {/* Barre fixe : le minuteur doit rester atteignable sans remonter la page. */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-ink-700 bg-ink-950/95 backdrop-blur">
        <div className="mx-auto max-w-md px-4 py-2.5">
          <RestBar rest={rest} />
          <div className="mt-2 flex gap-2">
            <button
              className="k-btn-ghost flex-1 !py-2 !text-[10px]"
              onClick={() => setConfirmQuit(true)}
            >
              Abandonner
            </button>
            <button
              className="k-btn-primary flex-[2] !py-2"
              disabled={finishing}
              onClick={() => setDebriefing(true)}
            >
              Terminer la séance
            </button>
          </div>
        </div>
      </div>

      <SessionDebrief
        open={debriefing}
        summary={summary}
        durationMin={sessionMinutes(draft.startedAt)}
        saving={finishing}
        onResume={() => setDebriefing(false)}
        onConfirm={finish}
      />

      <Modal open={confirmQuit} onClose={() => setConfirmQuit(false)} title="Abandonner la séance">
        <p className="text-sm leading-relaxed text-bone-400">
          {draftFilledSets(draft)} série(s) saisie(s) seront perdues. Rien ne sera enregistré dans
          l'historique.
        </p>
        <div className="mt-4 flex gap-2">
          <button className="k-btn-ghost flex-1" onClick={() => setConfirmQuit(false)}>
            Continuer la séance
          </button>
          <button
            className="k-btn-danger flex-1"
            onClick={async () => {
              cancelPendingWrite();
              await clearDraft();
              setDraft(null);
              navigate("/physique", { replace: true });
            }}
          >
            Abandonner
          </button>
        </div>
      </Modal>
    </div>
  );
}

function Elapsed({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const secs = Math.max(0, Math.floor((now - startedAt) / 1000));
  return (
    <span className="font-mono text-lg tabular-nums text-bone-400">
      {String(Math.floor(secs / 3600)).padStart(2, "0")}:
      {String(Math.floor((secs % 3600) / 60)).padStart(2, "0")}:
      {String(secs % 60).padStart(2, "0")}
    </span>
  );
}

function RestBar({ rest }: { rest: ReturnType<typeof useRestTimer> }) {
  if (!rest.running) {
    return (
      <div className="flex items-center gap-2">
        <span className="k-label shrink-0">Repos</span>
        <div className="flex flex-1 justify-end gap-1">
          {REST_PRESETS.map((s) => (
            <button
              key={s}
              onClick={() => rest.start(s)}
              className="border border-ink-600 px-2 py-1 font-mono text-[10px] tabular-nums text-bone-400 active:bg-ink-800"
            >
              {s < 120 ? `${s}s` : `${s / 60}min`}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const pct = rest.duration > 0 ? rest.remaining / rest.duration : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-xl tabular-nums text-bone-50">
        {String(Math.floor(rest.remaining / 60)).padStart(2, "0")}:
        {String(rest.remaining % 60).padStart(2, "0")}
      </span>
      <div className="h-0.5 flex-1 bg-ink-800">
        <div
          className="h-full bg-blood-500 transition-[width] duration-200"
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      <button
        onClick={() => rest.start(rest.duration + 30)}
        className="shrink-0 border border-ink-600 px-2 py-1 font-mono text-[10px] text-bone-400"
      >
        +30s
      </button>
      <button
        onClick={rest.stop}
        className="shrink-0 border border-ink-600 px-2 py-1 font-mono text-[10px] uppercase text-bone-400"
      >
        Stop
      </button>
    </div>
  );
}

function ExerciseCard({
  exercise,
  draft,
  last,
  records,
  onChange,
  onRemove,
  onSetDone,
}: {
  exercise: Exercise;
  draft: DraftExercise;
  last?: LastPerformance;
  records?: ExerciseRecords;
  onChange: (d: DraftExercise) => void;
  onRemove: () => void;
  onSetDone: () => void;
}) {
  const done = draft.sets.filter((s) => s.done).length;
  const complete = done === draft.sets.length && done > 0;

  const setSet = (i: number, patch: Partial<DraftExercise["sets"][number]>) =>
    onChange({ ...draft, sets: draft.sets.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  const toggleDone = (i: number) => {
    const set = draft.sets[i];
    const next = !set.done;
    // Valider une série sans chiffre reprendrait la dernière performance :
    // c'est le geste le plus courant quand on refait exactement pareil.
    const prev = last?.sets[i];
    const reps = set.reps || (next && prev?.reps !== undefined ? String(prev.reps) : set.reps);
    const weightKg =
      set.weightKg ||
      (next && prev?.weightKg !== undefined ? String(prev.weightKg) : set.weightKg);

    setSet(i, { done: next, reps, weightKg });

    if (!next) return;

    // Le téléphone est souvent posé à côté : la vibration confirme la validation
    // sans qu'on ait à revenir regarder l'écran. Un record vibre différemment —
    // c'est l'événement qu'on ne veut pas manquer sur le moment.
    const beatsRecord =
      records &&
      recordsBeatenBy(
        { reps: reps ? Number(reps) : undefined, weightKg: weightKg ? Number(weightKg) : undefined },
        records,
      ).length > 0;

    if (beatsRecord) hapticRecord();
    else hapticTap();

    onSetDone();
  };

  return (
    <Panel className={clsx(complete && "opacity-60")}>
      <div className="flex items-center gap-2 border-b border-ink-800 px-2.5 py-2">
        {exercise.priority === "primaire" && (
          <span className="shrink-0 text-blood-400" aria-hidden>
            ★
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-sm text-bone-50">{exercise.name}</span>
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-bone-600">
          {done}/{draft.sets.length}
        </span>
        <button
          onClick={onRemove}
          aria-label={`Retirer ${exercise.name}`}
          className="shrink-0 px-1 font-mono text-bone-600 active:text-blood-300"
        >
          ×
        </button>
      </div>

      <div className="space-y-2 px-2.5 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {exercise.defaultReps && <Tag>{exercise.defaultReps}</Tag>}
          <span className="font-mono text-[10px] text-bone-600">
            {last
              ? `Dernière : ${prettyShort(last.date)}${
                  last.topWeightKg !== undefined ? ` · ${last.topWeightKg} kg` : ""
                }${last.topReps !== undefined ? ` × ${last.topReps}` : ""}`
              : "Première fois"}
          </span>
          <a
            href={demoSearchUrl(exercise.name)}
            target="_blank"
            rel="noreferrer"
            className="ml-auto shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-bone-600 underline decoration-ink-700 underline-offset-2"
          >
            ▶ Démo
          </a>
        </div>

        {draft.sets.map((s, i) => {
          const prev = last?.sets[i];
          const beaten =
            records && (s.reps || s.weightKg)
              ? recordsBeatenBy(
                  {
                    reps: s.reps ? Number(s.reps) : undefined,
                    weightKg: s.weightKg ? Number(s.weightKg) : undefined,
                  },
                  records,
                )
              : [];

          return (
            <div key={i}>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleDone(i)}
                  aria-pressed={s.done}
                  aria-label={`Série ${i + 1} ${s.done ? "validée" : "à valider"}`}
                  className={clsx(
                    "flex h-8 w-8 shrink-0 items-center justify-center border font-mono text-[11px] tabular-nums transition-colors",
                    s.done
                      ? "border-jade-400 bg-jade-400/15 text-jade-400"
                      : "border-ink-700 text-bone-600",
                  )}
                >
                  {s.done ? "✓" : i + 1}
                </button>
                <div className="flex-1">
                  <Stepper
                    value={s.reps}
                    onChange={(v) => setSet(i, { reps: v })}
                    ghost={prev?.reps}
                    suffix="rep"
                    ariaLabel={`${exercise.name} série ${i + 1} répétitions`}
                  />
                </div>
                <div className="flex-1">
                  <Stepper
                    value={s.weightKg}
                    onChange={(v) => setSet(i, { weightKg: v })}
                    ghost={prev?.weightKg}
                    step={exercise.bodyweight ? 1 : 0.5}
                    suffix={exercise.bodyweight ? "lest" : "kg"}
                    ariaLabel={`${exercise.name} série ${i + 1} charge`}
                  />
                </div>
              </div>

              {beaten.length > 0 && (
                <div className="ml-10 mt-1 flex flex-wrap gap-1">
                  {beaten.map((b) => (
                    <Tag key={b.kind} tone="gold">
                      Record {RECORD_LABELS[b.kind].toLowerCase()}
                      {b.previous !== undefined && ` · +${(b.value - b.previous).toFixed(1)}`}
                    </Tag>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <div className="flex gap-2">
          <button
            className="flex-1 border border-ink-700 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-bone-600 active:bg-ink-800"
            onClick={() =>
              onChange({ ...draft, sets: [...draft.sets, { reps: "", weightKg: "", done: false }] })
            }
          >
            + Série
          </button>
          {draft.sets.length > 1 && (
            <button
              className="flex-1 border border-ink-700 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-bone-600 active:bg-ink-800"
              onClick={() => onChange({ ...draft, sets: draft.sets.slice(0, -1) })}
            >
              − Série
            </button>
          )}
        </div>

        {exercise.progression && exercise.progression.length > 0 && (
          <p className="border-l border-ink-700 pl-2 text-[10px] leading-relaxed text-bone-600">
            Leviers :{" "}
            {exercise.progression
              .slice(0, 3)
              .map((p) => PROGRESSION_LABELS[p].toLowerCase())
              .join(" · ")}
          </p>
        )}
      </div>
    </Panel>
  );
}
