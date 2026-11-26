import { Fragment, useEffect, useMemo, useState } from "react";
import {
  HUSH_MASTERY,
  getPlayerAgents,
  getTeamMapProfile,
  getTeamOvr
} from "../../core/index.ts";
import type { Region } from "../../core/index.ts";
import { RoleIcon } from "../../components/RoleIcon.tsx";
import { TeamLogo } from "../../components/TeamLogo.tsx";
import { useDbStore } from "../../stores/useDbStore.ts";
import type { EditableStatKey } from "../../stores/useDbStore.ts";
import { DataPackBar } from "./DataPackBar.tsx";

type RegionFilter = "ALL" | Region;

const REGION_TABS: readonly RegionFilter[] = ["ALL", "AMERICAS", "EMEA", "PACIFIC", "CHINA"];

const STAT_COLUMNS: readonly { key: EditableStatKey; label: string; title: string }[] = [
  { key: "aim", label: "AIM", title: "Puntería y Duelos (0-99)" },
  { key: "fd", label: "FD", title: "Primer Duelo / Apertura (0-99)" },
  { key: "clutch", label: "CLU", title: "Resolución de Clutches 1vX (0-99)" },
  { key: "entry", label: "ENT", title: "Agresividad de Entrada (0-99)" },
  { key: "util", label: "UTI", title: "Impacto de Utilidad y Asistencias (0-99)" },
  { key: "igl", label: "IGL", title: "Lectura de Juego / Calling (0-99)" },
  { key: "conf", label: "CONF", title: "Confianza Estadística (0-99)" },
  { key: "cons", label: "CONS", title: "Consistencia / KAST (0-99)" },
  { key: "pot", label: "POT", title: "Techo de Potencial (0-99)" }
];

interface StatCellProps {
  playerName: string;
  statKey: EditableStatKey;
  value: number;
  onCommit: (nextVal: number) => void;
}

function StatCell({ playerName, statKey, value, onCommit }: StatCellProps) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const cls =
    value >= 94 ? "stat-elite" : value >= 89 ? "stat-high" : value <= 76 ? "stat-low" : "";

  const commit = () => {
    const parsed = parseInt(draft, 10);
    const next = Number.isNaN(parsed) ? value : Math.max(40, Math.min(99, parsed));
    setDraft(String(next));
    if (next !== value) onCommit(next);
  };

  return (
    <td className={`mono ${cls}`}>
      <input
        type="number"
        min={40}
        max={99}
        value={draft}
        className="stat-edit"
        aria-label={`${playerName} ${statKey}`}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit();
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
    </td>
  );
}

