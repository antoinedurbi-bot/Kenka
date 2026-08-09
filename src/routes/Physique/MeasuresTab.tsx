import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db";
import type { BodyMeasurement } from "../../db/types";
import { isoDay, prettyDate } from "../../lib/dates";
import {
  DEFAULT_HEIGHT_CM,
  estimateBodyFat,
  smoothBody,
  TOJI_TARGET,
} from "../../lib/progression";
import { useSetting } from "../../lib/useSetting";
import { upsertDailyWeight } from "../../lib/daily";
import { TrendChart } from "../../components/charts/TrendChart";
import { Empty, Field, Modal, Panel, SectionTitle, Stat, Tag } from "../../components/ui";

const FIELDS = [
  { key: "weightKg", label: "Poids", unit: "kg", step: "0.1" },
  { key: "shouldersCm", label: "Épaules", unit: "cm", step: "0.5" },
  { key: "chestCm", label: "Poitrine", unit: "cm", step: "0.5" },
  { key: "waistCm", label: "Taille", unit: "cm", step: "0.5" },
  { key: "armsCm", label: "Bras", unit: "cm", step: "0.5" },
  { key: "thighsCm", label: "Cuisses", unit: "cm", step: "0.5" },
  { key: "neckCm", label: "Cou", unit: "cm", step: "0.5" },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];

export function MeasuresTab() {
  const [adding, setAdding] = useState(false);
  const measures = useLiveQuery(() => db.measurements.orderBy("date").toArray(), []) ?? [];
  const latest = measures[measures.length - 1];
  const first = measures[0];

  const series = (key: FieldKey | "bfPercent") =>
    measures
      .filter((m) => m[key] !== undefined)
      .map((m) => ({ date: m.date, value: m[key] as number }));

  const smooth = smoothBody(measures);

  return (
    <div className="space-y-6">
      <SectionTitle
        action={
          <button className="k-btn-primary !px-3 !py-1.5 !text-xs" onClick={() => setAdding(true)}>
            Nouvelle mesure
          </button>
        }
      >
        Mesures
      </SectionTitle>

      <MeasurementProtocol />

      {!latest ? (
        <Empty>
          Aucune mesure. Le niveau physique ne peut pas être calculé sans données réelles.
        </Empty>
      ) : (
        <>
          <div>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Poids" value={smooth.weightKg?.toFixed(1) ?? "—"} unit="kg" />
              <Stat
                label="% BF"
                value={smooth.bfPercent?.toFixed(1) ?? "—"}
                unit="%"
                tone="blood"
              />
              <Stat label="V-taper" value={smooth.vTaper?.toFixed(2) ?? "—"} tone="steel" />
            </div>
            <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-bone-600">
              Lissé sur les {smooth.samples} dernière(s) mesure(s)
            </p>
          </div>

          {first && first !== latest && (
            <Panel className="px-3 py-3">
              <div className="k-label mb-2">Depuis la première mesure ({prettyDate(first.date)})</div>
              <div className="flex flex-wrap gap-2">
                {FIELDS.map((f) => {
                  const a = first[f.key];
                  const b = latest[f.key];
                  if (a === undefined || b === undefined) return null;
                  const d = b - a;
                  if (Math.abs(d) < 0.05) return null;
                  return (
                    <Tag key={f.key} tone={d > 0 ? "jade" : "blood"}>
                      {f.label} {d > 0 ? "+" : ""}
                      {d.toFixed(1)} {f.unit}
                    </Tag>
                  );
                })}
              </div>
            </Panel>
          )}

          {measures.length < 2 ? (
            <Empty>
              Les courbes apparaissent à partir de la deuxième mesure. Rythme conseillé : toutes les
              deux semaines, dans les mêmes conditions.
            </Empty>
          ) : (
            <>
              <section>
                <SectionTitle>Masse grasse estimée</SectionTitle>
                <TrendChart
                  data={series("bfPercent")}
                  unit=" %"
                  target={TOJI_TARGET.bfPercent}
                  color="#c8323f"
                />
              </section>

              <section>
                <SectionTitle>Poids</SectionTitle>
                <TrendChart data={series("weightKg")} unit=" kg" color="#9fb2bb" />
              </section>

              <section>
                <SectionTitle>Épaules / Taille</SectionTitle>
                <div className="space-y-3">
                  <TrendChart data={series("shouldersCm")} unit=" cm" color="#c8933f" />
                  <TrendChart data={series("waistCm")} unit=" cm" color="#6f9c78" />
                </div>
              </section>
            </>
          )}

          <section>
            <SectionTitle>Historique</SectionTitle>
            <Panel className="divide-y divide-ink-800">
              {[...measures].reverse().map((m) => (
                <MeasureRow key={m.id} m={m} />
              ))}
            </Panel>
          </section>
        </>
      )}

      <AddMeasureModal open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function MeasureRow({ m }: { m: BodyMeasurement }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="px-3 py-2.5">
      <button className="flex w-full items-center justify-between" onClick={() => setOpen(!open)}>
        <span className="font-mono text-xs uppercase tracking-[0.1em] text-bone-400">
          {prettyDate(m.date)}
        </span>
        <span className="flex items-center gap-3 font-mono text-sm tabular-nums text-bone-50">
          {m.weightKg && <span>{m.weightKg.toFixed(1)} kg</span>}
          {m.bfPercent && <span className="text-blood-300">{m.bfPercent.toFixed(1)} %</span>}
        </span>
      </button>
      {open && (
        <div className="mt-2 space-y-2 border-l border-ink-700 pl-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {FIELDS.map((f) =>
              m[f.key] !== undefined ? (
                <div key={f.key} className="flex justify-between">
                  <span className="text-bone-600">{f.label}</span>
                  <span className="font-mono tabular-nums text-bone-200">
                    {(m[f.key] as number).toFixed(1)} {f.unit}
                  </span>
                </div>
              ) : null,
            )}
          </div>
          {m.notes && <p className="text-xs text-bone-400">{m.notes}</p>}
          <button
            className="k-btn-danger !px-2 !py-1 !text-[10px]"
            onClick={() => db.measurements.delete(m.id!)}
          >
            Supprimer
          </button>
        </div>
      )}
    </div>
  );
}

