/**
 * Lien de démo par exercice. Fabriquer une URL de vidéo précise sans pouvoir la
 * vérifier reviendrait à distribuer des liens potentiellement morts ou hors
 * sujet ; une recherche YouTube pré-remplie, elle, fonctionne toujours et
 * laisse le choix de la meilleure vidéo à l'utilisateur.
 */
export function demoSearchUrl(exerciseName: string): string {
  const query = `${exerciseName} technique muscu`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}
