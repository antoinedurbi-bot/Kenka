import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { useSetting } from "../lib/useSetting";
import { daysBetween, isoDay } from "../lib/dates";
import { storageState } from "../lib/storage";
import type { StorageState } from "../lib/storage";

const BACKUP_STALE_DAYS = 30;
/** En dessous, il n'y a rien à perdre : réclamer une sauvegarde serait du bruit. */
const BACKUP_WORTH_IT = 5;

/**
 * Deux risques réels pour une app sans cloud : Safari qui évince le stockage
 * d'un site non installé, et une sauvegarde jamais exportée. Rien de tout cela
 * ne se voit avant que les données ne soient perdues — donc on l'affiche.
 */
export function DataSafetyBanner() {
  const [state, setState] = useState<StorageState>();
  const [lastBackup, , backupLoaded] = useSetting<string | null>("lastBackup", null);
  const [dismissedInstall, setDismissedInstall, dismissLoaded] = useSetting<boolean>(
    "dismissedInstall",
    false,
  );

  // Volume de données réellement à risque — les fiches et exercices pré-remplis
  // ne comptent pas : eux se régénèrent tout seuls.
  const ownData = useLiveQuery(
    async () =>
      (await db.workoutLogs.count()) +
      (await db.combatLogs.count()) +
      (await db.measurements.count()) +
      (await db.photos.count()) +
      (await db.referenceImages.count()) +
      (await db.dailyWeights.count()) +
      (await db.mobilityLogs.count()),
    [],
  );

  useEffect(() => {
    storageState().then(setState);
  }, []);

  // Rien tant que l'état réel n'est pas connu : afficher une alerte puis la
  // retirer au rendu suivant serait pire que de ne rien afficher.
  if (!state || !backupLoaded || !dismissLoaded || ownData === undefined) return null;

  const backupAge = lastBackup ? daysBetween(lastBackup, isoDay()) : undefined;
  const backupStale =
    ownData >= BACKUP_WORTH_IT && (backupAge === undefined || backupAge >= BACKUP_STALE_DAYS);
  const evictionRisk = state.isIOS && !state.standalone && !dismissedInstall;

  if (!evictionRisk && !backupStale) return null;

  /*
   * Un seul bandeau à la fois, le plus urgent. Les deux empilés poussaient tout
   * le contenu du tableau de bord sous la ligne de flottaison à chaque
   * ouverture — et deux alertes affichées ensemble se lisent comme du décor,
   * plus comme des alertes.
   *
   * L'éviction passe devant : elle fait perdre les données sans prévenir,
   * alors qu'une sauvegarde en retard laisse encore le temps d'agir.
   */
  if (evictionRisk) {
    return (
      <div className="mb-4 flex items-start justify-between gap-2 border border-blood-600 bg-blood-900/25 px-3 py-2.5">
        <div>
          <div className="font-display text-xs uppercase tracking-[0.1em] text-bone-50">
            Installe l'app pour ne pas perdre tes données
          </div>
          <p className="mt-1 text-[11px] text-bone-200">
            Safari efface le stockage d'un site non installé. Partager → « Sur l'écran d'accueil ».
          </p>
        </div>
        <button
          onClick={() => setDismissedInstall(true)}
          aria-label="Masquer cet avertissement"
          className="shrink-0 px-1 font-mono text-bone-400"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <Link
      to="/reglages"
      className="mb-4 block border border-ink-700 bg-ink-900 px-3 py-2.5 transition-colors hover:border-ink-600"
    >
      <div className="font-display text-xs uppercase tracking-[0.1em] text-gold-400">
        Sauvegarde à faire
      </div>
      <p className="mt-1 text-[11px] text-bone-400">
        {backupAge === undefined
          ? "Aucune sauvegarde exportée."
          : `Dernier export il y a ${backupAge} jours.`}{" "}
        Exporter depuis les Réglages.
      </p>
    </Link>
  );
}
