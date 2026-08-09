import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db";
import type { GlowUpCategory, GlowUpEntry } from "../../db/types";
import { PageHeader } from "../../components/layout/Shell";
import { Tabs } from "../../components/layout/Tabs";
import { Empty, Field, Modal, Panel, SectionTitle } from "../../components/ui";
import { MobilityTracker } from "./MobilityTracker";
import { ReferenceGallery } from "./ReferenceGallery";

/** Catégories où une référence visuelle a du sens — pas la peau ni la mobilité. */
const VISUAL_CATEGORIES: GlowUpCategory[] = ["coiffure", "posture", "style"];

const CATEGORIES: Array<{ value: GlowUpCategory; label: string; blurb: string }> = [
  {
    value: "mobilite",
    label: "Mobilité",
    blurb: "Point faible identifié. Travail articulaire actif, pas seulement du stretching passif.",
  },
  { value: "peau", label: "Peau", blurb: "Routines simples, tenues sur la durée." },
  { value: "coiffure", label: "Coiffure", blurb: "Référence Toji : mi-long, attaché ou lâché." },
  { value: "posture", label: "Posture", blurb: "Diagnostic et correctifs — c'est aussi de la performance." },
  { value: "style", label: "Style", blurb: "La coupe avant la marque." },
];

export function GlowUp() {
  const [tab, setTab] = useState<GlowUpCategory>("mobilite");
  const [adding, setAdding] = useState(false);
  const [mobilityView, setMobilityView] = useState<"fiches" | "mesures">("mesures");

  const entries =
    useLiveQuery(() => db.glowUp.where("category").equals(tab).sortBy("order"), [tab]) ?? [];
  const current = CATEGORIES.find((c) => c.value === tab)!;

  return (
    <>
      <PageHeader eyebrow="Détails" title="Glow up">
        Ce qui se joue en dehors des séances. Le physique porte la moitié du résultat, pas la
        totalité.
      </PageHeader>

      <Tabs<GlowUpCategory>
        value={tab}
        onChange={setTab}
        options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
      />

      {tab === "mobilite" && (
        <div className="mb-5 flex gap-1">
          {(["mesures", "fiches"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setMobilityView(v)}
              aria-pressed={mobilityView === v}
              className={`flex-1 border py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
                mobilityView === v
                  ? "border-blood-500 bg-blood-900 text-bone-50"
                  : "border-ink-700 text-bone-600"
              }`}
            >
              {v === "mesures" ? "Repères mesurés" : "Programme"}
            </button>
          ))}
        </div>
      )}

      {tab === "mobilite" && mobilityView === "mesures" ? (
        <MobilityTracker />
      ) : (
        <FichesView
          label={current.label}
          blurb={current.blurb}
          entries={entries}
          onAdd={() => setAdding(true)}
          category={tab}
        />
      )}

      <EntryModal open={adding} onClose={() => setAdding(false)} category={tab} />
    </>
  );
}

function FichesView({
  label,
  blurb,
  entries,
  onAdd,
  category,
}: {
  label: string;
  blurb: string;
  entries: GlowUpEntry[];
  onAdd: () => void;
  category: GlowUpCategory;
}) {
  return (
    <>
      {VISUAL_CATEGORIES.includes(category) && <ReferenceGallery category={category} />}

      <SectionTitle
        action={
          <button className="k-btn-ghost !px-3 !py-1.5 !text-xs" onClick={onAdd}>
            + Fiche
          </button>
        }
      >
        {label}
      </SectionTitle>
      <p className="-mt-1 mb-4 text-xs leading-relaxed text-bone-600">{blurb}</p>

      {entries.length === 0 ? (
        <Empty>Aucune fiche dans cette catégorie.</Empty>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <EntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </>
  );
}

function EntryCard({ entry }: { entry: GlowUpEntry }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  return (
    <Panel>
      <button
        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
        onClick={() => setOpen(!open)}
      >
        <h3 className="text-sm leading-tight">{entry.title}</h3>
        <span className="shrink-0 font-mono text-xs text-bone-600">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="border-t border-ink-800 px-3 py-3">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-bone-400">
            {entry.content}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              className="k-btn-ghost !px-2.5 !py-1 !text-[10px]"
              onClick={() => setEditing(true)}
            >
              Modifier
            </button>
            <button
              className="k-btn-danger !px-2.5 !py-1 !text-[10px]"
              onClick={() => db.glowUp.delete(entry.id!)}
            >
              Supprimer
            </button>
          </div>
        </div>
      )}

      <EntryModal
        open={editing}
        onClose={() => setEditing(false)}
        category={entry.category}
        entry={entry}
      />
    </Panel>
  );
}

function EntryModal({
  open,
  onClose,
  category,
  entry,
}: {
  open: boolean;
  onClose: () => void;
  category: GlowUpCategory;
  entry?: GlowUpEntry;
}) {
  const [title, setTitle] = useState(entry?.title ?? "");
  const [content, setContent] = useState(entry?.content ?? "");

  const submit = async () => {
    if (!title.trim()) return;
    if (entry) {
      await db.glowUp.update(entry.id!, { title: title.trim(), content });
    } else {
      const count = await db.glowUp.where("category").equals(category).count();
      await db.glowUp.add({ category, title: title.trim(), content, order: count + 1 });
      setTitle("");
      setContent("");
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={entry ? "Modifier la fiche" : "Nouvelle fiche"}>
      <div className="space-y-4">
        <Field label="Titre">
          <input className="k-field" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Contenu">
          <textarea
            className="k-field min-h-48"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </Field>
        <button className="k-btn-primary w-full" onClick={submit}>
          Enregistrer
        </button>
      </div>
    </Modal>
  );
}
