import { db } from "./db";
import { SEED_EXERCISES } from "./seedExercises";
import type { CombatCategory, GlowUpEntry } from "./types";

interface SeedSkill {
  name: string;
  category: CombatCategory;
  description: string;
  checkpoints: string[];
}

export const SEED_SKILLS: SeedSkill[] = [
  {
    name: "Clinch",
    category: "clinch",
    description:
      "Contrôle en corps à corps : position de tête, cassage de posture, genoux et sorties. Le clinch est le domaine où la condition physique et la technique se rejoignent le plus vite.",
    checkpoints: [
      "Tenir la double nuque 30 s sur un partenaire de même gabarit",
      "Sortir d'un clinch subi sans reculer en ligne droite",
      "Enchaîner clinch → genou → dégagement latéral proprement",
      "Casser la posture adverse et déséquilibrer sur 3 appuis",
      "Imposer le clinch offensivement pendant un round entier",
      "Gérer un partenaire plus lourd sans céder le contrôle de tête",
    ],
  },
  {
    name: "Low kicks en combinaison",
    category: "low-kicks",
    description:
      "Le low kick n'existe pas seul : il se cache derrière les mains. Objectif — sortir la jambe sans télégraphier et revenir en garde.",
    checkpoints: [
      "Low kick puissant sur sac, hanche engagée, tibia (pas le pied)",
      "Jab → cross → low kick fluide sans temps mort",
      "Low kick jambe avant en changement de rythme",
      "Enchaîner après le low : retour en garde immédiat",
      "Low kick sur jambe arrière après esquive latérale",
      "Placer 3 low kicks dans un round de sparring sans être contré",
    ],
  },
  {
    name: "Garde & défense",
    category: "garde-defense",
    description:
      "Encaisser, bloquer, esquiver, rester lucide sous pression. C'est l'axe Ippo par excellence : le premier travail est de ne pas être touché proprement.",
    checkpoints: [
      "Garde haute maintenue en fin de round malgré la fatigue",
      "Check systématique des low kicks du côté fort",
      "Slip du jab sans reculer, retour immédiat",
      "Bloc-parade des combinaisons à 3 coups",
      "Sortir d'axe après avoir bloqué (pas rester en face)",
      "Rester lucide et structuré après avoir encaissé un coup lourd",
    ],
  },
  {
    name: "Cardio rounds",
    category: "cardio-rounds",
    description:
      "Tenir 5 rounds à intensité constante — pas 2 rounds forts puis survivre. La référence : même volume de frappe au round 5 qu'au round 1.",
    checkpoints: [
      "3 rounds de 3 min sur sac à intensité constante",
      "5 rounds de 3 min sur sac sans chute de rythme",
      "3 rounds de sparring sans baisse de garde en fin de round",
      "5 rounds de sparring à intensité constante",
      "Récupération à 60 s entre les rounds sans dette d'oxygène",
      "5 rounds + finish : dernier round le plus intense",
    ],
  },
];

