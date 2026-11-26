import { useMemo, useState } from "react";
import { AGENTS, getPlayerAgents, getTeamOvr } from "../../core/index.ts";
import type { Coach, Region } from "../../core/index.ts";
import { TeamLogo } from "../../components/TeamLogo.tsx";
import { useDbStore } from "../../stores/useDbStore.ts";
import { useMatchStore } from "../../stores/useMatchStore.ts";
import { useSocialStore } from "../../stores/useSocialStore.ts";
import { copyShareLink, exportSnapshotPNG } from "./shareUtils.ts";
import type { CompactSeriesSnapshot } from "./shareUtils.ts";

type SocialTab = "history" | "form" | "custom";

interface DraftSlot {
  n: string;
  r: string;
  aim: number;
  fd: number;
  clutch: number;
  entry: number;
  util: number;
  igl: number;
  conf: number;
  cons: number;
  pot: number;
  agents: string;
}

type NumericSlotKey = "aim" | "fd" | "clutch" | "entry" | "util" | "igl" | "conf" | "cons" | "pot";

const NUMERIC_KEYS: readonly NumericSlotKey[] = [
  "aim",
  "fd",
  "clutch",
  "entry",
  "util",
  "igl",
  "conf",
  "cons",
  "pot"
];

const ROLE_OPTIONS = [
  "Duelista",
  "Flex",
  "Iniciador",
  "Controlador",
  "Centinela",
  "Iniciador/IGL",
  "Controlador/IGL",
  "IGL/Centinela",
  "Duelista/Flex"
];

const DEFAULT_SLOTS: DraftSlot[] = [
  { n: "Player1", r: "Duelista", aim: 90, fd: 88, clutch: 83, entry: 91, util: 75, igl: 62, conf: 82, cons: 81, pot: 90, agents: "Jett, Raze, Neon" },
  { n: "Player2", r: "Flex", aim: 87, fd: 82, clutch: 84, entry: 84, util: 84, igl: 68, conf: 80, cons: 82, pot: 88, agents: "Yoru, KAY/O, Fade" },
  { n: "Player3", r: "Iniciador", aim: 85, fd: 76, clutch: 85, entry: 76, util: 90, igl: 72, conf: 81, cons: 85, pot: 87, agents: "Sova, Fade, Tejo" },
  { n: "Player4", r: "Controlador", aim: 85, fd: 75, clutch: 86, entry: 74, util: 91, igl: 86, conf: 82, cons: 86, pot: 87, agents: "Omen, Viper, Miks" },
  { n: "Player5", r: "Centinela", aim: 88, fd: 78, clutch: 89, entry: 75, util: 84, igl: 68, conf: 83, cons: 87, pot: 88, agents: "Cypher, Chamber, Veto" }
];

