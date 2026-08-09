import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import clsx from "clsx";
import { db } from "../../db/db";
import type { MobilityMetric } from "../../db/types";
import { metricDef, mobilityDelta, MOBILITY_METRICS } from "../../lib/mobility";
import { isoDay, prettyDate } from "../../lib/dates";
import { TrendChart } from "../../components/charts/TrendChart";
import { Empty, Field, Modal, Panel, SectionTitle, Tag } from "../../components/ui";

export function MobilityTracker() {
  const [adding, setAdding] = useState<MobilityMetric | null>(null);
  const logs = useLiveQuery(() => db.mobilityLogs.orderBy("date").toArray(), []) ?? [];

  return (
    <div className="space-y-4">
      <SectionTitle>Repères mesurés</SectionTitle>
      <p className="-mt-3 text-xs leading-relaxed text-bone-600">
        La mobilité progresse trop lentement pour se juger au ressenti. Relever ces repères une
        fois par mois, toujours à chaud et de la même façon — sinon c'est le protocole qui varie,
        pas la souplesse.
      </p>

      {MOBILITY_METRICS.map((def) => {
        const series = logs.filter((l) => l.metric === def.metric);
        const first = series[0];
        const last = series[series.length - 1];
        const delta =
          first && last && first !== last
            ? mobilityDelta(def, first.value, last.value)
            : undefined;

        return (
          <Panel key={def.metric}>
            <div className="flex items-start justify-between gap-3 border-b border-ink-800 px-3 py-2.5">
              <div className="min-w-0">
                <h3 className="text-sm leading-tight">{def.label}</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-bone-600">{def.how}</p>
              </div>
              <button
                className="k-btn-ghost shrink-0 !px-2.5 !py-1 !text-[10px]"
                onClick={() => setAdding(def.metric)}
              >
                Relever
              </button>
            </div>

            <div className="flex items-center gap-3 px-3 py-2.5">
              <div>
                <div className="k-label">Actuel</div>
                <div className="font-mono text-xl tabular-nums text-bone-50">
                  {last ? `${last.value}` : "—"}
                  <span className="ml-1 text-[10px] text-bone-600">{def.unit}</span>
                </div>
              </div>
              {delta !== undefined && (
                <Tag tone={delta > 0 ? "jade" : delta < 0 ? "blood" : "neutral"}>
                  {delta > 0 ? "+" : ""}
                  {delta.toFixed(1)} {def.unit} depuis le début
                </Tag>
              )}
            </div>

            {series.length >= 2 && (
              <div className="px-2 pb-2">
                <TrendChart
                  data={series.map((s) => ({ date: s.date, value: s.value }))}
                  unit={` ${def.unit}`}
                  color="#6f9c78"
                  target={def.target}
                  domainPad={2}
                />
              </div>
            )}
          </Panel>
        );
      })}

      {logs.length === 0 && (
        <Empty>Aucun relevé. Le premier sert de référence à tout le reste.</Empty>
      )}

      {logs.length > 0 && (
        <section>
          <SectionTitle>Historique</SectionTitle>
          <Panel className="divide-y divide-ink-800">
            {[...logs].reverse().map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm text-bone-200">{metricDef(l.metric).label}</div>
                  <div className="k-label">{prettyDate(l.date)}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-sm tabular-nums text-bone-50">
                    {l.value} {metricDef(l.metric).unit}
                  </span>
                  <button
                    onClick={() => db.mobilityLogs.delete(l.id!)}
                    aria-label="Supprimer ce relevé"
                    className="px-1 font-mono text-bone-600 active:text-blood-300"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </Panel>
        </section>
      )}

      <AddMobilityModal metric={adding} onClose={() => setAdding(null)} />
    </div>
  );
}

function AddMobilityModal({
  metric,
  onClose,
}: {
  metric: MobilityMetric | null;
  onClose: () => void;
}) {
  const [date, setDate] = useState(isoDay());
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");

  const def = metric ? metricDef(metric) : undefined;

  const submit = async () => {
    if (!metric || value === "") return;
    await db.mobilityLogs.add({
      date,
      metric,
      value: Number(value),
      notes: notes.trim() || undefined,
    });
    setValue("");
    setNotes("");
    onClose();
  };

  return (
    <Modal open={metric !== null} onClose={onClose} title={def?.label ?? "Relevé"}>
      <div className="space-y-4">
        {def && (
          <p className="border-l border-blood-600 pl-3 text-xs leading-relaxed text-bone-400">
            {def.how}
          </p>
        )}

        <Field label="Date">
          <input
            type="date"
            className="k-field"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>

        <Field
          label={`Valeur (${def?.unit ?? ""})`}
          hint={def?.lowerIsBetter ? "Ici, plus bas = mieux." : "Ici, plus haut = mieux."}
        >
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            className="k-field"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
        </Field>

        <Field label="Notes">
          <textarea
            className="k-field min-h-16"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Conditions, gêne, échauffement…"
          />
        </Field>

        <button
          className={clsx("k-btn-primary w-full")}
          disabled={value === ""}
          onClick={submit}
        >
          Enregistrer
        </button>
      </div>
    </Modal>
  );
}
