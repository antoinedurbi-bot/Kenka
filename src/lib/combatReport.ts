import type { CombatSessionKind, CombatSessionLog } from "../db/types";
import { daysBetween, isoDay } from "./dates";

export type TechniqueFamily = "poings" | "jambes" | "clinch" | "defense" | "deplacement";

/**
 * Liste canonique des techniques loggables. Elle vit ici plutôt que dans le
 * formulaire : c'est la même liste qui alimente la saisie et le classement par
 * famille, et deux copies finiraient par diverger — une technique ajoutée au
 * formulaire seul serait loggable mais invisible dans l'analyse.
 */
export const TECHNIQUE_FAMILY: Record<string, TechniqueFamily> = {
  Jab: "poings",
  Direct: "poings",
  Crochet: "poings",
  Uppercut: "poings",
  "Low kick": "jambes",
  "Middle kick": "jambes",
  "High kick": "jambes",
  Teep: "jambes",
  Genou: "clinch",
  Coude: "clinch",
  Clinch: "clinch",
  Esquive: "defense",
  "Blocage / check": "defense",
  Déplacements: "deplacement",
};

export const FAMILY_LABELS: Record<TechniqueFamily, string> = {
  poings: "Poings",
  jambes: "Jambes",
  clinch: "Clinch / coudes / genoux",
  defense: "Défense",
  deplacement: "Déplacements",
};

/**
 * Les deux familles que l'axe Combat revendique comme fondations — « les
 * fondamentaux avant le style ». Ce sont aussi celles qu'on saute en premier :
 * frapper est gratifiant, esquiver et se placer ne le sont pas.
 */
export const FUNDAMENTAL_FAMILIES: TechniqueFamily[] = ["defense", "deplacement"];

/** Séances qui impliquent un partenaire — les seules où la technique est mise à l'épreuve. */
const PARTNER_KINDS: CombatSessionKind[] = ["club", "sparring"];

/** Une fondation doit apparaître dans au moins ce ratio de séances. */
const FUNDAMENTAL_MIN_SHARE = 1 / 3;

/** Part minimale de séances avec partenaire avant que le travail devienne théorique. */
const PARTNER_MIN_SHARE = 1 / 3;

/** Au-delà, le sparring ne joue plus son rôle de contrôle de réalité. */
const SPARRING_STALE_DAYS = 21;

/** Sous ce nombre de séances, la répartition n'est que du bruit. */
const MIN_SESSIONS = 4;

export interface FamilyVolume {
  family: TechniqueFamily;
  /** Nombre de séances où au moins une technique de la famille a été travaillée. */
  sessions: number;
  /** Part des séances de la fenêtre. */
  share: number;
  fundamental: boolean;
}

export interface CombatReport {
  windowDays: number;
  sessions: number;
  rounds: number;
  minutes: number;
  byFamily: FamilyVolume[];
  partnerSessions: number;
  /** Assez de séances avec partenaire pour que la technique soit corrigée. */
  partnerHealthy: boolean;
  sparringSessions: number;
  /** Le dernier sparring est-il assez récent pour servir de contrôle de réalité ? */
  sparringFresh: boolean;
  /** Jours depuis le dernier sparring, toutes périodes confondues. */
  daysSinceSparring?: number;
  /** Fondations sous le seuil de présence. */
  neglected: TechniqueFamily[];
  verdict: "aligne" | "a-corriger" | "insuffisant";
  advice: string;
}

/**
 * Lecture des N derniers jours de l'axe Combat.
 *
 * Les techniques sont comptées **par séance** et non par occurrence : cocher
 * « Jab » dix fois en un mois de sac ne dit pas qu'on l'a travaillé dix fois,
 * seulement qu'on l'a travaillé dix jours. C'est la régularité qui construit un
 * automatisme, pas le total.
 */
