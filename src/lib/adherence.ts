import type { SplitDay } from "../db/types";
import { LOGGABLE_SPLIT_DAYS, SPLIT_AXIS, WEEKDAYS } from "./split";
import type { Weekday } from "./split";
import { daysBetween, isoDay } from "./dates";

/**
 * Prévu contre réel.
 *
 * Le reste de l'app mesure la progression : charges, volume, niveaux, séries
 * records. Tout ça suppose qu'on s'entraîne. Aucun écran ne disait jusqu'ici
 * « tu as prévu quatre séances par semaine et tu en fais deux » — et c'est
 * pourtant l'explication la plus fréquente d'une progression qui n'arrive pas.
 *
 * Cet écran n'a donc pas vocation à encourager. Il compte, et il le dit.
 */
export interface AdherenceReport {
  windowWeeks: number;
  /** Séances de musculation prévues par le split sur la fenêtre. */
  plannedMuscu: number;
  doneMuscu: number;
  plannedCombat: number;
  doneCombat: number;
  plannedTotal: number;
  doneTotal: number;
  /** Part réalisée, bornée à 1 : au-delà, ce n'est plus de l'assiduité. */
  rate: number;
  /** Séances faites en plus du plan, comptées à part plutôt que noyées dans le taux. */
  extra: number;
  verdict: "insuffisant" | "decroche" | "irregulier" | "tenu";
  headline: string;
  detail: string;
}

/** Sous ce nombre de jours suivis, le taux ne mesure que la date d'installation. */
const MIN_DAYS = 14;

const DECROCHE = 0.5;
const TENU = 0.85;

/**
 * Compte les séances prévues par le split sur les N dernières semaines, en
 * s'arrêtant à aujourd'hui : compter la fin de la semaine en cours comme
 * « manquée » ferait chuter le taux tous les lundis pour rien.
 */
export function adherence(
  split: Record<Weekday, SplitDay>,
  muscuDates: string[],
  combatDates: string[],
  windowWeeks = 4,
  today = isoDay(),
): AdherenceReport {
  const days = windowWeeks * 7;
  const start = new Date(`${today}T00:00:00`);
  start.setDate(start.getDate() - (days - 1));

  let plannedMuscu = 0;
  let plannedCombat = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const planned = split[WEEKDAYS[(d.getDay() + 6) % 7]];
    // « Mobilité / repos actif » est prévu au split mais n'est pas une séance
    // dont l'absence se reproche : on ne le compte pas au dénominateur.
    if (LOGGABLE_SPLIT_DAYS.includes(planned) && planned !== "mobilite") plannedMuscu++;
    else if (SPLIT_AXIS[planned] === "ippo") plannedCombat++;
  }

  const inWindow = (d: string) => {
    const age = daysBetween(d, today);
    return age >= 0 && age < days;
  };
  const doneMuscu = muscuDates.filter(inWindow).length;
  const doneCombat = combatDates.filter(inWindow).length;

  const plannedTotal = plannedMuscu + plannedCombat;
  const doneTotal = doneMuscu + doneCombat;
  const rate = plannedTotal === 0 ? 0 : Math.min(1, doneTotal / plannedTotal);
  const extra = Math.max(0, doneTotal - plannedTotal);

  const trackedDays = muscuDates.concat(combatDates).length
    ? daysBetween(
        [...muscuDates, ...combatDates].sort()[0],
        today,
      )
    : 0;

  if (plannedTotal === 0 || trackedDays < MIN_DAYS) {
    return {
      windowWeeks,
      plannedMuscu,
      doneMuscu,
      plannedCombat,
      doneCombat,
      plannedTotal,
      doneTotal,
      rate,
      extra,
      verdict: "insuffisant",
      headline: "Pas encore assez de recul",
      detail: `Il faut au moins ${MIN_DAYS} jours de séances loggées avant que le taux d'assiduité veuille dire quelque chose.`,
    };
  }

  const missedMuscu = Math.max(0, plannedMuscu - doneMuscu);
  const missedCombat = Math.max(0, plannedCombat - doneCombat);
  const worst = missedMuscu >= missedCombat ? "musculation" : "combat";

  if (rate < DECROCHE) {
    return {
      windowWeeks,
      plannedMuscu,
      doneMuscu,
      plannedCombat,
      doneCombat,
      plannedTotal,
      doneTotal,
      rate,
      extra,
      verdict: "decroche",
      headline: `${doneTotal} séances sur ${plannedTotal} prévues`,
      detail: `Moins d'une séance sur deux. Aucun réglage de programme ne compense ça — soit le split est trop ambitieux et il faut le réduire pour qu'il soit tenable, soit c'est l'exécution qui décroche. Le trou est surtout en ${worst}.`,
    };
  }

  if (rate < TENU) {
    return {
      windowWeeks,
      plannedMuscu,
      doneMuscu,
      plannedCombat,
      doneCombat,
      plannedTotal,
      doneTotal,
      rate,
      extra,
      verdict: "irregulier",
      headline: `${doneTotal} séances sur ${plannedTotal} prévues`,
      detail: `${missedMuscu + missedCombat} séances manquées sur ${windowWeeks} semaines, surtout en ${worst}. C'est le niveau où la progression ralentit sans qu'on comprenne pourquoi.`,
    };
  }

  return {
    windowWeeks,
    plannedMuscu,
    doneMuscu,
    plannedCombat,
    doneCombat,
    plannedTotal,
    doneTotal,
    rate,
    extra,
    verdict: "tenu",
    headline: `${doneTotal} séances sur ${plannedTotal} prévues`,
    detail:
      extra > 0
        ? `Plan tenu, et ${extra} séance(s) au-delà. Si la progression stagne malgré ça, le problème est dans le programme, pas dans l'assiduité.`
        : "Plan tenu. Si la progression stagne malgré ça, le problème est dans le programme, pas dans l'assiduité.",
  };
}
