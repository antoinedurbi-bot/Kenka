import type { TechniqueFamily } from "./combatReport";

/**
 * Contenu écrit à la main du flux « Découvrir ».
 *
 * Règle de sélection, volontairement stricte : une entrée n'entre ici que si
 * elle change une décision d'entraînement. « Bois de l'eau » ou « la
 * régularité paie » ne passent pas — ce sont des phrases qui se lisent une
 * fois et ne modifient rien. Ce qui passe : un seuil chiffré, un protocole,
 * un arbitrage entre deux options qu'on croyait équivalentes.
 *
 * C'est la seule partie du flux qui ne sort pas des données de l'utilisateur,
 * donc la seule qui puisse dériver vers le remplissage. D'où la liste courte
 * et la règle explicite.
 */
export interface Principle {
  id: string;
  title: string;
  body: string;
  /** Ce qu'on fait différemment après l'avoir lu. */
  apply: string;
  tag: "muscu" | "combat" | "nutrition" | "recuperation" | "mobilite";
}

export const PRINCIPLES: Principle[] = [
  {
    id: "p-echec",
    title: "Les dernières répétitions font le travail",
    body: "Une série arrêtée 5 répétitions avant l'échec ne stimule presque rien. Ce sont les répétitions difficiles, celles où la barre ralentit, qui déclenchent l'adaptation — les précédentes ne sont que le péage à payer pour y arriver.",
    apply: "Viser 1 à 3 répétitions en réserve sur les séries de travail. Si tu pourrais en faire 6 de plus, la série ne compte pas.",
    tag: "muscu",
  },
  {
    id: "p-frequence",
    title: "Deux fois par semaine bat une fois",
    body: "La synthèse protéique déclenchée par une séance retombe en 36 à 48 h. Douze séries d'épaules le lundi produisent une seule montée puis cinq jours de rien ; six séries lundi et six jeudi en produisent deux, pour le même volume total.",
    apply: "Répartir chaque zone prioritaire sur deux jours plutôt que de tout empiler sur un seul.",
    tag: "muscu",
  },
  {
    id: "p-tension",
    title: "La brûlure n'est pas le signal",
    body: "La sensation de brûlure vient de l'accumulation de métabolites, pas de la tension mécanique. On peut brûler énormément avec une charge dérisoire et construire très peu. C'est la tension sur le muscle allongé qui fait grossir.",
    apply: "Juger une série à la difficulté des dernières répétitions, pas à la brûlure ressentie.",
    tag: "muscu",
  },
  {
    id: "p-amplitude",
    title: "L'amplitude basse vaut double",
    body: "La partie allongée du mouvement — le bas d'un curl, la descente d'un développé, l'étirement d'un écarté — produit plus de croissance que la contraction haute. Couper le bas d'un mouvement, c'est supprimer sa partie la plus utile.",
    apply: "Descendre complètement, quitte à baisser la charge. Sur les mouvements au poids du corps, chercher à augmenter l'amplitude avant les répétitions.",
    tag: "muscu",
  },
  {
    id: "p-un-levier",
    title: "Un seul levier à la fois",
    body: "Monter la charge, ajouter des répétitions, ralentir le tempo et réduire le repos en même temps rend le progrès illisible : quand ça bloque, impossible de savoir ce qui a saturé.",
    apply: "Fixer un levier pour un bloc de 3 à 4 semaines. Les autres restent constants.",
    tag: "muscu",
  },
  {
    id: "p-courbatures",
    title: "Les courbatures ne mesurent rien",
    body: "Elles dépendent surtout de la nouveauté du mouvement et de la part excentrique. Un exercice fait depuis six mois cesse de donner des courbatures alors qu'il continue de construire — et un mouvement inhabituel peut détruire pendant trois jours sans rien apporter.",
    apply: "Ne jamais choisir un exercice parce qu'il fait mal le lendemain. Juger sur les charges et les répétitions loggées.",
    tag: "recuperation",
  },
  {
    id: "p-deload",
    title: "La fatigue s'accumule sous le seuil de la douleur",
    body: "Avant qu'une blessure ne se déclare, la performance stagne, le sommeil se dégrade et la motivation tombe. Ces trois signaux arrivent des semaines avant le problème — et disparaissent après une semaine allégée.",
    apply: "Après 6 à 8 semaines de progression, une semaine à la moitié du volume, charges inchangées. On ne perd rien, on repart plus haut.",
    tag: "recuperation",
  },
  {
    id: "p-sommeil",
    title: "Le sommeil est un levier d'entraînement",
    body: "En dessous de six heures, la force chute, la récupération ralentit et la faim augmente. Aucun ajustement de programme ne compense une dette de sommeil chronique — mais l'inverse est vrai aussi : dormir correctement fait progresser un programme médiocre.",
    apply: "Si les charges stagnent, regarder le sommeil des deux dernières semaines avant de changer le programme.",
    tag: "recuperation",
  },
  {
    id: "p-proteines",
    title: "1,6 à 2,2 g/kg, et le reste est du détail",
    body: "Au-delà de 2,2 g par kilo de poids de corps, aucun bénéfice mesuré. En dessous de 1,6, la construction musculaire est limitée quoi qu'on fasse à l'entraînement. Le timing, la répartition et le type de source pèsent infiniment moins que ce total.",
    apply: "Fixer le total quotidien en protéines et ignorer les débats sur la fenêtre anabolique.",
    tag: "nutrition",
  },
  {
    id: "p-surplus",
    title: "Un surplus trop grand ne construit pas plus vite",
    body: "La vitesse de construction musculaire a un plafond biologique. Passé 300 à 500 kcal au-dessus du maintien, le supplément part en gras, pas en muscle — et il faudra ensuite le perdre, ce qui coûte du muscle.",
    apply: "Viser +0,25 à +0,4 kg par semaine. Au-delà, réduire l'apport de 200 kcal.",
    tag: "nutrition",
  },
  {
    id: "p-balance",
    title: "La balance ment sur trois jours, pas sur trois semaines",
    body: "Le poids d'un matin varie de 1 à 2 kg selon l'hydratation, le sel et le contenu digestif. Réagir à une pesée isolée, c'est ajuster son alimentation sur du bruit.",
    apply: "Ne juger que la moyenne lissée sur 2 à 3 semaines. Une pesée seule ne déclenche jamais un changement.",
    tag: "nutrition",
  },
  {
    id: "p-sparring-leger",
    title: "Le sparring dur apprend moins que le sparring léger",
    body: "À haute intensité, on retombe sur ses deux ou trois réflexes acquis et on protège son visage. À 40-50 %, on peut tenter une technique nouvelle, la rater, et recommencer — c'est là que le répertoire s'élargit.",
    apply: "Choisir une intention par round léger (« ce round, je ne frappe qu'après avoir bougé ») plutôt que de chercher à gagner l'échange.",
    tag: "combat",
  },
  {
    id: "p-garde-fatigue",
    title: "La garde tombe avec le cardio, pas avec la technique",
    body: "Les mains descendent en fin de round parce que les épaules brûlent, pas parce qu'on a oublié la consigne. Répéter « garde haute » à froid ne corrige rien.",
    apply: "Travailler la garde en fin de séance, fatigué — c'est le seul moment où le défaut apparaît vraiment.",
    tag: "combat",
  },
  {
    id: "p-shadow",
    title: "Le shadow sans intention ne construit rien",
    body: "Enchaîner des combinaisons dans le vide en pensant à autre chose grave les mêmes automatismes qu'on a déjà. Le shadow utile suppose un adversaire imaginaire précis : sa garde, sa distance, ce qu'il renvoie.",
    apply: "Un round de shadow = une situation (« il avance en pression », « il est plus grand »). Pas de round sans scénario.",
    tag: "combat",
  },
  {
    id: "p-defense-couteuse",
    title: "On travaille ce qui est gratifiant, pas ce qui manque",
    body: "Frapper le sac procure un retour immédiat ; esquiver et se replacer n'en procurent aucun. C'est pour ça que la défense et les déplacements sont systématiquement les familles les moins travaillées — pas parce qu'on les juge inutiles.",
    apply: "Programmer défense et déplacements en début de séance, quand la volonté est encore disponible.",
    tag: "combat",
  },
  {
    id: "p-mobilite-actif",
    title: "L'étirement passif ne gagne pas d'amplitude durable",
    body: "Tenir une position 30 secondes augmente la tolérance à l'étirement sur l'instant, puis se dissipe. Le gain qui reste vient du travail en fin d'amplitude sous contraction — contracter le muscle étiré à sa longueur maximale.",
    apply: "En fin d'amplitude, pousser contre le sol ou le mur pendant 10 à 15 secondes, relâcher, gagner un centimètre, recommencer.",
    tag: "mobilite",
  },
  {
    id: "p-cou",
    title: "Le cou se travaille lentement ou pas du tout",
    body: "C'est la zone où le rapport bénéfice/risque bascule le plus vite. Un cou solide encaisse mieux les chocs et change la silhouette, mais toute secousse ou charge excessive touche des structures qui ne pardonnent pas.",
    apply: "Amplitude contrôlée, tempo lent, jamais d'à-coups, charges dérisoires comparées au reste. Arrêter au moindre signal.",
    tag: "muscu",
  },
  {
    id: "p-echauffement",
    title: "L'échauffement utile ressemble à l'exercice",
    body: "Cinq minutes de vélo ne préparent pas une épaule à un développé. Ce qui prépare, ce sont deux séries légères du mouvement lui-même, qui montent la température locale et recalibrent la coordination.",
    apply: "Sur le premier exercice de chaque zone : une série à vide, une série à 50 %, puis la série de travail.",
    tag: "muscu",
  },
  {
    id: "p-delto-lateral",
    title: "La largeur vient du deltoïde latéral",
    body: "L'impression de carrure ne vient ni des pectoraux ni des bras, mais de la partie latérale de l'épaule — celle qui élargit la silhouette vue de face. C'est aussi une des rares zones qui tolère un volume élevé.",
    apply: "Faire des élévations latérales le mouvement le plus fréquent de la semaine, léger, en séries longues.",
    tag: "muscu",
  },
  {
    id: "p-cardio-espace",
    title: "Cardio et muscu ne s'annulent que s'ils se touchent",
    body: "L'interférence entre endurance et force est réelle mais dépend surtout de la proximité : une séance de course juste après les jambes coûte cher, la même six heures plus tard presque rien.",
    apply: "Espacer d'au moins six heures, ou placer le cardio les jours où la zone concernée ne travaille pas.",
    tag: "recuperation",
  },
];

