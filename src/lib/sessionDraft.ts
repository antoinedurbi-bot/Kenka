import { useCallback, useEffect, useRef, useState } from "react";
import { db } from "../db/db";
import type { DraftExercise, SessionDraft, SplitDay } from "../db/types";

const DRAFT_ID = "current";
/** Fenêtre d'écriture : assez courte pour survivre à une fermeture, assez longue
 *  pour ne pas écrire à chaque caractère tapé. */
const PERSIST_DELAY_MS = 400;

export async function loadDraft(): Promise<SessionDraft | undefined> {
  return db.sessionDraft.get(DRAFT_ID);
}

export async function clearDraft() {
  await db.sessionDraft.delete(DRAFT_ID);
}

export async function startDraft(init: {
  date: string;
  splitDay: SplitDay;
  exercises: DraftExercise[];
  fromHistory: boolean;
}): Promise<SessionDraft> {
  const draft: SessionDraft = {
    id: DRAFT_ID,
    startedAt: Date.now(),
    feeling: 3,
    ...init,
  };
  await db.sessionDraft.put(draft);
  return draft;
}

/**
 * Garde le brouillon en mémoire pour un rendu immédiat et le recopie sur disque
 * en différé. L'écriture est aussi forcée quand l'onglet passe en arrière-plan :
 * c'est le dernier instant garanti avant que Safari puisse tuer la page.
 */
export function usePersistedDraft(draft: SessionDraft | null) {
  const pending = useRef<SessionDraft | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flush = useCallback(() => {
    const value = pending.current;
    if (!value) return;
    pending.current = null;
    void db.sessionDraft.put(value);
  }, []);

  /*
   * À appeler avant de supprimer le brouillon. Sans ça, terminer une séance
   * moins de PERSIST_DELAY_MS après une saisie laisserait l'écriture différée
   * s'exécuter APRÈS la suppression et ressusciterait une séance fantôme.
   */
  const cancelPendingWrite = useCallback(() => {
    pending.current = null;
    clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    if (!draft) return;
    pending.current = draft;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, PERSIST_DELAY_MS);
    return () => clearTimeout(timer.current);
  }, [draft, flush]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    // pagehide couvre le cas iOS où l'onglet est déchargé sans visibilitychange.
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  return { cancelPendingWrite };
}

/** Séance en cours, pour la bannière de reprise. */
export function useActiveDraft(): [SessionDraft | undefined, boolean] {
  const [draft, setDraft] = useState<SessionDraft>();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadDraft().then((d) => {
      if (cancelled) return;
      setDraft(d);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return [draft, loaded];
}

/**
 * Durée maximale créditée à une séance. Une séance oubliée puis reprise le
 * lendemain enregistrerait sinon douze heures d'entraînement et fausserait
 * durablement les statistiques.
 */
const MAX_SESSION_MINUTES = 240;

export function sessionMinutes(startedAt: number, now = Date.now()): number {
  const elapsed = Math.round((now - startedAt) / 60000);
  return Math.max(1, Math.min(MAX_SESSION_MINUTES, elapsed));
}

/** Séries effectivement remplies — sert à savoir si un brouillon vaut la peine. */
export function draftFilledSets(draft: SessionDraft): number {
  return draft.exercises.reduce(
    (n, ex) => n + ex.sets.filter((s) => s.done || s.reps || s.weightKg).length,
    0,
  );
}
