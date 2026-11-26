import {
  AGENTS,
  ALL_MAPS,
  ALL_MAP_NAMES,
  HUSH_MASTERY,
  draftTeamComp
} from "../../core/index.ts";
import type { CoreRole, MapName, RoleName } from "../../core/index.ts";
import { RoleIcon } from "../../components/RoleIcon.tsx";
import { TeamLogo } from "../../components/TeamLogo.tsx";
import { useManagerStore } from "../../stores/useManagerStore.ts";
import {
  COACH_COURSES,
  LEARNABLE_ROLES,
  PLAYER_PLANS,
  TRAINING_MODES
} from "./constants.ts";
import {
  calcLearningWeeks,
  calcManagerReputation,
  calcPlayerOvr,
  calcRosterOvr,
  evaluateSeasonObjective,
  fmtMoney,
  getAgentSpecLabel,
  getDiffCfg,
  getKnownAgentsForPlayer,
  getMatchesForWeek,
  getPlayerRoleDistance,
  getWeekPhaseName,
  isTravelWeek
} from "./managerHelpers.ts";
import type { PlayerPlanId } from "./types.ts";

export function HubTab() {
  const M = useManagerStore((s) => s.career);
  const lastSeriesRef = useManagerStore((s) => s.lastSeriesRef);
  const advanceWeek = useManagerStore((s) => s.advanceWeek);
  const skipToNextMatch = useManagerStore((s) => s.skipToNextMatch);
  const setTraining = useManagerStore((s) => s.setTraining);
  const setPrepMap = useManagerStore((s) => s.setPrepMap);
  const setActiveTab = useManagerStore((s) => s.setActiveTab);
  const respondSponsor = useManagerStore((s) => s.respondSponsor);
  const acceptJobOffer = useManagerStore((s) => s.acceptJobOffer);
  const dismissJobOffers = useManagerStore((s) => s.dismissJobOffers);
  const respondOffer = useManagerStore((s) => s.respondOffer);
  const openSellNeg = useManagerStore((s) => s.openSellNeg);
  const openLastBoxscore = useManagerStore((s) => s.openLastBoxscore);

  if (!M) return null;

  const club = M.clubs[M.userTeam];
  const weekMatches = getMatchesForWeek(M.schedule, M.week);
  const nextMatch = weekMatches.find(
    (m) => !m.played && (m.teamA === M.userTeam || m.teamB === M.userTeam)
  );
  const injured = club.players.filter((p) => p.injuredWeeks > 0);
  const healthyStarters = club.players.filter((p) => !p.sub && !(p.injuredWeeks > 0));
  const payroll = club.players.reduce((s, p) => s + (p.salary || 2500), 0);
  const travel = isTravelWeek(M.week);
  const confCls = M.boardConfidence >= 35 ? "kd-pos" : M.boardConfidence <= 0 ? "kd-neg" : "";
  const rep = calcManagerReputation(M);
  const oppName = nextMatch
    ? nextMatch.teamA === M.userTeam
      ? nextMatch.teamB!
      : nextMatch.teamA!
    : null;
  const oppClub = oppName ? M.clubs[oppName] : null;
  const objEval = evaluateSeasonObjective(M);
  const diffCfg = getDiffCfg(M);
  const estRewardBudget =
  Math.round((M.schedule.objective.rewardBudget * diffCfg.prizeMult) / 1000) * 1000;

  return (
    <>
      {M.pendingSponsorOffer && (
        <div className="mgr-alert-bar" style={{ borderColor: "var(--ok)" }}>
          <span className="mono">
            <b>OFERTA PATROCINADOR ({M.pendingSponsorOffer.reason}):</b>{" "}
            {M.pendingSponsorOffer.name} ofrece{" "}
            <b className="kd-pos">{fmtMoney(M.pendingSponsorOffer.upfront)}</b> +{" "}
            <b className="kd-pos">{fmtMoney(M.pendingSponsorOffer.weekly)}/sem</b>
          </span>
          <div className="btn-group">
            <button
              type="button"
              className="t-btn-sm mono t-btn-live"
              onClick={() => respondSponsor(true)}
            >
              Firmar Sponsor
            </button>
            <button
              type="button"
              className="t-btn-sm mono"
              onClick={() => respondSponsor(false)}
            >
              Rechazar
            </button>
          </div>
        </div>
      )}

      {M.pendingJobOffers.length > 0 && (
        <div className="mgr-alert-bar" style={{ borderColor: "var(--purple)" }}>
          <span className="mono">
            <b>OFERTAS DE OTROS CLUBES:</b>{" "}
            {M.pendingJobOffers.map((o, i) => (
              <span key={o.club} style={{ marginRight: "8px" }}>
                {o.club} (OVR {o.ovr}, {fmtMoney(o.budget)}){" "}
                <button
                  type="button"
                  className="t-btn-sm mono"
                  onClick={() => acceptJobOffer(i)}
                >
                  Dirigir {o.club}
                </button>
              </span>
            ))}
          </span>
          <button type="button" className="t-btn-sm mono" onClick={dismissJobOffers}>
            Quedarme
          </button>
        </div>
      )}

      {M.pendingOffer && (
        <div className="mgr-alert-bar" style={{ borderColor: "var(--gold)" }}>
          <span className="mono">
            <b>{M.pendingOffer.isListedBid ? "OFERTA EN MERCADO" : "OFERTA DE TRASPASO"}:</b>{" "}
            {M.pendingOffer.buyer} ofrece{" "}
            <b className="kd-pos">{fmtMoney(M.pendingOffer.amount)}</b>
            {M.pendingOffer.sellOnPct ? ` + ${M.pendingOffer.sellOnPct}% fut. venta` : ""} por{" "}
            <b>{M.pendingOffer.player}</b>
          </span>
          <div className="btn-group">
            <button
              type="button"
              className="t-btn-sm mono t-btn-live"
              onClick={() => respondOffer(true)}
            >
              Aceptar
            </button>
            <button
              type="button"
              className="t-btn-sm mono"
              style={{ borderColor: "var(--gold)", color: "var(--gold)" }}
              onClick={openSellNeg}
            >
              Contraofertar
            </button>
            <button
              type="button"
              className="t-btn-sm mono"
              onClick={() => respondOffer(false)}
            >
              Rechazar
            </button>
          </div>
        </div>
      )}

      {M.lastPlayedMatch && (
        <div className="mgr-last-bar mono">
          <span>
            ÚLTIMO PARTIDO:{" "}
            <b>
              {M.lastPlayedMatch.teamA} {M.lastPlayedMatch.scoreA}-{M.lastPlayedMatch.scoreB}{" "}
              {M.lastPlayedMatch.teamB}
            </b>{" "}
            ({M.lastPlayedMatch.mapsLine})
          </span>
          {lastSeriesRef && (
            <div className="btn-group">
              <button
                type="button"
                className="t-btn-sm mono"
                onClick={() => openLastBoxscore(false)}
              >
                Ver Boxscore
              </button>
              <button
                type="button"
                className="t-btn-sm mono"
                onClick={() => openLastBoxscore(true)}
              >
                Replay Vivo
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mgr-hub-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {/* TARJETA SEMANA / PARTIDO */}
          {M.week === 33 ? (
            <div className="mgr-panel">
              <div className="t-group-head">
                <b className="mono">GALA DE CIERRE · TEMPORADA {M.season}</b>
                <span className="duel-badge">FIN DE AÑO</span>
              </div>
              <p style={{ margin: "6px 0 10px", fontSize: "13px" }}>
                Masters 1: <b>{M.schedule.stage1.mastersChamp || "-"}</b> · Masters 2:{" "}
                <b>{M.schedule.stage2.mastersChamp || "-"}</b> · VALORANT Champions:{" "}
                <b style={{ color: "var(--gold)" }}>{M.schedule.championsChamp || "-"}</b>.
              </p>
              <button type="button" className="p mono" onClick={() => advanceWeek(false)}>
                Iniciar Temporada {M.season + 1}
              </button>
            </div>
          ) : nextMatch && oppName && oppClub ? (
            <div className="mgr-panel mgr-matchday">
              <div className="t-group-head">
                <b className="mono">PRÓXIMO PARTIDO · SEMANA {M.week}/33</b>
                <span className="t-fmt-tag mono">BO{nextMatch.fmt}</span>
              </div>
              <div className="mgr-versus">
                <div className="t-team-cell">
                  <span className="mgr-logo-frame">
                    <TeamLogo teamName={M.userTeam} className="score-logo-sm" />
                  </span>
                  <div>
                    <b>{M.userTeam}</b>
                    <small className="mono" style={{ display: "block", color: "var(--mut)" }}>
                      OVR {calcRosterOvr(club.players, club.coach)}
                    </small>
                  </div>
                </div>
                <span className="mono" style={{ fontSize: "14px", fontWeight: 700, color: "var(--mut)" }}>
                  VS
                </span>
                <div
                  className="t-team-cell"
                  style={{ flexDirection: "row-reverse", textAlign: "right" }}
                >
                  <span className="mgr-logo-frame">
                    <TeamLogo teamName={oppName} className="score-logo-sm" />
                  </span>
                  <div>
                    <b>{oppName}</b>
                    <small className="mono" style={{ display: "block", color: "var(--mut)" }}>
                      OVR {calcRosterOvr(oppClub.players, oppClub.coach)}
                    </small>
                  </div>
                </div>
              </div>
              <div className="mono" style={{ fontSize: "11px", marginBottom: "10px", color: "var(--mut)" }}>
                {nextMatch.label} · Titulares sanos:{" "}
                <b className={healthyStarters.length === 5 ? "kd-pos" : "kd-neg"}>
                  {healthyStarters.length}/5
                </b>
              </div>
              <div className="btn-group">
                <button type="button" className="p mono" onClick={() => advanceWeek(false)}>
                  Simular Semana
                </button>
                <button
                  type="button"
                  className="mono t-btn-live"
                  style={{ borderColor: "var(--ok)", color: "var(--ok)" }}
                  onClick={() => advanceWeek(true)}
                >
                  Jugar Partido En Vivo
                </button>
              </div>
            </div>
          ) : travel ? (
            <div className="mgr-panel" style={{ borderColor: "var(--vct-cyan)" }}>
              <div className="t-group-head">
                <b className="mono" style={{ color: "var(--vct-cyan)" }}>
                  {getWeekPhaseName(M.week)}
                </b>
                <span className="t-fmt-tag mono">RECUPERACIÓN -15 FAT</span>
              </div>
              <p style={{ margin: "6px 0 10px", fontSize: "12.5px", color: "var(--mut)" }}>
                El plantel viaja a la sede internacional y descansa antes del gran torneo (-15%
                Fatiga automática extra y +2 Moral). Revisa el bracket en Calendario o ajusta tu
                plan semanal.
              </p>
              <div className="btn-group">
                <button type="button" className="p mono" onClick={() => advanceWeek(false)}>
                  Avanzar Semana de Viaje ({M.week} → {M.week + 1})
                </button>
                <button type="button" className="mono" onClick={skipToNextMatch}>
                  Saltar al Torneo
                </button>
              </div>
            </div>
          ) : (
            <div className="mgr-panel">
              <div className="t-group-head">
                <b className="mono">SEMANA {M.week}/33 · SIN PARTIDO OFICIAL</b>
                <span className="mono" style={{ color: "var(--mut)" }}>
                  {getWeekPhaseName(M.week)}
                </span>
              </div>
              <p style={{ margin: "6px 0 10px", fontSize: "12.5px", color: "var(--mut)" }}>
                Semana libre o fase donde compiten otros clubes. Puedes entrenar, explorar la
                Academia, postularte a otro club o saltar al próximo partido.
              </p>
              <div className="btn-group">
                <button type="button" className="p mono" onClick={() => advanceWeek(false)}>
                  Avanzar 1 Semana ({M.week} → {M.week + 1})
                </button>
                <button type="button" className="mono" onClick={skipToNextMatch}>
                  Saltar al Próximo Partido
                </button>
              </div>
            </div>
          )}

          {/* 10 MODOS DE ENTRENAMIENTO */}
          <div className="mgr-panel">
            <div className="t-group-head" style={{ flexWrap: "wrap", gap: "6px" }}>
              <b className="mono">PLAN DE ENTRENAMIENTO SEMANAL</b>
              <span className="mono" style={{ color: "var(--mut)" }}>
                DT {club.coach.n} · DEV {club.coach.dev}
              </span>
            </div>

            {M.training === "map_prep" && (
              <div
                className="mono"
                style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", fontSize: "11px" }}
              >
                <span style={{ color: "var(--mut)" }}>MAPA OBJETIVO:</span>
                <select
                  className="cb-mini-sel mono"
                  value={M.prepMapTarget || M.activeMapPool[0]}
                  onChange={(e) => setPrepMap(e.target.value as MapName)}
                >
                  {M.activeMapPool.map((mp) => (
                    <option key={mp} value={mp}>
                      {mp} (+{((M.mapPrep[mp] || 0) * 100).toFixed(1)}%)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="mgr-train-list mgr-train-compact">
              {Object.values(TRAINING_MODES).map((tm) => (
                <button
                  key={tm.id}
                  type="button"
                  className={`mgr-train-btn ${M.training === tm.id ? "active" : ""}`}
                  onClick={() => setTraining(tm.id)}
                >
                  <div
                    className="mono"
                    style={{ display: "flex", justifyContent: "space-between", width: "100%", fontSize: "10.5px" }}
                  >
                    <b>{tm.name}</b>
                    <span style={{ color: "var(--mut)" }}>
                      {tm.cost ? fmtMoney(tm.cost) : "FREE"}
                    </span>
                  </div>
                  <small>{tm.desc}</small>
                  <small
                    className="mono"
                    style={{
                      fontSize: "9.5px",
                      color:
                        tm.riskLabel === "ALTO"
                          ? "var(--vct-red)"
                          : tm.riskLabel === "NULO"
                            ? "var(--ok)"
                            : "var(--mut)"
                    }}
                  >
                    RIESGO FATIGA: {tm.riskLabel}
                  </small>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: KPIs, BUZÓN, PRENSA */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div className={`mgr-panel mgr-obj-panel status-${objEval.status}`}>
         <div className="t-group-head" style={{ flexWrap: "wrap", gap: "6px" }}>
           <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
             <b className="mono">OBJETIVO DE TEMPORADA</b>
             <span className={`mgr-tier-pill tier-${objEval.tier}`}>{objEval.tierLabel}</span>
           </div>
           <span className={`obj-status-badge mono is-${objEval.status}`}>
             {objEval.statusLabel}
           </span>
         </div>

         <div className="mgr-obj-title">{objEval.label}</div>

         <div className="obj-criteria-list">
           {objEval.criteria.map((c, idx) => (
             <div key={idx} className="obj-crit-row mono">
               <span
                 className={`obj-crit-mark ${
                   c.done ? "is-ok" : c.failed ? "is-fail" : "is-pend"
                 }`}
               >
                 {c.done ? "OK" : c.failed ? "FALLO" : "PEND"}
               </span>
               <span className="obj-crit-label">{c.label}</span>
               <span className="obj-crit-detail">{c.detail}</span>
             </div>
           ))}
         </div>

         <div className="mgr-obj-foot mono">
           <span>{objEval.summary}</span>
           <span className={M.schedule.objective.rewarded ? "kd-pos" : ""}>
             {M.schedule.objective.rewarded
               ? "BONO COBRADO"
               : `BONO: +${fmtMoney(estRewardBudget)} · +${M.schedule.objective.rewardRep} REP`}
           </span>
         </div>
       </div>
          <div className="mgr-panel">
            <div className="t-group-head">
              <b className="mono">ESTADO DEL CLUB &amp; MANAGER</b>
              <span
                className={`mono ${M.graceWeeks > 0 ? "kd-pos" : ""}`}
                style={M.graceWeeks <= 0 ? { color: "var(--mut)" } : undefined}
              >
                {M.graceWeeks > 0
                  ? `GRACIA: ${M.graceWeeks} SEM`
                  : `DESPIDO <= ${getDiffCfg(M).fireThreshold}`}
              </span>
            </div>

            <div className="mgr-kpi-row mono">
              <div>
                <small style={{ color: "var(--mut)" }}>DIRECTIVA</small>
                <b className={confCls}>
                  {M.boardConfidence > 0 ? "+" : ""}
                  {M.boardConfidence}
                </b>
              </div>
              <div>
                <small style={{ color: "var(--mut)" }}>REP MANAGER</small>
                <b style={{ color: "var(--vct-cyan)" }}>{rep}/99</b>
              </div>
              <div>
                <small style={{ color: "var(--mut)" }}>FLUJO/SEM</small>
                <b className={club.sponsorWeekly - payroll >= 0 ? "kd-pos" : "kd-neg"}>
                  {fmtMoney(club.sponsorWeekly - payroll)}
                </b>
              </div>
              <div>
                <small style={{ color: "var(--mut)" }}>RACHA W</small>
                <b className={M.winStreak >= 5 ? "stat-elite" : ""}>
                  {M.winStreak}
                  {M.winStreak >= 5 ? " ($)" : ""}
                </b>
              </div>
            </div>

            <div
              className="mono"
              style={{
                fontSize: "11px",
                marginTop: "8px",
                paddingTop: "8px",
                borderTop: "1px solid var(--bd)",
                color: "var(--mut)"
              }}
            >
              Récord Carrera:{" "}
              <b style={{ color: "var(--fg)" }}>
                {M.career.wins}W-{M.career.losses}L
              </b>{" "}
              · PTS VCT:{" "}
              <b style={{ color: "var(--fg)" }}>{M.schedule.vctPoints[M.userTeam] || 0}</b> ·
              Lesionados:{" "}
              <b className={injured.length ? "kd-neg" : "kd-pos"}>{injured.length}</b> · Títulos:{" "}
              <b style={{ color: "var(--gold)" }}>{M.trophies.length}</b>
            </div>
          </div>

          <div className="mgr-panel">
            <div className="t-group-head">
              <b className="mono">BUZÓN DEL MANAGER</b>
              <span className="mono" style={{ color: "var(--mut)" }}>
                {M.inbox.length} MENSAJES
              </span>
            </div>
            <div className="mgr-inbox-scroll" style={{ maxHeight: "220px" }}>
              {M.inbox.map((msg) => (
                <div key={msg.id} className="mgr-msg">
                  <div className="mgr-msg-top mono">
                    <span className={`mgr-tag tag-${msg.tag.toLowerCase().replace(/\s+/g, "")}`}>
                      {msg.tag}
                    </span>
                    <span style={{ color: "var(--mut)" }}>
                      T{msg.season} · S{msg.week}
                    </span>
                  </div>
                  <b>{msg.title}</b>
                  <p>{msg.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mgr-panel">
            <div className="t-group-head">
              <b className="mono">PRENSA VLR &amp; RUMORES</b>
              <button
                type="button"
                className="t-btn-sm mono"
                onClick={() => setActiveTab("news")}
              >
                Ver Feed ({M.news.length})
              </button>
            </div>
            <div className="news-feed">
              {M.news.length > 0 ? (
                M.news.slice(0, 4).map((n) => (
                  <div key={n.id} className={`news-card ${n.hot ? "is-hot" : ""}`}>
                    <div className="news-head mono">
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span className={`news-tag cat-${n.cat.toLowerCase()}`}>{n.cat}</span>
                            {n.source && <span className="news-source">{n.source}</span>}
                        </div>
                            <span style={{ color: "var(--mut)" }}>
                            T{n.s} · S{n.w}
                        </span>
                    </div>
                    <b>{n.headline}</b>
                    <p>{n.body}</p>
                  </div>
                ))
              ) : (
                <span className="mono" style={{ fontSize: "11px", color: "var(--mut)" }}>
                  Avanza una semana para generar rumores y cobertura de prensa.
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function SquadTab() {
  const M = useManagerStore((s) => s.career);
  const toggleStarter = useManagerStore((s) => s.toggleStarter);
  const autoFillLineup = useManagerStore((s) => s.autoFillLineup);
  const setActiveTab = useManagerStore((s) => s.setActiveTab);
  const setPlayerPlan = useManagerStore((s) => s.setPlayerPlan);
  const physioPlayer = useManagerStore((s) => s.physioPlayer);
  const openRenew = useManagerStore((s) => s.openRenew);
  const toggleForSale = useManagerStore((s) => s.toggleForSale);
  const buyCoachCourse = useManagerStore((s) => s.buyCoachCourse);
  const startLearning = useManagerStore((s) => s.startLearning);
  const cancelLearning = useManagerStore((s) => s.cancelLearning);

  if (!M) return null;

  const club = M.clubs[M.userTeam];
  const healthyStarters = club.players.filter((p) => !p.sub && !(p.injuredWeeks > 0)).length;
  const costMult = getDiffCfg(M).costMult;
  const c = club.coach;
  const isProspectCoach = c.tier === "prospect" || (c.exp || 5) <= 2;

  const agentsByRole: Record<CoreRole, string[]> = {
    Duelista: [],
    Iniciador: [],
    Controlador: [],
    Centinela: []
  };
  for (const agName of Object.keys(AGENTS)) {
    agentsByRole[AGENTS[agName].role].push(agName);
  }

  const renderDelta = (d: number) =>
    d > 0 ? <sup className="kd-pos">+{d}</sup> : d < 0 ? <sup className="kd-neg">{d}</sup> : null;

  const statBar = (label: string, val: number) => (
    <div className="mgr-coach-stat" key={label}>
      <div className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: "10.5px" }}>
        <span style={{ color: "var(--mut)" }}>{label}</span>
        <b>{val}</b>
      </div>
      <div className="mgr-learn-track">
        <i
          style={{
            width: `${val}%`,
            background: val >= 90 ? "var(--gold)" : val >= 84 ? "var(--ok)" : "var(--vct-cyan)"
          }}
        />
      </div>
    </div>
  );

  return (
    <>
      <div className="db-controls">
        <span className={`mono ${healthyStarters === 5 ? "kd-pos" : "kd-neg"}`} style={{ fontSize: "11.5px" }}>
          TITULARES ACTIVOS: <b>{healthyStarters}/5</b> · Pasa a banca a cualquier titular para activar 1 o 2 suplentes
        </span>
        <div className="btn-group">
          <button type="button" className="t-btn-sm mono" onClick={autoFillLineup}>
            Auto-Alinear Top 5
          </button>
          {healthyStarters < 5 && (
            <button
              type="button"
              className="t-btn-sm mono t-btn-live"
              onClick={() => setActiveTab("academy")}
            >
              Ir a Academia
            </button>
          )}
        </div>
      </div>

      <div className="sc">
        <table>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Jugador</th>
              <th style={{ textAlign: "left" }}>Estado</th>
              <th>EDAD</th>
              <th>PJ</th>
              <th>OVR / POT</th>
              <th>MORAL</th>
              <th>FATIGA</th>
              <th>CONTRATO</th>
              <th>AIM</th>
              <th>FD</th>
              <th>CLU</th>
              <th>ENT</th>
              <th>UTI</th>
              <th>IGL</th>
              <th style={{ textAlign: "left" }}>Plan Individual</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {club.players.map((p, idx) => {
              const ovr = calcPlayerOvr(p);
              const isInj = p.injuredWeeks > 0;
              const fatCol =
                p.fatigue >= 76 ? "var(--vct-red)" : p.fatigue >= 55 ? "var(--gold)" : "var(--ok)";
              const morCol =
                p.morale >= 75 ? "var(--ok)" : p.morale <= 45 ? "var(--vct-red)" : "var(--gold)";

              return (
                <tr key={`${p.n}-${idx}`}>
                  <td style={{ textAlign: "left" }}>
                    <div>
                      <b>{p.n}</b>
                      {p.isAcademy && (
                        <span className="igl-tag" style={{ color: "var(--ok)", borderColor: "var(--ok)" }}>
                          ACAD
                        </span>
                      )}
                      {p._hushMastery >= 0.9 ? (
                        <span className="igl-tag" style={{ color: "var(--purple)", borderColor: "var(--purple)" }}>
                          HUSH
                        </span>
                      ) : p.hushProgress > 0 ? (
                        <span className="igl-tag">HUSH {p.hushProgress}%</span>
                      ) : null}
                    </div>
                    <small style={{ color: "var(--mut)" }}>
                      <RoleIcon roleStr={p.r} /> {p.r}
                      {isInj && (
                        <>
                          {" "}
                          · <span className="kd-neg">{p.injuryType}</span>
                        </>
                      )}
                    </small>
                  </td>
                  <td style={{ textAlign: "left" }}>
                    {isInj ? (
                      <span
                        className="sub-swap-btn"
                        style={{ borderColor: "var(--vct-red)", color: "var(--vct-red)", cursor: "default" }}
                      >
                        LESIÓN {p.injuredWeeks}S
                      </span>
                    ) : (
                      <button
                        type="button"
                        className={`sub-swap-btn ${p.sub ? "is-sub" : "is-starter"}`}
                        onClick={() => toggleStarter(idx)}
                      >
                        {p.sub ? "6TH SUB ⇄" : "TITULAR ⇄"}
                      </button>
                    )}
                  </td>
                  <td className="mono" style={{ color: "var(--mut)" }}>
                    {p.age}
                  </td>
                  <td className="mono">{p.matchesPlayed || 0}</td>
                  <td className="mono">
                    <b>{ovr}</b> <span style={{ color: "var(--mut)" }}>/ {p.pot}</span>
                  </td>
                  <td className="mono">
                    <div className="mgr-meter">
                      <span>{p.morale}</span>
                      <div className="mgr-bar">
                        <i style={{ width: `${p.morale}%`, background: morCol }} />
                      </div>
                    </div>
                  </td>
                  <td className="mono">
                    <div className="mgr-meter">
                      <span>{p.fatigue}%</span>
                      <div className="mgr-bar">
                        <i style={{ width: `${p.fatigue}%`, background: fatCol }} />
                      </div>
                    </div>
                  </td>
                  <td className="mono" style={{ fontSize: "11px" }}>
                    <span className={(p.contractYears || 2) <= 1 ? "kd-neg" : ""}>
                      <b>{p.contractYears || 2}T</b>
                    </span>{" "}
                    · {fmtMoney(p.salary)}
                    <small style={{ display: "block", fontSize: "9.5px", color: "var(--mut)" }}>
                      {p.promisedRole === "starter"
                        ? "TITULAR"
                        : p.promisedRole === "prospect"
                          ? "PROMESA"
                          : "ROTACIÓN"}
                      {p.transferRequested && (
                        <>
                          {" "}
                          · <b className="kd-neg">PIDE SALIR</b>
                        </>
                      )}
                    </small>
                  </td>
                  <td className="mono">
                    {p.aim}
                    {renderDelta(p.deltas.aim)}
                  </td>
                  <td className="mono">
                    {p.fd}
                    {renderDelta(p.deltas.fd)}
                  </td>
                  <td className="mono">
                    {p.clutch}
                    {renderDelta(p.deltas.clutch)}
                  </td>
                  <td className="mono">
                    {p.entry}
                    {renderDelta(p.deltas.entry)}
                  </td>
                  <td className="mono">
                    {p.util}
                    {renderDelta(p.deltas.util)}
                  </td>
                  <td className="mono">
                    {p.igl}
                    {renderDelta(p.deltas.igl)}
                  </td>
                  <td style={{ textAlign: "left" }}>
                    <select
                      className="cb-mini-sel mono"
                      style={{ width: "124px" }}
                      value={p.plan}
                      onChange={(e) => setPlayerPlan(idx, e.target.value as PlayerPlanId)}
                    >
                      {Object.entries(PLAYER_PLANS).map(([k, obj]) => (
                        <option key={k} value={k}>
                          {obj.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div className="btn-group" style={{ justifyContent: "flex-end" }}>
                      {isInj && (
                        <button
                          type="button"
                          className="t-btn-sm mono t-btn-live"
                          onClick={() => physioPlayer(idx)}
                        >
                          Fisio $15k
                        </button>
                      )}
                      <button type="button" className="t-btn-sm mono" onClick={() => openRenew(idx)}>
                        Renovar
                      </button>
                      <button
                        type="button"
                        className={`t-btn-sm mono ${p.forSale ? "is-listed" : ""}`}
                        onClick={() => toggleForSale(idx)}
                        title="Poner o quitar del mercado de transferibles"
                      >
                        {p.forSale ? "En Venta ✓" : "En Venta"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* PANEL HEAD COACH Y CURSOS */}
      <div className="mgr-panel mgr-learn-box">
        <div className="t-group-head" style={{ flexWrap: "wrap", gap: "8px" }}>
          <div>
            <b className="mono">HEAD COACH: {c.n}</b>
            <span
              className="igl-tag"
              style={{
                color: isProspectCoach ? "var(--ok)" : "var(--mut)",
                borderColor: isProspectCoach ? "var(--ok)" : "var(--bd-hi)"
              }}
            >
              {isProspectCoach ? "PROMESA" : "CONSAGRADO"}
            </span>
            <span className="mono" style={{ fontSize: "11px", marginLeft: "6px", color: "var(--mut)" }}>
              EXP {c.exp || 5} AÑOS · POT {c.pot || 92}
            </span>
          </div>
          <span className="mono" style={{ fontSize: "10.5px", color: "var(--mut)" }}>
            {isProspectCoach
              ? "Crecimiento acelerado en cursos (+4 por curso)"
              : "Cursos de especialización (+2 por curso)"}
          </span>
        </div>

        <div className="mgr-coach-grid">
          {statBar("TÁCTICA / MACRO", c.macro)}
          {statBar("LECTURA / MICRO", c.micro)}
          {statBar("ANTI-STRAT / ADAPT", c.adapt)}
          {statBar("DESARROLLO JÓVENES", c.dev)}
          {statBar("VESTUARIO / DISC", c.disc)}
        </div>

        {M.coachCourse && (
          <div className="mgr-learn-prog" style={{ marginBottom: "8px" }}>
            <div className="mgr-learn-meta mono">
              <span>
                <span className="igl-tag" style={{ margin: "0 5px 0 0" }}>
                  EN CURSO
                </span>
                <b>{M.coachCourse.name}</b>
              </span>
              <span style={{ color: "var(--mut)" }}>
                {M.coachCourse.done}/{M.coachCourse.weeks} SEM
              </span>
            </div>
            <div className="mgr-learn-track">
              <i
                style={{
                  width: `${Math.round((M.coachCourse.done / M.coachCourse.weeks) * 100)}%`,
                  background: "var(--vct-cyan)"
                }}
              />
            </div>
          </div>
        )}

        <div className="mgr-course-grid">
          {COACH_COURSES.map((cr) => {
            const effCost = Math.round((cr.cost * costMult) / 1000) * 1000;
            const canBuy = !M.coachCourse && club.budget >= effCost;
            return (
              <div key={cr.id} className="mgr-course-card">
                <div className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                  <b>{cr.name}</b>
                  <span className={club.budget >= effCost ? "kd-pos" : "kd-neg"}>
                    {fmtMoney(effCost)}
                  </span>
                </div>
                <small style={{ fontSize: "11px", lineHeight: 1.25, color: "var(--mut)" }}>
                  {cr.desc}
                </small>
                <div
                  className="mono"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: "4px",
                    fontSize: "10px"
                  }}
                >
                  <span style={{ color: "var(--mut)" }}>DURACIÓN: {cr.weeks} SEM</span>
                  <button
                    type="button"
                    className="t-btn-sm mono t-btn-live"
                    disabled={!canBuy}
                    onClick={() => buyCoachCourse(cr.id)}
                  >
                    Comprar Curso
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* PANEL APRENDIZAJE DE ROLES Y AGENTES (1-4 SEMANAS) */}
      <div className="mgr-panel mgr-learn-box">
        <div className="t-group-head">
          <b className="mono">APRENDIZAJE DE ROLES &amp; MAESTRÍA DE AGENTES (MÁX. 4 SEMANAS)</b>
          <span className="mono" style={{ fontSize: "10.5px", color: "var(--mut)" }}>
            Duración según distancia de rol y complejidad del agente · Avanza 1 sem/turno
          </span>
        </div>

        <div className="sc">
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Jugador</th>
                <th style={{ textAlign: "left" }}>Pool de Agentes Actual</th>
                <th style={{ textAlign: "left" }}>Asignar Rol / Agente</th>
                <th style={{ textAlign: "left" }}>Progreso de Maestría</th>
              </tr>
            </thead>
            <tbody>
              {club.players.map((p, idx) => {
                const known = getKnownAgentsForPlayer(p);
                const hasFullHush = Math.max(HUSH_MASTERY[p.n] || 0, p._hushMastery || 0) >= 0.9;
                const curRoles = (p.r || "").toLowerCase();
                const l = p.learning;
                const isInj = p.injuredWeeks > 0;
                const curLearnVal = l ? `${l.type}::${l.target}` : "";

                const roleOpts = LEARNABLE_ROLES.filter((r) =>
                  r === "IGL" ? !curRoles.includes("igl") : getPlayerRoleDistance(p, r as RoleName) > 0
                );

                return (
                  <tr key={`${p.n}-learn-${idx}`}>
                    <td style={{ textAlign: "left" }}>
                      <b>{p.n}</b>
                      <small style={{ display: "block", color: "var(--mut)" }}>
                        <RoleIcon roleStr={p.r} /> {p.r}
                      </small>
                    </td>
                    <td style={{ textAlign: "left" }}>
                      <div className="mgr-agent-pills mono">
                        {known.slice(0, 6).map((a) => (
                          <span key={a} className={`mgr-ag-chip ${a === "Hush" ? "is-hush" : ""}`}>
                            {a}
                          </span>
                        ))}
                        {known.length > 6 && (
                          <span style={{ fontSize: "10px", color: "var(--mut)" }}>
                            +{known.length - 6}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: "left" }}>
                      <select
                        className="cb-mini-sel mono mgr-learn-select"
                        value={curLearnVal}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (!raw) return;
                          const [t, target] = raw.split("::");
                          if ((t === "agent" || t === "role") && target) {
                            startLearning(idx, t, target);
                          }
                        }}
                      >
                        <option value="">-- Elegir Rol o Agente --</option>
                        {roleOpts.length > 0 && (
                          <optgroup label="ROLES NUEVOS (2–4 SEM)">
                            {roleOpts.map((r) => (
                              <option key={`role::${r}`} value={`role::${r}`}>
                                Rol: {r} ({calcLearningWeeks(p, "role", r)} sem)
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {(["Duelista", "Iniciador", "Controlador", "Centinela"] as const).map(
                          (rKey) => {
                            const agList = agentsByRole[rKey].filter((ag) =>
                              ag === "Hush" ? !hasFullHush : !known.includes(ag)
                            );
                            if (!agList.length) return null;
                            return (
                              <optgroup key={rKey} label={`AGENTES · ${rKey.toUpperCase()}`}>
                                {agList.map((ag) => (
                                  <option key={`agent::${ag}`} value={`agent::${ag}`}>
                                    {ag} ({calcLearningWeeks(p, "agent", ag)} sem)
                                  </option>
                                ))}
                              </optgroup>
                            );
                          }
                        )}
                      </select>
                    </td>
                    <td style={{ textAlign: "left" }}>
                      {l ? (
                        <div className="mgr-learn-prog">
                          <div className="mgr-learn-meta mono">
                            <span>
                              <span className="igl-tag" style={{ margin: "0 5px 0 0" }}>
                                {l.type === "role" ? "ROL" : "AGENTE"}
                              </span>
                              <b>{l.target}</b>
                            </span>
                            <span
                              className={isInj ? "kd-neg" : ""}
                              style={!isInj ? { color: "var(--mut)" } : undefined}
                            >
                              {isInj
                                ? "PAUSADO (LESIÓN)"
                                : `${l.done}/${l.total} SEM · ${
                                    l.total - l.done === 1
                                      ? "Falta 1 sem"
                                      : `Faltan ${Math.max(0, l.total - l.done)} sem`
                                  } (${Math.round((l.done / l.total) * 100)}%)`}
                            </span>
                          </div>
                          <div className="mgr-learn-row">
                            <div className="mgr-learn-track">
                              <i
                                style={{
                                  width: `${Math.round((l.done / l.total) * 100)}%`,
                                  background: isInj
                                    ? "var(--vct-red)"
                                    : l.target === "Hush"
                                      ? "var(--purple)"
                                      : "var(--ok)"
                                }}
                              />
                            </div>
                            <button
                              type="button"
                              className="t-btn-sm mono"
                              onClick={() => cancelLearning(idx)}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span className="mono" style={{ fontSize: "11px", color: "var(--mut)" }}>
                          Sin aprendizaje asignado
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export function TacticsTab() {
  const M = useManagerStore((s) => s.career);
  const tacticsMap = useManagerStore((s) => s.tacticsMap);
  const showMapPoolEditor = useManagerStore((s) => s.showMapPoolEditor);
  const setTacticsMap = useManagerStore((s) => s.setTacticsMap);
  const toggleMapPoolEditor = useManagerStore((s) => s.toggleMapPoolEditor);
  const setCompAgent = useManagerStore((s) => s.setCompAgent);
  const resetMapComp = useManagerStore((s) => s.resetMapComp);
  const toggleMapInPool = useManagerStore((s) => s.toggleMapInPool);
  const manualRotatePool = useManagerStore((s) => s.manualRotatePool);

  if (!M) return null;

  const club = M.clubs[M.userTeam];
  const activeNames = M.activeMapPool;
  const activeMap: MapName = activeNames.includes(tacticsMap) ? tacticsMap : activeNames[0];
  const benchNames = ALL_MAP_NAMES.filter((m) => !activeNames.includes(m));
  const starters = club.players.filter((p) => !p.sub && !(p.injuredWeeks > 0)).slice(0, 5);
  const comp =
    starters.length === 5
      ? draftTeamComp(
          { name: M.userTeam, players: starters, coach: club.coach, customComp: M.customComps },
          activeMap
        )
      : null;
  const savedMap = M.customComps[activeMap] || {};
  const prepPct = (M.mapPrep[activeMap] || 0) * 100;
  const rolesOrder: readonly CoreRole[] = ["Controlador", "Duelista", "Iniciador", "Centinela"];
  const agentsByRole: Record<CoreRole, string[]> = {
    Controlador: Object.keys(AGENTS).filter((a) => AGENTS[a].role === "Controlador"),
    Duelista: Object.keys(AGENTS).filter((a) => AGENTS[a].role === "Duelista"),
    Iniciador: Object.keys(AGENTS).filter((a) => AGENTS[a].role === "Iniciador"),
    Centinela: Object.keys(AGENTS).filter((a) => AGENTS[a].role === "Centinela")
  };

  return (
    <>
      <div className="db-controls">
        <div className="region-tabs">
          {activeNames.map((mp) => {
            const hasCustom = Boolean(M.customComps[mp] && Object.keys(M.customComps[mp]!).length > 0);
            return (
              <button
                key={mp}
                type="button"
                className={`tab-btn mono ${activeMap === mp ? "active" : ""}`}
                onClick={() => setTacticsMap(mp)}
              >
                {mp.toUpperCase()}
                {hasCustom ? " *" : ""}
              </button>
            );
          })}
        </div>
        <div className="btn-group">
          <span className="mono" style={{ fontSize: "11px", alignSelf: "center", color: "var(--mut)" }}>
            PREP MAPA: <b className="kd-pos">+{prepPct.toFixed(1)}%</b>
          </span>
          <button type="button" className="t-btn-sm mono" onClick={toggleMapPoolEditor}>
            {showMapPoolEditor ? "Cerrar Pool (7/13)" : "Pool VCT (7/13)"}
          </button>
          <button type="button" className="t-btn-sm mono" onClick={resetMapComp}>
            Restaurar Auto ({activeMap})
          </button>
        </div>
      </div>

      {showMapPoolEditor && (
        <div className="mgr-panel" style={{ marginBottom: "12px", borderColor: "var(--vct-cyan)" }}>
          <div className="t-group-head" style={{ flexWrap: "wrap", gap: "8px" }}>
            <b className="mono">
              ROTACIÓN VCT DE MAPAS (7 ACTIVOS / {benchNames.length} EN RESERVA)
            </b>
            <button
              type="button"
              className="t-btn-sm mono t-btn-live"
              onClick={manualRotatePool}
            >
              Rotar 2 Mapas Ahora
            </button>
          </div>
          <div className="mono" style={{ fontSize: "11px", marginBottom: "8px", color: "var(--mut)" }}>
            Al cambiar de temporada rotan 2 mapas automáticamente. Haz clic en un mapa en reserva
            para meterlo al pool activo:
          </div>
          <div className="map-pool-grid">
            {activeNames.map((m) => (
              <span key={m} className="map-pool-chip is-active mono">
                {m} · ACTIVO
              </span>
            ))}
            {benchNames.map((m) => (
              <button
                key={m}
                type="button"
                className="map-pool-chip is-bench mono"
                onClick={() => toggleMapInPool(m)}
                title={`Meter ${m} al pool activo`}
              >
                + {m} (RESERVA)
              </button>
            ))}
          </div>
        </div>
      )}

      {!comp ? (
        <div className="mgr-alert-bar" style={{ borderColor: "var(--vct-red)" }}>
          <span className="mono">
            Necesitas 5 titulares sanos en Plantilla para diseñar composiciones.
          </span>
        </div>
      ) : (
        <>
          <div className="mgr-panel" style={{ marginBottom: "12px" }}>
            <div className="t-group-head" style={{ flexWrap: "wrap", gap: "8px" }}>
              <div>
                <b className="mono">EVALUACIÓN TÁCTICA EN {activeMap.toUpperCase()}</b>
                <span className="ovr-pill mono" style={{ marginLeft: "8px" }}>
                  COMP {comp.compScore}
                </span>
                <span className="igl-tag">{comp.archetype}</span>
              </div>
              <span className="mono" style={{ fontSize: "11px", color: "var(--mut)" }}>
                {ALL_MAPS[activeMap].desc}
              </span>
            </div>

            <div className="comp-axes mono" style={{ marginBottom: "8px" }}>
              {(
                [
                  ["MAC", comp.bonuses.macro],
                  ["UTI", comp.bonuses.util],
                  ["ENT", comp.bonuses.entrada],
                  ["DEF", comp.bonuses.defensa],
                  ["FLX", comp.bonuses.flex]
                ] as const
              ).map(([l, v]) => {
                const pct = (v * 100).toFixed(1);
                const cls = v > 0.004 ? "kd-pos" : v < -0.004 ? "kd-neg" : "";
                return (
                  <span
                    key={l}
                    className={`axis-pill ${cls}`}
                    style={!cls ? { color: "var(--mut)" } : undefined}
                  >
                    {l} {v > 0 ? "+" : ""}
                    {pct}%
                  </span>
                );
              })}
            </div>

            {comp.synergies.length > 0 && (
              <div className="mono kd-pos" style={{ fontSize: "11px", marginBottom: "4px" }}>
                SINERGIAS: {comp.synergies.join(" · ")}
              </div>
            )}
            {comp.warnings.length > 0 ? (
              <div className="mono kd-neg" style={{ fontSize: "11px" }}>
                PENALIZACIONES: {comp.warnings.join(" · ")}
              </div>
            ) : (
              <div className="mono kd-pos" style={{ fontSize: "11px" }}>
                REQUISITOS TÁCTICOS COMPLETOS: sin penalizaciones de rol.
              </div>
            )}
          </div>

          <div className="sc">
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Titular</th>
                  <th style={{ textAlign: "left" }}>Agente Asignado</th>
                  <th style={{ textAlign: "left" }}>Clasificación Táctica</th>
                  <th>FIT MAPA</th>
                  <th>CONFORT</th>
                  <th style={{ textAlign: "left" }}>Elegir Agente Manual</th>
                </tr>
              </thead>
              <tbody>
                {comp.assignments.map((a) => {
                  const chosenManual = savedMap[a.playerName] || "";
                  const agObj = AGENTS[a.agent];
                  return (
                    <tr key={a.playerName}>
                      <td style={{ textAlign: "left" }}>
                        <b>{a.playerName}</b>
                      </td>
                      <td style={{ textAlign: "left" }} className="mono">
                        <RoleIcon roleStr={a.role} /> <b>{a.agent}</b>{" "}
                        {a.manual ? (
                          <span className="igl-tag">MANUAL</span>
                        ) : (
                          <span style={{ fontSize: "10px", color: "var(--mut)" }}>(AUTO)</span>
                        )}
                      </td>
                      <td style={{ textAlign: "left", fontSize: "11px", color: "var(--mut)" }} className="mono">
                        <span style={agObj?.cannotSoloRole ? { color: "var(--gold)" } : undefined}>
                          {getAgentSpecLabel(a.agent)}
                        </span>
                      </td>
                      <td
                        className={`mono ${a.mapFit >= 92 ? "stat-elite" : a.mapFit >= 85 ? "kd-pos" : ""}`}
                        style={a.mapFit < 85 ? { color: "var(--mut)" } : undefined}
                      >
                        <b>{a.mapFit}</b>
                      </td>
                      <td className={`mono ${a.comfort ? "kd-pos" : "kd-neg"}`}>
                        {a.comfort ? "SÍ" : "FUERA POOL"}
                      </td>
                      <td style={{ textAlign: "left" }}>
                        <select
                          className="cb-mini-sel mono"
                          style={{ width: "215px" }}
                          value={chosenManual}
                          onChange={(e) => setCompAgent(a.playerName, e.target.value)}
                        >
                          <option value="">-- Automático (DT {club.coach.n}) --</option>
                          {rolesOrder.map((r) => (
                            <optgroup key={r} label={r.toUpperCase()}>
                              {agentsByRole[r].map((agName) => (
                                <option key={agName} value={agName}>
                                  {agName} · Fit {AGENTS[agName].maps[activeMap]} (
                                  {getAgentSpecLabel(agName)})
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}