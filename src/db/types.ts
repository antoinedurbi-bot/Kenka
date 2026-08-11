export type TrainingType = "musculation" | "combat" | "mobilite";

export type SplitDay =
  | "push"
  | "pull"
  | "legs"
  | "fullbody"
  | "muaythai"
  | "mobilite"
  | "repos";

export type MuscleZone =
  | "epaules"
  | "dos"
  | "trapezes"
  | "avant-bras"
  | "abdos"
  | "obliques"
  | "cou"
  | "jambes"
  | "pecs"
  | "bras"
  | "fessiers"
  | "mollets";

export type Priority = "primaire" | "secondaire";

/**
 * Leviers de progression. Avec des haltères plafonnés à 10 kg, la charge cesse
 * très vite d'être utilisable : chaque exercice porte donc les leviers qui
 * restent disponibles une fois ce plafond atteint.
 */
export type ProgressionMethod =
  | "charge"
  | "reps"
  | "tempo"
  | "unilateral"
  | "amplitude"
  | "levier"
  | "bande"
  | "lest"
  | "densite";

export interface Exercise {
  id?: number;
  name: string;
  type: TrainingType;
  zones: MuscleZone[];
  priority: Priority;
  equipment: string[];
  splitDays: SplitDay[];
  instructions?: string;
  isCustom?: boolean;
  /** Séries × répétitions de référence, utilisés pour pré-remplir une séance. */
  defaultSets?: number;
  defaultReps?: string;
  progression?: ProgressionMethod[];
  /** Exercice au poids du corps : le champ charge sert alors au lest. */
  bodyweight?: boolean;
}

export interface WorkoutSetLog {
  id?: number;
  workoutLogId: number;
  exerciseId: number;
  setIndex: number;
  weightKg?: number;
  reps?: number;
  rpe?: number;
  /** Dupliqué depuis la séance parente : permet de retrouver la dernière
   *  performance d'un exercice en une seule requête indexée. */
  date: string;
}

export interface WorkoutLog {
  id?: number;
  date: string; // ISO date
  type: TrainingType;
  splitDay: SplitDay;
  completed: boolean;
  feeling?: 1 | 2 | 3 | 4 | 5;
  durationMin?: number;
  notes?: string;
}

export interface BodyMeasurement {
  id?: number;
  date: string;
  weightKg?: number;
  bfPercent?: number;
  shouldersCm?: number;
  chestCm?: number;
  waistCm?: number;
  armsCm?: number;
  thighsCm?: number;
  neckCm?: number;
  notes?: string;
}

export interface NutritionCheckIn {
  id?: number;
  weekStart: string; // ISO date, monday
  avgWeightKg?: number;
  maintenanceKcal?: number;
  targetKcal?: number;
  targetProteinG?: number;
  targetCarbsG?: number;
  targetFatG?: number;
  notes?: string;
}

/** Apport quotidien — existe uniquement pour rendre la calibration du maintien
 *  réalisable dans l'app, pas pour imposer un log alimentaire permanent. */
export interface DailyIntake {
  id?: number;
  date: string;
  kcal: number;
  proteinG?: number;
  notes?: string;
}

export interface DailyWeight {
  id?: number;
  date: string;
  weightKg: number;
}

export type MobilityMetric =
  | "grand-ecart-facial"
  | "high-kick"
  | "epaules-baton"
  | "toucher-orteils"
  | "squat-profond";

export interface MobilityLog {
  id?: number;
  date: string;
  metric: MobilityMetric;
  /** Interprétation dépendante de la métrique (cm au sol, cm de prise, etc.). */
  value: number;
  notes?: string;
}

export type CombatCategory = "clinch" | "low-kicks" | "garde-defense" | "cardio-rounds";

export interface CombatSkill {
  id?: number;
  name: string;
  category: CombatCategory;
  levelCurrent: number; // 0-5
  levelMax: number;
  description?: string;
}

export interface CombatCheckpoint {
  id?: number;
  skillId: number;
  label: string;
  achieved: boolean;
  dateAchieved?: string;
}

export interface CombatAssessment {
  id?: number;
  skillId: number;
  date: string;
  level: number;
  notes?: string;
}

export type CombatSessionKind = "club" | "shadow" | "sac" | "sparring" | "physique";

export interface CombatSessionLog {
  id?: number;
  date: string;
  kind: CombatSessionKind;
  durationMin?: number;
  rounds?: number;
  techniques: string[];
  intensity?: 1 | 2 | 3 | 4 | 5;
  notes?: string;
}

export type PhotoAngle = "face" | "profil" | "dos";

export interface ProgressPhoto {
  id?: number;
  date: string;
  angle: PhotoAngle;
  blob: Blob;
  notes?: string;
}

export type GlowUpCategory = "peau" | "coiffure" | "mobilite" | "posture" | "style";

/**
 * Image de référence déposée par l'utilisateur — coupe de cheveux visée, tenue,
 * posture à corriger. Jamais fournie par l'app : uniquement ce que l'utilisateur
 * importe lui-même, stocké en local comme les photos de progression.
 */
export interface ReferenceImage {
  id?: number;
  category: GlowUpCategory;
  caption?: string;
  blob: Blob;
  order?: number;
}

export interface GlowUpEntry {
  id?: number;
  category: GlowUpCategory;
  title: string;
  content: string;
  order?: number;
}

export interface AppSetting {
  key: string;
  value: unknown;
}

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id?: number;
  role: ChatRole;
  content: string;
  createdAt: string;
}

export interface DraftSet {
  reps: string;
  weightKg: string;
  /** Série validée pendant la séance — déclenche le minuteur de repos. */
  done: boolean;
}

export interface DraftExercise {
  exerciseId: number;
  sets: DraftSet[];
}

/**
 * Séance en cours, persistée à chaque frappe. Safari tue régulièrement un onglet
 * en arrière-plan : sans cette copie sur disque, poser le téléphone entre deux
 * séries suffirait à perdre la séance entière.
 */
export interface SessionDraft {
  id: "current";
  startedAt: number;
  date: string;
  splitDay: SplitDay;
  exercises: DraftExercise[];
  feeling?: 1 | 2 | 3 | 4 | 5;
  notes?: string;
  /** Modèle issu d'une séance réelle plutôt que de la liste par défaut. */
  fromHistory: boolean;
}
