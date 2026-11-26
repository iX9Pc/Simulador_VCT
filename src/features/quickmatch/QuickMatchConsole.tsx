import { useEffect } from "react";
import type { CSSProperties } from "react";
import { ALL_MAPS, getTeamOvr } from "../../core/index.ts";
import type { MapName, SeriesFormat } from "../../core/index.ts";
import { TeamLogo } from "../../components/TeamLogo.tsx";
import { BroadcastViewer } from "../broadcast/BroadcastViewer.tsx";
import { MatchPreview } from "../broadcast/MatchPreview.tsx";
import { applyTeamColorsForPair } from "../broadcast/stats.ts";
import { useDbStore } from "../../stores/useDbStore.ts";
import { useMatchStore } from "../../stores/useMatchStore.ts";
import { ShareBar } from "../social/ShareBar.tsx";
import { SharedResultCard } from "../social/SharedResultCard.tsx";

const FORMATS: readonly SeriesFormat[] = [1, 3, 5];

export function QuickMatchConsole() {
  const teams = useDbStore((s) => s.teams);
  const coaches = useDbStore((s) => s.coaches);
  const teamMeta = useDbStore((s) => s.teamMeta);
  const activeMapPool = useDbStore((s) => s.activeMapPool);
  const dataVersion = useDbStore((s) => s.dataVersion);

  const teamA = useMatchStore((s) => s.teamA);
  const teamB = useMatchStore((s) => s.teamB);
  const format = useMatchStore((s) => s.format);
  const mapChoice = useMatchStore((s) => s.mapChoice);
  const series = useMatchStore((s) => s.series);
  const contextLabel = useMatchStore((s) => s.contextLabel);
  const liveFinished = useMatchStore((s) => s.liveFinished);
  const liveMapIdx = useMatchStore((s) => s.liveMapIdx);
  const liveShown = useMatchStore((s) => s.liveShown);
  const revealedMaps = useMatchStore((s) => s.revealedMaps);
  const activeTab = useMatchStore((s) => s.activeTab);
  const isAutoPlaying = useMatchStore((s) => s.isAutoPlaying);
  const errorMsg = useMatchStore((s) => s.errorMsg);
  const monteCarlo = useMatchStore((s) => s.monteCarlo);

  const ensureValidSelection = useMatchStore((s) => s.ensureValidSelection);
  const setTeamA = useMatchStore((s) => s.setTeamA);
  const setTeamB = useMatchStore((s) => s.setTeamB);
  const swapTeams = useMatchStore((s) => s.swapTeams);
  const setFormat = useMatchStore((s) => s.setFormat);
  const setMapChoice = useMatchStore((s) => s.setMapChoice);
  const simulateFull = useMatchStore((s) => s.simulateFull);
  const stepRound = useMatchStore((s) => s.stepRound);
  const toggleAutoPlay = useMatchStore((s) => s.toggleAutoPlay);
  const selectTab = useMatchStore((s) => s.selectTab);
  const runMonteCarlo = useMatchStore((s) => s.runMonteCarlo);
  const stopLive = useMatchStore((s) => s.stopLive);

  // Al arrancar o al cambiar datos/DataPack: validar selección y simular primera serie sin grabar historial
  useEffect(() => {
    ensureValidSelection();
    if (!useMatchStore.getState().series) {
      simulateFull(false);
    }
  }, [dataVersion, ensureValidSelection, simulateFull]);

  // Limpiar intervalo al desmontar la página principal
  useEffect(() => () => stopLive(), [stopLive]);

  const teamNames = Object.keys(teams);
  const { colorA, colorB } = applyTeamColorsForPair(teamMeta, teamA, teamB);
  const metaA = teamMeta[teamA];
  const metaB = teamMeta[teamB];
  const coachA = coaches[teamA];
  const coachB = coaches[teamB];

  const mapDesc =
    mapChoice === "AUTO"
      ? "Protocolo VCT: 1v1 define Equipo A/B + Veto de 7 pasos (con sinergia de 30 agentes)"
      : ALL_MAPS[mapChoice].desc;

  return (
    <section id="sim">
      <div className="workspace-bar">
        <div>
          <h1>Simulador Táctico VCT 2027</h1>
          <p className="workspace-sub">
            Duelo 1v1, veto oficial de 7 pasos, draft inteligente de 30 agentes (5 ejes), economía
            ronda a ronda y Visor 2D con navmesh A*.
          </p>
        </div>
        <span className="mono" style={{ fontSize: "11px", color: "var(--mut)" }}>
          POOL ACTIVO ({activeMapPool.length}): {activeMapPool.join(" · ")}
        </span>
      </div>

      {/* CONTROL DECK */}
      <div className="control-deck">
        <div className="deck-grid">
          <div
            className="team-picker"
            style={{ "--team-color": colorA } as CSSProperties}
          >
            <div className="picker-logo-wrap">
              {teamA && <TeamLogo teamName={teamA} />}
            </div>
            <div className="picker-body">
              <div className="picker-top">
                <span className="picker-label mono ca">EQUIPO IZQUIERDO</span>
                {teamA && teams[teamA] && coachA && (
                  <div className="picker-meta">
                    <span>{metaA?.reg || "VCT"}</span> · <span>DT {coachA.n}</span>{" "}
                    <span className="ovr-pill">OVR {getTeamOvr(teams[teamA], coachA)}</span>
                  </div>
                )}
              </div>
              <select
                aria-label="Equipo A"
                value={teamA}
                onChange={(e) => setTeamA(e.target.value)}
              >
                {teamNames.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            className="swap-btn"
            title="Intercambiar equipos"
            onClick={swapTeams}
          >
            ⇄
          </button>

          <div
            className="team-picker"
            style={{ "--team-color": colorB } as CSSProperties}
          >
            <div className="picker-logo-wrap">
              {teamB && <TeamLogo teamName={teamB} />}
            </div>
            <div className="picker-body">
              <div className="picker-top">
                <span className="picker-label mono cb">EQUIPO DERECHO</span>
                {teamB && teams[teamB] && coachB && (
                  <div className="picker-meta">
                    <span>{metaB?.reg || "VCT"}</span> · <span>DT {coachB.n}</span>{" "}
                    <span className="ovr-pill">OVR {getTeamOvr(teams[teamB], coachB)}</span>
                  </div>
                )}
              </div>
              <select
                aria-label="Equipo B"
                value={teamB}
                onChange={(e) => setTeamB(e.target.value)}
              >
                {teamNames.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="tactical-bar">
          <div className="tac-group">
            <span className="tac-label">Formato</span>
            <div className="seg-group">
              {FORMATS.map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  className={`seg-btn mono ${format === fmt ? "active" : ""}`}
                  onClick={() => setFormat(fmt)}
                >
                  Bo{fmt}
                </button>
              ))}
            </div>

            <span className="tac-label">Mapa 1</span>
            <select
              className="map-select"
              aria-label="Selector de mapa"
              value={mapChoice}
              onChange={(e) => setMapChoice(e.target.value as MapName | "AUTO")}
            >
              <option value="AUTO">1v1 + Veto Oficial de Coaches (Auto)</option>
              {activeMapPool.map((m) => (
                <option key={m} value={m}>
                  Forzar Mapa 1: {m}
                </option>
              ))}
            </select>
          </div>

          <span className="map-mod-pill mono">{mapDesc}</span>
        </div>

        <div className="deck-actions">
          <div className="btn-group">
            <button type="button" className="p" onClick={() => simulateFull(true)}>
              Simular Serie
            </button>
            <button type="button" onClick={stepRound}>
              +1 Ronda
            </button>
            <button
              type="button"
              className={isAutoPlaying ? "live-active" : ""}
              onClick={toggleAutoPlay}
            >
              {isAutoPlaying ? "Pausar" : "Auto-Play"}
            </button>
          </div>

          <div className="btn-group">
            <button type="button" onClick={() => runMonteCarlo(500)}>
              Monte Carlo (500 Series)
            </button>
          </div>
        </div>
      </div>

      {/* BANNERS DE ESTADO / MONTE CARLO / SERIE OFICIAL */}
      <SharedResultCard />
      {errorMsg && (
        <div className="cal-card" style={{ borderColor: "var(--vct-red)" }}>
          <b style={{ color: "var(--vct-red)" }}>{errorMsg}</b>
        </div>
      )}

      {contextLabel && (
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
            <b>SERIE OFICIAL</b> · {contextLabel}
          </span>
          <a
            href="#torneo"
            className="nav-link mono"
            style={{ border: "1px solid var(--bd-hi)", fontSize: "11px", padding: "4px 9px" }}
          >
            Volver al Torneo
          </a>
        </div>
      )}

      {monteCarlo && (
        <div className="cal-card">
          <div className="cal-top">
            <span>
              <b>
                SIMULACIÓN MONTE CARLO ({monteCarlo.n} SERIES BO{monteCarlo.format})
              </b>{" "}
              · {monteCarlo.teamA} vs {monteCarlo.teamB}
            </span>
            <span className="mono">
              <b className="ca">
                {monteCarlo.teamA} {monteCarlo.pctA}%
              </b>{" "}
              —{" "}
              <b className="cb">
                {monteCarlo.pctB}% {monteCarlo.teamB}
              </b>
            </span>
          </div>
          <div className="cal-bar">
            <div className="cal-bar-a" style={{ width: `${monteCarlo.pctA}%` }} />
          </div>
          <div className="cal-meta">
            <span>
              Mapas/Serie: <b>{monteCarlo.avgMaps}</b>
            </span>
            <span>
              Rondas/Serie: <b>{monteCarlo.avgRounds}</b>
            </span>
            <span>
              Tasa Overtime: <b>{monteCarlo.otRate}%</b>
            </span>
          </div>
        </div>
      )}

    {/* VISOR BROADCAST COMPLETO */}
    {series && (
    <BroadcastViewer
    series={series}
    liveFinished={liveFinished}
    liveMapIdx={liveMapIdx}
    liveShown={liveShown}
    revealedMaps={revealedMaps}
    activeTab={activeTab}
    isAutoPlaying={isAutoPlaying}
    onSelectTab={selectTab}
    shareBar={<ShareBar series={series} />}
  />
)}

      {/* PREVIA DE SCOUTING CON RADARES SVG */}
      <MatchPreview teamA={teamA} teamB={teamB} format={format} />
    </section>
  );
}