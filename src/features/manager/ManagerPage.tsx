import { useEffect, useRef } from "react";
import type { ChangeEvent } from "react";
import { TeamLogo } from "../../components/TeamLogo.tsx";
import { DATA_UPDATED } from "../../data/officialData.ts";
import { BroadcastViewer } from "../broadcast/BroadcastViewer.tsx";
import { ShareBar } from "../social/ShareBar.tsx";
import { useManagerStore } from "../../stores/useManagerStore.ts";
import {
  calcManagerReputation,
  calcRosterOvr,
  fmtMoney,
  getWeekPhaseName
} from "./managerHelpers.ts";
import {
  BoardMeetingScreen,
  CareerSummaryScreen,
  ClubSelectScreen,
  FiredScreen,
  NegotiationDrawer
} from "./ManagerScreens.tsx";
import { HubTab, SquadTab, TacticsTab } from "./ManagerTabsMain.tsx";
import {
  AcademyTab,
  CalendarTab,
  ClubsTab,
  FinanceTab,
  MarketTab,
  NewsTab
} from "./ManagerTabsWorld.tsx";
import type { ManagerTabId } from "./types.ts";

export function ManagerPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const viewerRef = useRef<HTMLElement | null>(null);

  const M = useManagerStore((s) => s.career);
  const activeTab = useManagerStore((s) => s.activeTab);
  const setActiveTab = useManagerStore((s) => s.setActiveTab);
  const exportSave = useManagerStore((s) => s.exportSave);
  const importSave = useManagerStore((s) => s.importSave);
  const endCareer = useManagerStore((s) => s.endCareer);

  const viewerOpen = useManagerStore((s) => s.viewerOpen);
  const viewerPayload = useManagerStore((s) => s.viewerPayload);
  const viewerLiveFinished = useManagerStore((s) => s.viewerLiveFinished);
  const viewerLiveMapIdx = useManagerStore((s) => s.viewerLiveMapIdx);
  const viewerLiveShown = useManagerStore((s) => s.viewerLiveShown);
  const viewerRevealedMaps = useManagerStore((s) => s.viewerRevealedMaps);
  const viewerActiveTab = useManagerStore((s) => s.viewerActiveTab);
  const viewerAutoPlaying = useManagerStore((s) => s.viewerAutoPlaying);
  const closeViewer = useManagerStore((s) => s.closeViewer);
  const stepViewerRound = useManagerStore((s) => s.stepViewerRound);
  const toggleViewerAutoPlay = useManagerStore((s) => s.toggleViewerAutoPlay);
  const stopViewerLive = useManagerStore((s) => s.stopViewerLive);
  const selectViewerTab = useManagerStore((s) => s.selectViewerTab);

  useEffect(() => () => stopViewerLive(), [stopViewerLive]);

  useEffect(() => {
    if (viewerOpen && viewerRef.current) {
      viewerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [viewerOpen, viewerPayload]);

  const triggerImport = () => fileInputRef.current?.click();

  const handleFileImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const res = importSave(parsed);
        if (!res.ok) window.alert(res.err);
        else window.alert(res.summary);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "JSON inválido";
        window.alert(`Error leyendo el archivo .json: ${msg}`);
      }
    };
    reader.readAsText(file);
  };

