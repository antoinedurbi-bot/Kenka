import { useMemo, useState } from "react";
import clsx from "clsx";
import type { Exercise } from "../../db/types";
import { Modal, Tag } from "../../components/ui";
import { fold } from "../../lib/search";

/**
 * Sélecteur d'exercice.
 *
 * Remplace le `<select>` natif : la bibliothèque dépasse la centaine d'entrées,
 * et faire défiler une liste déroulante iOS au milieu d'une séance pour trouver
 * un mouvement était largement plus lent que de le sauter.
 */
export function ExercisePicker({
  open,
  onClose,
  exercises,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  exercises: Exercise[];
  onPick: (exercise: Exercise) => void;
}) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = fold(query.trim());
    const matched = q
      ? exercises.filter(
          (e) => fold(e.name).includes(q) || e.zones.some((z) => fold(z).includes(q)),
        )
      : exercises;

    // Les exercices prioritaires en premier : ce sont ceux qu'on ajoute à la volée
    // quand on veut rattraper un groupe sous-travaillé.
    return [...matched].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority === "primaire" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [exercises, query]);

  const close = () => {
    setQuery("");
    onClose();
  };

  return (
    <Modal open={open} onClose={close} title="Ajouter un exercice">
      <input
        type="search"
        autoFocus
        className="k-field"
        placeholder="Chercher — nom ou zone…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Chercher un exercice"
      />

      {results.length === 0 ? (
        <p className="mt-4 text-center text-xs text-bone-600">
          Aucun exercice ne correspond à « {query.trim()} ».
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-ink-800">
          {results.map((ex) => (
            <li key={ex.id}>
              <button
                onClick={() => {
                  onPick(ex);
                  close();
                }}
                className="flex w-full items-center gap-2 py-2.5 text-left active:bg-ink-850"
              >
                <span
                  className={clsx(
                    "shrink-0 font-mono text-xs",
                    ex.priority === "primaire" ? "text-blood-400" : "text-ink-500",
                  )}
                  aria-hidden
                >
                  ★
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-bone-50">{ex.name}</span>
                  <span className="mt-0.5 block truncate font-mono text-[10px] uppercase tracking-[0.1em] text-bone-600">
                    {ex.zones.join(" · ")}
                  </span>
                </span>
                {ex.defaultReps && <Tag>{ex.defaultReps}</Tag>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
