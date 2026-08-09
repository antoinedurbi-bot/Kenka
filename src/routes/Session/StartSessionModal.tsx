import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db";
import type { Exercise, SplitDay } from "../../db/types";
import {
  DEFAULT_SPLIT,
  defaultLoggableDay,
  LOGGABLE_SPLIT_DAYS,
  SPLIT_LABELS,
} from "../../lib/split";
import { useSetting } from "../../lib/useSetting";
import type { Weekday } from "../../lib/split";
import { isoDay } from "../../lib/dates";
import { sessionTemplate } from "../../lib/performance";
import { startDraft } from "../../lib/sessionDraft";
import { Field, Modal, Tag } from "../../components/ui";

const NO_EXERCISES: Exercise[] = [];

/**
 * Prépare la séance puis bascule sur l'écran de séance. La composition est
 * décidée ici pour que l'écran de séance n'ait qu'un seul rôle : dérouler la
 * séance en cours et survivre à une fermeture de l'onglet.
 */
export function StartSessionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [split] = useSetting<Record<Weekday, SplitDay>>("split", DEFAULT_SPLIT);
  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? NO_EXERCISES;

  const [date, setDate] = useState(isoDay());
  const [splitDay, setSplitDay] = useState<SplitDay>(() => defaultLoggableDay(split));
  const [preview, setPreview] = useState<{ name: string; sets: number }[]>([]);
  const [fromHistory, setFromHistory] = useState(false);
  const [starting, setStarting] = useState(false);

  const planned = useMemo(
    () => exercises.filter((e) => e.splitDays.includes(splitDay)),
    [exercises, splitDay],
  );
  const plannedKey = planned.map((e) => e.id).join(",");

  useEffect(() => {
    if (!open || planned.length === 0) return;
    let cancelled = false;
    sessionTemplate(splitDay, planned).then((template) => {
      if (cancelled) return;
      const byId = new Map(exercises.map((e) => [e.id!, e]));
      setFromHistory(template.some((t) => t.fromHistory));
      setPreview(
        template.map((t) => ({
          name: byId.get(t.exerciseId)?.name ?? "—",
          sets: t.sets,
        })),
      );
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, splitDay, plannedKey]);

  const begin = async () => {
    setStarting(true);
    try {
      const template = await sessionTemplate(splitDay, planned);
      await startDraft({
        date,
        splitDay,
        fromHistory: template.some((t) => t.fromHistory),
        exercises: template.map((t) => ({
          exerciseId: t.exerciseId,
          sets: Array.from({ length: t.sets }, () => ({ reps: "", weightKg: "", done: false })),
        })),
      });
      onClose();
      navigate("/seance");
    } finally {
      setStarting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Démarrer une séance">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input
              type="date"
              className="k-field"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="Séance">
            <select
              className="k-field"
              value={splitDay}
              onChange={(e) => setSplitDay(e.target.value as SplitDay)}
            >
              {LOGGABLE_SPLIT_DAYS.map((d) => (
                <option key={d} value={d}>
                  {SPLIT_LABELS[d]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="k-label">Composition</span>
            <Tag tone={fromHistory ? "jade" : "neutral"}>
              {fromHistory ? "D'après la dernière" : "Séance type"}
            </Tag>
          </div>
          <ul className="divide-y divide-ink-800 border border-ink-700">
            {preview.map((p, i) => (
              <li key={i} className="flex items-center justify-between px-2.5 py-1.5">
                <span className="truncate text-xs text-bone-200">{p.name}</span>
                <span className="shrink-0 font-mono text-[10px] tabular-nums text-bone-600">
                  {p.sets} séries
                </span>
              </li>
            ))}
            {preview.length === 0 && (
              <li className="px-2.5 py-3 text-center text-xs text-bone-600">
                Aucun exercice pour ce jour.
              </li>
            )}
          </ul>
          <p className="mt-2 text-[11px] leading-relaxed text-bone-600">
            Tout reste modifiable pendant la séance : ajouter, retirer, changer le nombre de
            séries.
          </p>
        </div>

        <button
          className="k-btn-primary w-full"
          disabled={starting || preview.length === 0}
          onClick={begin}
        >
          {starting ? "…" : "Démarrer"}
        </button>
      </div>
    </Modal>
  );
}
