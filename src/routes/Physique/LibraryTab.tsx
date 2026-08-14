import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import clsx from "clsx";
import { db } from "../../db/db";
import type { Exercise, MuscleZone, TrainingType } from "../../db/types";
import { Empty, Field, Modal, Panel, SectionTitle, Tag } from "../../components/ui";
import { fold, matches } from "../../lib/search";
import { ExerciseDetail } from "./ExerciseDetail";

const ZONES: MuscleZone[] = [
  "epaules",
  "dos",
  "trapezes",
  "avant-bras",
  "abdos",
  "obliques",
  "cou",
  "jambes",
  "pecs",
  "bras",
  "fessiers",
  "mollets",
];

const ZONE_LABELS: Record<MuscleZone, string> = {
  epaules: "Épaules",
  dos: "Dos",
  trapezes: "Trapèzes",
  "avant-bras": "Avant-bras",
  abdos: "Abdos",
  obliques: "Obliques",
  cou: "Cou",
  jambes: "Jambes",
  pecs: "Pecs",
  bras: "Bras",
  fessiers: "Fessiers",
  mollets: "Mollets",
};

/** Zones qui construisent la silhouette Toji — mises en avant dans le filtre. */
const PRIORITY_ZONES: MuscleZone[] = [
  "epaules",
  "dos",
  "trapezes",
  "avant-bras",
  "abdos",
  "obliques",
  "cou",
];

export function LibraryTab() {
  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? [];
  const [zone, setZone] = useState<MuscleZone | "toutes" | "priorite">("toutes");
  const [type, setType] = useState<TrainingType | "tous">("tous");
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [detail, setDetail] = useState<Exercise | null>(null);

  // Même repli d'accents que le sélecteur de séance, et la zone est cherchable
  // aussi : taper « epaules » ici doit donner le même résultat qu'y filtrer.
  const needle = fold(query.trim());
  const filtered = exercises.filter((e) => {
    if (!matches(needle, e.name, ...e.zones)) return false;
    if (type !== "tous" && e.type !== type) return false;
    if (zone === "priorite") return e.priority === "primaire";
    if (zone !== "toutes" && !e.zones.includes(zone)) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <SectionTitle
        action={
          <button className="k-btn-ghost !px-3 !py-1.5 !text-xs" onClick={() => setAdding(true)}>
            + Exercice
          </button>
        }
      >
        Bibliothèque — {filtered.length}
      </SectionTitle>

      <input
        type="search"
        className="k-field"
        placeholder="Rechercher un exercice…"
        aria-label="Rechercher un exercice"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(["tous", "musculation", "mobilite"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={clsx(
              "shrink-0 border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
              type === t
                ? "border-blood-500 bg-blood-900 text-bone-50"
                : "border-ink-700 text-bone-600 hover:text-bone-200",
            )}
          >
            {t === "tous" ? "Tous" : t === "musculation" ? "Muscu" : "Mobilité"}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(["toutes", "priorite", ...ZONES] as const).map((z) => (
          <button
            key={z}
            onClick={() => setZone(z)}
            className={clsx(
              "border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors",
              zone === z
                ? "border-bone-400 text-bone-50"
                : PRIORITY_ZONES.includes(z as MuscleZone)
                  ? "border-ink-700 text-blood-300/70 hover:text-blood-300"
                  : "border-ink-800 text-bone-600 hover:text-bone-400",
            )}
          >
            {z === "toutes" ? "Toutes" : z === "priorite" ? "★ Priorité Toji" : ZONE_LABELS[z]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Empty>Aucun exercice pour ce filtre.</Empty>
      ) : (
        <Panel className="divide-y divide-ink-800">
          {filtered.map((ex) => (
            <ExerciseRow key={ex.id} exercise={ex} onOpen={() => setDetail(ex)} />
          ))}
        </Panel>
      )}

      <AddExerciseModal open={adding} onClose={() => setAdding(false)} />
      {detail && <ExerciseDetail exercise={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function ExerciseRow({ exercise, onOpen }: { exercise: Exercise; onOpen: () => void }) {
  return (
    <button
      className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition-colors active:bg-ink-800"
      onClick={onOpen}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {exercise.priority === "primaire" && (
            <span className="text-blood-400" aria-hidden>
              ★
            </span>
          )}
          <span className="text-sm text-bone-50">{exercise.name}</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {exercise.zones.map((z) => (
            <Tag key={z} tone={PRIORITY_ZONES.includes(z) ? "blood" : "neutral"}>
              {ZONE_LABELS[z]}
            </Tag>
          ))}
        </div>
      </div>
      <span className="mt-0.5 shrink-0 font-mono text-xs text-bone-600">→</span>
    </button>
  );
}

function AddExerciseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [zones, setZones] = useState<MuscleZone[]>([]);
  const [instructions, setInstructions] = useState("");
  const [type, setType] = useState<TrainingType>("musculation");

  const submit = async () => {
    if (!name.trim()) return;
    await db.exercises.add({
      name: name.trim(),
      type,
      zones: zones.length ? zones : ["abdos"],
      priority: zones.some((z) => PRIORITY_ZONES.includes(z)) ? "primaire" : "secondaire",
      equipment: ["perso"],
      splitDays: [],
      instructions: instructions.trim() || undefined,
      isCustom: true,
    });
    setName("");
    setZones([]);
    setInstructions("");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Nouvel exercice">
      <div className="space-y-4">
        <Field label="Nom">
          <input className="k-field" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        <Field label="Type">
          <select
            className="k-field"
            value={type}
            onChange={(e) => setType(e.target.value as TrainingType)}
          >
            <option value="musculation">Musculation</option>
            <option value="mobilite">Mobilité</option>
            <option value="combat">Combat</option>
          </select>
        </Field>

        <Field label="Zones">
          <div className="flex flex-wrap gap-1.5">
            {ZONES.map((z) => (
              <button
                key={z}
                onClick={() =>
                  setZones(zones.includes(z) ? zones.filter((x) => x !== z) : [...zones, z])
                }
                className={clsx(
                  "border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em]",
                  zones.includes(z)
                    ? "border-blood-500 bg-blood-900 text-bone-50"
                    : "border-ink-700 text-bone-600",
                )}
              >
                {ZONE_LABELS[z]}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Consignes">
          <textarea
            className="k-field min-h-20"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </Field>

        <button className="k-btn-primary w-full" onClick={submit}>
          Ajouter
        </button>
      </div>
    </Modal>
  );
}
