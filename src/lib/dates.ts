import { format, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";

export const isoDay = (d: Date = new Date()) => format(d, "yyyy-MM-dd");

export const isoWeekStart = (d: Date = new Date()) =>
  format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");

export const prettyDate = (iso: string) =>
  format(new Date(`${iso}T00:00:00`), "d MMM yyyy", { locale: fr });

export const prettyShort = (iso: string) =>
  format(new Date(`${iso}T00:00:00`), "d MMM", { locale: fr });

export const daysBetween = (a: string, b: string) =>
  Math.round(
    (new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86_400_000,
  );
