/**
 * Retour haptique sémantique.
 *
 * Pendant une séance, le téléphone est souvent posé, l'écran regardé une demi-
 * seconde entre deux séries. Une confirmation visuelle seule se rate ; une
 * vibration courte confirme sans qu'on ait à vérifier.
 *
 * `navigator.vibrate` est absent de Safari iOS : tous les appels sont donc
 * best-effort et ne doivent jamais être la seule confirmation d'une action.
 */

type Pattern = number | number[];

const buzz = (pattern: Pattern) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // API absente ou bloquée : le visuel reste la source de vérité.
  }
};

/** Validation d'une série — le geste le plus répété de l'app. */
export const hapticTap = () => buzz(15);

/** Action accomplie (séance terminée, sauvegarde exportée). */
export const hapticSuccess = () => buzz([25, 40, 25]);

/** Record battu — volontairement plus long, c'est l'événement rare. */
export const hapticRecord = () => buzz([15, 50, 15, 50, 60]);

/** Fin de minuteur de repos. */
export const hapticAlert = () => buzz([120, 60, 120]);
