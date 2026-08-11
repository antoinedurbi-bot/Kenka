import { useSetting } from "./useSetting";

export type SectionId = "physique" | "combat" | "photos" | "glow-up";

export interface SectionDef {
  id: SectionId;
  label: string;
  kanji: string;
  blurb: string;
}

/**
 * Base et Réglages ne sont pas dans cette liste : ce sont l'accueil et la
 * sortie de secours, elles restent toujours accessibles quel que soit le
 * choix. Ce qui peut être désactivé, ce sont les axes optionnels — tout le
 * monde ne veut pas suivre son combat ou tenir des fiches glow up.
 */
export const SECTIONS: SectionDef[] = [
  { id: "physique", label: "Physique", kanji: "体", blurb: "Séances muscu, volume, mesures." },
  { id: "combat", label: "Combat", kanji: "闘", blurb: "Compétences, séances, sparring." },
  { id: "photos", label: "Photos", kanji: "影", blurb: "Suivi visuel de la progression." },
  { id: "glow-up", label: "Glow up", kanji: "道", blurb: "Mobilité, peau, posture, style." },
];

export const ALL_SECTION_IDS: SectionId[] = SECTIONS.map((s) => s.id);

/** Clé de stockage partagée par l'onboarding, les réglages et la navigation. */
export const ENABLED_SECTIONS_KEY = "enabledSections";

/**
 * Défaut = tout activé, pour que l'app d'un utilisateur déjà onboardé avant
 * l'ajout de ce réglage ne perde rien silencieusement.
 */
export function useEnabledSections() {
  const [ids, set, loaded] = useSetting<SectionId[]>(ENABLED_SECTIONS_KEY, ALL_SECTION_IDS);
  return [ids, set, loaded] as const;
}
