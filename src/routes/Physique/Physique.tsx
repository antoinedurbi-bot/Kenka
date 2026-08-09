import { useState } from "react";
import { PageHeader } from "../../components/layout/Shell";
import { Tabs } from "../../components/layout/Tabs";
import { SplitTab } from "./SplitTab";
import { SessionsTab } from "./SessionsTab";
import { LibraryTab } from "./LibraryTab";
import { MeasuresTab } from "./MeasuresTab";
import { NutritionTab } from "./NutritionTab";
import { VolumeTab } from "./VolumeTab";

type Tab = "split" | "seances" | "volume" | "biblio" | "mesures" | "nutrition";

export function Physique() {
  const [tab, setTab] = useState<Tab>("split");

  return (
    <>
      <PageHeader eyebrow="Axe I — Toji" title="Physique">
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
          { value: "nutrition", label: "Nutrition" },
        ]}
      />

      {tab === "split" && <SplitTab />}
      {tab === "seances" && <SessionsTab />}
      {tab === "volume" && <VolumeTab />}
      {tab === "biblio" && <LibraryTab />}
      {tab === "mesures" && <MeasuresTab />}
      {tab === "nutrition" && <NutritionTab />}
    </>
  );
}
