import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import clsx from "clsx";
import { db } from "../../db/db";
import type { CombatSessionKind, CombatSessionLog } from "../../db/types";
import { isoDay, prettyDate } from "../../lib/dates";
import { FAMILY_LABELS, TECHNIQUE_FAMILY, type TechniqueFamily } from "../../lib/combatReport";
import { Empty, Field, Modal, Panel, SectionTitle, Stat, Tag } from "../../components/ui";

const KINDS: Array<{ value: CombatSessionKind; label: string }> = [
  { value: "club", label: "Club" },
  { value: "sparring", label: "Sparring" },
  { value: "sac", label: "Sac" },
  { value: "shadow", label: "Shadow" },
  { value: "physique", label: "Physique" },
];

/**
 * Techniques regroupées par famille, dans l'ordre où l'analyse les lit. Une
 * liste plate de quatorze boutons se cochait de gauche à droite : les familles
 * rendent visible ce qu'on est en train de ne pas cocher.
 */
const TECHNIQUES_BY_FAMILY = Object.entries(TECHNIQUE_FAMILY).reduce<
  Array<[TechniqueFamily, string[]]>
>((acc, [technique, family]) => {
  const bucket = acc.find(([f]) => f === family);
  if (bucket) bucket[1].push(technique);
  else acc.push([family, [technique]]);
  return acc;
}, []);

export function CombatSessionsTab() {
  const [logging, setLogging] = useState(false);
  const logs = useLiveQuery(() => db.combatLogs.orderBy("date").reverse().toArray(), []) ?? [];

  const totalRounds = logs.reduce((n, l) => n + (l.rounds ?? 0), 0);
  const totalMin = logs.reduce((n, l) => n + (l.durationMin ?? 0), 0);
  const sparring = logs.filter((l) => l.kind === "sparring").length;

  return (
    <div className="space-y-5">
      <SectionTitle
        action={
          <button className="k-btn-primary !px-3 !py-1.5 !text-xs" onClick={() => setLogging(true)}>
            Logger une séance
          </button>
        }
      >
        Séances combat
      </SectionTitle>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Séances" value={logs.length} />
        <Stat label="Rounds" value={totalRounds} tone="steel" />
        <Stat label="Heures" value={Math.round(totalMin / 60)} tone="blood" />
      </div>

      {sparring > 0 && (
        <p className="text-xs text-bone-600">
          Dont <span className="font-mono text-bone-200">{sparring}</span> séance(s) de sparring.
        </p>
      )}

      {logs.length === 0 ? (
        <Empty>Aucune séance combat enregistrée.</Empty>
      ) : (
        <Panel className="divide-y divide-ink-800">
          {logs.map((log) => (
            <CombatRow key={log.id} log={log} />
          ))}
        </Panel>
      )}

      <LogCombatModal open={logging} onClose={() => setLogging(false)} />
    </div>
  );
}

function CombatRow({ log }: { log: CombatSessionLog }) {
  const [open, setOpen] = useState(false);
  const kindLabel = KINDS.find((k) => k.value === log.kind)?.label ?? log.kind;

  return (
    <div className="px-3 py-2.5">
      <button className="flex w-full items-center justify-between gap-3" onClick={() => setOpen(!open)}>
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={clsx(
              "h-8 w-0.5 shrink-0",
              log.kind === "sparring" ? "bg-blood-500" : "bg-steel-600",
            )}
          />
          <div className="min-w-0 text-left">
            <div className="text-sm text-bone-50">{kindLabel}</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-bone-600">
              {prettyDate(log.date)}
              {log.rounds ? ` · ${log.rounds} rounds` : ""}
              {log.durationMin ? ` · ${log.durationMin} min` : ""}
            </div>
          </div>
        </div>
        {log.intensity && <Tag tone={log.intensity >= 4 ? "blood" : "neutral"}>I{log.intensity}</Tag>}
      </button>

      {open && (
        <div className="mt-2.5 space-y-2 border-l border-ink-700 pl-3">
          {log.techniques.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {log.techniques.map((t) => (
                <Tag key={t} tone="steel">
                  {t}
                </Tag>
              ))}
            </div>
          )}
          {log.notes && <p className="text-xs leading-relaxed text-bone-400">{log.notes}</p>}
          <button
            className="k-btn-danger !px-2 !py-1 !text-[10px]"
            onClick={() => db.combatLogs.delete(log.id!)}
          >
            Supprimer
          </button>
        </div>
      )}
    </div>
  );
}

function LogCombatModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [date, setDate] = useState(isoDay());
  const [kind, setKind] = useState<CombatSessionKind>("club");
  // `null` = jamais touché par l'utilisateur, donc reprenable de la dernière
  // séance. Distinguer ce cas d'un champ vidé volontairement évite de réécrire
  // une valeur que l'utilisateur vient d'effacer.
  const [duration, setDuration] = useState<string | null>(null);
  const [rounds, setRounds] = useState<string | null>(null);
  const [intensity, setIntensity] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [techniques, setTechniques] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const lastOfKind = useLiveQuery(
    () => db.combatLogs.where("kind").equals(kind).sortBy("date").then((l) => l[l.length - 1]),
    [kind],
  );

  /**
   * Durée et rounds sont repris de la dernière séance du même type : un
   * entraînement au club dure toujours à peu près pareil, et retaper « 90 »
   * chaque semaine est de la saisie sans information. Dérivé plutôt que copié
   * dans l'état, pour que changer de type suffise à changer la reprise.
   */
  const durationValue = duration ?? (lastOfKind?.durationMin ? String(lastOfKind.durationMin) : "");
  const roundsValue = rounds ?? (lastOfKind?.rounds ? String(lastOfKind.rounds) : "");

  const applyKind = (next: CombatSessionKind) => {
    setKind(next);
    setDuration(null);
    setRounds(null);
  };

  const submit = async () => {
    await db.combatLogs.add({
      date,
      kind,
      durationMin: durationValue ? Number(durationValue) : undefined,
      rounds: roundsValue ? Number(roundsValue) : undefined,
      intensity,
      techniques,
      notes: notes.trim() || undefined,
    });
    setTechniques([]);
    setNotes("");
    setDuration(null);
    setRounds(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Séance combat">
      <div className="space-y-4">
        <Field label="Date">
          <input
            type="date"
            className="k-field"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>

        <Field label="Type">
          <div className="grid grid-cols-3 gap-1">
            {KINDS.map((k) => (
              <button
                key={k.value}
                onClick={() => applyKind(k.value)}
                className={clsx(
                  "border py-2 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors",
                  kind === k.value
                    ? "border-blood-500 bg-blood-900 text-bone-50"
                    : "border-ink-700 text-bone-600",
                )}
              >
                {k.label}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Durée (min)">
            <input
              type="number"
              inputMode="numeric"
              className="k-field"
              value={durationValue}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="90"
            />
          </Field>
          <Field label="Rounds">
            <input
              type="number"
              inputMode="numeric"
              className="k-field"
              value={roundsValue}
              onChange={(e) => setRounds(e.target.value)}
              placeholder="5"
            />
          </Field>
        </div>

        <Field label="Intensité">
          <div className="grid grid-cols-5 gap-1">
            {([1, 2, 3, 4, 5] as const).map((i) => (
              <button
                key={i}
                onClick={() => setIntensity(i)}
                className={clsx(
                  "border py-2 font-mono text-xs tabular-nums transition-colors",
                  intensity === i
                    ? "border-blood-500 bg-blood-900 text-bone-50"
                    : "border-ink-700 text-bone-600",
                )}
              >
                {i}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Techniques travaillées">
          <div className="space-y-2.5">
            {TECHNIQUES_BY_FAMILY.map(([family, list]) => (
              <div key={family}>
                <div className="k-label pb-1">{FAMILY_LABELS[family]}</div>
                <div className="flex flex-wrap gap-1.5">
                  {list.map((t) => (
                    <button
                      key={t}
                      aria-pressed={techniques.includes(t)}
                      onClick={() =>
                        setTechniques(
                          techniques.includes(t)
                            ? techniques.filter((x) => x !== t)
                            : [...techniques, t],
                        )
                      }
                      className={clsx(
                        "border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors",
                        techniques.includes(t)
                          ? "border-steel-400 bg-steel-600/25 text-bone-50"
                          : "border-ink-700 text-bone-600",
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Field>

        <Field label="Notes">
          <textarea
            className="k-field min-h-20"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ce qui a marché, ce qui a manqué, retour du coach…"
          />
        </Field>

        <button className="k-btn-primary w-full" onClick={submit}>
          Enregistrer
        </button>
      </div>
    </Modal>
  );
}