const PROTOCOL = [
  "Le matin, à jeun, après les toilettes — le seul état reproductible.",
  "Toujours du même côté, muscle relâché, jamais après une série.",
  "Ruban à plat sur la peau, tendu sans comprimer. Un centimètre d'écart déplace l'estimation de masse grasse d'environ 1,5 point.",
  "Taille : au plus étroit, généralement juste au-dessus du nombril, en fin d'expiration normale.",
  "Épaules : au plus large, ruban horizontal, bras le long du corps.",
  "Cou : sous la pomme d'Adam, ruban légèrement incliné vers le bas.",
  "Toutes les deux semaines suffit. Plus souvent, on mesure du bruit.",
];

function MeasurementProtocol() {
  const [open, setOpen] = useState(false);
  return (
    <Panel>
      <button
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="text-sm text-bone-200">Protocole de mesure</span>
        <span className="font-mono text-xs text-bone-600">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <ol className="space-y-2 border-t border-ink-800 px-3 py-3">
          {PROTOCOL.map((rule, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="font-mono text-[10px] tabular-nums text-blood-500">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-xs leading-relaxed text-bone-400">{rule}</span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function AddMeasureModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [date, setDate] = useState(isoDay());
  const [values, setValues] = useState<Record<string, string>>({});
  const [bf, setBf] = useState("");
  const [notes, setNotes] = useState("");
  const [heightCm] = useSetting<number>("heightCm", DEFAULT_HEIGHT_CM);

  const num = (k: string) => (values[k] ? Number(values[k]) : undefined);
  const estimated = estimateBodyFat(num("waistCm"), num("neckCm"), heightCm);

  const submit = async () => {
    // Le poids saisi ici alimente aussi la série quotidienne : sans ça, la
    // tendance nutrition ignorerait une pesée pourtant enregistrée.
    const weight = num("weightKg");
    if (weight) await upsertDailyWeight(date, weight);

    await db.measurements.add({
      date,
      weightKg: weight,
      shouldersCm: num("shouldersCm"),
      chestCm: num("chestCm"),
      waistCm: num("waistCm"),
      armsCm: num("armsCm"),
      thighsCm: num("thighsCm"),
      neckCm: num("neckCm"),
      bfPercent: bf ? Number(bf) : estimated,
      notes: notes.trim() || undefined,
    });
    setValues({});
    setBf("");
    setNotes("");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Nouvelle mesure">
      <div className="space-y-4">
        <Field label="Date">
          <input
            type="date"
            className="k-field"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          {FIELDS.map((f) => (
            <Field key={f.key} label={`${f.label} (${f.unit})`}>
              <input
                type="number"
                inputMode="decimal"
                step={f.step}
                className="k-field"
                value={values[f.key] ?? ""}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              />
            </Field>
          ))}
        </div>

        <Field
          label="% masse grasse"
          hint={
            estimated
              ? `Estimation Navy à partir du cou et de la taille : ${estimated} %. Laisser vide pour l'utiliser.`
              : "Renseigner cou + taille permet une estimation automatique."
          }
        >
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            className="k-field"
            value={bf}
            onChange={(e) => setBf(e.target.value)}
            placeholder={estimated ? String(estimated) : "—"}
          />
        </Field>

        <Field label="Notes">
          <textarea
            className="k-field min-h-16"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>

        <button className="k-btn-primary w-full" onClick={submit}>
          Enregistrer
        </button>
      </div>
    </Modal>
  );
}
