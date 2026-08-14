import type {
  CombatSessionLog,
  DailyWeight,
  Exercise,
  MobilityLog,
  ProgressPhoto,
  WorkoutSetLog,
} from "../db/types";
import { daysBetween, isoDay } from "./dates";
import { historyByExercise, isPlateaued, lastSessionOf } from "./exerciseHistory";
import { nextTarget, repRange } from "./records";
import { ZONE_LABELS } from "./volume";
import type { VolumeReport } from "./volume";
import { FAMILY_LABELS } from "./combatReport";
import type { CombatReport } from "./combatReport";
import { MOBILITY_METRICS } from "./mobility";
import { trendWeight } from "./nutrition";
import { CHALLENGES, DRILLS, PRINCIPLES } from "./feedContent";
import type { SectionId } from "./sections";

export type FeedKind =
  | "exercice"
  | "levier"
  | "drill"
  | "mobilite"
  | "constat"
  | "principe"
  | "defi";

/**
 * Une carte sans action est une carte qu'on lit et qu'on oublie. Le type force
 * donc à dire où mène la carte : soit une route de l'app, soit la fiche d'un
 * exercice précis (ouverte sur place, sans quitter le flux).
 */
export type FeedAction =
  | { type: "route"; label: string; to: string }
  | { type: "exercise"; label: string; exerciseId: number };

export interface FeedCard {
  id: string;
  kind: FeedKind;
  kanji: string;
  eyebrow: string;
  title: string;
  body: string;
  /** Le chiffre qui justifie la carte, quand il y en a un. */
  metric?: string;
  action?: FeedAction;
  /** Calculée depuis les données de l'utilisateur, par opposition au contenu écrit. */
  personal: boolean;
}

export interface FeedInput {
  exercises: Exercise[];
  sets: WorkoutSetLog[];
  combatLogs: CombatSessionLog[];
  mobilityLogs: MobilityLog[];
  photos: Pick<ProgressPhoto, "date">[];
  weights: DailyWeight[];
  volume: VolumeReport;
  combat: CombatReport;
  enabled: SectionId[];
  /** Cartes masquées : id → date de masquage. */
  seen: Record<string, string>;
  today?: string;
}

/** Une carte masquée revient après ce délai : un exercice écarté en janvier
 *  redevient une bonne idée en mars, mais pas la semaine suivante. */
export const SEEN_COOLDOWN_DAYS = 30;

/** Sans séries depuis ce délai, un exercice a quitté le programme sans décision. */
const STALE_EXERCISE_DAYS = 45;

/** Au-delà, une photo de progression ne se compare plus à grand-chose. */
const STALE_PHOTO_DAYS = 30;

const KANJI = {
  exercice: "技",
  levier: "力",
  drill: "闘",
  mobilite: "柔",
  constat: "観",
  principe: "理",
  defi: "挑",
} as const;

/**
 * Construit le flux « Découvrir ».
 *
 * Le principe de tri est le seul qui compte ici : ce qui vient des données de
 * l'utilisateur passe devant le contenu écrit, et les deux sont ensuite
 * entrelacés. Un flux qui commence par vingt cartes génériques se referme
 * avant d'arriver à la seule carte qui parlait de lui.
 */
export function buildFeed(input: FeedInput): FeedCard[] {
  const today = input.today ?? isoDay();
  const seed = seedOf(today);

  const visible = (cards: FeedCard[]) =>
    cards.filter((c) => {
      const hiddenOn = input.seen[c.id];
      if (!hiddenOn) return true;
      return daysBetween(hiddenOn, today) >= SEEN_COOLDOWN_DAYS;
    });

  /*
   * Plafond par type, tiré au sort chaque jour.
   *
   * Sans lui, une bibliothèque de soixante-dix exercices produisait
   * soixante-dix cartes « jamais testé » d'affilée : un flux qu'on abandonne
   * au dixième écran parce qu'il ne raconte plus qu'une seule chose. Le tirage
   * étant calé sur la date, ce sont d'autres exercices qui remontent demain —
   * rien n'est perdu, tout est étalé.
   *
   * Les constats échappent au plafond : ils sont peu nombreux par
   * construction, et ce sont eux qui justifient l'écran.
   */
  const cap = (cards: FeedCard[], n: number, salt: number) =>
    shuffle(visible(cards), seed ^ salt).slice(0, n);

  const personal = [
    ...cap(leverCards(input, today), 6, 0x11),
    ...cap(untriedExerciseCards(input, today), 8, 0x22),
    ...visible(constatCards(input, today)),
    ...cap(drillCards(input), 4, 0x33),
    ...cap(mobilityCards(input, today), 3, 0x44),
  ];
  const written = [
    ...cap(principleCards(input), 10, 0x55),
    ...cap(challengeCards(), 4, 0x66),
  ];

  return interleave(shuffle(personal, seed), shuffle(written, seed ^ 0x9e37));
}

