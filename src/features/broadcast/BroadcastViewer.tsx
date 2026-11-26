import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type {
  HighlightEvent,
  MatchTeamState,
  RoundResult,
  SeriesResult,
  TeamCompDraft
} from "../../core/index.ts";
import { RoleIcon } from "../../components/RoleIcon.tsx";
import { TeamLogo } from "../../components/TeamLogo.tsx";
import { useDbStore } from "../../stores/useDbStore.ts";
import { Radar2DCanvas } from "./Radar2DCanvas.tsx";
import { StorySummary } from "./StorySummary.tsx";
import {
  computeSeriesStats,
  computeStatsForMatch,
  getHalfSplits,
  getLiveSeriesWins
} from "./stats.ts";

interface BroadcastViewerProps {
  series: SeriesResult;
  liveFinished: boolean;
  liveMapIdx: number;
  liveShown: number;
  revealedMaps: number;
  activeTab: number | "SERIES";
  isAutoPlaying: boolean;
  onSelectTab: (tab: number | "SERIES") => void;
  shareBar?: ReactNode;
}

const HL_LABELS: Record<HighlightEvent["t"], string> = {
  ace: "ACE / CLUTCH ÉLITE",
  cl: "CLUTCH 1vX",
  mk: "MULTIKILL",
  up: "THRIFTY / ECO",
  to: "TIMEOUT TÁCTICO"
};

function AxisBadges({ comp }: { comp: TeamCompDraft }) {
  const axes: Array<[string, number]> = [
    ["MAC", comp.bonuses.macro],
    ["UTI", comp.bonuses.util],
    ["ENT", comp.bonuses.entrada],
    ["DEF", comp.bonuses.defensa],
    ["FLX", comp.bonuses.flex]
  ];

  return (
    <div className="comp-axes mono">
      {axes.map(([lab, val]) => {
        const pct = (val * 100).toFixed(1);
        const cls = val > 0.004 ? "kd-pos" : val < -0.004 ? "kd-neg" : "";
        const sign = val > 0 ? "+" : "";
        return (
          <span
            key={lab}
            className={`axis-pill ${cls}`}
            style={!cls ? { color: "var(--mut)" } : undefined}
          >
            {lab} {sign}
            {pct}%
          </span>
        );
      })}
    </div>
  );
}

function CompSideCard({
  team,
  comp,
  colorCls,
  dotVar
}: {
  team: MatchTeamState;
  comp: TeamCompDraft;
  colorCls: "ca" | "cb";
  dotVar: "--a" | "--b";
}) {
  const warnSet = new Set(comp.warnings);
  const scoreCls = comp.compScore >= 94 ? "stat-elite" : comp.compScore >= 88 ? "kd-pos" : "";

  return (
    <div className="comp-side">
      <div className="comp-head">
        <div className="comp-title-row">
          <span className="team-dot" style={{ background: `var(${dotVar})` }} />
          <b className={`comp-team-name ${colorCls}`}>{team.name}</b>
        </div>
        <span className={`mono comp-fit ${scoreCls}`}>
          COMP <b>{comp.compScore}</b>
        </span>
      </div>

      {comp.tags.length > 0 && (
        <div className="comp-tags mono">
          {comp.tags.map((tag, i) => {
            const isWarn =
              warnSet.has(tag) || tag.startsWith("Sin ") || tag.includes("débil");
            const isEq =
              tag.includes("EQ") ||
              tag.includes("Combo") ||
              tag.includes("Sinergia") ||
              tag.includes("Doble Controller");
            const cls = isWarn ? "is-warn" : isEq ? "is-syn" : "";
            return (
              <span key={`${tag}-${i}`} className={`comp-tag-pill ${cls}`}>
                {tag}
              </span>
            );
          })}
        </div>
      )}

      <div className="comp-chips">
        {comp.assignments.map((a) => {
          const hiCls = a.isOpBoost ? "is-op" : a.hushMastery >= 0.9 ? "is-hush" : "";
          return (
            <div
              key={`${a.playerName}-${a.agent}`}
              className={`agent-chip ${hiCls}`}
              title={`${a.playerName} · ${a.agent} (${a.role}) · Fit Mapa ${a.mapFit}`}
            >
              <div className="chip-top">
                <RoleIcon roleStr={a.role} />
                <span className="chip-ag">{a.agent}</span>
                {a.isOpBoost ? (
                  <em className="chip-mark is-op">OP</em>
                ) : a.hushMastery >= 0.9 ? (
                  <em className="chip-mark is-hush">M</em>
                ) : null}
              </div>
              <span className="chip-pl mono">{a.playerName}</span>
            </div>
          );
        })}
      </div>

      <AxisBadges comp={comp} />
    </div>
  );
}

