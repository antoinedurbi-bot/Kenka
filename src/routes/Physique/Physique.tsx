import { useState } from "react";
import { PageHeader } from "../../components/layout/Shell";
import { Tabs } from "../../components/layout/Tabs";
import { SplitTab } from "./SplitTab";
import { SessionsTab } from "./SessionsTab";
import { LibraryTab } from "./LibraryTab";
import { MeasuresTab } from "./MeasuresTab";
import { VolumeTab } from "./VolumeTab";

type Tab = "split" | "seances" | "volume" | "biblio" | "mesures";

/** Nutrition a sa propre tuile dans le hub — voir routes/Nutrition/NutritionPage.tsx. */
export function Physique() {
  const [tab, setTab] = useState<Tab>("split");

  return (
    <>
      <PageHeader eyebrow="Axe I — Toji" title="Muscu">
        Corps d'assassin : sec, découpé, fonctionnel. Épaules, dos, avant-bras, abdos —
        pas de volume pour le volume.
      </PageHeader>

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: "split", label: "Split" },
          { value: "seances", label: "Séances" },
          { value: "volume", label: "Volume" },
          { value: "biblio", label: "Exercices" },
          { value: "mesures", label: "Mesures" },
        ]}
      />

      {tab === "split" && <SplitTab />}
      {tab === "seances" && <SessionsTab />}
      {tab === "volume" && <VolumeTab />}
      {tab === "biblio" && <LibraryTab />}
      {tab === "mesures" && <MeasuresTab />}
    </>
  );
}