/* ------------------------------------------------------------------ *
 * Cartes issues des données
 * ------------------------------------------------------------------ */

/**
 * Exercices qui stagnent, ou qui ont atteint le haut de leur fourchette : les
 * deux cas où la prochaine séance doit être différente de la précédente.
 * Un exercice qui progresse normalement n'a rien à faire dans le flux — il n'y
 * a rien à décider.
 */
function leverCards(input: FeedInput, today: string): FeedCard[] {
  if (!input.enabled.includes("physique")) return [];
  const hist = historyByExercise(input.sets);
  const out: FeedCard[] = [];

  for (const ex of input.exercises) {
    const h = ex.id !== undefined ? hist.get(ex.id) : undefined;
    if (!h || !h.lastDate || h.sessions.length < 2) continue;
    // Un exercice abandonné n'a pas de plateau à débloquer : il a un autre problème.
    if (daysBetween(h.lastDate, today) > STALE_EXERCISE_DAYS) continue;

    const stuck = isPlateaued(h);
    const [, high] = repRange(ex.defaultReps);
    const atCeiling = (h.topReps ?? 0) >= high;
    if (!stuck && !atCeiling) continue;

    const target = nextTarget(ex, lastSessionOf(h), stuck);

    out.push({
      id: `levier-${ex.id}`,
      kind: "levier",
      kanji: KANJI.levier,
      eyebrow: stuck ? "Débloquer" : "Prochain palier",
      title: `${ex.name} — ${target.headline}`,
      body: target.detail,
      metric: h.topReps
        ? `Dernière séance : ${h.sets.filter((s) => s.date === h.lastDate).length} × ${h.topReps}${h.topWeightKg ? ` à ${h.topWeightKg} kg` : ""}`
        : undefined,
      action: { type: "exercise", label: "Voir la fiche", exerciseId: ex.id! },
      personal: true,
    });
  }
  return out;
}

/**
 * Exercices jamais loggés, ou sortis du programme sans décision. C'est le
 * « à tester » du flux — et il sort de la bibliothèque réelle, pas d'une liste
 * générique qui proposerait du matériel qu'on n'a pas.
 */
function untriedExerciseCards(input: FeedInput, today: string): FeedCard[] {
  if (!input.enabled.includes("physique")) return [];
  const hist = historyByExercise(input.sets);
  const out: FeedCard[] = [];

  for (const ex of input.exercises) {
    if (ex.id === undefined || ex.type === "combat") continue;
    const h = hist.get(ex.id);
    const zones = ex.zones.map((z) => ZONE_LABELS[z]).join(" · ");

    if (!h) {
      out.push({
        id: `neuf-${ex.id}`,
        kind: "exercice",
        kanji: KANJI.exercice,
        eyebrow: "Jamais testé",
        title: ex.name,
        body:
          ex.instructions ??
          `Présent dans ta bibliothèque mais jamais chargé. ${ex.defaultSets ?? 3} × ${ex.defaultReps ?? "10-12"} pour établir une référence.`,
        metric: zones,
        action: { type: "exercise", label: "Voir la fiche", exerciseId: ex.id },
        personal: true,
      });
      continue;
    }

    const age = h.lastDate ? daysBetween(h.lastDate, today) : undefined;
    if (age !== undefined && age >= STALE_EXERCISE_DAYS) {
      out.push({
        id: `delaisse-${ex.id}`,
        kind: "exercice",
        kanji: KANJI.exercice,
        eyebrow: "Sorti du programme",
        title: ex.name,
        body: `Plus une seule série depuis ${age} jours. Soit il ne sert à rien et il faut l'assumer, soit c'est un trou dans le programme — ${zones.toLowerCase()} ne se travaillent pas tout seuls.`,
        metric: `Dernière série il y a ${age} j`,
        action: { type: "exercise", label: "Voir la fiche", exerciseId: ex.id },
        personal: true,
      });
    }
  }
  return out;
}