export function BroadcastViewer({
  series,
  liveFinished,
  liveMapIdx,
  liveShown,
  revealedMaps,
  activeTab,
  isAutoPlaying,
  onSelectTab,
  shareBar
}: BroadcastViewerProps) {
  const teamMeta = useDbStore((s) => s.teamMeta);
  const [jumpSignal, setJumpSignal] = useState<{ roundNum: number; seq: number } | null>(null);
  const [expandedRound, setExpandedRound] = useState<number | null>(null);

  const isSeriesSummary = series.format > 1 && activeTab === "SERIES";
  const currentMapIdx = isSeriesSummary
    ? series.maps.length - 1
    : typeof activeTab === "number"
      ? Math.min(activeTab, series.maps.length - 1)
      : 0;
  const M = series.maps[currentMapIdx];

  const isViewedMapFinished =
    liveFinished ||
    currentMapIdx < liveMapIdx ||
    (currentMapIdx === liveMapIdx && liveShown >= M.rounds.length);
  const maxR =
    isSeriesSummary || isViewedMapFinished
      ? M.rounds.length
      : Math.min(liveShown, M.rounds.length);

  const S = useMemo(
    () =>
      isSeriesSummary
        ? computeSeriesStats(series, revealedMaps, liveFinished)
        : computeStatsForMatch(M, maxR),
    [isSeriesSummary, series, revealedMaps, liveFinished, M, maxR]
  );

  // Al cambiar de mapa o avanzar de ronda, expandir la última ronda jugada
  useEffect(() => {
    if (maxR > 0) setExpandedRound(M.rounds[maxR - 1]?.n ?? null);
  }, [M, maxR]);

  const handleJumpToRound = useCallback((rn: number) => {
    setExpandedRound(rn);
    setJumpSignal((prev) => ({ roundNum: rn, seq: (prev?.seq ?? 0) + 1 }));
    window.requestAnimationFrame(() => {
      const el = document.getElementById(`round-det-${rn}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, []);

  if (!M) return null;

  const R = M.rounds;
  const cur: [number, number] = isSeriesSummary
    ? series.seriesScore
    : maxR
      ? R[maxR - 1].score
      : [0, 0];
  const done = isSeriesSummary ? true : isViewedMapFinished;
  const w: 0 | 1 = cur[0] > cur[1] ? 0 : 1;
  const t0 = M.teams[0];
  const t1 = M.teams[1];
  const liveWins = getLiveSeriesWins(series, liveMapIdx, liveShown, liveFinished);
  const nm = (id: string) => S[id]?.u.p.n ?? id;

  const mvp = done
    ? Object.values(S)
        .filter((s) => s.ti === w)
        .sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating))[0] ?? null
    : null;

  const mapHeaderLabel = isSeriesSummary
    ? `GLOBAL BO${series.format} · ${series.maps
        .map((m) => `${m.mapName} ${m.sc[0]}-${m.sc[1]}`)
        .join(" / ")}`
    : `MAPA ${currentMapIdx + 1}/${series.maps.length}: ${M.mapName.toUpperCase()} (PICK: ${
        M.pickedBy
      }) · SERIE [${liveWins[0]}-${liveWins[1]}] · ${
        done ? `FINAL (${R.length} RND)` : `VIVO R${maxR}/${R.length}`
      }`;

  const splitSubtitle = isSeriesSummary
    ? `TOTAL RONDAS: ${series.maps.reduce((acc, m) => acc + m.rounds.length, 0)} (${
        series.maps.length
      } MAPAS)`
    : getHalfSplits(M, maxR);

  const slicedR = R.slice(0, maxR);
  const h1R = slicedR.filter((x) => x.n <= 12);
  const h2R = slicedR.filter((x) => x.n >= 13 && x.n <= 24);
  const otR = slicedR.filter((x) => x.n > 24);

  const h1Sides = M.leftStartsAtk
    ? `${t0.name} ATK / ${t1.name} DEF`
    : `${t0.name} DEF / ${t1.name} ATK`;
  const h2Sides = M.leftStartsAtk
    ? `${t0.name} DEF / ${t1.name} ATK`
    : `${t0.name} ATK / ${t1.name} DEF`;

  const renderPipList = (arr: RoundResult[]) =>
    arr.map((x) => {
      const isSpecial =
        Boolean(x.cl && x.cl.won && x.cl.x >= 2) || x.hl.some((hItem) => hItem.t === "ace");
      const hasTo = x.timeouts.length > 0;
      return (
        <div
          key={x.n}
          className={`strip-pip ${x.win ? "sb" : "sa"}${isSpecial ? " st" : ""}`}
          onClick={() => handleJumpToRound(x.n)}
          title={`R${x.n} (${x.econ[0]} vs ${x.econ[1]}) · Gana ${M.teams[x.win].name}${
            hasTo ? " · Pausa Táctica" : ""
          }`}
        >
          <span>{x.n}</span>
          {hasTo && <span className="pip-to" />}
        </div>
      );
    });

  const highlights: Array<HighlightEvent & { mapTag: string }> = [];
  if (isSeriesSummary) {
    series.maps.forEach((mObj, mIdx) => {
      mObj.rounds.forEach((rObj) => {
        rObj.hl.forEach((x) =>
          highlights.push({ ...x, mapTag: `M${mIdx + 1} (${mObj.mapName}) · R${x.r}` })
        );
      });
    });
  } else {
    for (let r = 0; r < maxR; r++) {
      R[r].hl.forEach((x) =>
        highlights.push({ ...x, mapTag: `M${currentMapIdx + 1} · R${x.r}` })
      );
    }
  }

  return (
    <div id="out">
      {done && (
        <StorySummary
          series={series}
          match={M}
          stats={S}
          isSeriesSummary={isSeriesSummary}
          onJumpToRound={handleJumpToRound}
        />
      )}

      {done && shareBar}

      {series.vetoData && (
        <div className="veto-panel">
          <div className="duel-banner">
            <div className="duel-left">
              <span className="duel-badge">1V1 APERTURA</span>
              <span>
                DT <b>{t0.coach.n}</b> asigna a{" "}
                <b className="ca">{series.vetoData.duel.repLeft.n}</b>{" "}
                <small style={{ color: "var(--mut)" }}>
                  ({series.vetoData.duel.reasonLeft})
                </small>{" "}
                vs DT <b>{t1.coach.n}</b> asigna a{" "}
                <b className="cb">{series.vetoData.duel.repRight.n}</b>{" "}
                <small style={{ color: "var(--mut)" }}>
                  ({series.vetoData.duel.reasonRight})
                </small>
              </span>
            </div>
            <div className="duel-outcome">
              Victoria: <b>{series.vetoData.duel.winnerPlayer.n}</b> (
              {series.vetoData.duel.score1v1[0]}-{series.vetoData.duel.score1v1[1]}) ·{" "}
              <b>{series.vetoData.duel.winnerTeamName}</b> toma{" "}
              <b>{series.vetoData.duel.chosenRole}</b> (A: {series.vetoData.duel.teamA.name} / B:{" "}
              {series.vetoData.duel.teamB.name})
            </div>
          </div>

          <div className="veto-steps-grid">
            {series.vetoData.steps.map((st) => (
              <div key={st.step} className={`veto-step-card is-${st.type}`}>
                <div className="v-step-top">
                  <span>{st.actor}</span>
                  <span className="v-tag">
                    {st.type === "ban" ? "BAN" : st.type === "decider" ? "DEC" : "PICK"}
                  </span>
                </div>
                <div className="v-step-map">{st.mapName}</div>
                <div className="v-step-sub">{st.detail}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {series.format > 1 && (
        <div className="series-tabs">
          <button
            type="button"
            className={`series-tab ${isSeriesSummary ? "active" : ""} ${
              !liveFinished ? "unplayed" : ""
            }`}
            onClick={() => onSelectTab("SERIES")}
            title={
              liveFinished
                ? "Estadísticas globales de la serie"
                : "Disponible al concluir la serie"
            }
          >
            GLOBAL SERIE BO{series.format} [{liveWins[0]}-{liveWins[1]}]
          </button>

          {series.maps.map((mObj, idx) => {
            const isRevealed = liveFinished || idx <= liveMapIdx;
            const isFinishedMap =
              liveFinished ||
              idx < liveMapIdx ||
              (idx === liveMapIdx && liveShown >= mObj.rounds.length);
            const mw = !isFinishedMap
              ? "var(--mut)"
              : mObj.sc[0] > mObj.sc[1]
                ? "var(--a)"
                : "var(--b)";

            let scoreLabel = "PENDIENTE";
            if (isFinishedMap) {
              scoreLabel = `${mObj.sc[0]}-${mObj.sc[1]}`;
            } else if (isRevealed) {
              const liveR = Math.min(liveShown, mObj.rounds.length);
              scoreLabel =
                liveR > 0
                  ? `${mObj.rounds[liveR - 1].score[0]}-${mObj.rounds[liveR - 1].score[1]} · R${liveR}`
                  : "0-0";
            }

            return (
              <button
                key={`${mObj.mapName}-${idx}`}
                type="button"
                className={`series-tab ${activeTab === idx ? "active" : ""} ${
                  !isRevealed ? "unplayed" : ""
                }`}
                onClick={() => onSelectTab(idx)}
              >
                <span className="map-win-dot" style={{ background: mw }} />M{idx + 1} ·{" "}
                {mObj.mapName.toUpperCase()} ({scoreLabel})
              </button>
            );
          })}
        </div>
      )}

      {/* SCOREBOARD HUD */}
      <div className="score">
        <div className="score-side">
          <div className="score-logo">
            <TeamLogo teamName={t0.name} />
          </div>
          <div className="score-team">
            <span className="region-tag">{teamMeta[t0.name]?.reg || "VCT"}</span>
            <div className="t ca">{t0.name}</div>
            <div className="score-coach">
              <span>
                DT <b>{t0.coach.n}</b>
              </span>
              <span className="mono">
                MAC {t0.coach.macro} · ADP {t0.coach.adapt}
              </span>
            </div>
          </div>
        </div>

        <div className="score-center">
          <span className="map-pill-top">{mapHeaderLabel}</span>
          <div className="n">
            <span className="ca">{cur[0]}</span>{" "}
            <span style={{ color: "var(--dim)" }}>:</span>{" "}
            <span className="cb">{cur[1]}</span>
          </div>
          <div className="half-splits">{splitSubtitle}</div>
        </div>

        <div className="score-side right">
          <div className="score-logo">
            <TeamLogo teamName={t1.name} />
          </div>
          <div className="score-team">
            <span className="region-tag">{teamMeta[t1.name]?.reg || "VCT"}</span>
            <div className="t cb">{t1.name}</div>
            <div className="score-coach">
              <span className="mono">
                MAC {t1.coach.macro} · ADP {t1.coach.adapt}
              </span>
              <span>
                DT <b>{t1.coach.n}</b>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* BARRA DE COMPOSICIONES */}
      {!isSeriesSummary && M.comps && (
        <div className="comp-bar">
          <CompSideCard team={t0} comp={M.comps[0]} colorCls="ca" dotVar="--a" />
          <CompSideCard team={t1} comp={M.comps[1]} colorCls="cb" dotVar="--b" />
        </div>
      )}

      {/* TIMELINE INTERACTIVO DE RONDAS */}
      {!isSeriesSummary && (
        <div className="timeline-wrap">
          <div className="timeline-header">
            <span>
              Secuencia de Rondas ({M.mapName}) — Selecciona una ronda para inspeccionar duelos
            </span>
            <span>Contorno Oro = Clutch 1v2+ / Ace · Punto Púrpura = Timeout</span>
          </div>

          <div className="timeline-halves">
            <div className="half-block">
              <span className="half-title">1ª Mitad (R1–R12 · {h1Sides})</span>
              <div className="strip">{renderPipList(h1R)}</div>
            </div>

            {h2R.length > 0 && (
              <div className="half-block">
                <span className="half-title">2ª Mitad (R13–R24 · {h2Sides})</span>
                <div className="strip">{renderPipList(h2R)}</div>
              </div>
            )}

            {otR.length > 0 && (
              <div className="half-block">
                <span className="half-title">Overtime (R25+)</span>
                <div className="strip">{renderPipList(otR)}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TELEMETRÍA EN 2 COLUMNAS */}
      <div className="grid">
        <div>
          {([0, 1] as const).map((ti) => {
            const teamState = M.teams[ti];
            const dotColor = ti ? "var(--b)" : "var(--a)";
            const rows = Object.values(S)
              .filter((s) => s.ti === ti)
              .sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));

            return (
              <div className="box" key={ti}>
                <div className="box-head">
                  <div className="box-title-wrap">
                    <span className="team-dot" style={{ background: dotColor }} />
                    <TeamLogo teamName={teamState.name} className="mini-team-logo" />
                    <h2 className={ti ? "cb" : "ca"}>{teamState.name}</h2>
                  </div>
                  <span className="mono" style={{ fontSize: "11px", color: "var(--mut)" }}>
                    DT {teamState.coach.n} · DISC {teamState.coach.disc}
                  </span>
                </div>

                <div className="sc">
                  <table>
                    <thead>
                      <tr>
                        <th>Jugador</th>
                        <th style={{ textAlign: "left" }}>Agente</th>
                        <th title="VLR Rating 2.0">R 2.0</th>
                        <th title="Average Combat Score">ACS</th>
                        <th>K</th>
                        <th>D</th>
                        <th>A</th>
                        <th>+/-</th>
                        <th title="Kill, Assist, Survived, Traded %">KAST</th>
                        <th>FB</th>
                        <th>CL</th>
                        {done && <th>FORMA</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((s) => {
                        const f = s.u.form;
                        const fDeltaNum = f * 100 - 100;
                        const fDelta = fDeltaNum.toFixed(1);
                        const fCls = f > 1.03 ? "kd-pos" : f < 0.97 ? "kd-neg" : "";
                        const diff = s.k - s.d;
                        const diffCls = diff > 0 ? "kd-pos" : diff < 0 ? "kd-neg" : "";
                        const ratVal = parseFloat(s.rating);
                        const ratCls =
                          ratVal >= 1.18 ? "rat-elite" : ratVal >= 1.02 ? "rat-good" : "";
                        const acsColor =
                          s.acs >= 245 ? "var(--gold)" : s.acs >= 195 ? "var(--ok)" : "var(--mut)";
                        const isIGL = s.u.p.r.includes("IGL") || s.u.p.igl >= 85;
                        const tagCls = s.u.isOpBoost
                          ? "is-op"
                          : s.u.hushMastery >= 0.9
                            ? "is-hush"
                            : "";
                        const suffix = s.u.isOpBoost
                          ? " [OP]"
                          : s.u.hushMastery >= 0.9
                            ? " [M]"
                            : "";

                        return (
                          <tr key={s.u.p.n}>
                            <td>
                              <div className="pl">
                                <span className="av">{s.u.p.n.slice(0, 2).toUpperCase()}</span>
                                <span>
                                  <b>
                                    {s.u.p.n}
                                    {isIGL && <span className="igl-tag">IGL</span>}
                                    {s === mvp && <em className="badge">MVP</em>}
                                  </b>
                                  <small>
                                    <RoleIcon roleStr={s.u.p.r} /> {s.u.p.r}
                                  </small>
                                </span>
                              </div>
                            </td>
                            <td style={{ textAlign: "left" }}>
                              {isSeriesSummary ? (
                                <span className="agent-tag mono">
                                  {(s.agents.length ? s.agents : [s.u.agent]).join(" / ")}
                                </span>
                              ) : (
                                <span className={`agent-tag mono ${tagCls}`}>
                                  <RoleIcon roleStr={s.u.agentRole || s.u.p.r} /> {s.u.agent}
                                  {suffix}
                                </span>
                              )}
                            </td>
                            <td
                              className={`mono ${ratCls}`}
                              style={!ratCls ? { color: "var(--mut)" } : undefined}
                            >
                              {s.rating}
                            </td>
                            <td className="mono">
                              <div className="acs-cell">
                                <b>{s.acs}</b>
                                <div className="acs-bar-track">
                                  <div
                                    className="acs-bar-fill"
                                    style={{
                                      width: `${Math.min(100, s.acs / 3.4)}%`,
                                      background: acsColor
                                    }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="mono">
                              <b>{s.k}</b>
                            </td>
                            <td className="mono">{s.d}</td>
                            <td className="mono">{s.a}</td>
                            <td
                              className={`mono ${diffCls}`}
                              style={!diffCls ? { color: "var(--mut)" } : undefined}
                            >
                              {diff > 0 ? `+${diff}` : diff}
                            </td>
                            <td className="mono">{s.kast}%</td>
                            <td className="mono">{s.fb}</td>
                            <td className="mono">{s.cl}</td>
                            {done && (
                              <td
                                className={`mono ${fCls}`}
                                style={!fCls ? { color: "var(--mut)" } : undefined}
                              >
                                {fDeltaNum > 0 ? `+${fDelta}` : fDelta}%
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>

        <div>
          {!isSeriesSummary && maxR > 0 && (
            <Radar2DCanvas
              match={M}
              maxR={maxR}
              isAutoPlaying={isAutoPlaying}
              jumpSignal={jumpSignal}
            />
          )}

          {/* REGISTRO DE JUGADAS CLAVE */}
          <div className="box">
            <div className="box-head">
              <h2>Registro de Jugadas Clave</h2>
              <span className="mono" style={{ fontSize: "11px", color: "var(--mut)" }}>
                {highlights.length} EVENTOS
              </span>
            </div>
            <div className="hl-scroll">
              {highlights.length > 0 ? (
                highlights
                  .slice()
                  .reverse()
                  .map((x, idx) => (
                    <div key={`${x.mapTag}-${idx}`} className={`hl ${x.t}`}>
                      <div className="hl-head">
                        <span className="hl-tag">{HL_LABELS[x.t] || "EVENTO"}</span>
                        <span className="mono" style={{ fontSize: "10.5px", color: "var(--mut)" }}>
                          {x.mapTag}
                        </span>
                      </div>
                      <div>{x.x}</div>
                    </div>
                  ))
              ) : (
                <span style={{ color: "var(--mut)" }}>
                  Sin eventos críticos registrados en este tramo.
                </span>
              )}
            </div>
          </div>

          {/* LOG DE RONDAS */}
          <div className="box">
            <div className="box-head">
              <h2>Log de Rondas ({M.mapName})</h2>
              <span className="mono" style={{ fontSize: "11px", color: "var(--mut)" }}>
                {maxR} / {R.length} RND
              </span>
            </div>
            <div className="rounds-scroll">
              {slicedR
                .slice()
                .reverse()
                .map((x) => {
                  const winClass = x.win ? "cb" : "ca";
                  const hasTo = x.timeouts.length > 0;
                  return (
                    <details
                      key={x.n}
                      className="round-item"
                      id={`round-det-${x.n}`}
                      open={expandedRound === x.n}
                      onToggle={(e) => {
                        const isOpen = (e.currentTarget as HTMLDetailsElement).open;
                        if (isOpen) setExpandedRound(x.n);
                        else if (expandedRound === x.n) setExpandedRound(null);
                      }}
                    >
                      <summary className="round-sum">
                        <span>
                          <b className="mono">R{x.n}</b>{" "}
                          <span className="mono" style={{ color: "var(--mut)" }}>
                            [{x.before[0]}-{x.before[1]}]
                          </span>{" "}
                          · <b className={winClass}>{M.teams[x.win].name}</b>
                          {hasTo && (
                            <span className="k-tag k-to" style={{ marginLeft: "6px" }}>
                              TIMEOUT
                            </span>
                          )}
                        </span>
                        <span className="econ-pill">
                          {x.econ[0]} vs {x.econ[1]}
                        </span>
                      </summary>
                      <div className="kill-list">
                        {hasTo &&
                          x.timeouts.map((to, idx) => (
                            <div key={idx} className="kill-row">
                              <span className="k-tag k-to">PAUSA</span> <b>DT {to.coach}</b> (
                              {to.team})
                            </div>
                          ))}
                        {x.ev.map((e, idx) => {
                          const kTeam = e.k.startsWith("0") ? "ca" : "cb";
                          const vTeam = e.v.startsWith("0") ? "ca" : "cb";
                          return (
                            <div key={idx} className="kill-row">
                              <b className={kTeam}>{nm(e.k)}</b>
                              <span>→</span>
                              <span className={vTeam}>{nm(e.v)}</span>
                              {e.fb && <span className="k-tag k-fb">FB</span>}
                              {e.tr && <span className="k-tag k-tr">TR</span>}
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}