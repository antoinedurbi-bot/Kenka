import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";

/**
 * Le troisième élément indique si la valeur stockée a été lue. `useLiveQuery`
 * rend `undefined` aussi bien pendant le chargement que pour une clé absente :
 * sans distinguer les deux, un écran qui réagit à l'absence d'une valeur
 * afficherait brièvement le mauvais état à chaque montage.
 */
export function useSetting<T>(
  key: string,
  fallback: T,
): [T, (v: T) => Promise<void>, boolean] {
  const stored = useLiveQuery(async () => (await db.settings.get(key)) ?? null, [key]);
  const loaded = stored !== undefined;
  const value = (stored?.value as T | undefined) ?? fallback;

  const set = async (v: T) => {
    await db.settings.put({ key, value: v });
  };

  return [value, set, loaded];
}
