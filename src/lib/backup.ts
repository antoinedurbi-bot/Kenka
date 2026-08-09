import { db } from "../db/db";
import type { ProgressPhoto, ReferenceImage } from "../db/types";

const FORMAT_VERSION = 3;

interface Backup {
  format: "kenka-backup";
  version: number;
  exportedAt: string;
  tables: Record<string, unknown[]>;
}

const TABLES = [
  "exercises",
  "workoutLogs",
  "workoutSets",
  "measurements",
  "nutrition",
  "dailyIntake",
  "dailyWeights",
  "mobilityLogs",
  "combatSkills",
  "combatCheckpoints",
  "combatAssessments",
  "combatLogs",
  "glowUp",
  "settings",
] as const;

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

async function dataUrlToBlob(dataUrl: string) {
  const res = await fetch(dataUrl);
  return res.blob();
}

export async function exportBackup(includePhotos: boolean): Promise<Blob> {
  const tables: Record<string, unknown[]> = {};

  for (const name of TABLES) {
    tables[name] = await db.table(name).toArray();
  }

  if (includePhotos) {
    const photos = await db.photos.toArray();
    tables.photos = await Promise.all(
      photos.map(async (p) => ({
        id: p.id,
        date: p.date,
        angle: p.angle,
        notes: p.notes,
        dataUrl: await blobToDataUrl(p.blob),
      })),
    );

    const refs = await db.referenceImages.toArray();
    tables.referenceImages = await Promise.all(
      refs.map(async (r) => ({
        id: r.id,
        category: r.category,
        caption: r.caption,
        order: r.order,
        dataUrl: await blobToDataUrl(r.blob),
      })),
    );
  }

  const backup: Backup = {
    format: "kenka-backup",
    version: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    tables,
  };

  return new Blob([JSON.stringify(backup)], { type: "application/json" });
}

export async function importBackup(file: File): Promise<{ restored: number }> {
  const parsed = JSON.parse(await file.text()) as Backup;

  if (parsed.format !== "kenka-backup") {
    throw new Error("Ce fichier n'est pas une sauvegarde KENKA.");
  }
  if (parsed.version > FORMAT_VERSION) {
    throw new Error("Sauvegarde créée par une version plus récente de l'app.");
  }

  // Une sauvegarde v1 ignore workoutSets.date : sans ce report depuis la séance
  // parente, tout l'historique de charges deviendrait invisible côté progression.
  const logDates = new Map<number, string>();
  for (const log of (parsed.tables.workoutLogs ?? []) as Array<Record<string, unknown>>) {
    if (typeof log.id === "number" && typeof log.date === "string") {
      logDates.set(log.id, log.date);
    }
  }

  // Les blobs sont décodés AVANT d'ouvrir la transaction : un décodage échoué
  // doit interrompre l'import sans qu'une seule table ait été vidée, et un await
  // sur une promesse externe ferait de toute façon expirer la transaction Dexie.
  const photoRows: ProgressPhoto[] = [];
  const rawPhotos = parsed.tables.photos;
  if (Array.isArray(rawPhotos)) {
    for (const raw of rawPhotos as Array<Record<string, string>>) {
      if (!raw.dataUrl) continue;
      photoRows.push({
        id: raw.id ? Number(raw.id) : undefined,
        date: raw.date,
        angle: raw.angle as ProgressPhoto["angle"],
        notes: raw.notes,
        blob: await dataUrlToBlob(raw.dataUrl),
      });
    }
  }

  const referenceRows: ReferenceImage[] = [];
  const rawReferences = parsed.tables.referenceImages;
  if (Array.isArray(rawReferences)) {
    for (const raw of rawReferences as Array<Record<string, string | number>>) {
      if (!raw.dataUrl) continue;
      referenceRows.push({
        id: raw.id ? Number(raw.id) : undefined,
        category: raw.category as ReferenceImage["category"],
        caption: raw.caption as string | undefined,
        order: raw.order as number | undefined,
        blob: await dataUrlToBlob(raw.dataUrl as string),
      });
    }
  }

  let restored = 0;

  /*
   * Tout l'import tient dans une seule transaction. Sans elle, un fichier
   * corrompu à mi-parcours laisserait des tables déjà vidées et d'autres encore
   * pleines : l'utilisateur perdrait ses données en tentant de les restaurer.
   */
  await db.transaction(
    "rw",
    [...TABLES.map((t) => db.table(t)), db.photos, db.referenceImages],
    async () => {
      for (const name of TABLES) {
        const rows = parsed.tables[name];
        if (!Array.isArray(rows)) continue;

        const prepared =
          name === "workoutSets"
            ? (rows as Array<Record<string, unknown>>).map((set) => ({
                ...set,
                date:
                  typeof set.date === "string"
                    ? set.date
                    : (logDates.get(set.workoutLogId as number) ?? "1970-01-01"),
              }))
            : rows;

        await db.table(name).clear();
        await db.table(name).bulkPut(prepared);
        restored += prepared.length;
      }

      if (Array.isArray(rawPhotos)) {
        await db.photos.clear();
        await db.photos.bulkPut(photoRows);
        restored += photoRows.length;
      }

      if (Array.isArray(rawReferences)) {
        await db.referenceImages.clear();
        await db.referenceImages.bulkPut(referenceRows);
        restored += referenceRows.length;
      }
    },
  );

  return { restored };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
