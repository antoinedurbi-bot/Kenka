import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "./components/layout/Shell";
import { db } from "./db/db";
import { seedIfEmpty } from "./db/seed";
import { requestPersistentStorage } from "./lib/storage";
import { useEnabledSections } from "./lib/sections";
import type { SectionId } from "./lib/sections";
import { Onboarding } from "./routes/Onboarding/Onboarding";
import { Hub } from "./routes/Hub/Hub";
import { Dashboard } from "./routes/Dashboard/Dashboard";
import { Physique } from "./routes/Physique/Physique";
import { Combat } from "./routes/Combat/Combat";
import { Photos } from "./routes/Photos/Photos";
import { GlowUp } from "./routes/GlowUp/GlowUp";
import { Settings } from "./routes/Settings/Settings";
import { SessionScreen } from "./routes/Session/SessionScreen";

/**
 * Une section désactivée depuis les Réglages doit aussi fermer son URL
 * directe — sinon un onglet gardé ouvert ou un lien favori continuerait à
 * afficher un écran que la navigation prétend ne plus exister.
 */
function RequireSection({ id, children }: { id: SectionId; children: ReactNode }) {
  const [enabled] = useEnabledSections();
  if (!enabled.includes(id)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(true);

  useEffect(() => {
    (async () => {
      await seedIfEmpty();
      const flag = await db.settings.get("onboarded");
      setOnboarded(Boolean(flag));
      // Demande au navigateur de ne pas évincer la base : sans ça, iOS peut
      // effacer les données après quelques jours sans ouverture.
      void requestPersistentStorage();
    })().finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span className="font-display text-sm tracking-[0.3em] text-bone-600">KENKA</span>
      </div>
    );
  }

  if (!onboarded) {
    return <Onboarding onDone={() => setOnboarded(true)} />;
  }

  return (
    <Routes>
      {/* Hors du Shell : pendant une séance, la navigation par onglets ne doit
          pas inviter à quitter l'écran sans terminer ou abandonner. */}
      <Route path="seance" element={<SessionScreen />} />
      {/* Le hub est le passage obligé à chaque ouverture, hors du Shell : il
          n'a ni bouton retour ni bandeau réglages, seulement le choix. */}
      <Route index element={<Hub />} />
      <Route element={<Shell />}>
        <Route path="base" element={<Dashboard />} />
        <Route
          path="physique"
          element={
            <RequireSection id="physique">
              <Physique />
            </RequireSection>
          }
        />
        <Route
          path="combat"
          element={
            <RequireSection id="combat">
              <Combat />
            </RequireSection>
          }
        />
        <Route
          path="photos"
          element={
            <RequireSection id="photos">
              <Photos />
            </RequireSection>
          }
        />
        <Route
          path="glow-up"
          element={
            <RequireSection id="glow-up">
              <GlowUp />
            </RequireSection>
          }
        />
        <Route path="reglages" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
