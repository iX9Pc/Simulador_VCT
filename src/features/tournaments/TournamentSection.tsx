import { useEffect, useMemo, useRef, useState } from "react";
import { getTeamOvr } from "../../core/index.ts";
import { RoleIcon } from "../../components/RoleIcon.tsx";
import { TeamLogo } from "../../components/TeamLogo.tsx";
import { useDbStore } from "../../stores/useDbStore.ts";
import { useMatchStore } from "../../stores/useMatchStore.ts";
import { useSocialStore } from "../../stores/useSocialStore.ts";
import {
  TOURNAMENT_PRESETS,
  computeGroupStandings,
  computeTournamentPlayers,
  createTournament,
  defaultSelectionForPreset,
  getAllTeamsSortedByOvr,
  simulateCurrentRound,
  simulateEntireTournament,
  simulateNextMatch,
  simulateTournamentMatchById
} from "./tournamentEngine.ts";
import type {
  TournamentDataCtx,
  TournamentMatch,
  TournamentPresetId,
  TournamentState
} from "./tournamentEngine.ts";

type TournamentSubTab = "groups" | "schedule" | "bracket" | "stats" | "news";

export function TournamentSection() {
  const teams = useDbStore((s) => s.teams);
  const coaches = useDbStore((s) => s.coaches);
  const teamMeta = useDbStore((s) => s.teamMeta);
  const activeMapPool = useDbStore((s) => s.activeMapPool);
  const activePackMeta = useDbStore((s) => s.activePackMeta);

  const getPersistentFormBonus = useSocialStore((s) => s.getPersistentFormBonus);

  const ctx = useMemo<TournamentDataCtx>(
    () => ({ teams, coaches, teamMeta, activeMapPool, getPersistentFormBonus }),
    [teams, coaches, teamMeta, activeMapPool, getPersistentFormBonus]
  );

  const [setupPreset, setSetupPreset] = useState<TournamentPresetId>("masters16");
  const [selectedTeams, setSelectedTeams] = useState<string[]>(() =>
    defaultSelectionForPreset("masters16", {
      teams: useDbStore.getState().teams,
      coaches: useDbStore.getState().coaches,
      teamMeta: useDbStore.getState().teamMeta,
      activeMapPool: useDbStore.getState().activeMapPool
    })
  );
  const [T, setT] = useState<TournamentState>(() =>
    createTournament(
      "masters16",
      {
        teams: useDbStore.getState().teams,
        coaches: useDbStore.getState().coaches,
        teamMeta: useDbStore.getState().teamMeta,
        activeMapPool: useDbStore.getState().activeMapPool
      },
      null,
      false
    )
  );
  const [activeSubTab, setActiveSubTab] = useState<TournamentSubTab>("groups");
  const [showSetupPicker, setShowSetupPicker] = useState(false);
  const [trackedFriends, setTrackedFriends] = useState<Set<string>>(
    () => new Set(["Sentinels", "FUT Esports"])
  );

  // Al cambiar de DataPack, reiniciar el preset ajustado al número de equipos disponibles
  const packKeyRef = useRef(activePackMeta?.name ?? "__official__");
  useEffect(() => {
    const nextKey = activePackMeta?.name ?? "__official__";
    if (packKeyRef.current === nextKey) return;
    packKeyRef.current = nextKey;
    const cnt = Object.keys(teams).length;
    const nextPreset: TournamentPresetId =
      cnt >= 16 ? "masters16" : cnt >= 8 ? "masters8" : "americas6";
    const defSel = defaultSelectionForPreset(nextPreset, ctx);
    setSetupPreset(nextPreset);
    setSelectedTeams(defSel);
    setT(createTournament(nextPreset, ctx, defSel, false));
    setActiveSubTab("groups");
  }, [activePackMeta, teams, ctx]);

  const handleSelectPreset = (presetId: TournamentPresetId) => {
    const defSel = defaultSelectionForPreset(presetId, ctx);
    setSetupPreset(presetId);
    setSelectedTeams(defSel);
    setT(createTournament(presetId, ctx, defSel, false));
    setActiveSubTab("groups");
  };

  const handleToggleTeamInSetup = (teamName: string) => {
    const cfg = TOURNAMENT_PRESETS[setupPreset];
    setSelectedTeams((prev) => {
      if (prev.includes(teamName)) return prev.filter((x) => x !== teamName);
      if (prev.length < cfg.size) return [...prev, teamName];
      return prev;
    });
  };

  const handleToggleFriend = (teamName: string) => {
    setTrackedFriends((prev) => {
      const next = new Set(prev);
      if (next.has(teamName)) next.delete(teamName);
      else next.add(teamName);
      return next;
    });
  };

  const handleStartCustom = (randomize: boolean) => {
    const cfg = TOURNAMENT_PRESETS[setupPreset];
    if (selectedTeams.length !== cfg.size) return;
    setShowSetupPicker(false);
    setActiveSubTab("groups");
    setT(createTournament(setupPreset, ctx, selectedTeams, randomize));
  };

  const handleSimMatch = (matchId: string) => {
    const { next } = simulateTournamentMatchById(T, matchId, ctx);
    setT(next);
  };

  const handleWatchMatch = (matchId: string, autoPlay: boolean) => {
    const { next, match } = simulateTournamentMatchById(T, matchId, ctx);
    setT(next);
    if (!match || !match.teamA || !match.teamB || !match.series) return;
    useMatchStore
      .getState()
      .loadExternalSeries(
        match.teamA,
        match.teamB,
        match.series,
        autoPlay,
        `${next.cfg.name} · ${match.label} (Bo${match.fmt})`
      );
    document.getElementById("out")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSimNext = () => {
    const { next, enteredPlayoffs } = simulateNextMatch(T, ctx);
    setT(next);
    if (enteredPlayoffs && activeSubTab === "groups") setActiveSubTab("bracket");
  };

  const handleSimRound = () => {
    const { next, switchToBracket } = simulateCurrentRound(T, ctx);
    setT(next);
    if (switchToBracket) setActiveSubTab("bracket");
  };

  const handleSimAll = () => {
    setT(simulateEntireTournament(T, ctx));
    setActiveSubTab("bracket");
  };

  const players = useMemo(() => computeTournamentPlayers(T), [T]);
  const allTeamsSorted = useMemo(() => getAllTeamsSortedByOvr(ctx), [ctx]);

  const totalMatches = T.groupMatches.length + T.playoffs.length;
  const playedMatches =
    T.groupMatches.filter((m) => m.played).length + T.playoffs.filter((m) => m.played).length;
  const allDone = Boolean(T.champion);

  const champMvp = T.champion
    ? players.find((p) => p.team === T.champion) || players[0] || null
    : null;

  const phaseStatus = T.champion
    ? "TORNEO FINALIZADO"
    : T.playoffsSeeded
      ? "PLAYOFFS EN CURSO (BO3 / FINAL BO5)"
      : "FASE DE GRUPOS (ROUND-ROBIN BO3)";

  const latestNews = T.news[0] || null;
  const maxGroupRound = T.groupMatches.length
    ? Math.max(...T.groupMatches.map((m) => m.roundNum ?? 1))
    : 1;

  const renderMatchRow = (m: TournamentMatch) => {
    const isFriend = Boolean(
      (m.teamA && trackedFriends.has(m.teamA)) || (m.teamB && trackedFriends.has(m.teamB))
    );
    const ready = Boolean(m.teamA && m.teamB);

    return (
      <div key={m.id} className={`t-match-row ${isFriend ? "t-friend-border" : ""}`}>
        <div className="t-m-meta mono">
          <span>{m.label}</span>
          <span className="t-fmt-tag">BO{m.fmt}</span>
        </div>

        <div className="t-m-teams">
          <span className={`t-m-side left ${m.played && m.winner === m.teamA ? "is-win" : ""}`}>
            {m.teamA && <TeamLogo teamName={m.teamA} className="mini-team-logo" />}
            <b>{m.teamA || "Por definir"}</b>
          </span>

          <span className="t-m-score mono">
            {m.played ? (
              <>
                <b className={m.winner === m.teamA ? "kd-pos" : ""}>{m.scoreA}</b> :{" "}
                <b className={m.winner === m.teamB ? "kd-pos" : ""}>{m.scoreB}</b>
              </>
            ) : (
              <span style={{ color: "var(--mut)" }}>VS</span>
            )}
          </span>

          <span className={`t-m-side right ${m.played && m.winner === m.teamB ? "is-win" : ""}`}>
            <b>{m.teamB || "Por definir"}</b>
            {m.teamB && <TeamLogo teamName={m.teamB} className="mini-team-logo" />}
          </span>
        </div>

        <div className="t-m-foot">
          <span className="mono t-map-mini" style={{ color: "var(--mut)" }}>
            {m.played && m.series
              ? m.series.maps
                  .map((x) => `${x.mapName.slice(0, 3).toUpperCase()} ${x.sc[0]}-${x.sc[1]}`)
                  .join(" · ")
              : `BO${m.fmt} · Veto Oficial`}
          </span>

          <div className="t-m-actions">
            {!ready ? (
              <span className="mono" style={{ fontSize: "10.5px", color: "var(--mut)" }}>
                ESPERANDO CRUCE
              </span>
            ) : m.played ? (
              <>
                <button
                  type="button"
                  className="t-btn-sm mono"
                  onClick={() => handleWatchMatch(m.id, false)}
                >
                  Boxscore
                </button>
                <button
                  type="button"
                  className="t-btn-sm mono"
                  onClick={() => handleWatchMatch(m.id, true)}
                >
                  Replay Vivo
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="t-btn-sm mono"
                  onClick={() => handleSimMatch(m.id)}
                >
                  Simular
                </button>
                <button
                  type="button"
                  className="t-btn-sm mono t-btn-live"
                  onClick={() => handleWatchMatch(m.id, true)}
                >
                  En Vivo
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const qfs = T.playoffs.filter((m) => m.roundKey === "QF");
  const sfs = T.playoffs.filter((m) => m.roundKey === "SF");
  const gf = T.playoffs.filter((m) => m.roundKey === "GF");
  const bracketCols = [
    ...(qfs.length ? [{ title: "CUARTOS DE FINAL · BO3", matches: qfs }] : []),
    { title: "SEMIFINALES · BO3", matches: sfs },
    { title: "GRAN FINAL · BO5", matches: gf }
  ];

  const cfgSetup = TOURNAMENT_PRESETS[setupPreset];
  const okSetupCount = selectedTeams.length === cfgSetup.size;

  return (
    <section id="torneo" className="box">
      <div className="box-head">
        <div>
          <h2>Modo Torneos VCT 2027 (Grupos, Calendario &amp; Playoffs Bo3/Bo5)</h2>
          <small style={{ color: "var(--mut)" }}>{T.cfg.desc}</small>
        </div>
        <span className="mono" style={{ fontSize: "11px", color: "var(--mut)" }}>
          {phaseStatus} · {playedMatches}/{totalMatches} SERIES
        </span>
      </div>

      {/* TOOLBAR */}
      <div className="t-toolbar">
        <div className="tac-group">
          <span className="tac-label">Torneo</span>
          <select
            className="map-select mono"
            aria-label="Elegir formato de torneo"
            value={setupPreset}
            onChange={(e) => handleSelectPreset(e.target.value as TournamentPresetId)}
          >
            {Object.values(TOURNAMENT_PRESETS).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="mono"
            onClick={() => setShowSetupPicker((prev) => !prev)}
          >
            {showSetupPicker ? "Cerrar Equipos" : "Equipos / Amigos"}
          </button>
          <button type="button" className="mono" onClick={() => handleStartCustom(true)}>
            Nuevo Sorteo
          </button>
        </div>

        <div className="btn-group">
          <button type="button" className="mono" disabled={allDone} onClick={handleSimNext}>
            +1 Serie
          </button>
          <button type="button" className="mono" disabled={allDone} onClick={handleSimRound}>
            Simular Jornada
          </button>
          <button type="button" className="p" disabled={allDone} onClick={handleSimAll}>
            Simular Torneo
          </button>
        </div>
      </div>

      {/* SELECTOR DE EQUIPOS Y SEGUIMIENTO DE AMIGOS */}
      {showSetupPicker && (
        <div className="t-setup-drawer">
          <div className="t-setup-top">
            <span className="mono">
              SELECCIÓN DE PARTICIPANTES ({selectedTeams.length} / {cfgSetup.size}) · Clic en el
              nombre para incluir/quitar · Clic en [SEGUIR] para marcar equipos de amigos
            </span>
            <div className="btn-group">
              <button
                type="button"
                className="t-btn-sm mono"
                disabled={!okSetupCount}
                onClick={() => handleStartCustom(false)}
              >
                Aplicar (Seed OVR)
              </button>
              <button
                type="button"
                className="t-btn-sm mono"
                disabled={!okSetupCount}
                onClick={() => handleStartCustom(true)}
              >
                Aplicar (Sorteo Aleatorio)
              </button>
            </div>
          </div>

          <div className="t-picker-grid">
            {allTeamsSorted.map((name) => {
              const isIn = selectedTeams.includes(name);
              const isF = trackedFriends.has(name);
              const reg = teamMeta[name]?.reg || "";
              const ovr =
                teams[name] && coaches[name] ? getTeamOvr(teams[name], coaches[name]) : "-";
              return (
                <div key={name} className={`t-pick-item ${isIn ? "is-in" : ""}`}>
                  <button
                    type="button"
                    className="t-pick-main"
                    onClick={() => handleToggleTeamInSetup(name)}
                  >
                    <TeamLogo teamName={name} className="mini-team-logo" />
                    <span>
                      <b>{name}</b>
                      <small className="mono" style={{ color: "var(--mut)" }}>
                        {reg} · OVR {ovr}
                      </small>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`t-pick-follow mono ${isF ? "is-f" : ""}`}
                    onClick={() => handleToggleFriend(name)}
                    title="Marcar equipo para seguimiento con amigos"
                  >
                    {isF ? "SIGUIENDO" : "SEGUIR"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TICKER DE PRENSA */}
      {latestNews && (
        <div className="news-ticker mono">
          <span className={`news-tag cat-${latestNews.cat.toLowerCase()}`}>{latestNews.cat}</span>
          <span className="news-ticker-txt">
            <b>{latestNews.headline}</b> —{" "}
            <span style={{ color: "var(--mut)" }}>{latestNews.body}</span>
          </span>
          <button
            type="button"
            className="t-btn-sm mono"
            onClick={() => setActiveSubTab("news")}
          >
            Prensa ({T.news.length})
          </button>
        </div>
      )}

      {/* BANNER CAMPEÓN + MVP */}
      {T.champion && (
        <div className="t-champ-banner">
          <div className="t-champ-left">
            <div className="mgr-logo-frame">
              <TeamLogo teamName={T.champion} className="score-logo-sm" />
            </div>
            <div>
              <span className="duel-badge">CAMPEÓN · {T.cfg.name}</span>
              <div className="t-champ-name">{T.champion}</div>
              <small className="mono" style={{ color: "var(--mut)" }}>
                SUBCAMPEÓN: {T.runnerUp} · DT CAMPEÓN: {coaches[T.champion]?.n || "-"}
              </small>
            </div>
          </div>

          {champMvp && (
            <div className="t-champ-mvp mono">
              <small style={{ color: "var(--gold)" }}>MVP DEL TORNEO</small>
              <b>
                {champMvp.player} ({champMvp.team})
              </b>
              <span>
                RATING {champMvp.rating.toFixed(2)} · ACS {champMvp.acs} · K/D {champMvp.kd} ·{" "}
                {champMvp.maps} MAPAS
              </span>
            </div>
          )}
        </div>
      )}

      {/* SUB-PESTAÑAS */}
      <div className="series-tabs" style={{ marginTop: "10px" }}>
        <button
          type="button"
          className={`series-tab ${activeSubTab === "groups" ? "active" : ""}`}
          onClick={() => setActiveSubTab("groups")}
        >
          GRUPOS Y TABLA
        </button>
        <button
          type="button"
          className={`series-tab ${activeSubTab === "schedule" ? "active" : ""}`}
          onClick={() => setActiveSubTab("schedule")}
        >
          CALENDARIO ({playedMatches}/{totalMatches})
        </button>
        <button
          type="button"
          className={`series-tab ${activeSubTab === "bracket" ? "active" : ""}`}
          onClick={() => setActiveSubTab("bracket")}
        >
          BRACKET PLAYOFFS
        </button>
        <button
          type="button"
          className={`series-tab ${activeSubTab === "stats" ? "active" : ""}`}
          onClick={() => setActiveSubTab("stats")}
        >
          RANKING MVP
        </button>
        <button
          type="button"
          className={`series-tab ${activeSubTab === "news" ? "active" : ""}`}
          onClick={() => setActiveSubTab("news")}
        >
          NOTICIAS ({T.news.length})
        </button>
      </div>

      {/* VISTA 1: GRUPOS Y TABLA */}
      {activeSubTab === "groups" && (
        <div className={`t-groups-grid ${T.groups.length === 1 ? "single-league" : ""}`}>
          {T.groups.map((g) => {
            const rows = computeGroupStandings(T, g.key, ctx);
            const qCut = T.cfg.qualifyPerGroup;
            const title = g.key === "LIGA" ? "TABLA GENERAL DE LIGA" : `GRUPO ${g.key}`;

            return (
              <div key={g.key} className="t-group-card">
                <div className="t-group-head">
                  <b className="mono">{title}</b>
                  <span className="mono" style={{ fontSize: "10.5px", color: "var(--mut)" }}>
                    TOP {qCut} CLASIFICA A PLAYOFFS
                  </span>
                </div>
                <div className="sc">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th style={{ textAlign: "left" }}>Equipo</th>
                        <th>PJ</th>
                        <th>G-P</th>
                        <th>MAP</th>
                        <th>DIF M</th>
                        <th>DIF R</th>
                        <th>PTS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, idx) => {
                        const isQual = idx < qCut;
                        const isFriend = trackedFriends.has(r.team);
                        const md = r.mw - r.ml;
                        const rd = r.rw - r.rl;

                        return (
                          <tr key={r.team} className={isFriend ? "t-friend-row" : ""}>
                            <td
                              className={`mono ${isQual ? "kd-pos" : ""}`}
                              style={!isQual ? { color: "var(--mut)" } : undefined}
                            >
                              <b>{idx + 1}</b>
                            </td>
                            <td style={{ textAlign: "left" }}>
                              <div className="t-team-cell">
                                <TeamLogo teamName={r.team} className="mini-team-logo" />
                                <b>{r.team}</b>
                                {isFriend && (
                                  <span className="t-friend-tag mono">SEGUIMIENTO</span>
                                )}
                              </div>
                            </td>
                            <td className="mono">{r.pj}</td>
                            <td className="mono">
                              <b>
                                {r.g}-{r.p}
                              </b>
                            </td>
                            <td className="mono" style={{ color: "var(--mut)" }}>
                              {r.mw}-{r.ml}
                            </td>
                            <td
                              className={`mono ${md > 0 ? "kd-pos" : md < 0 ? "kd-neg" : ""}`}
                              style={md === 0 ? { color: "var(--mut)" } : undefined}
                            >
                              {md > 0 ? `+${md}` : md}
                            </td>
                            <td
                              className={`mono ${rd > 0 ? "kd-pos" : rd < 0 ? "kd-neg" : ""}`}
                              style={rd === 0 ? { color: "var(--mut)" } : undefined}
                            >
                              {rd > 0 ? `+${rd}` : rd}
                            </td>
                            <td className="mono">
                              <b>{r.pts}</b>
                            </td>
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
      )}

      {/* VISTA 2: CALENDARIO */}
      {activeSubTab === "schedule" && (
        <div className="t-schedule-wrap">
          {Array.from({ length: maxGroupRound }, (_, i) => i + 1).map((r) => {
            const rMatches = T.groupMatches.filter((m) => m.roundNum === r);
            const playedCnt = rMatches.filter((m) => m.played).length;
            return (
              <details
                key={r}
                className="t-round-block"
                open={playedCnt < rMatches.length || r === maxGroupRound}
              >
                <summary className="t-round-sum mono">
                  <span>FASE DE GRUPOS · JORNADA {r}</span>
                  <span style={{ color: "var(--mut)" }}>
                    {playedCnt} / {rMatches.length} SERIES JUGADAS
                  </span>
                </summary>
                <div className="t-match-list">{rMatches.map(renderMatchRow)}</div>
              </details>
            );
          })}

          <details className="t-round-block" open={T.playoffsSeeded}>
            <summary className="t-round-sum mono">
              <span>PLAYOFFS (ELIMINACIÓN DIRECTA · BO3 / GRAN FINAL BO5)</span>
              <span style={{ color: "var(--mut)" }}>
                {T.playoffs.filter((m) => m.played).length} / {T.playoffs.length} SERIES JUGADAS
              </span>
            </summary>
            <div className="t-match-list">{T.playoffs.map(renderMatchRow)}</div>
          </details>
        </div>
      )}

      {/* VISTA 3: BRACKET PLAYOFFS */}
      {activeSubTab === "bracket" && (
        <div className={`t-bracket-grid cols-${bracketCols.length}`}>
          {bracketCols.map((col) => (
            <div key={col.title} className="tb-col">
              <div className="tb-col-title mono">{col.title}</div>
              <div className="tb-col-body">
                {col.matches.map((m) => {
                  const ready = Boolean(m.teamA && m.teamB);
                  const isFriend = Boolean(
                    (m.teamA && trackedFriends.has(m.teamA)) ||
                      (m.teamB && trackedFriends.has(m.teamB))
                  );
                  return (
                    <div
                      key={m.id}
                      className={`tb-card ${isFriend ? "t-friend-border" : ""}`}
                    >
                      <div className="tb-head mono">
                        <span>{m.label}</span>
                        <span>BO{m.fmt}</span>
                      </div>

                      <div
                        className={`tb-slot ${m.played && m.winner === m.teamA ? "is-win" : ""}`}
                      >
                        <span className="tb-team">
                          {m.teamA && <TeamLogo teamName={m.teamA} className="mini-team-logo" />}
                          <span>{m.teamA || "TBD"}</span>
                        </span>
                        <span className="mono tb-sc">{m.played ? m.scoreA : "-"}</span>
                      </div>

                      <div
                        className={`tb-slot ${m.played && m.winner === m.teamB ? "is-win" : ""}`}
                      >
                        <span className="tb-team">
                          {m.teamB && <TeamLogo teamName={m.teamB} className="mini-team-logo" />}
                          <span>{m.teamB || "TBD"}</span>
                        </span>
                        <span className="mono tb-sc">{m.played ? m.scoreB : "-"}</span>
                      </div>

                      <div className="tb-foot">
                        {!ready ? (
                          <span className="mono" style={{ fontSize: "10px", color: "var(--mut)" }}>
                            PENDIENTE
                          </span>
                        ) : m.played ? (
                          <>
                            <button
                              type="button"
                              className="t-btn-sm mono"
                              onClick={() => handleWatchMatch(m.id, false)}
                            >
                              Boxscore
                            </button>
                            <button
                              type="button"
                              className="t-btn-sm mono"
                              onClick={() => handleWatchMatch(m.id, true)}
                            >
                              Replay
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="t-btn-sm mono"
                              onClick={() => handleSimMatch(m.id)}
                            >
                              Simular
                            </button>
                            <button
                              type="button"
                              className="t-btn-sm mono t-btn-live"
                              onClick={() => handleWatchMatch(m.id, true)}
                            >
                              En Vivo
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VISTA 4: RANKING MVP */}
      {activeSubTab === "stats" &&
        (players.length === 0 ? (
          <p className="mono" style={{ fontSize: "12px", color: "var(--mut)" }}>
            Simula al menos una serie del torneo para generar el ranking de jugadores y candidatos a
            MVP.
          </p>
        ) : (
          <div className="sc">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th style={{ textAlign: "left" }}>Jugador</th>
                  <th style={{ textAlign: "left" }}>Equipo</th>
                  <th style={{ textAlign: "left" }}>Agentes</th>
                  <th>MAP</th>
                  <th>R 2.0</th>
                  <th>ACS</th>
                  <th>K/D</th>
                  <th>KAST</th>
                  <th>FB</th>
                  <th>CL</th>
                </tr>
              </thead>
              <tbody>
                {players.slice(0, 20).map((p, idx) => {
                  const ratCls =
                    p.rating >= 1.18 ? "rat-elite" : p.rating >= 1.02 ? "rat-good" : "";
                  return (
                    <tr key={`${p.team}-${p.player}`}>
                      <td className="mono" style={{ color: "var(--mut)" }}>
                        {idx + 1}
                      </td>
                      <td style={{ textAlign: "left" }}>
                        <b>{p.player}</b>{" "}
                        <small style={{ color: "var(--mut)" }}>
                          <RoleIcon roleStr={p.role} />
                        </small>
                      </td>
                      <td style={{ textAlign: "left" }}>
                        <span className="t-team-cell">
                          <TeamLogo teamName={p.team} className="mini-team-logo" />
                          <span>{p.team}</span>
                        </span>
                      </td>
                      <td
                        style={{ textAlign: "left", fontSize: "11px", color: "var(--mut)" }}
                        className="mono"
                      >
                        {p.topAgents}
                      </td>
                      <td className="mono">{p.maps}</td>
                      <td
                        className={`mono ${ratCls}`}
                        style={!ratCls ? { color: "var(--mut)" } : undefined}
                      >
                        <b>{p.rating.toFixed(2)}</b>
                      </td>
                      <td className="mono">
                        <b>{p.acs}</b>
                      </td>
                      <td className="mono">{p.kd}</td>
                      <td className="mono">{p.kast}%</td>
                      <td className="mono">{p.fb}</td>
                      <td className="mono">{p.cl}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}

      {/* VISTA 5: NOTICIAS Y RUMORES */}
      {activeSubTab === "news" &&
        (T.news.length === 0 ? (
          <p className="mono" style={{ fontSize: "12px", color: "var(--mut)" }}>
            Simula series para generar cobertura de prensa y rumores del torneo.
          </p>
        ) : (
          <div className="news-grid">
            {T.news.map((n, i) => (
              <article key={i} className={`news-card ${n.hot ? "is-hot" : ""}`}>
                <div className="news-head mono">
                  <span className={`news-tag cat-${n.cat.toLowerCase()}`}>{n.cat}</span>
                  <span style={{ color: "var(--mut)" }}>{n.tag || "VCT"}</span>
                </div>
                <h3>{n.headline}</h3>
                <p>{n.body}</p>
              </article>
            ))}
          </div>
        ))}
    </section>
  );
}