const renderActiveTab = () => {
  if (!M) return null;
  if (M.fired) return <FiredScreen />;
  if (M.pendingBoardMeeting) return <BoardMeetingScreen />;
  switch (activeTab) {
      case "hub":
        return <HubTab />;
      case "squad":
        return <SquadTab />;
      case "tactics":
        return <TacticsTab />;
      case "academy":
        return <AcademyTab />;
      case "market":
        return <MarketTab />;
      case "calendar":
        return <CalendarTab />;
      case "clubs":
        return <ClubsTab />;
      case "news":
        return <NewsTab />;
      case "finance":
        return <FinanceTab />;
    }
  };

  const club = M ? M.clubs[M.userTeam] : null;
  const ovr = club ? calcRosterOvr(club.players, club.coach) : 0;
  const rep = calcManagerReputation(M);

  const tabs: Array<{ id: ManagerTabId; label: string }> =
    M && club
      ? [
          { id: "hub", label: "RESUMEN & SEMANA" },
          { id: "squad", label: `PLANTILLA (${club.players.length})` },
          { id: "tactics", label: "TÁCTICA & COMPS" },
          { id: "academy", label: `ACADEMIA (${M.academy.length})` },
          { id: "market", label: "FICHAJES & STAFF" },
          { id: "calendar", label: "CALENDARIO (33S)" },
          { id: "clubs", label: "POSTULAR & CLUBES" },
          { id: "news", label: `NOTICIAS (${M.news.length})` },
          { id: "finance", label: "FINANZAS & LEGADO" }
        ]
      : [];

  return (
    <main id="top">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={handleFileImport}
      />

      {/* VISOR BROADCAST + 2D DESPLEGABLE PARA PARTIDOS DE CARRERA */}
      {viewerOpen && viewerPayload && (
        <section ref={viewerRef} className="box mgr-viewer-wrap" id="mgrViewerSection">
          <div className="box-head">
            <div>
              <h2>Transmisión &amp; Telemetría del Partido</h2>
              <small style={{ color: "var(--mut)" }}>
                Reproduce la serie ronda a ronda o revisa los mapas, agentes, gráficas y Rating 2.0.
              </small>
            </div>
            <div className="btn-group">
              <button type="button" className="mono" onClick={stepViewerRound}>
                +1 Ronda
              </button>
              <button
                type="button"
                className={`mono ${viewerAutoPlaying ? "live-active" : ""}`}
                onClick={toggleViewerAutoPlay}
              >
                {viewerAutoPlaying ? "Pausar" : "Auto-Play"}
              </button>
              <button type="button" className="mono mgr-end-btn" onClick={closeViewer}>
                Cerrar Visor
              </button>
            </div>
          </div>

          <div
            className="cal-card"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px"
            }}
          >
            <span className="mono" style={{ fontSize: "11.5px" }}>
              <b>SERIE OFICIAL</b> · {viewerPayload.label}
            </span>
            <button type="button" className="t-btn-sm mono" onClick={closeViewer}>
              Volver a mi Club
            </button>
          </div>

          <BroadcastViewer
            series={viewerPayload.series}
            liveFinished={viewerLiveFinished}
            liveMapIdx={viewerLiveMapIdx}
            liveShown={viewerLiveShown}
            revealedMaps={viewerRevealedMaps}
            activeTab={viewerActiveTab}
            isAutoPlaying={viewerAutoPlaying}
            onSelectTab={selectViewerTab}
            shareBar={<ShareBar series={viewerPayload.series} />}
          />
        </section>
      )}

      {/* CONSOLA COMPLETA DEL MODO MANAGER */}
      <section className="box" id="manager" aria-label="Modo Manager VCT 2027">
        {!M ? (
          <ClubSelectScreen onTriggerImport={triggerImport} />
        ) : M.ended ? (
          <CareerSummaryScreen />
        ) : (
          club && (
            <>
              <div className="mgr-header-bar">
                <div className="mgr-brand-left">
                  <span className="mgr-logo-frame">
                    <TeamLogo teamName={M.userTeam} className="score-logo-sm" />
                  </span>
                  <div>
                    <div className="mono" style={{ fontSize: "10px", color: "var(--mut)" }}>
                      MODO MANAGER · TEMPORADA {M.season} · SEMANA {M.week}/33 ·{" "}
                      {getWeekPhaseName(M.week)}
                    </div>
                    <h2 style={{ fontSize: "22px", marginTop: "2px", color: club.color }}>
                      {M.userTeam}
                    </h2>
                  </div>
                </div>

                <div className="mgr-header-kpis mono">
                  <div className="mgr-kpi-box">
                    <small>OVR</small>
                    <b>{ovr}</b>
                  </div>
                  <div className="mgr-kpi-box">
                    <small>PRESUPUESTO</small>
                    <b className={club.budget >= 0 ? "kd-pos" : "kd-neg"}>
                      {fmtMoney(club.budget)}
                    </b>
                  </div>
                  <div className="mgr-kpi-box">
                    <small>DIRECTIVA{M.graceWeeks > 0 ? ` (G:${M.graceWeeks}S)` : ""}</small>
                    <b
                      className={
                        M.boardConfidence >= 35
                          ? "kd-pos"
                          : M.boardConfidence <= 0
                            ? "kd-neg"
                            : ""
                      }
                    >
                      {M.boardConfidence > 0 ? "+" : ""}
                      {M.boardConfidence}
                    </b>
                  </div>
                  <div className="mgr-kpi-box">
                    <small>REP</small>
                    <b style={{ color: "var(--vct-cyan)" }}>{rep}</b>
                  </div>
                  <div className="mgr-kpi-box">
                    <small>GUARDADO</small>
                    <b className="kd-pos">{M.lastSavedAt || "AUTO"}</b>
                  </div>
                  <button
                    type="button"
                    className="t-btn-sm mono t-btn-live"
                    onClick={exportSave}
                    title="Descarga tu partida en .json para respaldo o pasarla a amigos"
                  >
                    Exportar .json
                  </button>
                  <button
                    type="button"
                    className="t-btn-sm mono"
                    onClick={triggerImport}
                    title="Carga una partida .json tuya o de un amigo"
                  >
                    Importar .json
                  </button>
                  <button
                    type="button"
                    className="t-btn-sm mono mgr-end-btn"
                    onClick={endCareer}
                    title="Termina esta carrera y muestra tu calificación final"
                  >
                    Terminar Carrera
                  </button>
                </div>
              </div>

              {!M.fired && !M.pendingBoardMeeting && (
  <div className="series-tabs" style={{ marginBottom: "12px" }}>
                  {tabs.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`series-tab ${activeTab === t.id ? "active" : ""}`}
                      onClick={() => setActiveTab(t.id)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}

              <NegotiationDrawer />
              {renderActiveTab()}
            </>
          )
        )}
      </section>

      <footer className="closing">
        <span>
          Proyecto de análisis y simulación sin fines de lucro. No afiliado a Riot Games ni a las
          organizaciones listadas.
        </span>
        <span className="mono">DB ACTUALIZADA: {DATA_UPDATED} · AUTOGUARDADO + SAVE .JSON</span>
      </footer>
    </main>
  );
}