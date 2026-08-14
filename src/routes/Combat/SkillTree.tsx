import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import clsx from "clsx";
import { db } from "../../db/db";
import type { CombatCategory, CombatCheckpoint, CombatSkill } from "../../db/types";
import { isoDay, prettyDate } from "../../lib/dates";
import { Field, Modal, Tag } from "../../components/ui";

const CATEGORY_GLYPH: Record<CombatCategory, string> = {
  clinch: "組",
  "low-kicks": "蹴",
  "garde-defense": "守",
  "cardio-rounds": "耐",
};

/**
 * Les checkpoints sont déjà ordonnés du plus simple au plus exigeant dans la
 * seed : cet ordre EST la progression. La branche se contente de le rendre
 * visible plutôt que de le cacher dans une liste plate.
 *
 * Pas de verrou dur sur les paliers suivants : l'auto-évaluation reste
 * honnête et un coach peut juger qu'un palier plus loin est déjà acquis. Le
 * style "à venir" est une indication, pas une barrière.
 */
export function SkillTree({
  skill,
  checkpoints,
}: {
  skill: CombatSkill;
  checkpoints: CombatCheckpoint[];
}) {
  const [assessing, setAssessing] = useState(false);
  const ordered = checkpoints; // ordre d'insertion = ordre de la seed
  const done = ordered.filter((c) => c.achieved).length;
  const currentIndex = ordered.findIndex((c) => !c.achieved);

  const toggle = async (cp: CombatCheckpoint) => {
    const achieved = !cp.achieved;
    await db.combatCheckpoints.update(cp.id!, {
      achieved,
      dateAchieved: achieved ? isoDay() : undefined,
    });
    const newDone = ordered.filter((c) => (c.id === cp.id ? achieved : c.achieved)).length;
    await db.combatSkills.update(skill.id!, { levelCurrent: newDone });
  };

  return (
    <div className="border border-ink-700 bg-ink-950">
      <div className="flex items-start gap-3 border-b border-ink-800 px-3 py-3">
        <span
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center border border-ink-700 font-display text-lg text-blood-500"
          aria-hidden
        >
          {CATEGORY_GLYPH[skill.category]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base leading-tight">{skill.name}</h3>
            <span className="shrink-0 font-mono text-sm tabular-nums text-bone-50">
              {done}
              <span className="text-bone-600">/{ordered.length}</span>
            </span>
          </div>
          {skill.description && (
            <p className="mt-1.5 text-xs leading-relaxed text-bone-400">{skill.description}</p>
          )}
        </div>
      </div>

      <div className="px-3 py-4">
        <ol className="relative">
          {ordered.map((cp, i) => {
            const state: "done" | "current" | "future" =
              cp.achieved ? "done" : i === currentIndex ? "current" : "future";
            const isLast = i === ordered.length - 1;

            return (
              <li key={cp.id} className="relative flex gap-3 pb-5 last:pb-0">
                {!isLast && (
                  <span
                    aria-hidden
                    className={clsx(
                      "absolute left-[13px] top-7 h-full w-px",
                      cp.achieved ? "bg-blood-600" : "bg-ink-700",
                    )}
                  />
                )}

                <button
                  onClick={() => toggle(cp)}
                  aria-pressed={cp.achieved}
                  aria-label={`Palier ${i + 1} — ${cp.label}${cp.achieved ? " (validé)" : ""}`}
                  className={clsx(
                    "relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border font-mono text-[11px] transition-colors",
                    state === "done" && "border-blood-500 bg-blood-600",
                    state === "current" && "border-gold-400",
                    state === "future" && "border-ink-700",
                  )}
                >
                  <span
                    className={clsx(
                      state === "done" && "text-bone-50",
                      state === "current" && "text-gold-400",
                      state === "future" && "text-bone-700",
                    )}
                  >
                    {cp.achieved ? "✓" : i + 1}
                  </span>
                  {state === "current" && (
                    <span
                      aria-hidden
                      className="absolute inset-0 animate-pulse border border-gold-400/60"
                    />
                  )}
                </button>

                <button
                  onClick={() => toggle(cp)}
                  className="min-w-0 flex-1 pt-0.5 text-left"
                >
                  <span
                    className={clsx(
                      "block text-sm leading-snug",
                      state === "done" && "text-bone-300 line-through decoration-ink-600",
                      state === "current" && "text-bone-50",
                      state === "future" && "text-bone-600",
                    )}
                  >
                    {cp.label}
                  </span>
                  {cp.achieved && cp.dateAchieved ? (
                    <span className="k-label mt-0.5 block">Validé le {prettyDate(cp.dateAchieved)}</span>
                  ) : state === "current" ? (
                    <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.1em] text-gold-400">
                      Palier en cours
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <AssessmentHistory skillId={skill.id!} />

      <div className="border-t border-ink-800 px-3 py-2.5">
        <button
          className="k-btn-ghost w-full !text-[10px]"
          onClick={() => setAssessing(true)}
        >
          S'auto-évaluer sur cette branche
        </button>
      </div>

      <AssessModal skill={skill} open={assessing} onClose={() => setAssessing(false)} />
    </div>
  );
}

/**
 * Les auto-évaluations étaient écrites puis jamais relues : aucune trace après
 * l'enregistrement, donc aucun moyen de voir si le ressenti progresse. C'est
 * pourtant la seule mesure disponible sur une branche technique — l'app ne
 * peut pas juger un mouvement à la place de l'utilisateur.
 */
function AssessmentHistory({ skillId }: { skillId: number }) {
  const assessments =
    useLiveQuery(
      () => db.combatAssessments.where("skillId").equals(skillId).sortBy("date"),
      [skillId],
    ) ?? [];

  if (assessments.length === 0) return null;

  const latest = assessments[assessments.length - 1];
  const previous = assessments.length > 1 ? assessments[assessments.length - 2] : undefined;
  const delta = previous ? latest.level - previous.level : undefined;
  const max = LEVEL_LABELS.length - 1;

  return (
    <div className="border-t border-ink-800 px-3 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="k-label">Ressenti</span>
        <span className="font-mono text-[10px] tabular-nums text-bone-600">
          {assessments.length} évaluation{assessments.length > 1 ? "s" : ""}
        </span>
      </div>

      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="font-display text-sm uppercase tracking-[0.04em] text-bone-50">
          {LEVEL_LABELS[latest.level]}
        </span>
        {delta !== undefined && delta !== 0 && (
          <Tag tone={delta > 0 ? "jade" : "blood"}>
            {delta > 0 ? "+" : ""}
            {delta}
          </Tag>
        )}
      </div>

      {/* Une barre par évaluation, dans l'ordre chronologique : la forme de la
          suite dit tout de suite si le ressenti monte, stagne ou redescend. */}
      <div className="mt-2.5 flex items-end gap-[3px]" aria-hidden>
        {assessments.slice(-14).map((a) => (
          <span
            key={a.id}
            className="flex-1 bg-steel-400"
            style={{ height: `${6 + (a.level / max) * 26}px` }}
            title={`${prettyDate(a.date)} — ${LEVEL_LABELS[a.level]}`}
          />
        ))}
      </div>

      <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-bone-600">
        Dernière : {prettyDate(latest.date)}
      </div>
      {latest.notes && <p className="mt-1.5 text-xs text-bone-400">{latest.notes}</p>}
    </div>
  );
}

const LEVEL_LABELS = [
  "Non travaillé",
  "Découverte",
  "Ça vient en exercice",
  "Ça sort sous pression légère",
  "Fiable en sparring",
  "Automatique",
];

function AssessModal({
  skill,
  open,
  onClose,
}: {
  skill: CombatSkill;
  open: boolean;
  onClose: () => void;
}) {
  const [level, setLevel] = useState(3);
  const [notes, setNotes] = useState("");

  const submit = async () => {
    await db.combatAssessments.add({
      skillId: skill.id!,
      date: isoDay(),
      level,
      notes: notes.trim() || undefined,
    });
    setNotes("");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={`Auto-évaluation — ${skill.name}`}>
      <div className="space-y-4">
        <Field label="Niveau ressenti">
          <div className="space-y-1">
            {LEVEL_LABELS.map((label, i) => (
              <button
                key={i}
                onClick={() => setLevel(i)}
                className={clsx(
                  "flex w-full items-center gap-3 border px-3 py-2 text-left text-sm transition-colors",
                  level === i
                    ? "border-blood-500 bg-blood-900 text-bone-50"
                    : "border-ink-700 text-bone-400 hover:border-ink-600",
                )}
              >
                <span className="font-mono text-xs tabular-nums text-bone-600">{i}</span>
                {label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Notes">
          <textarea
            className="k-field min-h-16"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ce qui bloque, retour du coach…"
          />
        </Field>

        <button className="k-btn-primary w-full" onClick={submit}>
          Enregistrer
        </button>
      </div>
    </Modal>
  );
}

export { CATEGORY_GLYPH };
