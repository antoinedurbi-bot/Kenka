import { useState } from "react";
import clsx from "clsx";
import { db } from "../../db/db";
import { isoDay } from "../../lib/dates";
import { upsertDailyWeight } from "../../lib/daily";
import { DEFAULT_HEIGHT_CM, estimateBodyFat, TOJI_TARGET } from "../../lib/progression";
import { Field } from "../../components/ui";
import { FighterMark } from "../../components/illustrations/Motifs";
import { ALL_SECTION_IDS, ENABLED_SECTIONS_KEY, SECTIONS } from "../../lib/sections";
import type { SectionId } from "../../lib/sections";

const STEPS = ["Axes", "Mesures", "Prêt"] as const;

/**
 * Capture la ligne de base. Sans elle, l'app ouvre sur un niveau 0 vide et ne
 * peut rien dire d'utile — or le premier lancement est le seul moment garanti
 * où l'utilisateur est disposé à saisir ses chiffres.
 */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [sections, setSections] = useState<SectionId[]>(ALL_SECTION_IDS);
  const [heightCm, setHeightCm] = useState(String(DEFAULT_HEIGHT_CM));
  const [weightKg, setWeightKg] = useState("");
  const [m, setM] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const toggleSection = (id: SectionId) =>
    setSections((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

  const num = (k: string) => (m[k] ? Number(m[k]) : undefined);
  const estimated = estimateBodyFat(num("waistCm"), num("neckCm"), Number(heightCm) || undefined);

  const finish = async (withMeasures: boolean) => {
    setSaving(true);
    try {
      await db.settings.put({ key: "heightCm", value: Number(heightCm) || DEFAULT_HEIGHT_CM });
      await db.settings.put({ key: ENABLED_SECTIONS_KEY, value: sections });
      await db.settings.put({ key: "onboarded", value: isoDay() });

      if (withMeasures && (weightKg || Object.keys(m).length > 0)) {
        await db.measurements.add({
          date: isoDay(),
          weightKg: weightKg ? Number(weightKg) : undefined,
          shouldersCm: num("shouldersCm"),
          waistCm: num("waistCm"),
          neckCm: num("neckCm"),
          armsCm: num("armsCm"),
          thighsCm: num("thighsCm"),
          bfPercent: estimated,
          notes: "Mesure de référence",
        });
        if (weightKg) {
          await upsertDailyWeight(isoDay(), Number(weightKg));
        }
      }
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-8">
      <div className="mb-8">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-2xl tracking-[0.2em] text-bone-50">KENKA</span>
          <span className="font-mono text-[10px] tracking-[0.16em] text-blood-500">喧嘩</span>
        </div>
        <div className="mt-4 flex gap-1">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={clsx("h-0.5 flex-1", i <= step ? "bg-blood-500" : "bg-ink-700")}
            />
          ))}
        </div>
      </div>

      {step === 0 && (
        <div className="k-anim-in flex-1 space-y-5">
          <div className="relative -mx-5 -mt-2 mb-1 flex h-40 items-center justify-center overflow-hidden">
            <div className="k-glow-blood k-anim-pulse absolute h-56 w-56 rounded-full blur-3xl" aria-hidden />
            <FighterMark className="relative h-32 w-32 text-bone-50" color="currentColor" />
          </div>

          <div>
            <h1 className="text-xl leading-tight">Choisis tes axes</h1>
            <p className="mt-3 text-sm leading-relaxed text-bone-400">
              <span className="text-blood-300">Toji</span> côté corps,{" "}
              <span className="text-steel-300">Ippo</span> côté combat — le reste est optionnel.
              Ce qui est décoché disparaît de la navigation ; tout se change plus tard depuis les
              Réglages.
            </p>
          </div>

          <div className="space-y-2">
            {SECTIONS.map((s) => {
              const on = sections.includes(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => toggleSection(s.id)}
                  aria-pressed={on}
                  className={clsx(
                    "flex w-full items-center gap-3 border px-3 py-2.5 text-left transition-colors",
                    on ? "border-blood-500 bg-blood-900/30" : "border-ink-700",
                  )}
                >
                  <span
                    className={clsx(
                      "font-display text-lg",
                      on ? "text-blood-400" : "text-bone-700",
                    )}
                    aria-hidden
                  >
                    {s.kanji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={clsx("block text-sm", on ? "text-bone-50" : "text-bone-500")}>
                      {s.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-bone-600">{s.blurb}</span>
                  </span>
                  <span
                    className={clsx(
                      "flex h-5 w-5 shrink-0 items-center justify-center border font-mono text-[10px]",
                      on ? "border-blood-400 bg-blood-600 text-bone-50" : "border-ink-600",
                    )}
                  >
                    {on ? "✓" : ""}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="border-l border-ink-700 pl-3 text-xs leading-relaxed text-bone-600">
            Aucune donnée ne quitte cet appareil. Pas de compte, pas de serveur, pas de
            notification : l'app ne fait rien tant que tu ne l'ouvres pas.
          </p>

          <Field label="Taille (cm)" hint="Sert à estimer la masse grasse.">
            <input
              type="number"
              inputMode="numeric"
              className="k-field"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
            />
          </Field>

          <button className="k-btn-primary w-full" onClick={() => setStep(1)}>
            Continuer
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="k-anim-in flex-1 space-y-5">
          <div>
            <h1 className="text-xl leading-tight">Ligne de base</h1>
            <p className="mt-2 text-sm leading-relaxed text-bone-400">
              C'est la référence à laquelle tout sera comparé. Le tour de taille et le tour de cou
              suffisent à estimer la masse grasse.
            </p>
          </div>

          <Field label="Poids (kg)">
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              className="k-field"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="63"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            {[
              ["waistCm", "Taille (cm)"],
              ["neckCm", "Cou (cm)"],
              ["shouldersCm", "Épaules (cm)"],
              ["armsCm", "Bras (cm)"],
            ].map(([key, label]) => (
              <Field key={key} label={label}>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  className="k-field"
                  value={m[key] ?? ""}
                  onChange={(e) => setM({ ...m, [key]: e.target.value })}
                />
              </Field>
            ))}
          </div>

          {estimated !== undefined && (
            <div className="border border-ink-700 bg-ink-900 px-3 py-2.5">
              <div className="k-label">Masse grasse estimée</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-2xl tabular-nums text-blood-300">{estimated} %</span>
                <span className="text-xs text-bone-600">cible {TOJI_TARGET.bfPercent} %</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <button
              className="k-btn-primary w-full"
              disabled={saving}
              onClick={() => setStep(2)}
            >
              Continuer
            </button>
            <button
              className="w-full py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600"
              onClick={() => finish(false)}
            >
              Passer — je mesurerai plus tard
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="k-anim-in flex-1 space-y-5">
          <div>
            <h1 className="text-xl leading-tight">Comment ça marche</h1>
            <ul className="mt-4 space-y-3">
              {[
                ["Séances", "La séance du jour est déjà pré-remplie depuis ton split, avec tes charges de la dernière fois."],
                ["Volume", "L'onglet Volume vérifie que le travail va bien aux épaules et au dos plutôt qu'aux pecs et aux bras."],
                ["Mesures", "Une mesure toutes les deux semaines suffit. Le niveau est lissé sur les 3 dernières."],
                ["Photos", "Une session par semaine, mêmes conditions. Rien n'est retouché."],
                ["Sauvegarde", "Exporter régulièrement depuis les Réglages : il n'y a pas de cloud."],
              ].map(([title, body]) => (
                <li key={title} className="flex gap-3 border-l border-ink-700 pl-3">
                  <div>
                    <div className="font-display text-xs uppercase tracking-[0.1em] text-bone-50">
                      {title}
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-bone-400">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <button className="k-btn-primary w-full" disabled={saving} onClick={() => finish(true)}>
            {saving ? "…" : "Commencer"}
          </button>
        </div>
      )}
    </div>
  );
}
