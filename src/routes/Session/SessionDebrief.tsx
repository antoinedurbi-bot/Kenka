import type { CSSProperties } from "react";
import { RECORD_LABELS } from "../../lib/records";
import type { SessionSummary } from "../../lib/sessionSummary";
import { Modal, Tag } from "../../components/ui";
import { KanjiSeal } from "../../components/illustrations/Motifs";

/**
 * Débrief affiché avant l'enregistrement.
 *
 * Deux raisons d'exister. D'abord montrer ce qui vient d'être fait tant que
 * l'effort est chaud : c'est le seul moment de la boucle où l'app peut rendre
 * quelque chose plutôt que demander. Ensuite signaler les séries prévues restées
 * vides — elles ne sont pas enregistrées, et l'apprendre trois semaines plus tard
 * en lisant un graphe est trop tard.
 */
export function SessionDebrief({
  open,
  summary,
  durationMin,
  saving,
  onResume,
  onConfirm,
}: {
  open: boolean;
  summary: SessionSummary;
  durationMin: number;
  saving: boolean;
  onResume: () => void;
  onConfirm: () => void;
}) {
  const { records } = summary;

  return (
    <Modal open={open} onClose={onResume} title="Terminer la séance">
      <div className="grid grid-cols-3 gap-2">
        <Metric label="Durée" value={durationMin} unit="min" />
        <Metric label="Séries" value={summary.filledSets} unit={`/${summary.plannedSets}`} />
        {summary.tonnageKg > 0 ? (
          <Metric label="Tonnage" value={summary.tonnageKg} unit="kg" />
        ) : (
          <Metric label="Répétitions" value={summary.bodyweightReps} unit="" />
        )}
      </div>

      {summary.tonnageKg > 0 && summary.bodyweightReps > 0 && (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-bone-600">
          + {summary.bodyweightReps} répétitions au poids du corps
        </p>
      )}

      {records.length > 0 && (
        <section className="mt-5">
          <div className="mb-2 flex items-center gap-2">
            <span className="k-label text-gold-400">
              {records.length > 1 ? `${records.length} records battus` : "Record battu"}
            </span>
            <span className="h-px flex-1 bg-gold-400/30" />
          </div>

          <ul className="space-y-1.5">
            {records.map((r, i) => (
              <li
                key={`${r.exerciseId}-${r.kind}`}
                style={{ "--k-stagger": i } as CSSProperties}
                className="k-anim-pop k-shine relative flex items-center gap-2.5 overflow-hidden border border-gold-400/40 bg-gold-400/5 px-2.5 py-2"
              >
                <KanjiSeal kanji="極" color="#c8933f" className="h-8 w-8 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-xs uppercase tracking-[0.08em] text-bone-50">
                    {r.exerciseName}
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-bone-600">
                    {RECORD_LABELS[r.kind]}
                    {r.previous !== undefined
                      ? ` · ${r.previous} → ${r.value}`
                      : ` · ${r.value} (première référence)`}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {summary.skippedSets > 0 && (
        <div className="mt-5 border-l-2 border-l-gold-400 bg-ink-950 px-3 py-2.5">
          <Tag tone="gold">
            {summary.skippedSets} série{summary.skippedSets > 1 ? "s" : ""} vide
            {summary.skippedSets > 1 ? "s" : ""}
          </Tag>
          <p className="mt-1.5 text-[11px] leading-relaxed text-bone-400">
            Elles ne seront pas enregistrées. Si tu les as faites sans les saisir, reprends la
            séance — sinon le volume du mois sera sous-estimé.
          </p>
        </div>
      )}

      {summary.filledSets === 0 && (
        <p className="mt-5 text-[11px] leading-relaxed text-bone-400">
          Aucune série saisie : la séance sera enregistrée comme effectuée, mais sans aucun détail
          exploitable pour la progression.
        </p>
      )}

      <div className="mt-5 flex gap-2">
        <button className="k-btn-ghost flex-1" onClick={onResume} disabled={saving}>
          Reprendre
        </button>
        <button className="k-btn-primary flex-[2]" onClick={onConfirm} disabled={saving}>
          {saving ? "…" : "Enregistrer"}
        </button>
      </div>
    </Modal>
  );
}

function Metric({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="border border-ink-700 bg-ink-950 px-2.5 py-2.5 text-center">
      <div className="k-label">{label}</div>
      <div className="mt-1 font-mono text-xl leading-none tabular-nums text-bone-50">
        {value}
        {unit && <span className="ml-0.5 text-[10px] text-bone-600">{unit}</span>}
      </div>
    </div>
  );
}
