import { useCallback, useEffect, useRef, useState } from "react";
import { hapticAlert } from "../../lib/haptics";

/**
 * Minuteur de repos partagé. Il repose sur un horodatage de fin plutôt qu'un
 * décompte : sur iOS, un onglet en arrière-plan gèle les intervalles, et un
 * compteur décrémenté dériverait de plusieurs minutes pendant la série suivante.
 */
export function useRestTimer(defaultSeconds = 90) {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [duration, setDuration] = useState(defaultSeconds);
  const [remaining, setRemaining] = useState(0);
  const audio = useRef<AudioContext | null>(null);

  /* iOS n'autorise la création d'un AudioContext que pendant un geste
   * utilisateur : il est armé au démarrage du minuteur, pas à son échéance. */
  const arm = useCallback(() => {
    try {
      audio.current ??= new AudioContext();
      void audio.current.resume();
    } catch {
      // Audio indisponible : le minuteur reste utilisable visuellement.
    }
  }, []);

  const beep = useCallback(() => {
    try {
      const ctx = audio.current;
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 660;
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch {
      // Son bloqué (mode silencieux) : le visuel suffit.
    }
    // Absent de Safari iOS — d'où le repli sonore et visuel.
    hapticAlert();
  }, []);

  const start = useCallback(
    (seconds = duration) => {
      arm();
      setDuration(seconds);
      setEndsAt(Date.now() + seconds * 1000);
    },
    [arm, duration],
  );

  const stop = useCallback(() => setEndsAt(null), []);

  useEffect(() => {
    if (endsAt === null) return;
    const tick = () => {
      const left = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        setEndsAt(null);
        beep();
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endsAt, beep]);

  return {
    running: endsAt !== null,
    remaining,
    duration,
    setDuration,
    start,
    stop,
  };
}