/** Constats bruts tirés de l'état réel : les seuls à ne rien proposer d'autre
 *  que de regarder la vérité en face. */
function constatCards(input: FeedInput, today: string): FeedCard[] {
  const out: FeedCard[] = [];
  const { volume, combat } = input;

  if (input.enabled.includes("physique") && volume.verdict === "a-corriger") {
    out.push({
      id: "constat-volume",
      kind: "constat",
      kanji: KANJI.constat,
      eyebrow: `Volume — ${volume.windowDays} derniers jours`,
      title:
        volume.neglected.length > 0
          ? `${volume.neglected.map((z) => ZONE_LABELS[z]).join(", ")} sous le seuil`
          : "Répartition déséquilibrée",
      body: volume.advice,
      metric: `${volume.totalSets} séries · prioritaires ${volume.prioritySets} / contre-cible ${volume.counterSets}`,
      action: { type: "route", label: "Ouvrir Volume", to: "/physique" },
      personal: true,
    });
  }

  if (input.enabled.includes("combat")) {
    if (combat.neglected.length > 0) {
      out.push({
        id: "constat-combat-familles",
        kind: "constat",
        kanji: KANJI.constat,
        eyebrow: `Combat — ${combat.windowDays} derniers jours`,
        title: `${combat.neglected.map((f) => FAMILY_LABELS[f]).join(" et ")} : quasi absentes`,
        body: combat.advice,
        metric: `${combat.sessions} séances loggées`,
        action: { type: "route", label: "Ouvrir Analyse", to: "/combat" },
        personal: true,
      });
    }
    if (combat.daysSinceSparring !== undefined && !combat.sparringFresh) {
      out.push({
        id: "constat-sparring",
        kind: "constat",
        kanji: KANJI.constat,
        eyebrow: "Contrôle de réalité",
        title: `Aucun sparring depuis ${combat.daysSinceSparring} jours`,
        body: "Le sac et le shadow ne corrigent rien : ils confirment ce qu'on croit déjà savoir. Sans opposition, une technique reste une hypothèse.",
        metric: `${combat.sparringSessions} sparring sur la fenêtre`,
        action: { type: "route", label: "Ouvrir Combat", to: "/combat" },
        personal: true,
      });
    }
  }

  if (input.enabled.includes("nutrition") && input.weights.length >= 7) {
    const trend = trendWeight(input.weights);
    const last = trend[trend.length - 1];
    const twoWeeksAgo = trend[Math.max(0, trend.length - 15)];
    const delta = last.value - twoWeeksAgo.value;
    out.push({
      id: "constat-poids",
      kind: "constat",
      kanji: KANJI.constat,
      eyebrow: "Poids lissé",
      title: `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} kg sur deux semaines`,
      body: "C'est la tendance lissée, pas la pesée du matin — la seule qui puisse justifier de changer l'apport. Une pesée isolée varie de 1 à 2 kg pour des raisons qui n'ont rien à voir avec la masse.",
      metric: `${last.value.toFixed(1)} kg lissé · ${input.weights.length} pesées`,
      action: { type: "route", label: "Ouvrir Nutrition", to: "/nutrition" },
      personal: true,
    });
  }

  if (input.enabled.includes("photos")) {
    const dates = input.photos.map((p) => p.date).sort();
    const last = dates[dates.length - 1];
    const age = last ? daysBetween(last, today) : undefined;
    if (age === undefined || age >= STALE_PHOTO_DAYS) {
      out.push({
        id: "constat-photos",
        kind: "constat",
        kanji: KANJI.constat,
        eyebrow: "Mesure la plus honnête",
        title: age === undefined ? "Aucune photo de progression" : `Dernière photo il y a ${age} jours`,
        body: "Les chiffres se discutent, une photo non. Même lumière, même heure, mêmes angles — c'est la comparaison qui compte, pas la photo isolée.",
        action: { type: "route", label: "Ouvrir Photos", to: "/photos" },
        personal: true,
      });
    }
  }

  return out;
}

