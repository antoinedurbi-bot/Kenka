import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import clsx from "clsx";
import { db } from "../../db/db";
import { isoDay, isoWeekStart, prettyDate, prettyShort } from "../../lib/dates";
import {
  calibrateMaintenance,
  recalibrationSuggestion,
  suggestMacros,
  suggestTarget,
  trendWeight,
  weeklyAverage,
  weightSlopePerWeek,
  WEEKLY_GAIN_TARGET,
} from "../../lib/nutrition";
import { useSetting } from "../../lib/useSetting";
import { upsertDailyIntake, upsertDailyWeight } from "../../lib/daily";
import { TrendChart } from "../../components/charts/TrendChart";
import { Field, Modal, Panel, SectionTitle, Stat, Tag } from "../../components/ui";
import { Stepper } from "../../components/ui/Stepper";

export function NutritionTab() {
  const [calibrating, setCalibrating] = useState(false);
  const [maintenance, setMaintenance] = useSetting<number | null>("maintenanceKcal", null);

  const weights = useLiveQuery(() => db.dailyWeights.orderBy("date").toArray(), []) ?? [];
  const intake = useLiveQuery(() => db.dailyIntake.orderBy("date").toArray(), []) ?? [];

  const target = maintenance ? suggestTarget(maintenance) : undefined;
  const latestWeight = weights[weights.length - 1]?.weightKg;
  const macros = target && latestWeight ? suggestMacros(target, latestWeight) : undefined;

  const trend = trendWeight(weights);
  const latestTrend = trend[trend.length - 1]?.value;
  const recal = recalibrationSuggestion(maintenance, intake, weights);

  // Tendance sur 21 jours : assez long pour dépasser le bruit d'hydratation.
  const recent = weights.slice(-21);
  const slope = weightSlopePerWeek(recent);
  const hasTrend = recent.length >= 7;

  const trendTone = !hasTrend
    ? "neutral"
    : slope < WEEKLY_GAIN_TARGET.min
      ? "steel"
      : slope > WEEKLY_GAIN_TARGET.max
        ? "blood"
        : "jade";

  const trendAdvice = !hasTrend
    ? "Au moins 7 pesées pour établir une tendance fiable."
    : slope < WEEKLY_GAIN_TARGET.min
      ? "Prise trop lente : ajouter 150-200 kcal/jour et réévaluer dans deux semaines."
      : slope > WEEKLY_GAIN_TARGET.max
        ? "Prise trop rapide, risque de gras : retirer 150-200 kcal/jour."
        : "Vitesse correcte. Ne rien changer, continuer à peser.";

  return (
    <div className="space-y-6">
      <QuickEntry />

      <Panel className="px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="k-label">Maintien calibré</div>
            <div className="mt-1 font-mono text-2xl tabular-nums text-bone-50">
              {maintenance ?? "—"}
              <span className="ml-1 text-xs text-bone-600">kcal/j</span>
            </div>
          </div>
          <button
            className="k-btn-ghost shrink-0 !px-3 !py-1.5 !text-xs"
            onClick={() => setCalibrating(true)}
          >
            Calibrer
          </button>
        </div>
        <p className="mt-2 text-xs text-bone-600">Mesuré depuis tes apports et ta dérive de poids, pas calculé.</p>
      </Panel>

      {recal.available && (
        <Panel className="border-l-2 border-l-gold-400 px-3 py-3">
          <div className="flex items-center gap-2">
            <Tag tone="gold">Nouvelle estimation disponible</Tag>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-bone-400">
            Les derniers jours pointent vers{" "}
            <span className="font-mono text-bone-50">{recal.liveMaintenanceKcal} kcal</span>{" "}
            plutôt que {maintenance} — la dérive de poids réelle s'écarte de ce que la cible
            actuelle suppose.
          </p>
          <button
            className="k-btn-ghost mt-2.5 w-full !text-xs"
            onClick={() => setMaintenance(recal.liveMaintenanceKcal!)}
          >
            Mettre à jour à {recal.liveMaintenanceKcal} kcal
          </button>
        </Panel>
      )}

      {target && (
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Cible actuelle" value={target} unit="kcal" tone="blood" />
          <Stat label="Surplus" value={`+${target - maintenance!}`} unit="kcal" />
        </div>
      )}

      {macros && (
        <Panel className="divide-y divide-ink-800">
          <MacroRow label="Protéines" value={`${macros.proteinG} g`} note="≈ 2 g/kg" />
          <MacroRow label="Lipides" value={`${macros.fatG} g`} note="25 % des kcal" />
          <MacroRow label="Glucides" value={`${macros.carbsG} g`} note="le reste — carburant" />
        </Panel>
      )}

      <Panel className="px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="k-label">Tendance de poids</div>
          <Tag tone={trendTone}>
            {hasTrend ? `${slope >= 0 ? "+" : ""}${slope.toFixed(2)} kg/sem` : "insuffisant"}
          </Tag>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-bone-400">{trendAdvice}</p>
        <p className="mt-1 font-mono text-[10px] tracking-[0.1em] text-bone-600">
          CIBLE : +{WEEKLY_GAIN_TARGET.min} À +{WEEKLY_GAIN_TARGET.max} KG/SEM
        </p>
      </Panel>

      {weights.length >= 2 && (
        <section>
          <div className="flex items-baseline justify-between gap-2">
            <SectionTitle>Poids</SectionTitle>
            {latestTrend !== undefined && (
              <span className="mb-3 font-mono text-xs tabular-nums text-gold-400">
                {latestTrend.toFixed(1)} kg lissé
              </span>
            )}
          </div>
          <TrendChart
            data={weights.slice(-90).map((w) => ({ date: w.date, value: w.weightKg }))}
            trend={trend.slice(-90)}
            unit=" kg"
            color="#9fb2bb"
            domainPad={0.5}
          />
          <p className="mt-2 text-[11px] leading-relaxed text-bone-600">
            Points gris : pesées brutes. Ligne dorée : tendance lissée — c'est elle qui compte
            pour juger la vitesse de prise ou de perte, pas la pesée d'un seul jour.
          </p>
        </section>
      )}

      <WeeklyRollup />

      {intake.length > 0 && (
        <section>
          <SectionTitle>Apports récents</SectionTitle>
          <Panel className="divide-y divide-ink-800">
            {[...intake].reverse().slice(0, 14).map((i) => (
              <div key={i.id} className="flex items-center justify-between px-3 py-2">
                <span className="k-label">{prettyShort(i.date)}</span>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm tabular-nums text-bone-50">{i.kcal} kcal</span>
                  {i.proteinG && (
                    <span className="font-mono text-xs tabular-nums text-bone-600">
                      {i.proteinG} g P
                    </span>
                  )}
                  <button
                    onClick={() => db.dailyIntake.delete(i.id!)}
                    aria-label="Supprimer"
                    className="px-1 font-mono text-bone-600 active:text-blood-300"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </Panel>
        </section>
      )}

      <CalibrateModal
        open={calibrating}
        onClose={() => setCalibrating(false)}
        onSave={(v) => setMaintenance(v)}
        current={maintenance}
      />
    </div>
  );
}

/** Saisie du jour : deux champs, deux secondes. C'est la seule friction acceptable. */
function QuickEntry() {
  const today = isoDay();
  const todayWeight = useLiveQuery(() => db.dailyWeights.where("date").equals(today).first(), [today]);
  const todayIntake = useLiveQuery(() => db.dailyIntake.where("date").equals(today).first(), [today]);

  const [weight, setWeight] = useState("");
  const [kcal, setKcal] = useState("");

  const saveWeight = async () => {
    const v = Number(weight);
    if (!v) return;
    await upsertDailyWeight(today, v);
    setWeight("");
  };

  const saveKcal = async () => {
    const v = Number(kcal);
    if (!v) return;
    await upsertDailyIntake(today, v);
    setKcal("");
  };

  return (
    <Panel className="px-3 py-3">
      <div className="k-label mb-2.5">Aujourd'hui</div>

      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-xs text-bone-400">Poids</span>
          <div className="flex-1">
            <Stepper
              value={weight}
              onChange={setWeight}
              step={0.1}
              ghost={todayWeight?.weightKg}
              suffix="kg"
              ariaLabel="Poids du jour"
            />
          </div>
          <button
            className="k-btn-ghost shrink-0 !px-2.5 !py-1.5 !text-[10px]"
            onClick={saveWeight}
            disabled={!weight}
          >
            {todayWeight ? "Maj" : "OK"}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-xs text-bone-400">Apport</span>
          <div className="flex-1">
            <Stepper
              value={kcal}
              onChange={setKcal}
              step={50}
              max={9999}
              ghost={todayIntake?.kcal}
              suffix="kcal"
              ariaLabel="Apport calorique du jour"
            />
          </div>
          <button
            className="k-btn-ghost shrink-0 !px-2.5 !py-1.5 !text-[10px]"
            onClick={saveKcal}
            disabled={!kcal}
          >
            {todayIntake ? "Maj" : "OK"}
          </button>
        </div>
      </div>

      <p className="mt-2.5 text-[11px] text-bone-600">Pesée à jeun, après les toilettes.</p>
    </Panel>
  );
}

/** Les moyennes hebdo sont dérivées des pesées : plus rien à ressaisir. */
function WeeklyRollup() {
  const weights = useLiveQuery(() => db.dailyWeights.orderBy("date").toArray(), []) ?? [];
  if (weights.length === 0) return null;

  const weeks = new Map<string, number[]>();
  for (const w of weights) {
    const start = isoWeekStart(new Date(`${w.date}T00:00:00`));
    weeks.set(start, [...(weeks.get(start) ?? []), w.weightKg]);
  }

  const rows = [...weeks.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 12)
    .map(([start, vals]) => ({
      start,
      avg: weeklyAverage(weights, start)!,
      count: vals.length,
    }));

  if (rows.length === 0) return null;

  return (
    <section>
      <SectionTitle>Moyennes hebdomadaires</SectionTitle>
      <p className="-mt-1 mb-3 text-xs text-bone-600">
        Calculées automatiquement depuis les pesées — rien à ressaisir.
      </p>
      <Panel className="divide-y divide-ink-800">
        {rows.map((r, i) => {
          const prev = rows[i + 1];
          const delta = prev ? r.avg - prev.avg : undefined;
          return (
            <div key={r.start} className="flex items-center justify-between px-3 py-2.5">
              <div>
                <div className="font-mono text-xs uppercase tracking-[0.1em] text-bone-400">
                  Sem. du {prettyDate(r.start)}
                </div>
                <div className="k-label">{r.count} pesée(s)</div>
              </div>
              <div className="flex items-center gap-2.5">
                {delta !== undefined && (
                  <span
                    className={clsx(
                      "font-mono text-[10px] tabular-nums",
                      delta > 0 ? "text-jade-400" : delta < 0 ? "text-blood-300" : "text-bone-600",
                    )}
                  >
                    {delta > 0 ? "+" : ""}
                    {delta.toFixed(2)}
                  </span>
                )}
                <span className="font-mono text-sm tabular-nums text-bone-50">
                  {r.avg.toFixed(2)} kg
                </span>
              </div>
            </div>
          );
        })}
      </Panel>
    </section>
  );
}

function MacroRow({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex items-baseline justify-between px-3 py-2.5">
      <div>
        <div className="text-sm text-bone-50">{label}</div>
        <div className="k-label">{note}</div>
      </div>
      <span className="font-mono text-lg tabular-nums text-bone-50">{value}</span>
    </div>
  );
}

function CalibrateModal({
  open,
  onClose,
  onSave,
  current,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (v: number) => void;
  current: number | null;
}) {
  const [manual, setManual] = useState("");
  const weights = useLiveQuery(() => db.dailyWeights.toArray(), []) ?? [];
  const intake = useLiveQuery(() => db.dailyIntake.toArray(), []) ?? [];

  const result = calibrateMaintenance(intake, weights);

  return (
    <Modal open={open} onClose={onClose} title="Calibrer le maintien">
      <div className="space-y-4">
        <div
          className={clsx(
            "border-l-2 pl-3",
            result.ready ? "border-jade-400" : "border-ink-600",
          )}
        >
          <div className="k-label">
            {result.ready ? "Calibration prête" : `Collecte en cours — ${result.days}/7 jours`}
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-bone-400">{result.advice}</p>
        </div>

        {result.ready && result.maintenanceKcal && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Apport moyen" value={result.avgKcal!} unit="kcal" />
              <Stat
                label="Dérive"
                value={`${result.slopeKgPerWeek! >= 0 ? "+" : ""}${result.slopeKgPerWeek!.toFixed(2)}`}
                unit="kg/sem"
                tone="steel"
              />
            </div>
            <button
              className="k-btn-primary w-full"
              onClick={() => {
                onSave(result.maintenanceKcal!);
                onClose();
              }}
            >
              Retenir {result.maintenanceKcal} kcal comme maintien
            </button>
          </>
        )}

        <div className="space-y-2 border-t border-ink-800 pt-4">
          <Field
            label="Ou saisir manuellement"
            hint={
              current
                ? `Valeur actuelle : ${current} kcal/j.`
                : "À utiliser si tu as déjà calibré ailleurs."
            }
          >
            <input
              type="number"
              inputMode="numeric"
              className="k-field"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="2600"
            />
          </Field>
          {manual && (
            <p className="text-xs text-bone-600">
              Cible de recomposition :{" "}
              <span className="font-mono text-bone-200">{suggestTarget(Number(manual))} kcal/j</span>
            </p>
          )}
          <button
            className="k-btn-ghost w-full !text-xs"
            disabled={!manual || Number(manual) <= 0}
            onClick={() => {
              onSave(Number(manual));
              onClose();
            }}
          >
            Enregistrer la valeur manuelle
          </button>
        </div>
      </div>
    </Modal>
  );
}
