import { useState } from "react";
import { PageHeader } from "../../components/layout/Shell";
import { Tabs } from "../../components/layout/Tabs";
import { SkillsTab } from "./SkillsTab";
import { CombatSessionsTab } from "./CombatSessionsTab";

type Tab = "skills" | "seances";

export function Combat() {
  const [tab, setTab] = useState<Tab>("skills");

  return (
    <>
      <PageHeader eyebrow="Axe II — Ippo" title="Combat">
        Les fondamentaux avant le style : jab, déplacements, garde, encaissement, cardio.
        Un axe indépendant du physique.
      </PageHeader>

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: "skills", label: "Compétences" },
          { value: "seances", label: "Séances" },
        ]}
      />

      {tab === "skills" && <SkillsTab />}
      {tab === "seances" && <CombatSessionsTab />}
    </>
  );
}
