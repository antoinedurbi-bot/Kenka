/**
 * Repli des accents pour la recherche : « elevations » doit trouver
 * « Élévations latérales ». Partagé par le sélecteur de séance et la
 * bibliothèque — les deux avaient leur propre comparaison, et seule celle du
 * sélecteur pliait les accents : la même frappe donnait deux résultats
 * différents selon l'écran.
 */
export const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** Vrai si `needle` (déjà plié) apparaît dans l'un des champs donnés. */
export const matches = (needle: string, ...fields: string[]) =>
  needle === "" || fields.some((f) => fold(f).includes(needle));
