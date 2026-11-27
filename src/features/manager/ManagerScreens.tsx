import { getTeamOvr } from "../../core/index.ts";
import { TeamLogo } from "../../components/TeamLogo.tsx";
import { useDbStore } from "../../stores/useDbStore.ts";
import { useManagerStore } from "../../stores/useManagerStore.ts";
import { DIFFICULTY_CFG, MARKET_PACE_CFG, ROLE_PROMISE_LABELS } from "./constants.ts";
import {
  calcCareerScore,
  calcManagerReputation,
  calcPlayerOvr,
  calcPlayerValue,
  clamp,
  fmtMoney,
  getBoardExpectationByOvr,
  getClubAcademyInfo,
  getDiffCfg
} from "./managerHelpers.ts";
import type { BoardHistoryPoint, PromisedRole } from "./types.ts";

export function ClubSelectScreen({ onTriggerImport }: { onTriggerImport: () => void }) {
  const teams = useDbStore((s) => s.teams);
  const coaches = useDbStore((s) => s.coaches);
  const teamMeta = useDbStore((s) => s.teamMeta);
  const academies = useDbStore((s) => s.academies);

  const setupSettings = useManagerStore((s) => s.setupSettings);
  const setSetupOpt = useManagerStore((s) => s.setSetupOpt);
  const startCareer = useManagerStore((s) => s.startCareer);

  const diffCfg = DIFFICULTY_CFG[setupSettings.difficulty] || DIFFICULTY_CFG.normal;
  const mktCfg = MARKET_PACE_CFG[setupSettings.marketPace] || MARKET_PACE_CFG.normal;

  const allClubs = Object.keys(teams).sort((a, b) => {
    const ovrA = coaches[a] ? parseFloat(getTeamOvr(teams[a], coaches[a])) : 75;
    const ovrB = coaches[b] ? parseFloat(getTeamOvr(teams[b], coaches[b])) : 75;
    return ovrB - ovrA;
  });

  return (
    <>
      <div className="box-head">
        <div>
          <h2>Modo Manager VCT 2027 · Configura y Elige tu Franquicia</h2>
          <small style={{ color: "var(--mut)" }}>
            Define dificultad y ritmo de traspasos antes de firmar contrato con un club.
          </small>
        </div>
        <div className="btn-group">
          <button type="button" className="t-btn-sm mono t-btn-live" onClick={onTriggerImport}>
            Cargar Partida (.json)
          </button>
        </div>
      </div>

      <div className="mgr-setup-bar">
        <div className="mgr-setup-col">
          <span className="tac-label">Dificultad de Carrera</span>
          <div className="seg-group">
            {Object.values(DIFFICULTY_CFG).map((d) => (
              <button
                key={d.id}
                type="button"
                className={`seg-btn mono ${setupSettings.difficulty === d.id ? "active" : ""}`}
                onClick={() => setSetupOpt("difficulty", d.id)}
              >
                {d.label}
              </button>
            ))}
          </div>
          <small style={{ color: "var(--mut)" }}>{diffCfg.desc}</small>
        </div>

        <div className="mgr-setup-col">
          <span className="tac-label">Ritmo del Mercado</span>
          <div className="seg-group">
            {Object.values(MARKET_PACE_CFG).map((m) => (
              <button
                key={m.id}
                type="button"
                className={`seg-btn mono ${setupSettings.marketPace === m.id ? "active" : ""}`}
                onClick={() => setSetupOpt("marketPace", m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <small style={{ color: "var(--mut)" }}>{mktCfg.desc}</small>
        </div>
      </div>

      <div className="mgr-club-grid">
        {allClubs.map((name, idx) => {
          const meta = teamMeta[name] || { reg: "AMERICAS", color: "#E5484D" };
          const coach = coaches[name];
          const ovr = coach ? parseFloat(getTeamOvr(teams[name], coach)) : 80;
          const budget =
            Math.round(((360000 + Math.max(0, ovr - 80) * 40000) * diffCfg.budgetMult) / 5000) *
            5000;
          const acad = getClubAcademyInfo(name, academies, teamMeta);
       const exp = getBoardExpectationByOvr(ovr);

       return (
         <div
           key={name}
           className="mgr-club-card"
           style={{ borderTop: `2px solid ${meta.color}` }}
         >
           <div className="mgr-club-top">
             <TeamLogo teamName={name} className="mini-team-logo" />
             <div>
               <b>{name}</b>
               <small className="mono" style={{ color: "var(--mut)" }}>
                 {meta.reg} · DT {coach?.n || "-"}
               </small>
             </div>
             <span className="mgr-club-idx">{String(idx + 1).padStart(2, "0")}</span>
           </div>
           <div className="mgr-club-stats mono">
             <span>
               OVR <b>{ovr.toFixed(1)}</b>
             </span>
             <span>
               ACAD <b>{acad.quality.toFixed(1)}</b>
             </span>
             <span>
               CAJA <b className="kd-pos">{fmtMoney(budget)}</b>
             </span>
           </div>
           <div className="mgr-club-req mono" title={exp.label}>
             <span className={`mgr-tier-pill tier-${exp.tier}`}>{exp.tierLabel}</span>
             <span className="mgr-req-txt">
               Exigencia: <b>{exp.shortLabel}</b>
             </span>
           </div>
           <button
                type="button"
                className="p mono"
                style={{ width: "100%", justifyContent: "center", padding: "6px" }}
                onClick={() => startCareer(name)}
              >
                Dirigir Club
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

function BoardHistorySvg({
  history,
  currentVal,
  fireThreshold
}: {
  history: BoardHistoryPoint[];
  currentVal: number;
  fireThreshold: number;
}) {
  const pts = history.length >= 2 ? history : [{ val: currentVal }, { val: currentVal }];
  const W = 420;
  const H = 110;
  const pad = 12;
  const mapX = (i: number) => pad + (i / Math.max(1, pts.length - 1)) * (W - pad * 2);
  const mapY = (v: number) => pad + ((100 - clamp(v, -100, 100)) / 200) * (H - pad * 2);
  const zeroY = mapY(0);
  const fireY = mapY(fireThreshold);
  const line = pts.map((p, i) => `${mapX(i).toFixed(1)},${mapY(p.val).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mgr-board-svg" aria-label="Evolución de confianza directiva">
      <line
        x1={pad}
        y1={zeroY}
        x2={W - pad}
        y2={zeroY}
        stroke="var(--bd-hi)"
        strokeDasharray="3 3"
        strokeWidth={1}
      />
      <line
        x1={pad}
        y1={fireY}
        x2={W - pad}
        y2={fireY}
        stroke="var(--vct-red)"
        strokeDasharray="2 3"
        strokeWidth={1}
      />
      <polyline fill="none" stroke="var(--vct-cyan)" strokeWidth={2} points={line} />
      <text
        x={W - pad}
        y={Math.max(10, fireY - 3)}
        textAnchor="end"
        fill="var(--vct-red)"
        fontSize={9}
        fontFamily="JetBrains Mono"
      >
        DESPIDO ({fireThreshold})
      </text>
    </svg>
  );
}

export function CareerSummaryScreen() {
  const M = useManagerStore((s) => s.career);
  const exportSave = useManagerStore((s) => s.exportSave);
  const resetToClubSelect = useManagerStore((s) => s.resetToClubSelect);

  if (!M) return null;

  const club = M.clubs[M.userTeam];
  const c = M.career;
  const total = c.wins + c.losses;
  const wrPct = total ? ((c.wins / total) * 100).toFixed(1) : "0.0";
  const seasonsPlayed = Math.max(1, M.seasonHistory.length + (M.week > 1 ? 1 : 0));
  const netBalance = club.budget - (M.startBudget || club.budget);
  const { score, grade, verdict } = calcCareerScore(M);
  const diffCfg = getDiffCfg(M);

  const topPlayers = Object.values(M.careerPlayerStats || {})
    .filter((p) => p.maps >= 1)
    .map((p) => ({ ...p, avgRat: p.ratingSum / p.maps, avgAcs: Math.round(p.acsSum / p.maps) }))
    .sort((a, b) => b.avgRat - a.avgRat)
    .slice(0, 5);
  const topBuys = M.transferLog
    .filter((t) => t.type === "FICHAJE" || t.type === "ACADEMIA")
    .sort((a, b) => b.fee - a.fee)
    .slice(0, 4);
  const topSales = M.transferLog
    .filter((t) => t.type === "VENTA")
    .sort((a, b) => b.fee - a.fee)
    .slice(0, 4);

  return (
    <>
      <div className="mgr-summary-hero">
        <div className="mgr-brand-left">
          <span className="mgr-logo-frame">
            <TeamLogo teamName={M.userTeam} className="score-logo-sm" />
          </span>
          <div>
            <span className="duel-badge">
              RESUMEN FINAL DE CARRERA · {diffCfg.label.toUpperCase()}
            </span>
            <h2 style={{ fontSize: "26px", margin: "4px 0 2px" }}>{verdict}</h2>
            <small className="mono" style={{ color: "var(--mut)" }}>
              Clubes dirigidos: {(c.clubsManaged || [M.userTeam]).join(" → ")} · {seasonsPlayed}{" "}
              temporada(s)
            </small>
          </div>
        </div>

        <div className="mgr-grade-box mono">
          <small style={{ color: "var(--mut)" }}>CALIFICACIÓN</small>
          <div className={`mgr-grade-val grade-${grade.toLowerCase()}`}>{grade}</div>
          <span>{score} / 100 PTS</span>
        </div>
      </div>

      <div className="mgr-kpi-row mono" style={{ marginBottom: "12px" }}>
        <div>
          <small style={{ color: "var(--mut)" }}>RÉCORD GLOBAL</small>
          <b>
            {c.wins}W - {c.losses}L ({wrPct}%)
          </b>
        </div>
        <div>
          <small style={{ color: "var(--mut)" }}>TÍTULOS GANADOS</small>
          <b style={{ color: "var(--gold)" }}>
            {M.trophies.length} (CH:{c.championsTitles} · M:{c.mastersTitles} · R:{c.regionalTitles}
            )
          </b>
        </div>
        <div>
          <small style={{ color: "var(--mut)" }}>CAJA FINAL / BALANCE</small>
          <b className={netBalance >= 0 ? "kd-pos" : "kd-neg"}>
            {fmtMoney(club.budget)} ({netBalance >= 0 ? "+" : ""}
            {fmtMoney(netBalance)})
          </b>
        </div>
        <div>
          <small style={{ color: "var(--mut)" }}>DIRECTIVA FINAL</small>
          <b className={M.boardConfidence >= 25 ? "kd-pos" : "kd-neg"}>
            {M.boardConfidence > 0 ? "+" : ""}
            {M.boardConfidence}
          </b>
        </div>
      </div>

      <div className="t-groups-grid" style={{ marginBottom: "12px" }}>
        <div className="t-group-card">
          <div className="t-group-head">
            <b className="mono">EVOLUCIÓN DE LA DIRECTIVA</b>
            <span className="mono" style={{ color: "var(--mut)" }}>
              INICIO {M.boardHistory[0]?.val ?? 45} → FINAL {M.boardConfidence}
            </span>
          </div>
          <BoardHistorySvg
            history={M.boardHistory}
            currentVal={M.boardConfidence}
            fireThreshold={diffCfg.fireThreshold}
          />
          <div style={{ marginTop: "8px" }} className="mono">
            {M.trophies.length > 0 ? (
              M.trophies.map((t, i) => (
                <span
                  key={i}
                  className="duel-badge"
                  style={{ margin: "0 4px 4px 0", display: "inline-block" }}
                >
                  {t.season} · {t.title}
                </span>
              ))
            ) : (
              <span style={{ fontSize: "11px", color: "var(--mut)" }}>
                Sin trofeos oficiales en esta etapa.
              </span>
            )}
          </div>
        </div>

        <div className="t-group-card">
          <div className="t-group-head">
            <b className="mono">JUGADORES DESTACADOS</b>
            <span className="mono" style={{ color: "var(--mut)" }}>
              TOP RATING 2.0
            </span>
          </div>
          <div className="sc">
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Jugador</th>
                  <th>MAP</th>
                  <th>R2.0</th>
                  <th>ACS</th>
                  <th>PICO OVR</th>
                </tr>
              </thead>
              <tbody>
                {topPlayers.length > 0 ? (
                  topPlayers.map((p) => (
                    <tr key={p.name}>
                      <td style={{ textAlign: "left" }}>
                        <b>{p.name}</b>{" "}
                        <small style={{ color: "var(--mut)" }}>{p.role}</small>
                      </td>
                      <td className="mono">{p.maps}</td>
                      <td className="mono rat-elite">{p.avgRat.toFixed(2)}</td>
                      <td className="mono">{p.avgAcs}</td>
                      <td className="mono">
                        <b>{p.bestOvr}</b>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="mono" style={{ color: "var(--mut)" }}>
                      No se disputaron mapas suficientes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="t-groups-grid" style={{ marginBottom: "14px" }}>
        <div className="t-group-card">
          <div className="t-group-head">
            <b className="mono">FICHAJES MÁS IMPORTANTES</b>
          </div>
          <div className="sc">
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Jugador</th>
                  <th style={{ textAlign: "left" }}>Origen</th>
                  <th>Monto</th>
                </tr>
              </thead>
              <tbody>
                {topBuys.length > 0 ? (
                  topBuys.map((t, i) => (
                    <tr key={i}>
                      <td style={{ textAlign: "left" }}>
                        <b>{t.player}</b>
                      </td>
                      <td style={{ textAlign: "left", color: "var(--mut)" }}>{t.from}</td>
                      <td className="mono kd-neg">{fmtMoney(t.fee)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="mono" style={{ color: "var(--mut)" }}>
                      Sin fichajes registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="t-group-card">
          <div className="t-group-head">
            <b className="mono">VENTAS MÁS IMPORTANTES</b>
          </div>
          <div className="sc">
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Jugador</th>
                  <th style={{ textAlign: "left" }}>Destino</th>
                  <th>Monto</th>
                </tr>
              </thead>
              <tbody>
                {topSales.length > 0 ? (
                  topSales.map((t, i) => (
                    <tr key={i}>
                      <td style={{ textAlign: "left" }}>
                        <b>{t.player}</b>
                      </td>
                      <td style={{ textAlign: "left", color: "var(--mut)" }}>{t.to}</td>
                      <td className="mono kd-pos">{fmtMoney(t.fee)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="mono" style={{ color: "var(--mut)" }}>
                      Sin ventas registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="deck-actions">
        <button type="button" className="mono" onClick={exportSave}>
          Guardar Archivo de Carrera (.json)
        </button>
        <button type="button" className="p mono" onClick={resetToClubSelect}>
          Iniciar Nueva Carrera
        </button>
      </div>
    </>
  );
}

export function FiredScreen() {
  const M = useManagerStore((s) => s.career);
  const acceptJobOffer = useManagerStore((s) => s.acceptJobOffer);
  const endCareer = useManagerStore((s) => s.endCareer);
  if (!M) return null;

  const fireAt = getDiffCfg(M).fireThreshold;

  return (
    <div className="mgr-panel" style={{ borderColor: "var(--vct-red)" }}>
      <div className="t-group-head">
        <b className="mono kd-neg">DESPEDIDO POR LA DIRECTIVA DE {M.userTeam.toUpperCase()}</b>
        <span className="mono kd-neg">
          CONFIANZA FINAL: {M.boardConfidence} (LÍMITE {fireAt})
        </span>
      </div>
      <p style={{ fontSize: "13px", margin: "8px 0 12px" }}>
        Tu puntaje directivo cayó por debajo de {fireAt} tras expirar tu período de gracia. Puedes
        reconstruir tu carrera aceptando una de estas ofertas o ver tu resumen final:
      </p>
      <div className="mgr-club-grid" style={{ marginBottom: "12px" }}>
        {M.pendingJobOffers.map((off, idx) => (
          <div key={off.club} className="mgr-club-card">
            <div className="mgr-club-top">
              <TeamLogo teamName={off.club} className="mini-team-logo" />
              <div>
                <b>{off.club}</b>
                <small className="mono" style={{ color: "var(--mut)" }}>
                  {off.reg} · {off.reason}
                </small>
              </div>
            </div>
            <div className="mgr-club-stats mono">
              <span>
                OVR <b>{off.ovr}</b>
              </span>
              <span>
                CAJA <b className="kd-pos">{fmtMoney(off.budget)}</b>
              </span>
            </div>
            <button
              type="button"
              className="p mono"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => acceptJobOffer(idx)}
            >
              Firmar Contrato
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="mono" onClick={endCareer}>
        Ver Resumen Final de Carrera
      </button>
    </div>
  );
}

export function NegotiationDrawer() {
  const M = useManagerStore((s) => s.career);
  const activeNeg = useManagerStore((s) => s.activeNeg);
  const activeRenew = useManagerStore((s) => s.activeRenew);
  const updateRenew = useManagerStore((s) => s.updateRenew);
  const closeRenew = useManagerStore((s) => s.closeRenew);
  const submitRenew = useManagerStore((s) => s.submitRenew);
  const updateNeg = useManagerStore((s) => s.updateNeg);
  const closeNeg = useManagerStore((s) => s.closeNeg);
  const submitNeg = useManagerStore((s) => s.submitNeg);
  const acceptCounter = useManagerStore((s) => s.acceptCounter);

  if (!M) return null;

  if (activeRenew) {
    const p = M.clubs[M.userTeam].players[activeRenew.idx];
    if (!p) return null;
    return (
      <div className="mgr-neg-drawer">
        <div className="t-group-head">
          <b className="mono">
            RENOVAR CONTRATO · {p.n} (OVR {calcPlayerOvr(p)} · RESTAN {p.contractYears} TEMP.)
          </b>
          <button type="button" className="t-btn-sm mono" onClick={closeRenew}>
            Cerrar
          </button>
        </div>
        {activeRenew.feedback && (
          <div className="mono kd-neg" style={{ fontSize: "11.5px", marginBottom: "8px" }}>
            {activeRenew.feedback}
          </div>
        )}
        <div className="cb-grid-top">
          <label className="cb-field">
            <span className="tac-label">Duración (Temporadas)</span>
            <select
              className="map-select mono"
              value={activeRenew.years}
              onChange={(e) => updateRenew("years", parseInt(e.target.value, 10) || 2)}
            >
              {[1, 2, 3, 4].map((y) => (
                <option key={y} value={y}>
                  {y} temporada(s)
                </option>
              ))}
            </select>
          </label>
          <label className="cb-field">
            <span className="tac-label">Salario Semanal ($)</span>
            <input
              type="number"
              step={100}
              className="search-input mono"
              value={activeRenew.salary}
              onChange={(e) => updateRenew("salary", Math.max(0, parseInt(e.target.value, 10) || 0))}
            />
          </label>
          <label className="cb-field">
            <span className="tac-label">Promesa de Rol</span>
            <select
              className="map-select mono"
              value={activeRenew.promisedRole}
              onChange={(e) => updateRenew("promisedRole", e.target.value as PromisedRole)}
            >
              {Object.entries(ROLE_PROMISE_LABELS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="cb-field">
            <span className="tac-label">Cláusula Salida ($)</span>
            <input
              type="number"
              step={5000}
              className="search-input mono"
              value={activeRenew.releaseClause}
              onChange={(e) =>
                updateRenew("releaseClause", Math.max(0, parseInt(e.target.value, 10) || 0))
              }
            />
          </label>
          <label className="cb-field">
            <span className="tac-label">Bono Título ($)</span>
            <input
              type="number"
              step={500}
              className="search-input mono"
              value={activeRenew.winBonus}
              onChange={(e) =>
                updateRenew("winBonus", Math.max(0, parseInt(e.target.value, 10) || 0))
              }
            />
          </label>
        </div>
        <div className="btn-group">
          <button type="button" className="p mono" onClick={submitRenew}>
            Enviar Propuesta de Renovación
          </button>
          <button type="button" className="mono" onClick={closeRenew}>
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  if (!activeNeg) return null;

  const isBuy = activeNeg.dir === "buy";
  const myPlayers = M.clubs[M.userTeam].players;
  const swapPool = isBuy ? myPlayers : M.clubs[activeNeg.clubName]?.players || [];

  return (
    <div className="mgr-neg-drawer">
      <div className="t-group-head" style={{ flexWrap: "wrap", gap: "8px" }}>
        <b className="mono">
          {isBuy ? "NEGOCIAR FICHAJE" : "CONTRAOFERTAR VENTA"} · {activeNeg.playerName} (
          {isBuy
            ? `${activeNeg.clubName} → ${M.userTeam}`
            : `${M.userTeam} → ${activeNeg.clubName}`}
          ) · RONDA {activeNeg.round}/3
        </b>
        <button type="button" className="t-btn-sm mono" onClick={closeNeg}>
          Cerrar
        </button>
      </div>

      <div className="mgr-neg-log mono">
        {activeNeg.log.map((line, i) => (
          <div key={i}>· {line}</div>
        ))}
      </div>

      {activeNeg.status === "rejected" ? (
        <button type="button" className="mono" style={{ marginTop: "8px" }} onClick={closeNeg}>
          Entendido
        </button>
      ) : (
        <>
          <div className="cb-grid-top" style={{ marginTop: "8px" }}>
            <label className="cb-field">
              <span className="tac-label">
                {isBuy ? "Dinero Ofrecido ($)" : "Dinero Solicitado ($)"}
              </span>
              <input
                type="number"
                step={5000}
                className="search-input mono"
                value={activeNeg.cash}
                onChange={(e) =>
                  updateNeg("cash", Math.max(0, parseInt(e.target.value, 10) || 0))
                }
              />
            </label>

            <label className="cb-field">
              <span className="tac-label">
                {isBuy ? "Incluir Jugador (Intercambio)" : "Pedir Jugador en Intercambio"}
              </span>
              <select
                className="map-select mono"
                value={activeNeg.swapPlayer}
                onChange={(e) => updateNeg("swapPlayer", e.target.value)}
              >
                <option value="">-- Ninguno --</option>
                {swapPool.map((p) => (
                  <option key={p.n} value={p.n}>
                    {p.n} (OVR {calcPlayerOvr(p)} · {fmtMoney(calcPlayerValue(p))})
                  </option>
                ))}
              </select>
            </label>

            <label className="cb-field">
              <span className="tac-label">% Futura Venta</span>
              <select
                className="map-select mono"
                value={activeNeg.sellOnPct}
                onChange={(e) => updateNeg("sellOnPct", parseInt(e.target.value, 10) || 0)}
              >
                {[0, 10, 15, 20, 25].map((pct) => (
                  <option key={pct} value={pct}>
                    {pct}%
                  </option>
                ))}
              </select>
            </label>

            {isBuy && (
              <>
                <label className="cb-field">
                  <span className="tac-label">Contrato (Temp.)</span>
                  <select
                    className="map-select mono"
                    value={activeNeg.years}
                    onChange={(e) => updateNeg("years", parseInt(e.target.value, 10) || 2)}
                  >
                    {[1, 2, 3, 4].map((y) => (
                      <option key={y} value={y}>
                        {y} temp.
                      </option>
                    ))}
                  </select>
                </label>

                <label className="cb-field">
                  <span className="tac-label">Salario Sem. ($)</span>
                  <input
                    type="number"
                    step={100}
                    className="search-input mono"
                    value={activeNeg.salary}
                    onChange={(e) =>
                      updateNeg("salary", Math.max(0, parseInt(e.target.value, 10) || 0))
                    }
                  />
                </label>

                <label className="cb-field">
                  <span className="tac-label">Promesa de Rol</span>
                  <select
                    className="map-select mono"
                    value={activeNeg.promisedRole}
                    onChange={(e) => updateNeg("promisedRole", e.target.value)}
                  >
                    {Object.entries(ROLE_PROMISE_LABELS).map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="cb-field">
                  <span className="tac-label">Cláusula Propuesta ($)</span>
                  <input
                    type="number"
                    step={5000}
                    className="search-input mono"
                    value={activeNeg.releaseClause}
                    onChange={(e) =>
                      updateNeg("releaseClause", Math.max(0, parseInt(e.target.value, 10) || 0))
                    }
                  />
                </label>
              </>
            )}
          </div>

          <div className="btn-group">
            <button type="button" className="p mono" onClick={submitNeg}>
              {isBuy ? "Enviar Oferta" : "Enviar Contraoferta"}
            </button>
            {activeNeg.counter && (
              <button
                type="button"
                className="mono t-btn-live"
                style={{ borderColor: "var(--ok)", color: "var(--ok)" }}
                onClick={acceptCounter}
              >
                Aceptar Contraoferta ({fmtMoney(activeNeg.counter.cash)})
              </button>
            )}
            <button type="button" className="mono" onClick={closeNeg}>
              Cancelar
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function BoardMeetingScreen() {
  const M = useManagerStore((s) => s.career);
  const resolveBoardMeeting = useManagerStore((s) => s.resolveBoardMeeting);

  if (!M?.pendingBoardMeeting) return null;

  const mt = M.pendingBoardMeeting;
  const club = M.clubs[M.userTeam];
  const rep = calcManagerReputation(M);
  const fireAt = getDiffCfg(M).fireThreshold;
  const total = M.career.wins + M.career.losses;
  const wrPct = total ? ((M.career.wins / total) * 100).toFixed(0) : "50";

  const promiseViable =
    mt.tier === "giant"
      ? M.boardConfidence >= 10 || rep >= 65
      : M.boardConfidence >= fireAt + 12 || rep >= 56;

  let defendPoints = 0;
  if (total > 0 ? M.career.wins / total >= 0.5 : true) defendPoints++;
  if (club.budget >= 180000) defendPoints++;
  if (rep >= 58) defendPoints++;
  if (
    M.schedule.objective.academyStarterPromoted ||
    M.trophies.some((t) => t.season === M.season && t.club === M.userTeam)
  ) {
    defendPoints++;
  }
  const defendViable = mt.tier === "giant" ? defendPoints >= 3 : defendPoints >= 2;

  return (
    <div className="mgr-panel mgr-meeting-panel">
      <div className="t-group-head" style={{ flexWrap: "wrap", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span className={`mgr-tier-pill tier-${mt.tier}`}>{mt.tierLabel}</span>
          <b className="mono kd-neg">
            REUNIÓN FINAL DE DIRECTIVA · {mt.phaseLabel} ({M.userTeam.toUpperCase()})
          </b>
        </div>
        <span className="mono" style={{ fontSize: "11px", color: "var(--mut)" }}>
          TEMPORADA {mt.season} · SEMANA {mt.week}
        </span>
      </div>

      <p style={{ fontSize: "13px", margin: "8px 0 6px", lineHeight: 1.45 }}>
        La directiva te citó de urgencia por incumplir el objetivo de temporada:{" "}
        <b>{mt.objectiveLabel}</b>.
      </p>
      <p className="mono kd-neg" style={{ fontSize: "11.5px", margin: "0 0 12px" }}>
        MOTIVO: {mt.reason}
      </p>

      <div className="mgr-kpi-row mono" style={{ marginBottom: "12px" }}>
        <div>
          <small style={{ color: "var(--mut)" }}>RÉCORD</small>
          <b>
            {M.career.wins}W-{M.career.losses}L ({wrPct}%)
          </b>
        </div>
        <div>
          <small style={{ color: "var(--mut)" }}>CONFIANZA</small>
          <b className={M.boardConfidence >= 20 ? "kd-pos" : "kd-neg"}>
            {M.boardConfidence > 0 ? "+" : ""}
            {M.boardConfidence}
          </b>
        </div>
        <div>
          <small style={{ color: "var(--mut)" }}>REP MANAGER</small>
          <b style={{ color: "var(--vct-cyan)" }}>{rep}/99</b>
        </div>
        <div>
          <small style={{ color: "var(--mut)" }}>CAJA ACTUAL</small>
          <b className={club.budget >= 0 ? "kd-pos" : "kd-neg"}>{fmtMoney(club.budget)}</b>
        </div>
      </div>

      {mt.giantNoTitle ? (
        <>
          <div className="mgr-meeting-verdict mono">
            VEREDICTO DE JUNTA: En un club de exigencia GIGANTE (OVR 87+), terminar sin títulos
            conlleva la destitución inmediata sin importar el récord en temporada regular.
          </div>
          <div className="btn-group" style={{ marginTop: "10px" }}>
            <button
              type="button"
              className="p mono"
              onClick={() => resolveBoardMeeting("accept_sack")}
            >
              Aceptar Cese con Profesionalismo
            </button>
            <button
              type="button"
              className="mono mgr-end-btn"
              onClick={() => resolveBoardMeeting("defend")}
            >
              Discutir Récord y Exigir Explicaciones
            </button>
          </div>
        </>
      ) : (
        <div className="mgr-meeting-grid">
          <div className="mgr-meeting-opt">
            <div className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
              <b>PEDIR ÚLTIMA OPORTUNIDAD</b>
              <span className={promiseViable ? "kd-pos" : "kd-neg"}>
                VIABILIDAD: {promiseViable ? "ALTA" : "CRÍTICA"}
              </span>
            </div>
            <small style={{ color: "var(--mut)", lineHeight: 1.35 }}>
              Asumes un ultimátum directo: si la junta cede, sigues al frente con 0 semanas de
              gracia y margen mínimo.
            </small>
            <button
              type="button"
              className="p mono"
              style={{ marginTop: "auto", justifyContent: "center" }}
              onClick={() => resolveBoardMeeting("promise")}
            >
              Aceptar Ultimátum
            </button>
          </div>

          <div className="mgr-meeting-opt">
            <div className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
              <b>DEFENDER EL PROYECTO</b>
              <span className={defendViable ? "kd-pos" : "kd-neg"}>
                SOLIDEZ: {defendPoints}/4
              </span>
            </div>
            <small style={{ color: "var(--mut)", lineHeight: 1.35 }}>
              Presentas tus números de Win Rate, salud financiera, reputación y desarrollo de
              plantilla para ganar respaldo.
            </small>
            <button
              type="button"
              className="mono t-btn-live"
              style={{ marginTop: "auto", justifyContent: "center" }}
              onClick={() => resolveBoardMeeting("defend")}
            >
              Presentar Defensa
            </button>
          </div>

          <div className="mgr-meeting-opt">
            <div className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
              <b>PRESENTAR RENUNCIA</b>
              <span style={{ color: "var(--gold)" }}>SALIDA ORDENADA</span>
            </div>
            <small style={{ color: "var(--mut)", lineHeight: 1.35 }}>
              Evitas el desgaste del despido y sales al mercado de banquillos para elegir un nuevo
              proyecto de inmediato.
            </small>
            <button
              type="button"
              className="mono"
              style={{ marginTop: "auto", justifyContent: "center" }}
              onClick={() => resolveBoardMeeting("resign")}
            >
              Dimitir del Cargo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}