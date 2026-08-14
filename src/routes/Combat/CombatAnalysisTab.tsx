import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import clsx from "clsx";
import { db } from "../../db/db";
import { combatReport, FAMILY_LABELS } from "../../lib/combatReport";
import { KanjiSeal } from "../../components/illustrations/Motifs";
import { Empty, Panel, SectionTitle, Stat, Tag } from "../../components/ui";

const WINDOWS = [
  { days: 14, label: "14 j" },
  { days: 28, label: "28 j" },
  { days: 84, label: "12 sem" },
];

/**
 * Lecture de l'axe Combat. Les séances enregistraient déjà techniques, type et
 * rounds sans que rien ne les relise : cet onglet leur donne un usage. Le
 * pendant du Volume côté physique — mêmes fenêtres, même verdict, même façon de
 * nommer ce qui manque.
 */
export function CombatAnalysisTab() {
  const [windowDays, setWindowDays] = useState(28);
  const logs = useLiveQuery(() => db.combatLogs.toArray(), []) ?? [];

  const report = combatReport(logs, windowDays);
  const max = Math.max(1, ...report.byFamily.map((f) => f.sessions));

  return (
    <div className="space-y-5">
      <SectionTitle>Ce qui est réellement travaillé</SectionTitle>
      <p className="-mt-3 text-xs text-bone-600">Compté par séance, pas par occurrence.</p>

      <div className="flex gap-1">
        {WINDOWS.map((w) => (
          <button
            key={w.days}
            onClick={() => setWindowDays(w.days)}
            aria-pressed={windowDays === w.days}
            className={clsx(
              "flex-1 border py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
              windowDays === w.days
                ? "border-blood-500 bg-blood-900 text-bone-50"
                : "border-ink-700 text-bone-600",
            )}
          >
            {w.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Séances" value={report.sessions} />
        <Stat label="Rounds" value={report.rounds} tone="steel" />
        <Stat label="Heures" value={Math.round(report.minutes / 60)} tone="blood" />
      </div>

      {report.verdict === "insuffisant" ? (
        <Empty>{report.advice}</Empty>
      ) : (
        <>
          <Panel
            className={clsx(
              "relative overflow-hidden border-l-2 px-3 py-3",
              report.verdict === "aligne" ? "border-l-jade-400" : "border-l-blood-500",
            )}
          >
            <KanjiSeal
              kanji={report.verdict === "aligne" ? "整" : "欠"}
              className="pointer-events-none absolute -right-3 -top-2 h-20 w-20 opacity-[0.13]"
              color={report.verdict === "aligne" ? "#6f9c78" : "#c8323f"}
            />
            <Tag tone={report.verdict === "aligne" ? "jade" : "blood"}>
              {report.verdict === "aligne" ? "Aligné" : "À corriger"}
            </Tag>
            <p className="mt-2 max-w-[85%] text-xs leading-relaxed text-bone-400">
              {report.advice}
            </p>
          </Panel>

          <section>
            <SectionTitle>Par famille</SectionTitle>
            <Panel className="divide-y divide-ink-800">
              {report.byFamily.map((f) => (
                <div key={f.family} className="px-3 py-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={clsx(
                        "text-sm",
                        f.fundamental ? "text-bone-50" : "text-bone-400",
                      )}
                    >
                      {FAMILY_LABELS[f.family]}
                      {f.fundamental && <span className="ml-1.5 text-blood-400">★</span>}
                    </span>
                    <span className="font-mono text-xs tabular-nums text-bone-600">
                      {f.sessions} / {report.sessions} · {Math.round(f.share * 100)} %
                    </span>
                  </div>
                  <div className="mt-1 h-1 w-full bg-ink-800">
                    <div
                      className={clsx(
                        "h-full transition-[width] duration-500",
                        f.fundamental ? "bg-blood-500" : "bg-ink-600",
                      )}
                      style={{ width: `${(f.sessions / max) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </Panel>
            <p className="mt-2 text-[11px] leading-relaxed text-bone-600">
              ★ Fondations : elles devraient apparaître dans au moins une séance sur trois.
            </p>
          </section>

          <section>
            <SectionTitle>Mise à l'épreuve</SectionTitle>
            <Panel className="divide-y divide-ink-800">
              <Row
                label="Séances avec partenaire"
                value={`${report.partnerSessions} / ${report.sessions}`}
                tone={report.partnerHealthy ? "jade" : "blood"}
              />
              <Row
                label="Dont sparring"
                value={String(report.sparringSessions)}
                tone={report.sparringSessions > 0 ? "jade" : "neutral"}
              />
              <Row
                label="Dernier sparring"
                value={
                  report.daysSinceSparring === undefined
                    ? "jamais"
                    : report.daysSinceSparring === 0
                      ? "aujourd'hui"
                      : `il y a ${report.daysSinceSparring} j`
                }
                tone={report.sparringFresh ? "jade" : "blood"}
              />
            </Panel>
          </section>
        </>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "jade" | "blood" | "neutral";
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
      <span className="text-sm text-bone-400">{label}</span>
      <Tag tone={tone}>{value}</Tag>
    </div>
  );
}