export function SocialSection() {
  const [activeTab, setActiveTab] = useState<SocialTab>("history");
  const [toastMsg, setToastMsg] = useState("");

  // Borrador de equipo personalizado
  const [draftName, setDraftName] = useState("");
  const [draftCode, setDraftCode] = useState("CUS");
  const [draftReg, setDraftReg] = useState<Region>("AMERICAS");
  const [draftColor, setDraftColor] = useState("#10B981");
  const [draftCoach, setDraftCoach] = useState<Coach>({
    n: "HeadCoach",
    macro: 84,
    micro: 84,
    adapt: 84,
    dev: 84,
    disc: 85
  });
  const [slots, setSlots] = useState<DraftSlot[]>(() => DEFAULT_SLOTS.map((s) => ({ ...s })));

  const teams = useDbStore((s) => s.teams);
  const coaches = useDbStore((s) => s.coaches);
  const customTeams = useDbStore((s) => s.customTeams);
  const upsertCustomTeam = useDbStore((s) => s.upsertCustomTeam);
  const deleteCustomTeam = useDbStore((s) => s.deleteCustomTeam);

  const history = useSocialStore((s) => s.history);
  const formData = useSocialStore((s) => s.formData);
  const formEnabled = useSocialStore((s) => s.formEnabled);
  const toggleFormEnabled = useSocialStore((s) => s.toggleFormEnabled);
  const resetForm = useSocialStore((s) => s.resetForm);
  const clearHistory = useSocialStore((s) => s.clearHistory);

  const customNames = useMemo(() => Object.keys(customTeams), [customTeams]);

  const proOptions = useMemo(() => {
    const out: Array<{ value: string; label: string }> = [];
    for (const t of Object.keys(teams)) {
      for (const p of teams[t]) {
        out.push({
          value: `${t}::${p.n}`,
          label: `${p.n} (${t} · ${p.r} · AIM ${p.aim})`
        });
      }
    }
    return out;
  }, [teams]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => {
      setToastMsg((cur) => (cur === msg ? "" : cur));
    }, 3000);
  };

  const handleRematch = (h: CompactSeriesSnapshot) => {
    if (!teams[h.a] || !teams[h.b]) return;
    useMatchStore.setState({ teamA: h.a, teamB: h.b, format: h.f });
    useMatchStore.getState().simulateFull(true);
    document.getElementById("out")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleCopyHistoryLink = async (h: CompactSeriesSnapshot) => {
    const msg = await copyShareLink(h);
    showToast(msg);
  };

  const handleExportHistoryPng = async (h: CompactSeriesSnapshot) => {
    await exportSnapshotPNG(h);
    showToast("IMAGEN PNG DESCARGADA");
  };

  const updateSlotString = (idx: number, field: "n" | "r" | "agents", val: string) => {
    setSlots((prev) => prev.map((sl, i) => (i === idx ? { ...sl, [field]: val } : sl)));
  };

  const updateSlotNumber = (idx: number, field: NumericSlotKey, val: string) => {
    const num = Math.max(40, Math.min(99, parseInt(val, 10) || 80));
    setSlots((prev) => prev.map((sl, i) => (i === idx ? { ...sl, [field]: num } : sl)));
  };

  const importProToSlot = (idx: number, proKey: string) => {
    if (!proKey) return;
    const [tName, pName] = proKey.split("::");
    const found = (teams[tName] || []).find((p) => p.n === pName);
    if (!found) return;
    const agList = getPlayerAgents(found).slice(0, 4).join(", ");
    setSlots((prev) =>
      prev.map((sl, i) =>
        i === idx
          ? {
              n: found.n,
              r: found.r,
              aim: found.aim,
              fd: found.fd,
              clutch: found.clutch,
              entry: found.entry,
              util: found.util,
              igl: found.igl,
              conf: found.conf,
              cons: found.cons,
              pot: found.pot,
              agents: agList
            }
          : sl
      )
    );
  };

  const handleSaveCustomTeam = () => {
    const cleanName = draftName.trim();
    if (!cleanName) {
      window.alert("Escribe un nombre para tu equipo personalizado.");
      return;
    }

    const cleanCode = (draftCode.trim() || cleanName.slice(0, 3)).toUpperCase().slice(0, 4);
    const agentPools: Record<string, string[]> = {};
    const players = slots.map((sl, i) => {
      const pName = (sl.n || `Jugador${i + 1}`).trim();
      const parsedAgents = sl.agents
        .split(",")
        .map((x) => x.trim())
        .filter((a) => Boolean(AGENTS[a]));
      if (parsedAgents.length) agentPools[pName] = parsedAgents;
      return {
        n: pName,
        r: sl.r || "Flex",
        aim: Number(sl.aim) || 85,
        fd: Number(sl.fd) || 80,
        clutch: Number(sl.clutch) || 82,
        entry: Number(sl.entry) || 80,
        util: Number(sl.util) || 82,
        igl: Number(sl.igl) || 70,
        conf: Number(sl.conf) || 80,
        cons: Number(sl.cons) || 82,
        pot: Number(sl.pot) || 86,
        sub: 0
      };
    });

    upsertCustomTeam(cleanName, {
      reg: draftReg,
      color: draftColor || "#10B981",
      code: cleanCode,
      coach: { ...draftCoach },
      players,
      agentPools
    });

    setDraftName("");
    const curMatch = useMatchStore.getState();
    const allNames = Object.keys(useDbStore.getState().teams);
    const nextB =
      curMatch.teamB === cleanName
        ? allNames.find((n) => n !== cleanName) || curMatch.teamA
        : curMatch.teamB;
    useMatchStore.setState({ teamA: cleanName, teamB: nextB });
    useMatchStore.getState().simulateFull(true);
    showToast(`EQUIPO "${cleanName.toUpperCase()}" GUARDADO`);
  };

  // Preparación de listas para pestaña de Forma
  const pEntries = useMemo(
    () =>
      Object.entries(formData.players)
        .map(([name, rec]) => ({ name, ...rec }))
        .sort((a, b) => b.bonus - a.bonus),
    [formData.players]
  );

  const tEntries = useMemo(
    () =>
      Object.entries(formData.teams)
        .map(([name, rec]) => ({ name, ...rec }))
        .sort((a, b) => b.w - b.l - (a.w - a.l)),
    [formData.teams]
  );

  const topHot = pEntries.slice(0, 10);
  const topCold = pEntries
    .slice(-8)
    .reverse()
    .filter((c) => !topHot.some((h) => h.name === c.name));
  const combinedFormRows = [...topHot, ...topCold];

  return (
    <section id="social" className="box">
      <div className="box-head">
        <div>
          <h2>Persistencia, Forma Acumulada &amp; Equipos Personalizados</h2>
          <small style={{ color: "var(--mut)" }}>
            Historial local de resultados, evolución de forma por rendimiento reciente, creador de
            rosters propios y exportación social.
          </small>
        </div>

        <div className="btn-group">
          {toastMsg && (
            <span className="mono kd-pos" style={{ fontSize: "11px", alignSelf: "center" }}>
              {toastMsg}
            </span>
          )}
          <button
            type="button"
            className={`t-btn-sm mono ${formEnabled ? "t-btn-live" : ""}`}
            onClick={toggleFormEnabled}
          >
            FORMA PERSISTENTE: {formEnabled ? "ON" : "OFF"}
          </button>
          {activeTab === "history" && history.length > 0 && (
            <button type="button" className="t-btn-sm mono" onClick={clearHistory}>
              Limpiar Historial
            </button>
          )}
          {activeTab === "form" && (
            <button type="button" className="t-btn-sm mono" onClick={resetForm}>
              Resetear Forma
            </button>
          )}
        </div>
      </div>

      <div className="series-tabs">
        <button
          type="button"
          className={`series-tab ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          HISTORIAL ({history.length})
        </button>
        <button
          type="button"
          className={`series-tab ${activeTab === "form" ? "active" : ""}`}
          onClick={() => setActiveTab("form")}
        >
          RACHAS Y FORMA
        </button>
        <button
          type="button"
          className={`series-tab ${activeTab === "custom" ? "active" : ""}`}
          onClick={() => setActiveTab("custom")}
        >
          EQUIPOS PERSONALIZADOS ({customNames.length})
        </button>
      </div>

      {/* TAB 1: HISTORIAL */}
      {activeTab === "history" &&
        (history.length === 0 ? (
          <p className="mono" style={{ fontSize: "12px", color: "var(--mut)" }}>
            Todavía no hay series guardadas. Pulsa &ldquo;Simular Serie&rdquo; o termina un partido
            en Auto-Play para registrar tu historial.
          </p>
        ) : (
          <div className="sc">
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Fecha</th>
                  <th>FMT</th>
                  <th style={{ textAlign: "left" }}>Enfrentamiento</th>
                  <th>Marcador</th>
                  <th style={{ textAlign: "left" }}>Mapas</th>
                  <th style={{ textAlign: "left" }}>MVP</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td
                      style={{ textAlign: "left", fontSize: "11px", color: "var(--mut)" }}
                      className="mono"
                    >
                      {h.d}
                    </td>
                    <td className="mono" style={{ color: "var(--mut)" }}>
                      BO{h.f}
                    </td>
                    <td style={{ textAlign: "left" }}>
                      <b style={{ color: h.ca }}>{h.a}</b>{" "}
                      <span style={{ color: "var(--mut)" }}>vs</span>{" "}
                      <b style={{ color: h.cb }}>{h.b}</b>
                    </td>
                    <td className="mono">
                      <b>
                        {h.sa} : {h.sb}
                      </b>
                    </td>
                    <td
                      style={{ textAlign: "left", fontSize: "11px", color: "var(--mut)" }}
                      className="mono"
                    >
                      {h.maps.map((m) => `${m[0].slice(0, 3).toUpperCase()} ${m[1]}-${m[2]}`).join(" · ")}
                    </td>
                    <td style={{ textAlign: "left", fontSize: "11.5px" }} className="mono">
                      <b>{h.mvp[0]}</b>{" "}
                      <span style={{ color: "var(--mut)" }}>({h.mvp[2]})</span>
                    </td>
                    <td>
                      <div className="btn-group" style={{ justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          className="t-btn-sm mono"
                          onClick={() => handleRematch(h)}
                        >
                          Revancha
                        </button>
                        <button
                          type="button"
                          className="t-btn-sm mono"
                          onClick={() => handleCopyHistoryLink(h)}
                        >
                          Link
                        </button>
                        <button
                          type="button"
                          className="t-btn-sm mono t-btn-live"
                          onClick={() => handleExportHistoryPng(h)}
                        >
                          PNG
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {/* TAB 2: RACHAS Y FORMA */}
      {activeTab === "form" &&
        (pEntries.length === 0 ? (
          <p className="mono" style={{ fontSize: "12px", color: "var(--mut)" }}>
            Simula series para activar el seguimiento de racha W/L y forma persistente de los
            jugadores.
          </p>
        ) : (
          <div className="t-groups-grid">
            <div className="t-group-card">
              <div className="t-group-head">
                <b className="mono">RACHAS DE EQUIPOS (ÚLTIMAS 5 SERIES)</b>
              </div>
              <div className="sc">
                <table>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>Equipo</th>
                      <th>G-P</th>
                      <th style={{ textAlign: "right" }}>Racha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tEntries.map((t) => (
                      <tr key={t.name}>
                        <td style={{ textAlign: "left" }}>
                          <span className="t-team-cell">
                            <TeamLogo teamName={t.name} className="mini-team-logo" />
                            <b>{t.name}</b>
                          </span>
                        </td>
                        <td className="mono">
                          <b>
                            {t.w}-{t.l}
                          </b>
                        </td>
                        <td className="mono" style={{ textAlign: "right" }}>
                          {t.streak.map((r, i) => (
                            <span
                              key={i}
                              className={`streak-pip ${r === "W" ? "is-w" : "is-l"}`}
                            >
                              {r}
                            </span>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="t-group-card">
              <div className="t-group-head">
                <b className="mono">
                  ESTADO DE FORMA INDIVIDUAL (ACTIVO EN SIMULADOR: {formEnabled ? "SÍ" : "NO"})
                </b>
              </div>
              <div className="sc">
                <table>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>Jugador</th>
                      <th style={{ textAlign: "left" }}>Equipo</th>
                      <th>SER</th>
                      <th>R2.0 MED</th>
                      <th>MOD FORMA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {combinedFormRows.map((p) => {
                      const pct = (p.bonus * 100).toFixed(1);
                      const cls =
                        p.bonus > 0.005 ? "kd-pos" : p.bonus < -0.005 ? "kd-neg" : "";
                      return (
                        <tr key={p.name}>
                          <td style={{ textAlign: "left" }}>
                            <b>{p.name}</b>
                          </td>
                          <td style={{ textAlign: "left", color: "var(--mut)" }}>{p.team}</td>
                          <td className="mono">{p.matches}</td>
                          <td className="mono">{p.avgRating.toFixed(2)}</td>
                          <td
                            className={`mono ${cls}`}
                            style={!cls ? { color: "var(--mut)" } : undefined}
                          >
                            <b>
                              {p.bonus > 0 ? "+" : ""}
                              {pct}%
                            </b>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))}

      {/* TAB 3: EQUIPOS PERSONALIZADOS */}
      {activeTab === "custom" && (
        <>
          {customNames.length > 0 ? (
            <div className="custom-saved-list">
              {customNames.map((name) => {
                const c = customTeams[name];
                const ovr =
                  teams[name] && coaches[name] ? getTeamOvr(teams[name], coaches[name]) : "-";
                return (
                  <div key={name} className="custom-team-pill">
                    <span className="team-dot" style={{ background: c.color }} />
                    <b>{name}</b>
                    <span className="mono" style={{ color: "var(--mut)" }}>
                      [{c.code} · {c.reg} · OVR {ovr}]
                    </span>
                    <button
                      type="button"
                      className="t-btn-sm mono"
                      onClick={() => deleteCustomTeam(name)}
                    >
                      Eliminar
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mono" style={{ fontSize: "11.5px", margin: "0 0 10px", color: "var(--mut)" }}>
              Aún no has guardado equipos personalizados. Crea tu Dream Team o tu roster de amigos
              abajo.
            </p>
          )}

          <div className="custom-builder">
            <div className="cb-grid-top">
              <label className="cb-field">
                <span className="tac-label">Nombre del Equipo</span>
                <input
                  type="text"
                  className="search-input"
                  value={draftName}
                  placeholder="Ej. Team Lima / Dream Team"
                  onChange={(e) => setDraftName(e.target.value)}
                />
              </label>

              <label className="cb-field">
                <span className="tac-label">Tag (3-4 letras)</span>
                <input
                  type="text"
                  maxLength={4}
                  className="search-input mono"
                  value={draftCode}
                  onChange={(e) => setDraftCode(e.target.value)}
                />
              </label>

              <label className="cb-field">
                <span className="tac-label">Región</span>
                <select
                  className="map-select mono"
                  value={draftReg}
                  onChange={(e) => setDraftReg(e.target.value as Region)}
                >
                  {(["AMERICAS", "EMEA", "PACIFIC", "CHINA"] as const).map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>

              <label className="cb-field">
                <span className="tac-label">Color</span>
                <input
                  type="color"
                  className="cb-color"
                  value={draftColor}
                  onChange={(e) => setDraftColor(e.target.value)}
                />
              </label>

              <label className="cb-field">
                <span className="tac-label">Head Coach</span>
                <input
                  type="text"
                  className="search-input"
                  value={draftCoach.n}
                  onChange={(e) => setDraftCoach((c) => ({ ...c, n: e.target.value }))}
                />
              </label>

              <label className="cb-field">
                <span className="tac-label">MAC / MIC / ADP</span>
                <div className="cb-inline-nums">
                  {(["macro", "micro", "adapt"] as const).map((field) => (
                    <input
                      key={field}
                      type="number"
                      min={50}
                      max={99}
                      value={draftCoach[field]}
                      className="stat-edit"
                      style={{ borderColor: "var(--bd)" }}
                      onChange={(e) => {
                        const num = Math.max(50, Math.min(99, parseInt(e.target.value, 10) || 82));
                        setDraftCoach((c) => ({ ...c, [field]: num }));
                      }}
                    />
                  ))}
                </div>
              </label>
            </div>

            <div className="sc">
              <table>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Copiar Pro (Opcional)</th>
                    <th style={{ textAlign: "left" }}>Nombre</th>
                    <th style={{ textAlign: "left" }}>Rol</th>
                    <th style={{ textAlign: "left" }}>Agentes (coma)</th>
                    <th>AIM</th>
                    <th>FD</th>
                    <th>CLU</th>
                    <th>ENT</th>
                    <th>UTI</th>
                    <th>IGL</th>
                    <th>CONF</th>
                    <th>CONS</th>
                    <th>POT</th>
                  </tr>
                </thead>
                <tbody>
                  {slots.map((sl, idx) => (
                    <tr key={idx}>
                      <td style={{ textAlign: "left" }}>
                        <select
                          className="cb-mini-sel mono"
                          value=""
                          onChange={(e) => importProToSlot(idx, e.target.value)}
                        >
                          <option value="">-- Elegir Pro --</option>
                          {proOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ textAlign: "left" }}>
                        <input
                          type="text"
                          className="cb-inp"
                          value={sl.n}
                          onChange={(e) => updateSlotString(idx, "n", e.target.value)}
                        />
                      </td>
                      <td style={{ textAlign: "left" }}>
                        <select
                          className="cb-mini-sel"
                          value={sl.r}
                          onChange={(e) => updateSlotString(idx, "r", e.target.value)}
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ textAlign: "left" }}>
                        <input
                          type="text"
                          className="cb-inp mono"
                          style={{ width: "150px" }}
                          value={sl.agents}
                          onChange={(e) => updateSlotString(idx, "agents", e.target.value)}
                        />
                      </td>
                      {NUMERIC_KEYS.map((k) => (
                        <td key={k} className="mono">
                          <input
                            type="number"
                            min={40}
                            max={99}
                            value={sl[k]}
                            className="stat-edit"
                            style={{ borderColor: "var(--bd)" }}
                            onChange={(e) => updateSlotNumber(idx, k, e.target.value)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="deck-actions" style={{ marginTop: "10px" }}>
              <small style={{ color: "var(--mut)" }}>
                Se guarda en tu navegador y queda disponible en Partida Rápida, Base de Datos y
                Torneos.
              </small>
              <button type="button" className="p" onClick={handleSaveCustomTeam}>
                Guardar Equipo Personalizado
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}