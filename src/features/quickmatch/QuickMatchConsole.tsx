import { useEffect } from "react";
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

  useEffect(() => {
    ensureValidSelection();
    if (!useMatchStore.getState().series) {
      simulateFull(false);
    }
  }, [dataVersion, ensureValidSelection, simulateFull]);

  useEffect(() => () => stopLive(), [stopLive]);

  const teamNames = Object.keys(teams);
  const { colorA, colorB } = applyTeamColorsForPair(teamMeta, teamA, teamB);
  const metaA = teamMeta[teamA];
  const metaB = teamMeta[teamB];
  const coachA = coaches[teamA];
  const coachB = coaches[teamB];
  const ovrA = teamA && teams[teamA] && coachA ? getTeamOvr(teams[teamA], coachA) : null;
  const ovrB = teamB && teams[teamB] && coachB ? getTeamOvr(teams[teamB], coachB) : null;

  const mapDesc =
    mapChoice === "AUTO"
      ? "Protocolo VCT: 1v1 define Equipo A/B + Veto de 7 pasos (sinergia de 30 agentes)"
      : ALL_MAPS[mapChoice].desc;

  return (
    <section id="sim">
      <div className="workspace-bar">
        <div>
          <div className="ws-eyebrow mono">
            <span className="mgr-live-pip" aria-hidden="true" />
            <span>01 // MOTOR DE SIMULACIÓN COMPETITIVA VCT</span>
          </div>
          <h1>Simulador Táctico VCT 2027</h1>
          <p className="workspace-sub">
            Duelo 1v1, veto oficial de 7 pasos, draft de 30 agentes en 5 ejes, economía por ronda y
            Visor 2D con navmesh A*.
          </p>
        </div>

        <div className="ws-pool-box">
          <span className="ws-pool-label mono">MAP POOL ACTIVO ({activeMapPool.length})</span>
          <div className="ws-pool-strip mono">
            {activeMapPool.map((m) => (
              <span key={m} className="ws-pool-chip">
                {m}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* CONTROL DECK — CONSOLA UNIFICADA SIN CAJAS FLOTANTES */}
      <div className="control-deck console-shell">
        <div className="deck-grid">
          <div className="team-picker" style={{ borderTopColor: colorA }}>
            <div className="picker-logo-wrap">
              {teamA && <TeamLogo teamName={teamA} />}
            </div>
            <div className="picker-body">
              <div className="picker-top">
                <span className="picker-label mono ca">SIDE A · LOCAL</span>
                {teamA && coachA && (
                  <div className="picker-meta mono">
                    <span>{metaA?.reg || "VCT"}</span>
                    <span>·</span>
                    <span>DT {coachA.n}</span>
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
            {ovrA && (
              <div className="picker-ovr-big">
                <small className="mono">OVR</small>
                <b>{ovrA}</b>
              </div>
            )}
          </div>

          <button
            type="button"
            className="swap-btn"
            title="Intercambiar equipos"
            onClick={swapTeams}
          >
            ⇄
          </button>

          <div className="team-picker" style={{ borderTopColor: colorB }}>
            <div className="picker-logo-wrap">
              {teamB && <TeamLogo teamName={teamB} />}
            </div>
            <div className="picker-body">
              <div className="picker-top">
                <span className="picker-label mono cb">SIDE B · VISITANTE</span>
                {teamB && coachB && (
                  <div className="picker-meta mono">
                    <span>{metaB?.reg || "VCT"}</span>
                    <span>·</span>
                    <span>DT {coachB.n}</span>
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
            {ovrB && (
              <div className="picker-ovr-big">
                <small className="mono">OVR</small>
                <b>{ovrB}</b>
              </div>
            )}
          </div>
        </div>

        <div className="tactical-bar">
          <div className="tac-group">
            <span className="tac-label">FORMATO</span>
            <div className="seg-group">
              {FORMATS.map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  className={`seg-btn mono ${format === fmt ? "active" : ""}`}
                  onClick={() => setFormat(fmt)}
                >
                  BO{fmt}
                </button>
              ))}
            </div>

            <span className="tac-label">MAPA 1</span>
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
            <button type="button" className="mono" onClick={stepRound}>
              +1 Ronda
            </button>
            <button
              type="button"
              className={`mono ${isAutoPlaying ? "live-active" : ""}`}
              onClick={toggleAutoPlay}
            >
              {isAutoPlaying ? "Pausar Vivo" : "Auto-Play"}
            </button>
          </div>

          <div className="btn-group">
            <button type="button" className="mono" onClick={() => runMonteCarlo(500)}>
              Monte Carlo · 500 Series
            </button>
          </div>
        </div>
      </div>

      {/* BANNERS DE ESTADO / MONTE CARLO / SERIE OFICIAL */}
      <SharedResultCard />
      {errorMsg && (
        <div className="cal-card" style={{ borderColor: "var(--vct-red)" }}>
          <b className="mono" style={{ color: "var(--vct-red)", fontSize: "12px" }}>
            {errorMsg}
          </b>
        </div>
      )}

      {contextLabel && (
        <div className="cal-card cal-context-bar">
          <span className="mono" style={{ fontSize: "11.5px" }}>
            <span className="mgr-live-pip" style={{ marginRight: "7px" }} aria-hidden="true" />
            <b>SERIE OFICIAL</b> · {contextLabel}
          </span>
          <a href="#torneo" className="t-btn-sm mono" style={{ textDecoration: "none" }}>
            Volver al Torneo
          </a>
        </div>
      )}

      {monteCarlo && (
        <div className="cal-card">
          <div className="cal-top">
            <span className="mono" style={{ fontSize: "11px", letterSpacing: "0.05em" }}>
              <b>MONTE CARLO · {monteCarlo.n} SERIES BO{monteCarlo.format}</b> · {monteCarlo.teamA}{" "}
              vs {monteCarlo.teamB}
            </span>
            <span className="mc-pct-row mono">
              <b className="ca">
                {monteCarlo.teamA} {monteCarlo.pctA}%
              </b>
              <span style={{ color: "var(--dim)" }}>/</span>
              <b className="cb">
                {monteCarlo.pctB}% {monteCarlo.teamB}
              </b>
            </span>
          </div>
          <div className="cal-bar">
            <div className="cal-bar-a" style={{ width: `${monteCarlo.pctA}%` }} />
          </div>
          <div className="mc-stats-grid mono">
            <div>
              <small>MAPAS / SERIE</small>
              <b>{monteCarlo.avgMaps}</b>
            </div>
            <div>
              <small>RONDAS / SERIE</small>
              <b>{monteCarlo.avgRounds}</b>
            </div>
            <div>
              <small>TASA OVERTIME</small>
              <b>{monteCarlo.otRate}%</b>
            </div>
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