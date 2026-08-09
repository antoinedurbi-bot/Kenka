import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

const PRESETS = [60, 90, 120, 180];

/**
 * Minuteur de repos. Il s'appuie sur un timestamp de fin plutôt qu'un décompte
 * incrémental : sur iOS, l'onglet en arrière-plan gèle les intervalles, et un
 * compteur décrémenté dériverait de plusieurs minutes pendant la série suivante.
 */
export function RestTimer() {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [duration, setDuration] = useState(90);
  const audioRef = useRef<AudioContext | null>(null);

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
  }, [endsAt]);

  /*
   * iOS n'autorise la création/reprise d'un AudioContext que pendant un geste
   * utilisateur. Il est donc armé au moment où l'utilisateur lance le minuteur,
   * sinon le bip de fin — déclenché depuis un timer — resterait muet.
   */
  const armAudio = () => {
    try {
      audioRef.current ??= new AudioContext();
      void audioRef.current.resume();
    } catch {
      // Audio indisponible : le minuteur reste utilisable visuellement.
    }
  };

  const beep = () => {
    try {
      const ctx = audioRef.current;
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
    navigator.vibrate?.([120, 60, 120]);
  };

  const running = endsAt !== null;
  const pct = running && duration > 0 ? remaining / duration : 0;

  return (
    <div className="border border-ink-700 bg-ink-950">
      <div className="flex items-center gap-2 px-2.5 py-2">
        <span className="k-label shrink-0">Repos</span>

        {running ? (
          <>
            <span className="font-mono text-lg tabular-nums text-bone-50">
              {String(Math.floor(remaining / 60)).padStart(2, "0")}:
              {String(remaining % 60).padStart(2, "0")}
            </span>
            <div className="mx-1 h-0.5 flex-1 bg-ink-800">
              <div
                className="h-full bg-blood-500 transition-[width] duration-200"
                style={{ width: `${pct * 100}%` }}
              />
            </div>
            <button
              type="button"
              onClick={() => setEndsAt(null)}
              className="shrink-0 border border-ink-600 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-bone-400"
            >
              Stop
            </button>
          </>
        ) : (
          <div className="flex flex-1 justify-end gap-1">
            {PRESETS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  armAudio();
                  setDuration(s);
                  setEndsAt(Date.now() + s * 1000);
                }}
                className={clsx(
                  "border border-ink-600 px-2 py-1 font-mono text-[10px] tabular-nums text-bone-400",
                  "active:bg-ink-800",
                )}
              >
                {s < 120 ? `${s}s` : `${s / 60}min`}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
