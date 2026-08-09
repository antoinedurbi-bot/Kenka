import { useState } from "react";
import { daysBetween, isoDay, prettyDate } from "../../lib/dates";
import { useSetting } from "../../lib/useSetting";
import { Modal, Panel, Tag } from "../../components/ui";

const CHECKLIST = [
  "Charges ou répétitions en hausse sur au moins un exercice par groupe ? Sinon, ajouter une série ou un temps sous tension.",
  "Poids moyen dans la cible (+0,25 à +0,4 kg/sem) ? Ajuster de 150-200 kcal si non.",
  "Tour de taille stable pendant que les épaules montent ? C'est le vrai signal de recomposition.",
  "Un exercice prioritaire (épaules, dos, avant-bras, cou) plafonne-t-il ? Le changer ou le charger autrement.",
  "Mobilité : un repère mesuré a-t-il bougé ce mois-ci ?",
  "Combat : au moins un checkpoint validé ou re-évalué ?",
  "Sommeil et douleurs articulaires — un problème ici annule toute progression du mois suivant.",
];

export function MonthlyReview() {
  const [last, setLast, loaded] = useSetting<string | null>("lastMonthlyReview", null);
  const [open, setOpen] = useState(false);

  if (!loaded) return null;

  const days = last ? daysBetween(last, isoDay()) : undefined;
  const due = days === undefined || days >= 30;

  return (
    <>
      <Panel className="px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm leading-none">Bilan mensuel</h3>
            <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-bone-600">
              {last ? `Dernier : ${prettyDate(last)}` : "Jamais effectué"}
            </p>
          </div>
          {due ? (
            <button className="k-btn-primary shrink-0 !px-3 !py-1.5 !text-xs" onClick={() => setOpen(true)}>
              À faire
            </button>
          ) : (
            <Tag tone="jade">Dans {30 - days!} j</Tag>
          )}
        </div>
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} title="Bilan mensuel">
        <div className="space-y-4">
          <p className="text-xs leading-relaxed text-bone-400">
            Le programme ne s'ajuste pas tout seul. Une fois par mois, on relit les chiffres et on
            décide d'une seule chose à monter — pas cinq.
          </p>

          <ol className="space-y-2.5">
            {CHECKLIST.map((item, i) => (
              <li key={i} className="flex gap-3 border-l border-ink-700 pl-3">
                <span className="font-mono text-xs tabular-nums text-blood-500">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-xs leading-relaxed text-bone-400">{item}</span>
              </li>
            ))}
          </ol>

          <button
            className="k-btn-primary w-full"
            onClick={async () => {
              await setLast(isoDay());
              setOpen(false);
            }}
          >
            Bilan effectué
          </button>
        </div>
      </Modal>
    </>
  );
}
