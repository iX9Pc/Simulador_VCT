import { RoleIcon } from "../../components/RoleIcon.tsx";
import { TeamLogo } from "../../components/TeamLogo.tsx";
import { useDbStore } from "../../stores/useDbStore.ts";
import { useManagerStore } from "../../stores/useManagerStore.ts";
import {
  calcAcademyPriceByPot,
  calcManagerReputation,
  calcPlayerOvr,
  calcPlayerValue,
  calcRosterOvr,
  computeStageStandings,
  fmtMoney,
  getClubAcademyInfo,
  getClubRequiredRep,
  getDiffCfg
} from "./managerHelpers.ts";
import type { ManagerMatch, NewsCategory, StageSchedule } from "./types.ts";

export function AcademyTab() {
  const M = useManagerStore((s) => s.career);
  const hireAcademy = useManagerStore((s) => s.hireAcademy);
  const scoutMoreAcademy = useManagerStore((s) => s.scoutMoreAcademy);
  const academies = useDbStore((s) => s.academies);
  const teamMeta = useDbStore((s) => s.teamMeta);

  if (!M) return null;

  const club = M.clubs[M.userTeam];
  const acad = getClubAcademyInfo(M.userTeam, academies, teamMeta, M.clubs);
  const qCol =
    acad.quality >= 8.5 ? "var(--gold)" : acad.quality >= 6.5 ? "var(--ok)" : "var(--vct-cyan)";

  return (
    <>
      <div className="mgr-panel" style={{ marginBottom: "10px" }}>
        <div className="t-group-head" style={{ flexWrap: "wrap", gap: "8px" }}>
          <div>
            <b className="mono">
              CALIDAD DE CANTERA: <span style={{ color: qCol }}>{acad.quality.toFixed(1)} / 10</span>
            </b>
            <span className="igl-tag">{acad.tierLabel}</span>
            <span className="mono" style={{ fontSize: "11px", marginLeft: "6px", color: "var(--mut)" }}>
              {acad.source}
            </span>
          </div>
          <div className="mono" style={{ fontSize: "11px", color: "var(--mut)" }}>
            MULT. JOYAS: <b style={{ color: qCol }}>{acad.jewelMult}x</b> · PROB. JOYA (POT 90+):{" "}
            <b>~{acad.jewelChancePct}%</b>
          </div>
        </div>
        <div className="mgr-learn-track">
          <i style={{ width: `${acad.quality * 10}%`, background: qCol }} />
        </div>
      </div>

      <div className="db-controls">
        <span className="mono" style={{ fontSize: "11.5px", color: "var(--mut)" }}>
          PROSPECTOS DE ACADEMIA ({M.academy.length}) · Precio escalado por POT · Sueldos bajos ·
          Mejoran 2.4x más rápido jugando partidos oficiales
        </span>
        <button type="button" className="t-btn-sm mono" onClick={scoutMoreAcademy}>
          Nuevo Ojeo Juvenil ($10k)
        </button>
      </div>

      <div className="sc">
        <table>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Prospecto</th>
              <th style={{ textAlign: "left" }}>Rol</th>
              <th>EDAD</th>
              <th>OVR</th>
              <th>POT</th>
              <th>AIM</th>
              <th>FD</th>
              <th>CLU</th>
              <th>UTI</th>
              <th>IGL</th>
              <th>Salario/Sem</th>
              <th>Coste Contrato</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {M.academy.map((k, idx) => {
              const ovr = calcPlayerOvr(k);
              const cost = k.hireCost || calcAcademyPriceByPot(k.pot);
              const canAfford = club.budget >= cost;
              const potCls = k.pot >= 93 ? "stat-elite" : k.pot >= 89 ? "stat-high" : "";

              return (
                <tr key={`${k.n}-${idx}`}>
                  <td style={{ textAlign: "left" }}>
                    <b>{k.n}</b> <span className="igl-tag">{k.pot >= 93 ? "JOYA" : "CANTERA"}</span>
                  </td>
                  <td style={{ textAlign: "left" }}>
                    <RoleIcon roleStr={k.r} /> {k.r}
                  </td>
                  <td className="mono" style={{ color: "var(--mut)" }}>
                    {k.age}
                  </td>
                  <td className="mono">
                    <b>{ovr}</b>
                  </td>
                  <td
                    className={`mono ${potCls}`}
                    style={!potCls ? { color: "var(--mut)" } : undefined}
                  >
                    <b>{k.pot}</b>
                  </td>
                  <td className="mono">{k.aim}</td>
                  <td className="mono">{k.fd}</td>
                  <td className="mono">{k.clutch}</td>
                  <td className="mono">{k.util}</td>
                  <td className="mono">{k.igl}</td>
                  <td className="mono kd-pos">{fmtMoney(k.salary)}</td>
                  <td className={`mono ${canAfford ? "" : "kd-neg"}`}>
                    <b>{fmtMoney(cost)}</b>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="t-btn-sm mono t-btn-live"
                      disabled={!canAfford}
                      onClick={() => hireAcademy(idx)}
                    >
                      Contratar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function MarketTab() {
  const M = useManagerStore((s) => s.career);
  const marketFilter = useManagerStore((s) => s.marketFilter);
  const setMarketFilter = useManagerStore((s) => s.setMarketFilter);
  const signFreeAgent = useManagerStore((s) => s.signFreeAgent);
  const hireCoach = useManagerStore((s) => s.hireCoach);
  const openBuyNeg = useManagerStore((s) => s.openBuyNeg);

  if (!M) return null;

  const club = M.clubs[M.userTeam];
  const costMult = getDiffCfg(M).costMult;

  if (marketFilter.view === "coaches") {
    return (
      <>
        <div className="db-controls">
          <div className="region-tabs">
            <button
              type="button"
              className="tab-btn mono"
              onClick={() => setMarketFilter("view", "players")}
            >
              JUGADORES
            </button>
            <button
              type="button"
              className="tab-btn mono active"
              onClick={() => setMarketFilter("view", "coaches")}
            >
              HEAD COACHES ({M.freeCoaches.length})
            </button>
          </div>
          <span className="mono" style={{ fontSize: "11px", color: "var(--mut)" }}>
            DT ACTUAL: <b style={{ color: "var(--fg)" }}>{club.coach.n}</b> (MAC {club.coach.macro}{" "}
            · ADP {club.coach.adapt} · DEV {club.coach.dev})
          </span>
        </div>

        <div className="sc">
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Head Coach</th>
                <th style={{ textAlign: "left" }}>Perfil</th>
                <th>EXP</th>
                <th>POT</th>
                <th>MAC</th>
                <th>MIC</th>
                <th>ADP</th>
                <th>DEV</th>
                <th>DISC</th>
                <th>Coste</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {M.freeCoaches.map((c, idx) => {
                const isProsp = c.tier === "prospect" || (c.exp || 5) <= 2;
                const effFee = Math.round(((c.fee || 45000) * costMult) / 1000) * 1000;
                return (
                  <tr key={`${c.n}-${idx}`}>
                    <td style={{ textAlign: "left" }}>
                      <b>{c.n}</b>
                    </td>
                    <td style={{ textAlign: "left" }}>
                      <span
                        className="igl-tag"
                        style={{
                          margin: 0,
                          color: isProsp ? "var(--ok)" : "var(--mut)",
                          borderColor: isProsp ? "var(--ok)" : "var(--bd-hi)"
                        }}
                      >
                        {isProsp ? "PROMESA" : "CONSAGRADO"}
                      </span>
                    </td>
                    <td className="mono" style={{ color: "var(--mut)" }}>
                      {c.exp || 5}a
                    </td>
                    <td className={`mono ${(c.pot || 90) >= 93 ? "stat-elite" : ""}`}>
                      <b>{c.pot || 90}</b>
                    </td>
                    <td className="mono">{c.macro}</td>
                    <td className="mono">{c.micro}</td>
                    <td className="mono">{c.adapt}</td>
                    <td className="mono kd-pos">
                      <b>{c.dev}</b>
                    </td>
                    <td className="mono">{c.disc}</td>
                    <td className={`mono ${club.budget >= effFee ? "" : "kd-neg"}`}>
                      <b>{fmtMoney(effFee)}</b>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="t-btn-sm mono t-btn-live"
                        disabled={club.budget < effFee}
                        onClick={() => hireCoach(idx)}
                      >
                        Contratar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  const q = marketFilter.query.trim().toLowerCase();
  const list: Array<{
    p: (typeof M.freeAgents)[number];
    source: string;
    isFree: boolean;
    faIdx?: number;
    fee: number;
  }> = [];

  if (marketFilter.source === "ALL" || marketFilter.source === "FREE") {
    M.freeAgents.forEach((p, idx) =>
      list.push({
        p,
        source: "Agente Libre",
        isFree: true,
        faIdx: idx,
        fee: Math.round((calcPlayerValue(p) * 0.35) / 1000) * 1000
      })
    );
  }
  if (marketFilter.source === "ALL" || marketFilter.source === "CLUBS") {
    for (const cName of Object.keys(M.clubs)) {
      if (cName === M.userTeam) continue;
      M.clubs[cName].players.forEach((p) =>
        list.push({
          p,
          source: cName,
          isFree: false,
          fee: Math.round((calcPlayerValue(p) * 1.15) / 1000) * 1000
        })
      );
    }
  }

  const filtered = list
    .filter((item) => {
      if (
        marketFilter.role !== "ALL" &&
        !item.p.r.toLowerCase().includes(marketFilter.role.toLowerCase())
      ) {
        return false;
      }
      if (
        q &&
        !item.p.n.toLowerCase().includes(q) &&
        !item.source.toLowerCase().includes(q) &&
        !item.p.r.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) =>
      a.isFree !== b.isFree && marketFilter.source === "ALL"
        ? a.isFree
          ? -1
          : 1
        : calcPlayerOvr(b.p) - calcPlayerOvr(a.p)
    )
    .slice(0, 45);

  return (
    <>
      <div className="db-controls">
        <div className="region-tabs">
          <button
            type="button"
            className="tab-btn mono active"
            onClick={() => setMarketFilter("view", "players")}
          >
            JUGADORES
          </button>
          <button
            type="button"
            className="tab-btn mono"
            onClick={() => setMarketFilter("view", "coaches")}
          >
            HEAD COACHES ({M.freeCoaches.length})
          </button>

          <select
            className="cb-mini-sel mono"
            value={marketFilter.source}
            onChange={(e) =>
              setMarketFilter("source", e.target.value as "ALL" | "FREE" | "CLUBS")
            }
          >
            <option value="ALL">Origen: Todos</option>
            <option value="FREE">Agentes Libres ({M.freeAgents.length})</option>
            <option value="CLUBS">Clubes Rivales</option>
          </select>

          <select
            className="cb-mini-sel mono"
            value={marketFilter.role}
            onChange={(e) => setMarketFilter("role", e.target.value)}
          >
            <option value="ALL">Rol: Todos</option>
            {["Duelista", "Iniciador", "Controlador", "Centinela", "Flex"].map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <input
          type="search"
          className="search-input"
          value={marketFilter.query}
          placeholder="Buscar jugador o club..."
          onChange={(e) => setMarketFilter("query", e.target.value)}
        />
      </div>

      <div className="sc">
        <table>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Jugador</th>
              <th style={{ textAlign: "left" }}>Club Actual</th>
              <th>EDAD</th>
              <th>OVR</th>
              <th>POT</th>
              <th>AIM</th>
              <th>CLU</th>
              <th>UTI</th>
              <th>IGL</th>
              <th>Sueldo/Sem</th>
              <th>Coste</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item, idx) => {
              const p = item.p;
              const ovr = calcPlayerOvr(p);
              const canAfford = club.budget >= item.fee;
              return (
                <tr key={`${item.source}-${p.n}-${idx}`}>
                  <td style={{ textAlign: "left" }}>
                    <b>{p.n}</b>{" "}
                    <small style={{ color: "var(--mut)" }}>
                      <RoleIcon roleStr={p.r} /> {p.r}
                    </small>
                  </td>
                  <td
                    style={{
                      textAlign: "left",
                      fontSize: "11px",
                      color: item.isFree ? undefined : "var(--mut)"
                    }}
                    className={`mono ${item.isFree ? "kd-pos" : ""}`}
                  >
                    {item.source}
                  </td>
                  <td className="mono" style={{ color: "var(--mut)" }}>
                    {p.age}
                  </td>
                  <td className="mono">
                    <b>{ovr}</b>
                  </td>
                  <td className={`mono ${p.pot >= 92 ? "stat-elite" : ""}`}>{p.pot}</td>
                  <td className="mono">{p.aim}</td>
                  <td className="mono">{p.clutch}</td>
                  <td className="mono">{p.util}</td>
                  <td className="mono">{p.igl}</td>
                  <td className="mono" style={{ color: "var(--mut)" }}>
                    {fmtMoney(p.salary)}
                  </td>
                  <td className={`mono ${canAfford ? "" : "kd-neg"}`}>
                    <b>{fmtMoney(item.fee)}</b>
                  </td>
                  <td>
                    {item.isFree && item.faIdx !== undefined ? (
                      <button
                        type="button"
                        className="t-btn-sm mono t-btn-live"
                        disabled={!canAfford}
                        onClick={() => signFreeAgent(item.faIdx!)}
                      >
                        Fichar
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="t-btn-sm mono"
                        style={{ borderColor: "var(--vct-cyan)", color: "var(--vct-cyan)" }}
                        onClick={() => openBuyNeg(item.source, p.n)}
                      >
                        Negociar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function CalendarTab() {
  const M = useManagerStore((s) => s.career);
  if (!M) return null;

  const sc = M.schedule;

  const renderStageTable = (stageObj: StageSchedule, title: string) => {
    const st = computeStageStandings(stageObj, M.clubs);
    return (
      <div className="t-group-card">
        <div className="t-group-head">
          <b className="mono">{title}</b>
          <span className="mono" style={{ color: "var(--mut)" }}>
            TOP 4 PLAYOFFS
          </span>
        </div>
        <div className="sc">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th style={{ textAlign: "left" }}>Club</th>
                <th>PJ</th>
                <th>G-P</th>
                <th>MAP</th>
                <th>PTS</th>
              </tr>
            </thead>
            <tbody>
              {st.map((r, i) => (
                <tr key={r.team} className={r.team === M.userTeam ? "t-friend-row" : ""}>
                  <td
                    className={`mono ${i < 4 ? "kd-pos" : ""}`}
                    style={i >= 4 ? { color: "var(--mut)" } : undefined}
                  >
                    <b>{i + 1}</b>
                  </td>
                  <td style={{ textAlign: "left" }}>
                    <span className="t-team-cell">
                      <TeamLogo teamName={r.team} className="mini-team-logo" />
                      <b>{r.team}</b>
                    </span>
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
                  <td className="mono">
                    <b>{r.pts}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderListCard = (title: string, list: ManagerMatch[]) => (
    <div className="t-group-card">
      <div className="t-group-head">
        <b className="mono">{title}</b>
      </div>
      <div className="mgr-bracket-list" style={{ maxHeight: "260px", overflowY: "auto" }}>
        {list.map((m) => (
          <div
            key={m.id}
            className={`mgr-b-row ${
              m.teamA === M.userTeam || m.teamB === M.userTeam ? "t-friend-border" : ""
            }`}
          >
            <span className="mono" style={{ fontSize: "10px", color: "var(--mut)" }}>
              S{m.week} · {m.label}
            </span>
            <div className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
              <b className={m.played && m.winner === m.teamA ? "kd-pos" : ""}>{m.teamA || "TBD"}</b>
              <span>{m.played ? `${m.scoreA} : ${m.scoreB}` : `BO${m.fmt}`}</span>
              <b className={m.played && m.winner === m.teamB ? "kd-pos" : ""}>{m.teamB || "TBD"}</b>
            </div>
            {m.mapsLine && (
              <small className="mono" style={{ fontSize: "10px", color: "var(--mut)" }}>
                {m.mapsLine}
              </small>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const vctRanking = Object.keys(M.clubs)
    .map((c) => ({
      team: c,
      pts: sc.vctPoints[c] || 0,
      reg: M.clubs[c].reg,
      ovr: calcRosterOvr(M.clubs[c].players, M.clubs[c].coach)
    }))
    .sort((a, b) => b.pts - a.pts || b.ovr - a.ovr);

  return (
    <>
      <div className="t-groups-grid">
        {renderStageTable(sc.stage1, `${sc.stage1.leagueName.toUpperCase()} (SEM 2-6)`)}
        {renderListCard("STAGE 1 PO (S7-8) · VIAJE (S9-10) · MASTERS 1 (S11-13)", [
          ...sc.stage1.playoffs,
          ...sc.stage1.masters
        ])}
      </div>

      <div className="t-groups-grid" style={{ marginTop: "10px" }}>
        {renderStageTable(sc.stage2, `${sc.stage2.leagueName.toUpperCase()} (SEM 15-19)`)}
        {renderListCard("STAGE 2 PO (S20-21) · VIAJE (S22-23) · MASTERS 2 (S24-26)", [
          ...sc.stage2.playoffs,
          ...sc.stage2.masters
        ])}
      </div>

      <div className="t-groups-grid" style={{ marginTop: "10px" }}>
        {renderListCard(`VIAJE (S27-28) · VALORANT CHAMPIONS ${M.season} (S29-32)`, sc.champions)}
        <div className="t-group-card">
          <div className="t-group-head">
            <b className="mono">TABLA GLOBAL PUNTOS VCT (TOP 16 A CHAMPIONS)</b>
          </div>
          <div className="sc" style={{ maxHeight: "260px", overflowY: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th style={{ textAlign: "left" }}>Equipo</th>
                  <th>REG</th>
                  <th>OVR</th>
                  <th>PTS VCT</th>
                </tr>
              </thead>
              <tbody>
                {vctRanking.map((r, i) => (
                  <tr key={r.team} className={r.team === M.userTeam ? "t-friend-row" : ""}>
                    <td
                      className={`mono ${i < 16 ? "kd-pos" : ""}`}
                      style={i >= 16 ? { color: "var(--mut)" } : undefined}
                    >
                      <b>{i + 1}</b>
                    </td>
                    <td style={{ textAlign: "left" }}>
                      <span className="t-team-cell">
                        <TeamLogo teamName={r.team} className="mini-team-logo" />
                        <b>{r.team}</b>
                      </span>
                    </td>
                    <td className="mono" style={{ color: "var(--mut)" }}>
                      {r.reg}
                    </td>
                    <td className="mono">{r.ovr}</td>
                    <td className="mono">
                      <b>{r.pts}</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

export function ClubsTab() {
  const M = useManagerStore((s) => s.career);
  const clubsFilter = useManagerStore((s) => s.clubsFilter);
  const setClubsFilter = useManagerStore((s) => s.setClubsFilter);
  const applyForClub = useManagerStore((s) => s.applyForClub);
  const openBuyNeg = useManagerStore((s) => s.openBuyNeg);
  const academies = useDbStore((s) => s.academies);
  const teamMeta = useDbStore((s) => s.teamMeta);

  if (!M) return null;

  const clubList = Object.keys(M.clubs)
    .filter((c) => clubsFilter.reg === "ALL" || M.clubs[c].reg === clubsFilter.reg)
    .sort(
      (a, b) =>
        calcRosterOvr(M.clubs[b].players, M.clubs[b].coach) -
        calcRosterOvr(M.clubs[a].players, M.clubs[a].coach)
    );

  const selName =
    clubsFilter.selectedClub && M.clubs[clubsFilter.selectedClub]
      ? clubsFilter.selectedClub
      : clubList.find((c) => c !== M.userTeam) || clubList[0];
  const selClub = M.clubs[selName];

  const myRep = calcManagerReputation(M);
  const reqRep = getClubRequiredRep(selClub);
  const nowTick = M.season * 100 + M.week;
  const cd = M.career.applyCooldown[selClub.name] || 0;
  const onCooldown = nowTick < cd;
  const repDiff = myRep - reqRep;
  const chanceLabel = repDiff >= 2 ? "ALTA" : repDiff >= -5 ? "MEDIA" : "BAJA";
  const chanceCls = repDiff >= 2 ? "kd-pos" : repDiff >= -5 ? "stat-elite" : "kd-neg";
  const selAcad = getClubAcademyInfo(selClub.name, academies, teamMeta, M.clubs);

  return (
    <>
      <div className="db-controls">
        <div className="region-tabs">
          {["ALL", "AMERICAS", "EMEA", "PACIFIC", "CHINA"].map((r) => (
            <button
              key={r}
              type="button"
              className={`tab-btn mono ${clubsFilter.reg === r ? "active" : ""}`}
              onClick={() => setClubsFilter("reg", r)}
            >
              {r === "ALL" ? `TODOS (${Object.keys(M.clubs).length})` : r}
            </button>
          ))}
        </div>
        <span className="mono" style={{ fontSize: "11px", color: "var(--mut)" }}>
          TU REPUTACIÓN: <b style={{ color: "var(--vct-cyan)" }}>{myRep}/99</b> · Haz clic en un
          club para ver su roster o postularte como Manager
        </span>
      </div>

      <div className="mgr-clubs-layout">
        <div className="t-group-card">
          <div className="t-group-head">
            <b className="mono">FRANQUICIAS VCT ({clubList.length})</b>
          </div>
          <div className="sc" style={{ maxHeight: "430px", overflowY: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Club</th>
                  <th>REG</th>
                  <th>OVR</th>
                  <th>REQ REP</th>
                  <th>PTS</th>
                </tr>
              </thead>
              <tbody>
                {clubList.map((cName) => {
                  const cl = M.clubs[cName];
                  const isSel = cName === selClub.name;
                  const rReq = getClubRequiredRep(cl);
                  return (
                    <tr
                      key={cName}
                      style={{ cursor: "pointer", background: isSel ? "var(--bg3)" : undefined }}
                      onClick={() => setClubsFilter("selectedClub", cName)}
                    >
                      <td style={{ textAlign: "left" }}>
                        <span className="t-team-cell">
                          <TeamLogo teamName={cName} className="mini-team-logo" />
                          <b>{cName}</b>
                          {cName === M.userTeam && <span className="igl-tag">TÚ</span>}
                        </span>
                      </td>
                      <td className="mono" style={{ color: "var(--mut)" }}>
                        {cl.reg.slice(0, 3)}
                      </td>
                      <td className="mono">
                        <b>{calcRosterOvr(cl.players, cl.coach)}</b>
                      </td>
                      <td
                        className={`mono ${myRep >= rReq ? "kd-pos" : ""}`}
                        style={myRep < rReq ? { color: "var(--mut)" } : undefined}
                      >
                        {cName === M.userTeam ? "-" : rReq}
                      </td>
                      <td className="mono">{M.schedule.vctPoints[cName] || 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="t-group-card">
          <div className="t-group-head" style={{ flexWrap: "wrap", gap: "8px" }}>
            <span className="t-team-cell">
              <TeamLogo teamName={selClub.name} className="mini-team-logo" />
              <b style={{ color: selClub.color, fontSize: "15px" }}>{selClub.name}</b>
              <span className="mono" style={{ color: "var(--mut)" }}>
                DT {selClub.coach.n} · CAJA {fmtMoney(selClub.budget)} · ACAD{" "}
                {selAcad.quality.toFixed(1)}/10 ({selAcad.source})
              </span>
            </span>

            <div className="btn-group">
              {selClub.name !== M.userTeam ? (
                <>
                  <span
                    className="mono"
                    style={{ fontSize: "10.5px", alignSelf: "center", color: "var(--mut)" }}
                  >
                    REQ REP {reqRep} (<b className={chanceCls}>{chanceLabel}</b>)
                  </span>
                  <button
                    type="button"
                    className="t-btn-sm mono t-btn-live"
                    disabled={onCooldown}
                    onClick={() => applyForClub(selClub.name)}
                  >
                    {onCooldown ? `Espera ${cd - nowTick}S` : "Postular como Manager"}
                  </button>
                </>
              ) : (
                <span className="igl-tag">TU CLUB ACTUAL</span>
              )}
            </div>
          </div>

          <div className="sc">
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Jugador</th>
                  <th>ESTADO</th>
                  <th>EDAD</th>
                  <th>OVR / POT</th>
                  <th>AIM</th>
                  <th>FD</th>
                  <th>CLU</th>
                  <th>UTI</th>
                  <th>IGL</th>
                  <th>Cláusula</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {selClub.players.map((p) => {
                  const ovr = calcPlayerOvr(p);
                  const buyout = Math.round((calcPlayerValue(p) * 1.15) / 1000) * 1000;
                  const stTxt = p.injuredWeeks > 0 ? `LES ${p.injuredWeeks}S` : p.sub ? "SUB" : "TIT";
                  return (
                    <tr key={p.n}>
                      <td style={{ textAlign: "left" }}>
                        <b>{p.n}</b>{" "}
                        <small style={{ color: "var(--mut)" }}>
                          <RoleIcon roleStr={p.r} /> {p.r}
                        </small>
                      </td>
                      <td
                        className={`mono ${p.injuredWeeks > 0 ? "kd-neg" : p.sub ? "" : "kd-pos"}`}
                        style={p.sub && p.injuredWeeks <= 0 ? { color: "var(--mut)" } : undefined}
                      >
                        {stTxt}
                      </td>
                      <td className="mono" style={{ color: "var(--mut)" }}>
                        {p.age}
                      </td>
                      <td className="mono">
                        <b>{ovr}</b> <span style={{ color: "var(--mut)" }}>/ {p.pot}</span>
                      </td>
                      <td className="mono">{p.aim}</td>
                      <td className="mono">{p.fd}</td>
                      <td className="mono">{p.clutch}</td>
                      <td className="mono">{p.util}</td>
                      <td className="mono">{p.igl}</td>
                      <td className="mono" style={{ color: "var(--mut)" }}>
                        {selClub.name === M.userTeam ? "-" : fmtMoney(buyout)}
                      </td>
                      <td>
                        {selClub.name === M.userTeam ? (
                          <span className="mono" style={{ fontSize: "10px", color: "var(--mut)" }}>
                            TU CLUB
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="t-btn-sm mono"
                            style={{ borderColor: "var(--vct-cyan)", color: "var(--vct-cyan)" }}
                            onClick={() => openBuyNeg(selClub.name, p.n)}
                          >
                            Negociar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

export function NewsTab() {
  const M = useManagerStore((s) => s.career);
  const newsFilter = useManagerStore((s) => s.newsFilter);
  const setNewsFilter = useManagerStore((s) => s.setNewsFilter);

  if (!M) return null;

  const list = M.news.filter((n) => newsFilter === "ALL" || n.cat === newsFilter);
  const cats: ReadonlyArray<["ALL" | NewsCategory, string]> = [
    ["ALL", `TODOS (${M.news.length})`],
    ["RUMOR", "RUMORES"],
    ["UPSET", "UPSETS"],
    ["DRAMA", "DRAMA"],
    ["OFICIAL", "OFICIAL"]
  ];

  return (
    <>
      <div className="db-controls">
        <div className="region-tabs">
          {cats.map(([id, lab]) => (
            <button
              key={id}
              type="button"
              className={`tab-btn mono ${newsFilter === id ? "active" : ""}`}
              onClick={() => setNewsFilter(id)}
            >
              {lab}
            </button>
          ))}
        </div>
        <span className="mono" style={{ fontSize: "11px", color: "var(--mut)" }}>
          MAP POOL ACTIVO ({M.season}):{" "}
          <b style={{ color: "var(--fg)" }}>{M.activeMapPool.join(" · ")}</b>
        </span>
      </div>

      <div className="news-grid">
        {list.length > 0 ? (
          list.map((n) => (
            <article key={n.id} className={`news-card ${n.hot ? "is-hot" : ""}`}>
              <div className="news-head mono">
                <span className={`news-tag cat-${n.cat.toLowerCase()}`}>{n.cat}</span>
                <span style={{ color: "var(--mut)" }}>
                  TEMPORADA {n.s} · SEMANA {n.w}
                </span>
              </div>
              <h3>{n.headline}</h3>
              <p>{n.body}</p>
            </article>
          ))
        ) : (
          <p className="mono" style={{ fontSize: "12px", color: "var(--mut)" }}>
            No hay titulares registrados en esta categoría todavía.
          </p>
        )}
      </div>
    </>
  );
}

export function FinanceTab() {
  const M = useManagerStore((s) => s.career);
  if (!M) return null;

  const club = M.clubs[M.userTeam];
  const payroll = club.players.reduce((s, p) => s + (p.salary || 2500), 0);

  return (
    <div className="t-groups-grid">
      <div className="t-group-card">
        <div className="t-group-head">
          <b className="mono">MOVIMIENTOS FINANCIEROS</b>
          <span className="mono" style={{ color: "var(--mut)" }}>
            SPONSORS {fmtMoney(club.sponsorWeekly)} · NÓMINA {fmtMoney(payroll)}/SEM
          </span>
        </div>

        {club.activeSponsors.length > 0 && (
          <div className="mono" style={{ fontSize: "11px", marginBottom: "8px", color: "var(--ok)" }}>
            Sponsors extra activos:{" "}
            {club.activeSponsors.map((s) => `${s.name} (+${fmtMoney(s.weekly)}/sem)`).join(" · ")}
          </div>
        )}

        <div className="sc" style={{ maxHeight: "280px", overflowY: "auto" }}>
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Sem</th>
                <th style={{ textAlign: "left" }}>Concepto</th>
                <th>Monto</th>
              </tr>
            </thead>
            <tbody>
              {M.financeLog.length > 0 ? (
                M.financeLog.map((f, i) => (
                  <tr key={i}>
                    <td style={{ textAlign: "left", color: "var(--mut)" }} className="mono">
                      T{f.s}-S{f.w}
                    </td>
                    <td style={{ textAlign: "left" }}>{f.concept}</td>
                    <td className={`mono ${f.amount >= 0 ? "kd-pos" : "kd-neg"}`}>
                      <b>{fmtMoney(f.amount)}</b>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="mono" style={{ color: "var(--mut)" }}>
                    Sin movimientos aún.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="t-group-card">
        <div className="t-group-head">
          <b className="mono">PALMARÉS DEL MANAGER &amp; FICHAJES</b>
          <span className="mono" style={{ color: "var(--mut)" }}>
            RÉCORD: {M.career.wins}W-{M.career.losses}L · RACHA: {M.bestStreak || 0}W
          </span>
        </div>

        <div style={{ marginBottom: "8px", fontSize: "12px" }} className="mono">
          {M.trophies.length > 0 ? (
            M.trophies.map((t, i) => (
              <span
                key={i}
                className="duel-badge"
                style={{ margin: "0 5px 5px 0", display: "inline-block" }}
              >
                {t.season} · {t.title} ({t.club})
              </span>
            ))
          ) : (
            <span style={{ color: "var(--mut)" }}>Sin trofeos todavía.</span>
          )}
        </div>

        <div className="sc" style={{ maxHeight: "230px", overflowY: "auto" }}>
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Op</th>
                <th style={{ textAlign: "left" }}>Jugador</th>
                <th style={{ textAlign: "left" }}>Movimiento</th>
                <th>Monto</th>
              </tr>
            </thead>
            <tbody>
              {M.transferLog.length > 0 ? (
                M.transferLog.map((tr, i) => (
                  <tr key={i}>
                    <td
                      style={{ textAlign: "left" }}
                      className={`mono ${tr.type === "VENTA" ? "kd-pos" : "kd-neg"}`}
                    >
                      {tr.type}
                    </td>
                    <td style={{ textAlign: "left" }}>
                      <b>{tr.player}</b>
                    </td>
                    <td style={{ textAlign: "left", color: "var(--mut)" }}>
                      {tr.from} → {tr.to}
                    </td>
                    <td className="mono">{fmtMoney(tr.fee)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="mono" style={{ color: "var(--mut)" }}>
                    Sin fichajes realizados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}