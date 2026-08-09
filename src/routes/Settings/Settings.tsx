import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db";
import { downloadBlob, exportBackup, importBackup } from "../../lib/backup";
import { daysBetween, isoDay, prettyDate } from "../../lib/dates";
import { useSetting } from "../../lib/useSetting";
import { formatBytes, requestPersistentStorage, storageState } from "../../lib/storage";
import type { StorageState } from "../../lib/storage";
import { PageHeader } from "../../components/layout/Shell";
import { Modal, Panel, SectionTitle, Stat, Tag } from "../../components/ui";

export function Settings() {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [lastBackup, setLastBackup] = useSetting<string | null>("lastBackup", null);
  const [storage, setStorage] = useState<StorageState>();

  useEffect(() => {
    storageState().then(setStorage);
  }, [busy]);

  const counts = useLiveQuery(async () => ({
    workouts: await db.workoutLogs.count(),
    combat: await db.combatLogs.count(),
    measures: await db.measurements.count(),
    photos: await db.photos.count(),
  }));

  const backupAge = lastBackup ? daysBetween(lastBackup, isoDay()) : undefined;

  const doExport = async (withPhotos: boolean) => {
    setBusy(withPhotos ? "full" : "light");
    setError(null);
    try {
      const blob = await exportBackup(withPhotos);
      downloadBlob(blob, `kenka-${isoDay()}${withPhotos ? "-photos" : ""}.json`);
      await setLastBackup(isoDay());
      setMessage("Sauvegarde téléchargée.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export impossible.");
    } finally {
      setBusy(null);
    }
  };

  const doImport = async (file?: File) => {
    if (!file) return;
    setBusy("import");
    setError(null);
    setMessage(null);
    try {
      const { restored } = await importBackup(file);
      setMessage(`${restored} enregistrements restaurés.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import impossible.");
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <>
      <PageHeader eyebrow="Système" title="Réglages">
        Toutes les données vivent sur cet appareil, dans le navigateur. Aucun serveur, aucun compte,
        aucune synchronisation.
      </PageHeader>

      <div className="grid grid-cols-4 gap-2">
        <Stat label="Muscu" value={counts?.workouts ?? "—"} />
        <Stat label="Combat" value={counts?.combat ?? "—"} tone="steel" />
        <Stat label="Mesures" value={counts?.measures ?? "—"} />
        <Stat label="Photos" value={counts?.photos ?? "—"} tone="blood" />
      </div>

      <section className="mt-7">
        <SectionTitle>État du stockage</SectionTitle>
        <Panel className="divide-y divide-ink-800">
          <div className="flex items-center justify-between px-3 py-2.5">
            <div>
              <div className="text-sm text-bone-50">Stockage persistant</div>
              <div className="k-label">
                {storage?.persisted
                  ? "Le navigateur ne peut pas évincer les données"
                  : "Les données peuvent être effacées par le navigateur"}
              </div>
            </div>
            {storage?.persisted ? (
              <Tag tone="jade">Actif</Tag>
            ) : (
              <button
                className="k-btn-ghost shrink-0 !px-2.5 !py-1 !text-[10px]"
                onClick={async () => {
                  const ok = await requestPersistentStorage();
                  setStorage(await storageState());
                  setMessage(
                    ok
                      ? "Stockage persistant activé."
                      : "Le navigateur a refusé — installer l'app sur l'écran d'accueil est le moyen le plus sûr.",
                  );
                }}
              >
                Activer
              </button>
            )}
          </div>

          <div className="flex items-center justify-between px-3 py-2.5">
            <div>
              <div className="text-sm text-bone-50">Installation</div>
              <div className="k-label">
                {storage?.standalone ? "Lancée depuis l'écran d'accueil" : "Ouverte dans le navigateur"}
              </div>
            </div>
            <Tag tone={storage?.standalone ? "jade" : "blood"}>
              {storage?.standalone ? "Installée" : "Non installée"}
            </Tag>
          </div>

          <div className="flex items-center justify-between px-3 py-2.5">
            <div>
              <div className="text-sm text-bone-50">Espace utilisé</div>
              <div className="k-label">
                {storage?.quotaBytes
                  ? `sur ${formatBytes(storage.quotaBytes)} disponibles`
                  : "quota inconnu"}
              </div>
            </div>
            <span className="font-mono text-sm tabular-nums text-bone-50">
              {formatBytes(storage?.usageBytes)}
            </span>
          </div>

          <div className="flex items-center justify-between px-3 py-2.5">
            <div>
              <div className="text-sm text-bone-50">Dernière sauvegarde</div>
              <div className="k-label">
                {lastBackup ? prettyDate(lastBackup) : "jamais exportée"}
              </div>
            </div>
            <Tag tone={backupAge === undefined || backupAge >= 30 ? "blood" : "jade"}>
              {backupAge === undefined ? "Aucune" : `${backupAge} j`}
            </Tag>
          </div>
        </Panel>
      </section>

      <section className="mt-7">
        <SectionTitle>Sauvegarde</SectionTitle>
        <Panel className="space-y-3 px-3 py-3">
          <p className="text-xs leading-relaxed text-bone-400">
            Effacer les données du navigateur ou changer de téléphone efface tout. Exporter avant
            est le seul filet de sécurité.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              className="k-btn-ghost !text-xs"
              disabled={busy !== null}
              onClick={() => doExport(false)}
            >
              {busy === "light" ? "…" : "Export données"}
            </button>
            <button
              className="k-btn-primary !text-xs"
              disabled={busy !== null}
              onClick={() => doExport(true)}
            >
              {busy === "full" ? "…" : "Export + photos"}
            </button>
          </div>
          <p className="k-label">
            L'export avec photos est nettement plus lourd — c'est celui à garder avant un changement
            d'appareil.
          </p>
        </Panel>
      </section>

      <section className="mt-7">
        <SectionTitle>Restauration</SectionTitle>
        <Panel className="space-y-3 px-3 py-3">
          <p className="text-xs leading-relaxed text-bone-400">
            L'import <span className="text-blood-300">remplace</span> le contenu actuel de l'app par
            celui du fichier. Exporter d'abord si l'appareil contient des données récentes.
          </p>
          <button
            className="k-btn-ghost w-full !text-xs"
            disabled={busy !== null}
            onClick={() => fileInput.current?.click()}
          >
            {busy === "import" ? "Restauration…" : "Importer une sauvegarde"}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => doImport(e.target.files?.[0])}
          />
        </Panel>
      </section>

      {(message || error) && (
        <p
          className={`mt-4 border-l px-3 py-2 text-xs ${
            error ? "border-blood-500 text-blood-300" : "border-jade-400 text-jade-400"
          }`}
        >
          {error ?? message}
        </p>
      )}

      <section className="mt-7">
        <SectionTitle>Installation</SectionTitle>
        <Panel className="px-3 py-3">
          <ol className="space-y-1.5 text-xs leading-relaxed text-bone-400">
            <li>1. Ouvrir cette page dans Safari sur iPhone.</li>
            <li>2. Bouton Partager, puis « Sur l'écran d'accueil ».</li>
            <li>3. Lancer l'app depuis l'icône : plein écran, sans barre Safari, hors ligne.</li>
          </ol>
          <p className="mt-2.5 text-[11px] leading-relaxed text-bone-600">
            Important : les données sont liées au mode d'ouverture. Une fois l'app installée, tout
            passer par l'icône — le contenu ajouté depuis l'onglet Safari peut vivre séparément.
          </p>
        </Panel>
      </section>

      <section className="mt-7">
        <SectionTitle>Zone rouge</SectionTitle>
        <button className="k-btn-danger w-full !text-xs" onClick={() => setConfirmReset(true)}>
          Effacer toutes les données
        </button>
      </section>

      <Modal open={confirmReset} onClose={() => setConfirmReset(false)} title="Tout effacer">
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-bone-400">
            Séances, mesures, photos, checkpoints, fiches : tout est supprimé définitivement. Cette
            action est irréversible sans sauvegarde exportée.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button className="k-btn-ghost" onClick={() => setConfirmReset(false)}>
              Annuler
            </button>
            <button
              className="k-btn-danger"
              onClick={async () => {
                await db.delete();
                location.reload();
              }}
            >
              Effacer
            </button>
          </div>
        </div>
      </Modal>

      <p className="mt-8 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-ink-600">
        KENKA · usage personnel
      </p>
    </>
  );
}
