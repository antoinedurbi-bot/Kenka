import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "./components/layout/Shell";
import { db } from "./db/db";
import { seedIfEmpty } from "./db/seed";
import { requestPersistentStorage } from "./lib/storage";
import { Onboarding } from "./routes/Onboarding/Onboarding";
import { Dashboard } from "./routes/Dashboard/Dashboard";
import { Physique } from "./routes/Physique/Physique";
import { Combat } from "./routes/Combat/Combat";
import { Photos } from "./routes/Photos/Photos";
import { GlowUp } from "./routes/GlowUp/GlowUp";
import { Settings } from "./routes/Settings/Settings";
import { SessionScreen } from "./routes/Session/SessionScreen";

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
      <Route element={<Shell />}>
        <Route index element={<Dashboard />} />
        <Route path="physique" element={<Physique />} />
        <Route path="combat" element={<Combat />} />
        <Route path="photos" element={<Photos />} />
        <Route path="glow-up" element={<GlowUp />} />
        <Route path="reglages" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