const GLOW_UP: Omit<GlowUpEntry, "id">[] = [
  {
    category: "peau",
    order: 1,
    title: "Routine matin",
    content: `1. Nettoyant doux (gel sans savon), eau tiède — jamais brûlante.
2. Hydratant léger non comédogène.
3. SPF 30-50 tous les jours, même en hiver, même à l'intérieur près d'une fenêtre.

Le SPF est la seule étape non négociable : c'est 80 % du vieillissement cutané évitable.`,
  },
  {
    category: "peau",
    order: 2,
    title: "Routine soir",
    content: `1. Nettoyant (double nettoyage si sueur de séance ou SPF épais).
2. Actif ciblé — un seul à la fois :
   • Acné / grain irrégulier → adapalène ou acide salicylique, 2-3×/semaine au début.
   • Texture / rides précoces → rétinol faible dosage, 2×/semaine puis augmenter.
3. Hydratant.

Règle : introduire un actif à la fois, laisser 4 semaines avant de juger.`,
  },
  {
    category: "peau",
    order: 3,
    title: "Peau & sport de combat",
    content: `• Douche dans l'heure après entraînement — la sueur qui sèche sur la peau favorise l'acné du dos et des épaules.
• Nettoyer les gants et protections : la majorité des infections cutanées en muay thai viennent de l'équipement, pas des partenaires.
• Une coupure ou éraflure se couvre avant le tapis, sans exception.
• Vaseline fine sur les zones d'impact (arcades, pommettes) avant le sparring.`,
  },
  {
    category: "peau",
    order: 4,
    title: "Fondamentaux hors routine",
    content: `• Sommeil 7-9 h : le facteur le plus sous-estimé sur la peau ET la récupération.
• Hydratation régulière dans la journée, pas 2 L d'un coup le soir.
• Taies d'oreiller changées 2×/semaine.
• Ne pas toucher / gratter — l'inflammation post-lésion dure des mois.
• Le déficit ou surplus calorique extrême se lit sur le visage : la recomposition lente protège aussi la peau.`,
  },
  {
    category: "coiffure",
    order: 1,
    title: "Référence Toji — la coupe",
    content: `Structure : mi-long, longueur nuque, masse conservée sur le dessus, pas de dégradé net sur les côtés. Ce n'est PAS un undercut.

À demander au coiffeur :
• Longueur qui atteint le col, dessus conservé, effilage léger pour éviter l'effet casque.
• Pas de dégradé américain / fade sur les côtés — la coupe doit pouvoir être attachée entièrement.
• Frange avant laissée longue, encadrant le visage.

Phase de transition (2-5 mois) : c'est le moment difficile, les côtés dépassent avant que la longueur suive. Faire couper uniquement les pointes toutes les 8-10 semaines, ne jamais raccourcir les côtés.`,
  },
  {
    category: "coiffure",
    order: 2,
    title: "Porté attaché / porté lâché",
    content: `ATTACHÉ (entraînement, quotidien) :
• Demi-queue ou petit chignon bas. Élastique en tissu, jamais d'élastique fin qui casse la fibre.
• Ne pas serrer à la racine de façon répétée toujours au même endroit → alopécie de traction à long terme.

LÂCHÉ (sortie) :
• Séchage à l'air ou sèche-cheveux tiède tête en bas pour le volume racine.
• Une noisette de crème coiffante légère ou huile sèche sur les longueurs seulement.
• Éviter les cires lourdes : effet gras, tue le mouvement.`,
  },
  {
    category: "coiffure",
    order: 3,
    title: "Entretien de la fibre",
    content: `• Lavage 2-3×/semaine max, shampoing sans sulfates agressifs.
• Après-shampoing sur les longueurs à chaque lavage.
• Masque hydratant 1×/semaine sur la longueur mi-long.
• Rinçage à l'eau tiède/froide en fin de douche.
• Sport : rincer à l'eau claire après une séance qui fait transpirer, sans shampooing systématique.`,
  },
  {
    category: "mobilite",
    order: 1,
    title: "Pourquoi la mobilité, pas juste le stretching",
    content: `Souplesse = amplitude passive (jusqu'où le corps va quand on le pousse).
Mobilité = amplitude CONTRÔLÉE ACTIVEMENT (jusqu'où on va par sa propre force).

Un high kick, une esquive, une garde basse tenue : tout ça demande de la mobilité, pas de la souplesse passive. C'est pour ça que l'étirement statique seul n'a jamais suffi.

Le programme ci-dessous travaille les deux : amplitude passive pour ouvrir, puis force dans la nouvelle amplitude pour la rendre utilisable.`,
  },
  {
    category: "mobilite",
    order: 2,
    title: "Protocole quotidien — 10 min",
    content: `Tous les jours, y compris jour de repos. C'est la fréquence qui produit le résultat, pas la durée.

1. Suspension passive à la barre — 2×30 s
2. Cat-cow + segmentation thoracique — 10 répétitions
3. 90/90 hanches, passage lent — 8 par côté
4. Fente basse + rotation — 6 par côté
5. Rotations d'épaules avec bande — 10
6. CARs cou — 5 par sens

Objectif : ouvrir les 3 verrous principaux — thoracique, hanches, épaules.`,
  },
  {
    category: "mobilite",
    order: 3,
    title: "Bloc long — 25 min, 3×/semaine",
    content: `À placer après une séance (corps chaud) ou le jour de repos actif.

BLOC HANCHES (pour les kicks) :
• Cossack squat — 3×8 par côté
• 90/90 avec pause active 10 s en position haute — 3×5
• Progression grand écart facial — 3×90-120 s, noter la hauteur atteinte
• Étirement psoas — 3×45 s par côté

BLOC ÉPAULES / THORACIQUE (pour la garde et la posture) :
• Thread the needle — 2×10 par côté
• Rotations bande, prise resserrée progressivement — 3×10
• Suspension passive — 3×45 s

BLOC ISCHIOS :
• Étirement actif PNF avec bande — 3×5 par jambe (contraction 5 s / relâchement 5 s)

Règle PNF : contracter contre la résistance 5 s, relâcher, gagner 2-3 cm, tenir. Répéter 3-5 fois.`,
  },
  {
    category: "mobilite",
    order: 4,
    title: "Repères de progression",
    content: `Mesurer tous les mois, sinon on ne voit pas le progrès et on abandonne :

• Grand écart facial : distance sol-bassin (cm).
• High kick : hauteur atteinte sans compensation du buste (repère mural).
• Épaules : largeur de prise minimale sur le bâton pour passer derrière (cm).
• Squat profond : talons au sol, tenue 60 s, oui/non.
• Toucher les orteils jambes tendues : distance doigts-sol (cm).

Progrès réaliste en partant de très raide : 6-12 semaines pour un gain net, 12-24 mois pour un grand écart. La régularité bat l'intensité.`,
  },
  {
    category: "posture",
    order: 1,
    title: "Le diagnostic",
    content: `Les trois défauts classiques chez quelqu'un qui tire et pousse beaucoup :

1. Épaules enroulées vers l'avant (pectoraux courts, dorsaux/rhomboïdes faibles).
2. Tête projetée en avant (écrans) — accentue l'enroulement d'épaules.
3. Bascule antérieure du bassin (psoas courts, abdos et fessiers sous-actifs).

Test simple : dos au mur, talons/fessiers/omoplates/tête doivent toucher sans forcer. Écart lombaire = une main à plat max.`,
  },
  {
    category: "posture",
    order: 2,
    title: "Correctifs",
    content: `CONTRE LES ÉPAULES ENROULÉES :
• Face pull — 4×15-20, 3×/semaine (le plus rentable).
• Étirement pectoraux dans l'encadrement de porte — 3×45 s.
• Ratio tirage/poussée à 2:1 minimum. Volume de dos > volume de pecs.

CONTRE LA TÊTE EN AVANT :
• Chin tuck — 3×10, menton reculé, nuque allongée.
• Écran à hauteur d'yeux.

CONTRE LA BASCULE DE BASSIN :
• Étirement psoas — 3×45 s par côté.
• Hollow body hold + hip thrust — la force antérieure et postérieure qui verrouille le bassin.

En muay thai, la posture est aussi de la performance : garde haute tenable, rotation de hanche libre, encaissement structuré.`,
  },
  {
    category: "style",
    order: 1,
    title: "Le principe : la coupe avant la marque",
    content: `Un vêtement bon marché bien ajusté bat un vêtement cher mal coupé. À 1m69 avec une carrure en V qui se construit, la coupe fait tout.

Repères d'ajustement :
• Épaule : la couture tombe exactement sur l'os de l'épaule, jamais au-delà.
• T-shirt : manche à mi-biceps, ourlet à mi-braguette (pas plus bas — ça écrase la silhouette).
• Pantalon : pas de cassure ou une seule, ourlet qui effleure la chaussure.
• Veste : longueur qui couvre les fesses, pas plus.

Le retoucheur est l'investissement le plus rentable : 15-25 € pour transformer un vêtement.`,
  },
  {
    category: "style",
    order: 2,
    title: "Palette et silhouette",
    content: `PALETTE : neutres profonds — noir, anthracite, encre, kaki foncé, gris pierre, blanc cassé. Un accent maximum par tenue.

SILHOUETTE : haut ajusté / bas droit ou légèrement fuselé. La carrure travaillée doit être lisible — un haut oversize annule des mois de travail sur les épaules.

À FAVORISER : col rond ou col en V léger, encolure qui dégage le cou et les trapèzes ; manches courtes qui montrent l'avant-bras.

À ÉVITER : imprimés larges, logos criards, superpositions volumineuses, tout ce qui coupe la ligne verticale (ceintures contrastées, bicolore horizontal).`,
  },
  {
    category: "style",
    order: 3,
    title: "Détails qui comptent",
    content: `• Chaussures propres — le détail le plus regardé et le plus négligé.
• Ongles courts et nets (obligatoire au tapis de toute façon).
• Une montre sobre, un accessoire maximum.
• Barbe/rasage entretenu à intervalle fixe, pas quand ça se voit.
• Odeur : douche + déodorant > parfum. Un parfum sur un corps mal lavé sent le corps mal lavé.

Optique long terme : le style suit le physique. À 8-10 % de BF avec des épaules construites, la garde-robe se simplifie — un t-shirt noir bien coupé suffit.`,
  },
];

let pending: Promise<void> | undefined;

/** Dédupliqué : StrictMode déclenche l'effet deux fois et deux seeds concurrents
 *  liraient tous les deux "non seedé" avant que l'un écrive le drapeau. */
export function seedIfEmpty(): Promise<void> {
  pending ??= runSeed();
  return pending;
}

async function runSeed() {
  await db.transaction(
    "rw",
    db.exercises,
    db.combatSkills,
    db.combatCheckpoints,
    db.glowUp,
    db.settings,
    async () => {
      if (await db.settings.get("seeded")) return;

      await db.exercises.bulkAdd(SEED_EXERCISES);
      await db.glowUp.bulkAdd(GLOW_UP);

      for (const skill of SEED_SKILLS) {
        const skillId = await db.combatSkills.add({
          name: skill.name,
          category: skill.category,
          description: skill.description,
          levelCurrent: 0,
          levelMax: skill.checkpoints.length,
        });
        await db.combatCheckpoints.bulkAdd(
          skill.checkpoints.map((label) => ({ skillId, label, achieved: false })),
        );
      }

      await db.settings.put({ key: "seeded", value: new Date().toISOString() });
    },
  );
}
