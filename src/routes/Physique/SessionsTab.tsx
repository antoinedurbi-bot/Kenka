import { useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import clsx from "clsx";
import { db } from "../../db/db";
import type { WorkoutLog } from "../../db/types";
import { SPLIT_LABELS } from "../../lib/split";
import { prettyDate } from "../../lib/dates";
import { draftFilledSets } from "../../lib/sessionDraft";
import { Empty, Panel, SectionTitle, Tag } from "../../components/ui";
import { StartSessionModal } from "../Session/StartSessionModal";

const FEELINGS = [
  { value: 1, label: "Vidé" },
  { value: 2, label: "Dur" },
  { value: 3, label: "Correct" },
  { value: 4, label: "Bon" },
  { value: 5, label: "Fort" },
] as const;

export function SessionsTab() {
  const [logging, setLogging] = useState(false);
  const logs = useLiveQuery(
    () => db.workoutLogs.orderBy("date").reverse().limit(60).toArray(),
    [],
  );
  const draft = useLiveQuery(() => db.sessionDraft.get("current"), []);

  return (
    <div className="space-y-4">
      <SectionTitle
        action={
          <button className="k-btn-primary !px-3 !py-1.5 !text-xs" onClick={() => setLogging(true)}>
            Démarrer
          </button>
        }
      >
        Historique
      </SectionTitle>

      {draft && (
        <Link
          to="/seance"
          className="block border border-blood-600 bg-blood-900/25 px-3 py-2.5 transition-colors hover:border-blood-500"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="font-display text-xs uppercase tracking-[0.1em] text-bone-50">
                Séance en cours — {SPLIT_LABELS[draft.splitDay]}
              </div>
              <div className="k-label mt-0.5">
                {draftFilledSets(draft)} série(s) saisie(s) · reprendre
              </div>
            </div>
            <span className="font-mono text-bone-400">→</span>
          </div>
        </Link>
      )}

      {!logs || logs.length === 0 ? (
        <Empty>Aucune séance enregistrée. La première ligne du carnet reste à écrire.</Empty>
      ) : (
        <Panel className="divide-y divide-ink-800">
          {logs.map((log) => (
            <LogRow key={log.id} log={log} />
          ))}
        </Panel>
      )}

      <StartSessionModal open={logging} onClose={() => setLogging(false)} />
    </div>
  );
}

function LogRow({ log }: { log: WorkoutLog }) {
  const [open, setOpen] = useState(false);
  const sets = useLiveQuery(
    () => (open ? db.workoutSets.where("workoutLogId").equals(log.id!).toArray() : []),
    [open, log.id],
  );
  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? [];
  const nameOf = (id: number) => exercises.find((e) => e.id === id)?.name ?? "Exercice";

  return (
    <div className="px-3 py-2.5">
      <button className="flex w-full items-center justify-between gap-3" onClick={() => setOpen(!open)}>
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={clsx(
              "h-8 w-0.5 shrink-0",
              log.completed ? "bg-blood-500" : "bg-ink-600",
            )}
          />
          <div className="min-w-0 text-left">
            <div className="text-sm text-bone-50">{SPLIT_LABELS[log.splitDay]}</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-bone-600">
              {prettyDate(log.date)}
              {log.durationMin ? ` · ${log.durationMin} min` : ""}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!log.completed && <Tag tone="neutral">Ratée</Tag>}
          {log.feeling && (
            <Tag tone={log.feeling >= 4 ? "jade" : log.feeling <= 2 ? "blood" : "neutral"}>
              {FEELINGS.find((f) => f.value === log.feeling)?.label}
            </Tag>
          )}
        </div>
      </button>

      {open && (
        <div className="mt-2.5 space-y-2 border-l border-ink-700 pl-3">
          {sets && sets.length > 0 ? (
            <table className="w-full text-xs">
              <tbody className="text-bone-400">
                {sets.map((s) => (
                  <tr key={s.id} className="border-b border-ink-850 last:border-0">
                    <td className="py-1 pr-2">{nameOf(s.exerciseId)}</td>
                    <td className="py-1 text-right font-mono tabular-nums text-bone-200">
                      {s.reps ?? "—"} rep
                    </td>
                    <td className="w-16 py-1 text-right font-mono tabular-nums text-bone-200">
                      {s.weightKg ? `${s.weightKg} kg` : "PDC"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-bone-600">Aucun détail de charge enregistré.</p>
          )}
          {log.notes && <p className="text-xs leading-relaxed text-bone-400">{log.notes}</p>}
          <button
            className="k-btn-danger !px-2 !py-1 !text-[10px]"
            onClick={async () => {
              await db.workoutSets.where("workoutLogId").equals(log.id!).delete();
              await db.workoutLogs.delete(log.id!);
            }}
          >
            Supprimer
          </button>
        </div>
      )}
    </div>
  );
}