/** Un drill par famille délaissée : dire « tu négliges la défense » sans dire
 *  quoi faire n'a jamais changé une séance. */
function drillCards(input: FeedInput): FeedCard[] {
  if (!input.enabled.includes("combat")) return [];
  const families = input.combat.neglected.length
    ? input.combat.neglected
    : input.combat.byFamily.filter((f) => f.sessions === 0).map((f) => f.family);

  return DRILLS.filter((d) => families.includes(d.family)).map((d) => ({
    id: d.id,
    kind: "drill" as const,
    kanji: KANJI.drill,
    eyebrow: `À travailler — ${FAMILY_LABELS[d.family]}`,
    title: d.title,
    body: d.body,
    action: { type: "route" as const, label: "Ouvrir Combat", to: "/combat" },
    personal: true,
  }));
}

/** Métriques de mobilité jamais mesurées : le protocole vaut plus que le
 *  rappel, parce que sans protocole deux relevés ne sont pas comparables. */
function mobilityCards(input: FeedInput, today: string): FeedCard[] {
  if (!input.enabled.includes("glow-up")) return [];
  const out: FeedCard[] = [];

  for (const def of MOBILITY_METRICS) {
    const logs = input.mobilityLogs
      .filter((l) => l.metric === def.metric)
      .sort((a, b) => a.date.localeCompare(b.date));
    const last = logs[logs.length - 1];
    const age = last ? daysBetween(last.date, today) : undefined;
    if (age !== undefined && age < 30) continue;

    out.push({
      id: `mobilite-${def.metric}`,
      kind: "mobilite",
      kanji: KANJI.mobilite,
      eyebrow: age === undefined ? "Jamais mesuré" : `Pas mesuré depuis ${age} j`,
      title: def.label,
      body: def.how,
      metric: last ? `Dernier relevé : ${last.value} ${def.unit}` : `Unité : ${def.unit}`,
      action: { type: "route", label: "Ouvrir Glow up", to: "/glow-up" },
      personal: true,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Cartes écrites
 * ------------------------------------------------------------------ */

const TAG_SECTION: Record<string, SectionId | undefined> = {
  muscu: "physique",
  combat: "combat",
  nutrition: "nutrition",
  mobilite: "glow-up",
  recuperation: undefined,
};

/** Un principe dont l'axe est masqué n'a rien à faire dans le flux : on ne
 *  conseille pas sur une section que l'utilisateur a explicitement retirée. */
function principleCards(input: FeedInput): FeedCard[] {
  return PRINCIPLES.filter((p) => {
    const section = TAG_SECTION[p.tag];
    return section === undefined || input.enabled.includes(section);
  }).map((p) => ({
    id: p.id,
    kind: "principe" as const,
    kanji: KANJI.principe,
    eyebrow: "Principe",
    title: p.title,
    body: p.body,
    metric: `À faire : ${p.apply}`,
    personal: false,
  }));
}

function challengeCards(): FeedCard[] {
  return CHALLENGES.map((c) => ({
    id: c.id,
    kind: "defi" as const,
    kanji: KANJI.defi,
    eyebrow: "Défi — une semaine",
    title: c.title,
    body: c.body,
    personal: false,
  }));
}

/* ------------------------------------------------------------------ *
 * Ordre
 * ------------------------------------------------------------------ */

/** Graine stable sur la journée : le flux se réordonne chaque jour, mais pas
 *  entre deux ouvertures — sinon on perdrait sa place à chaque retour. */
function seedOf(day: string): number {
  let h = 2166136261;
  for (let i = 0; i < day.length; i++) {
    h ^= day.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let state = seed || 1;
  const rand = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Deux cartes personnelles pour une carte écrite. Le ratio est délibéré :
 * le flux doit rester majoritairement un miroir de ses propres données, sinon
 * il devient un magazine.
 */
function interleave(personal: FeedCard[], written: FeedCard[]): FeedCard[] {
  const out: FeedCard[] = [];
  let p = 0;
  let w = 0;
  while (p < personal.length || w < written.length) {
    for (let i = 0; i < 2 && p < personal.length; i++) out.push(personal[p++]);
    if (w < written.length) out.push(written[w++]);
  }
  return out;
}
