import { Suspense, lazy, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Topbar } from "./components/Topbar.tsx";
import { DATA_UPDATED } from "./data/officialData.ts";
import { DatabaseSection } from "./features/database/DatabaseSection.tsx";
import { QuickMatchConsole } from "./features/quickmatch/QuickMatchConsole.tsx";
import { SocialSection } from "./features/social/SocialSection.tsx";
import { TournamentSection } from "./features/tournaments/TournamentSection.tsx";
import { initGlobalClickSfx } from "./lib/sound.ts";
import { useMatchStore } from "./stores/useMatchStore.ts";
import { useSocialStore } from "./stores/useSocialStore.ts";

const ManagerPage = lazy(() =>
  import("./features/manager/ManagerPage.tsx").then((m) => ({ default: m.ManagerPage }))
);

useMatchStore.getState().setHooks({
  getPersistentFormBonus: (playerName) =>
    useSocialStore.getState().getPersistentFormBonus(playerName),
  onSeriesCompleted: (series) => useSocialStore.getState().recordCompletedSeries(series)
});

function HomePage() {
  return (
    <main>
      <QuickMatchConsole />
      <TournamentSection />
      <SocialSection />
      <DatabaseSection />

      <footer className="closing">
        <span>VCT Sim 2027 · Motor táctico Vite + React + TypeScript</span>
        <span className="mono">BASE OFICIAL ACTUALIZADA: {DATA_UPDATED}</span>
      </footer>
    </main>
  );
}

function ManagerFallback() {
  return (
    <main>
      <div className="box mono" style={{ color: "var(--mut)", fontSize: "12px" }}>
        CARGANDO MODO MANAGER VCT 2027...
      </div>
    </main>
  );
}

export function App() {
  useEffect(() => initGlobalClickSfx(), []);

  return (
    <>
      <Topbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/manager"
          element={
            <Suspense fallback={<ManagerFallback />}>
              <ManagerPage />
            </Suspense>
          }
        />
        <Route path="/manager.html" element={<Navigate to="/manager" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}