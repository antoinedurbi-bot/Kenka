import { useEffect, useState } from "react";

/**
 * Maintient l'écran allumé pendant une séance.
 *
 * C'est la friction la plus coûteuse de l'app : sans ça, l'écran s'éteint entre
 * deux séries et chaque saisie commence par déverrouiller le téléphone avec les
 * mains moites. Sur une séance de vingt séries, c'est vingt déverrouillages —
 * assez pour qu'on arrête de logger en cours et qu'on tente de tout ressaisir
 * de mémoire à la fin, ce qui produit des données fausses.
 *
 * Le verrou est libéré par le navigateur dès que l'onglet passe en arrière-plan
 * (appel entrant, changement d'app). Il faut donc le redemander au retour, sinon
 * il ne tient que jusqu'à la première interruption.
 */
export function useWakeLock(active: boolean) {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      // Une demande faite pendant que le document est masqué échoue par
      // spécification — inutile de la tenter, on repassera au retour au premier plan.
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) {
          void sentinel.release();
          sentinel = null;
          return;
        }
        setHeld(true);
        sentinel.addEventListener("release", () => setHeld(false));
      } catch {
        // Refus du navigateur (batterie faible, réglage système) : la séance
        // reste parfaitement utilisable, seulement moins confortable.
        setHeld(false);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible" && !sentinel) void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel?.release();
      sentinel = null;
      setHeld(false);
    };
  }, [active]);

  return held;
}