export function DatabaseSection() {
  const [activeRegion, setActiveRegion] = useState<RegionFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const teams = useDbStore((s) => s.teams);
  const teamMeta = useDbStore((s) => s.teamMeta);
  const coaches = useDbStore((s) => s.coaches);
  const activeMapPool = useDbStore((s) => s.activeMapPool);
  const updatePlayerStat = useDbStore((s) => s.updatePlayerStat);
  const toggleSubStatus = useDbStore((s) => s.toggleSubStatus);
  const resetRosters = useDbStore((s) => s.resetRosters);

  const teamNames = useMemo(() => Object.keys(teams), [teams]);

  const regCounts = useMemo(() => {
    const counts: Record<RegionFilter, number> = {
      ALL: teamNames.length,
      AMERICAS: 0,
      EMEA: 0,
      PACIFIC: 0,
      CHINA: 0
    };
    for (const t of teamNames) {
      const reg = teamMeta[t]?.reg;
      if (reg && counts[reg] !== undefined) counts[reg]++;
    }
    return counts;
  }, [teamNames, teamMeta]);

  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const groups = [];

    for (const t of teamNames) {
      const meta = teamMeta[t] || {
        reg: "AMERICAS" as Region,
        color: "#E5484D",
        logo: "vct.png",
        code: t.slice(0, 3).toUpperCase(),
        logoCls: ""
      };
      if (activeRegion !== "ALL" && meta.reg !== activeRegion) continue;

      const roster = teams[t];
      const coach = coaches[t];
      if (!roster || !coach) continue;

      const matchingPlayers = roster
        .map((p, idx) => ({ p, idx }))
        .filter(({ p }) => {
          if (!q) return true;
          const pool = getPlayerAgents(p).join(" ").toLowerCase();
          return (
            p.n.toLowerCase().includes(q) ||
            p.r.toLowerCase().includes(q) ||
            t.toLowerCase().includes(q) ||
            pool.includes(q)
          );
        });

      if (!matchingPlayers.length) continue;

      const mp = getTeamMapProfile({ name: t, players: roster, coach }, activeMapPool);
      const ovr = getTeamOvr(roster, coach);

      groups.push({
        teamName: t,
        meta,
        coach,
        hasBench: roster.length > 5,
        ovr,
        bestStr: mp.best.map((x) => `${x.mapName} (${x.score})`).join(", "),
        worstStr: `${mp.worst.mapName} (${mp.worst.score})`,
        matchingPlayers
      });
    }

    return groups;
  }, [teamNames, teamMeta, teams, coaches, activeRegion, searchQuery, activeMapPool]);

  return (
    <section id="database" className="box">
      <div className="box-head">
        <div className="box-title-wrap">
          <h2>Base de Datos de Plantillas (0–99)</h2>
          <span className="mono" style={{ fontSize: "11px", color: "var(--mut)" }}>
            Edición directa persistida en localStorage
          </span>
        </div>
        <button type="button" id="resetDbBtn" className="t-btn-sm mono" onClick={resetRosters}>
          Restaurar Stats
        </button>
      </div>

      <DataPackBar />

      <div className="db-controls">
        <div className="region-tabs" id="regionTabs">
          {REGION_TABS.map((reg) => (
            <button
              key={reg}
              type="button"
              className={`tab-btn mono ${activeRegion === reg ? "active" : ""}`}
              data-reg={reg}
              onClick={() => setActiveRegion(reg)}
            >
              {reg === "ALL" ? "TODOS" : reg} ({regCounts[reg]})
            </button>
          ))}
        </div>

        <input
          type="search"
          id="dbSearch"
          className="search-input"
          placeholder="Buscar jugador, equipo, rol o agente..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="sc" id="ros">
        <table>
          <thead>
            <tr>
              <th>Jugador</th>
              <th>Estado</th>
              <th>Rol &amp; Pool de Agentes</th>
              {STAT_COLUMNS.map((col) => (
                <th key={col.key} title={col.title}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredGroups.map((g) => (
              <Fragment key={g.teamName}>
                <tr className="team-group-row">
                  <td colSpan={12} className="r">
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        flexWrap: "wrap",
                        justifyContent: "space-between"
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          flexWrap: "wrap"
                        }}
                      >
                        <TeamLogo teamName={g.teamName} className="mini-team-logo" />
                        <span className="region-tag">{g.meta.reg}</span>
                        <b style={{ color: "var(--fg)", fontSize: "14px" }}>{g.teamName}</b>
                        <span className="mono" style={{ fontSize: "11px", color: "var(--mut)" }}>
                          DT <b style={{ color: "var(--fg)" }}>{g.coach.n}</b> · MAC {g.coach.macro}{" "}
                          · MIC {g.coach.micro} · ADP {g.coach.adapt} · DEV {g.coach.dev} · DISC{" "}
                          {g.coach.disc} · <b style={{ color: "var(--fg)" }}>OVR {g.ovr}</b>
                        </span>
                      </div>

                      <div className="mono" style={{ fontSize: "10.5px", color: "var(--mut)" }}>
                        <span style={{ color: "var(--ok)" }}>FUERTES: {g.bestStr}</span> ·{" "}
                        <span style={{ color: "var(--vct-red)" }}>DÉBIL: {g.worstStr}</span>
                      </div>
                    </div>
                  </td>
                </tr>

                {g.matchingPlayers.map(({ p, idx }) => {
                  const topAgents = getPlayerAgents(p).slice(0, 3).join(", ");
                  const hasHushMastery = (HUSH_MASTERY[p.n] ?? 0) >= 0.9;

                  return (
                    <tr key={`${g.teamName}-${p.n}-${idx}`}>
                      <td>
                        <b>{p.n}</b>
                        {hasHushMastery && (
                          <span
                            className="igl-tag"
                            style={{ color: "var(--purple)", borderColor: "var(--purple)" }}
                          >
                            HUSH
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "left" }}>
                        {g.hasBench ? (
                          <button
                            type="button"
                            className={`sub-swap-btn ${p.sub ? "is-sub" : "is-starter"}`}
                            onClick={() => toggleSubStatus(g.teamName, idx)}
                          >
                            {p.sub ? "6TH SUB ⇄" : "TITULAR ⇄"}
                          </button>
                        ) : (
                          <span className="sub-swap-btn is-starter" style={{ cursor: "default" }}>
                            TITULAR
                          </span>
                        )}
                      </td>
                      <td className="r">
                        <RoleIcon roleStr={p.r} /> {p.r}{" "}
                        <span
                          className="mono"
                          style={{ fontSize: "10.5px", marginLeft: "6px", color: "var(--mut)" }}
                        >
                          [{topAgents}]
                        </span>
                      </td>
                      {STAT_COLUMNS.map((col) => (
                        <StatCell
                          key={col.key}
                          playerName={p.n}
                          statKey={col.key}
                          value={p[col.key]}
                          onCommit={(val) => updatePlayerStat(g.teamName, idx, col.key, val)}
                        />
                      ))}
                    </tr>
                  );
                })}
              </Fragment>
            ))}

            {filteredGroups.length === 0 && (
              <tr>
                <td colSpan={12} style={{ textAlign: "center", color: "var(--mut)", padding: "18px" }}>
                  Sin resultados para &ldquo;{searchQuery}&rdquo; en la región seleccionada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}