/**
 * Exercices de fond par famille technique. Servent quand l'analyse Combat
 * détecte une famille délaissée : dire « tu négliges la défense » sans dire
 * quoi faire à la place ne fait pas avancer.
 */
export interface Drill {
  id: string;
  family: TechniqueFamily;
  title: string;
  body: string;
}

export const DRILLS: Drill[] = [
  {
    id: "d-def-1",
    family: "defense",
    title: "Slip line",
    body: "Une corde ou un élastique tendu à hauteur d'épaules. Trois minutes à passer dessous d'un côté puis de l'autre, en gardant la garde et sans plier la taille. C'est l'esquive rotative isolée de tout le reste.",
  },
  {
    id: "d-def-2",
    family: "defense",
    title: "Rounds défensifs purs",
    body: "Deux rounds où tu n'as pas le droit de frapper : uniquement esquiver, bloquer, checker. Frustrant, et c'est exactement pour ça que ça marche — on ne peut plus se cacher derrière l'attaque.",
  },
  {
    id: "d-def-3",
    family: "defense",
    title: "Check systématique",
    body: "Au sac ou en shadow : à chaque fois que tu termines une combinaison, tu enchaînes un check de jambe avant de repartir. L'objectif est que le retour de low kick devienne le réflexe par défaut après une frappe.",
  },
  {
    id: "d-dep-1",
    family: "deplacement",
    title: "Frapper puis sortir",
    body: "Règle unique pendant un round : aucune combinaison ne se termine sur place. Deux frappes maximum, puis un angle — pas un recul en ligne droite, un pas de côté.",
  },
  {
    id: "d-dep-2",
    family: "deplacement",
    title: "Gestion de la distance au teep",
    body: "Le partenaire ou le sac avance ; tu maintiens la distance uniquement avec le teep et les appuis, sans jamais reculer en courant. Trois minutes suffisent à rendre la jambe avant utile.",
  },
  {
    id: "d-dep-3",
    family: "deplacement",
    title: "Pivots sur l'extérieur",
    body: "Après chaque frappe du bras avant, un pivot pour te retrouver à l'extérieur de sa jambe avant. C'est la position qui annule la moitié de son arsenal.",
  },
  {
    id: "d-clinch-1",
    family: "clinch",
    title: "Bataille de position",
    body: "Trois minutes de clinch sans frapper : uniquement chercher la double nuque et la casser quand l'autre l'obtient. Le placement des coudes décide tout.",
  },
  {
    id: "d-clinch-2",
    family: "clinch",
    title: "Genou après entrée",
    body: "Depuis la garde, entrer au clinch, contrôler, un genou, sortir en angle. L'enchaînement complet, lentement, plutôt que des genoux dans le vide.",
  },
  {
    id: "d-jambes-1",
    family: "jambes",
    title: "Low kick sur retour",
    body: "Le low kick placé juste après sa combinaison, quand son poids revient sur la jambe avant. Timing plutôt que puissance.",
  },
  {
    id: "d-poings-1",
    family: "poings",
    title: "Jab en trois versions",
    body: "Un round entier avec un seul coup : jab de contrôle, jab en avançant, jab en sortant. Un même coup, trois fonctions — c'est ce qui sépare un jab d'un geste.",
  },
];