export function combatReport(logs: CombatSessionLog[], windowDays = 28): CombatReport {
  const today = isoDay();
  const recent = logs.filter((l) => {
    const age = daysBetween(l.date, today);
    return age >= 0 && age < windowDays;
  });

  const sessions = recent.length;
  const rounds = recent.reduce((n, l) => n + (l.rounds ?? 0), 0);
  const minutes = recent.reduce((n, l) => n + (l.durationMin ?? 0), 0);

  const counts = new Map<TechniqueFamily, number>();
  for (const log of recent) {
    const families = new Set<TechniqueFamily>();
    for (const t of log.techniques) {
      const family = TECHNIQUE_FAMILY[t];
      if (family) families.add(family);
    }
    for (const family of families) counts.set(family, (counts.get(family) ?? 0) + 1);
  }

  const byFamily: FamilyVolume[] = (Object.keys(FAMILY_LABELS) as TechniqueFamily[])
    .map((family) => ({
      family,
      sessions: counts.get(family) ?? 0,
      share: sessions === 0 ? 0 : (counts.get(family) ?? 0) / sessions,
      fundamental: FUNDAMENTAL_FAMILIES.includes(family),
    }))
    .sort((a, b) => b.sessions - a.sessions);

  const partnerSessions = recent.filter((l) => PARTNER_KINDS.includes(l.kind)).length;
  const sparringSessions = recent.filter((l) => l.kind === "sparring").length;

  // Le dernier sparring se cherche sur tout l'historique : « aucun depuis
  // 40 jours » est précisément l'information que la fenêtre effacerait.
  const lastSparring = logs
    .filter((l) => l.kind === "sparring")
    .map((l) => l.date)
    .sort()
    .pop();
  const daysSinceSparring = lastSparring ? daysBetween(lastSparring, today) : undefined;

  if (sessions < MIN_SESSIONS) {
    return {
      windowDays,
      sessions,
      rounds,
      minutes,
      byFamily,
      partnerSessions,
      partnerHealthy: sessions > 0 && partnerSessions / sessions >= PARTNER_MIN_SHARE,
      sparringSessions,
      sparringFresh:
        daysSinceSparring !== undefined && daysSinceSparring <= SPARRING_STALE_DAYS,
      daysSinceSparring,
      neglected: [],
      verdict: "insuffisant",
      advice: `${sessions} séance(s) loggée(s) sur ${windowDays} jours : pas encore de quoi juger la répartition du travail.`,
    };
  }

  const neglected = FUNDAMENTAL_FAMILIES.filter(
    (f) => (counts.get(f) ?? 0) / sessions < FUNDAMENTAL_MIN_SHARE,
  );
  const partnerShare = partnerSessions / sessions;
  const sparringStale =
    daysSinceSparring === undefined || daysSinceSparring > SPARRING_STALE_DAYS;

  const aligned = neglected.length === 0 && partnerShare >= PARTNER_MIN_SHARE && !sparringStale;

  return {
    windowDays,
    sessions,
    rounds,
    minutes,
    byFamily,
    partnerSessions,
    partnerHealthy: partnerShare >= PARTNER_MIN_SHARE,
    sparringSessions,
    sparringFresh: !sparringStale,
    daysSinceSparring,
    neglected,
    verdict: aligned ? "aligne" : "a-corriger",
    advice: buildAdvice({ neglected, partnerShare, daysSinceSparring, sparringStale }),
  };
}

function buildAdvice({
  neglected,
  partnerShare,
  daysSinceSparring,
  sparringStale,
}: {
  neglected: TechniqueFamily[];
  partnerShare: number;
  daysSinceSparring?: number;
  sparringStale: boolean;
}): string {
  if (neglected.length > 0) {
    const names = neglected.map((f) => FAMILY_LABELS[f].toLowerCase()).join(" et ");
    return `Presque rien sur ${names} sur la période. C'est ce qui tient debout sous pression — en ajouter à chaque séance, même cinq minutes, avant de chercher de nouvelles frappes.`;
  }
  if (partnerShare < PARTNER_MIN_SHARE) {
    return `Trop de travail en solo (${Math.round(partnerShare * 100)} % des séances avec partenaire). Le sac et le shadow entretiennent, ils ne corrigent pas : sans retour, une erreur se grave au lieu de disparaître.`;
  }
  if (sparringStale) {
    return daysSinceSparring === undefined
      ? "Aucun sparring enregistré. C'est le seul test qui dit si la technique tient quand quelqu'un répond."
      : `Dernier sparring il y a ${daysSinceSparring} jours. Au-delà de ${SPARRING_STALE_DAYS}, le niveau ressenti dérive du niveau réel.`;
  }
  return "Répartition saine : les fondations sont travaillées, le partenaire est présent et le sparring est récent.";
}