/** Défis d'une semaine — concrets, vérifiables, sans matériel supplémentaire. */
export interface Challenge {
  id: string;
  title: string;
  body: string;
}

export const CHALLENGES: Challenge[] = [
  {
    id: "c-tempo",
    title: "Semaine tempo",
    body: "Sur chaque exercice, trois secondes de descente contrôlée. Les charges vont baisser — c'est normal, et c'est le seul indicateur que tu le fais vraiment.",
  },
  {
    id: "c-suspension",
    title: "Suspension quotidienne",
    body: "Une suspension à la barre, maximum, chaque jour de la semaine. Note la durée. L'avant-bras et la ceinture scapulaire progressent vite sur ce format.",
  },
  {
    id: "c-lateral",
    title: "Élévations tous les jours",
    body: "Trois séries d'élévations latérales légères par jour, en dehors des séances. Peu de fatigue générée, beaucoup de fréquence — le deltoïde latéral tolère ça mieux que n'importe quel muscle.",
  },
  {
    id: "c-shadow-scenario",
    title: "Un scénario par round",
    body: "Cette semaine, aucun round de shadow sans avoir décidé avant qui est en face : sa taille, sa garde, ce qu'il renvoie.",
  },
  {
    id: "c-defense-first",
    title: "Défense en premier",
    body: "Inverser l'ordre de tes séances combat : défense et déplacements au début, frappes à la fin. Tu verras à quel point tu les repoussais.",
  },
  {
    id: "c-photo",
    title: "Trois angles, même lumière",
    body: "Une série de photos face, profil, dos cette semaine, dans les mêmes conditions que la dernière fois. C'est la seule mesure qui ne se discute pas.",
  },
  {
    id: "c-proteines",
    title: "Compter les protéines seulement",
    body: "Sept jours à ne suivre qu'un chiffre : les protéines. Pas les calories, pas les macros. Le total protéique est la variable qui compte le plus, et la seule facile à tenir.",
  },
  {
    id: "c-amplitude",
    title: "Semaine amplitude",
    body: "Charges inchangées, mais amplitude complète et pause d'une seconde en position basse sur chaque répétition. Si la charge devient trop lourde, c'est que l'amplitude était incomplète avant.",
  },
];
