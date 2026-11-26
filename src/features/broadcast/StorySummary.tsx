import { Fragment, useId } from "react";
import type { CSSProperties } from "react";
import type { EconType, MatchResult, SeriesResult } from "../../core/index.ts";
import { useDbStore } from "../../stores/useDbStore.ts";
import type { PlayerMatchStats } from "./stats.ts";

interface StorySummaryProps {
  series: SeriesResult;
  match: MatchResult;
  stats: Record<string, PlayerMatchStats>;
  isSeriesSummary: boolean;
  onJumpToRound: (rn: number) => void;
}

const ECON_CODE: Record<EconType, string> = {
  Pistol: "P",
  Eco: "E",
  Force: "F",
  Full: "$"
};

const ECON_CLS: Record<EconType, string> = {
  Pistol: "is-pistol",
  Eco: "is-eco",
  Force: "is-force",
  Full: "is-full"
};

function whyWon(M: MatchResult, S: Record<string, PlayerMatchStats>): string[] {
  const w: 0 | 1 = M.sc[0] > M.sc[1] ? 0 : 1;
  const l: 0 | 1 = w === 0 ? 1 : 0;
  const W = M.teams[w].name;
  const L = M.teams[l].name;
  const R = M.rounds;
  const out = [`${W} ganó ${M.sc[w]}-${M.sc[l]} en ${M.mapName}.`];

  let deficit = 0;
  R.forEach((r) => {
    deficit = Math.max(deficit, r.score[l] - r.score[w]);
  });
  if (deficit >= 4) {
    out[0] = `${W} remontó: llegó a ir ${deficit} rondas abajo y terminó ganando ${M.sc[w]}-${M.sc[l]} en ${M.mapName}.`;
  }

  const fb = [0, 0];
  for (const id of Object.keys(S)) fb[S[id].ti] += S[id].fb;
  const tot = fb[0] + fb[1];
  if (tot) {
    if (fb[w] / tot >= 0.55) {
      out.push(`Dominó las aperturas: ${fb[w]} de ${tot} primeras sangres.`);
    } else if (fb[w] / tot <= 0.45) {
      out.push(
        `Ganó aun perdiendo las aperturas (${fb[w]} de ${tot} primeras sangres), así que su fuerza estuvo en el juego de rondas largas.`
      );
    } else {
      out.push(`Las aperturas estuvieron parejas (${fb[w]} de ${tot}).`);
    }
  }

  const best = [0, 0];
  const cur = [0, 0];
  R.forEach((r) => {
    cur[r.win]++;
    cur[1 - r.win] = 0;
    best[r.win] = Math.max(best[r.win], cur[r.win]);
  });

  const up = R.filter((r) => r.win === w && r.econ[w] === "Eco" && r.econ[l] === "Full").length;
  if (best[w] >= 4) {
    out.push(`Su mejor momento fue una racha de ${best[w]} rondas seguidas.`);
  } else if (up) {
    out.push(`Ganó ${up} ronda${up > 1 ? "s" : ""} en eco contra un full buy de ${L}.`);
  }

  return out.slice(0, 3);
}

function MomentumChart({
  match,
  color0,
  color1
}: {
  match: MatchResult;
  color0: string;
  color1: string;
}) {
  const uid = useId().replace(/:/g, "");
  const R = match.rounds;
  const n = R.length;
  if (!n) return null;

  const W = 640;
  const H = 150;
  const pad = 26;
  const mid = H / 2;
  const diffs = R.map((r) => r.score[0] - r.score[1]);
  const mx = Math.max(4, ...diffs.map(Math.abs));
  const x = (i: number) => pad + ((W - 2 * pad) * (i + 0.5)) / n;
  const y = (d: number) => mid - (d / mx) * (mid - 18);

  const pts = diffs.map((d, i) => [x(i), y(d)] as const);
  const line = pts
    .map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(" ");
  const area = `M${pts[0][0]},${mid} ${pts
    .map((p) => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(" ")} L${pts[n - 1][0]},${mid} Z`;

  const halfX = n > 12 ? x(11) + (x(12) - x(11)) / 2 : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Ventaja de rondas a lo largo del mapa">
      <clipPath id={`cu-${uid}`}>
        <rect x={0} y={0} width={W} height={mid} />
      </clipPath>
      <clipPath id={`cd-${uid}`}>
        <rect x={0} y={mid} width={W} height={mid} />
      </clipPath>
      <path d={area} fill={color0} fillOpacity={0.3} clipPath={`url(#cu-${uid})`} />
      <path d={area} fill={color1} fillOpacity={0.3} clipPath={`url(#cd-${uid})`} />
      <line x1={pad} x2={W - pad} y1={mid} y2={mid} stroke="var(--bd-hi)" />
      {halfX !== null && (
        <>
          <line
            x1={halfX}
            x2={halfX}
            y1={8}
            y2={H - 8}
            stroke="var(--bd-hi)"
            strokeDasharray="3 3"
          />
          <text x={halfX + 4} y={14} fontSize={9} fill="var(--dim)">
            cambio de lado
          </text>
        </>
      )}
      <path d={line} fill="none" stroke="var(--fg)" strokeWidth={1.8} />
      <text x={pad} y={12} fontSize={10} fill={color0}>
        {match.teams[0].name} por delante
      </text>
      <text x={pad} y={H - 4} fontSize={10} fill={color1}>
        {match.teams[1].name} por delante
      </text>
    </svg>
  );
}

function EconomyMatrix({
  match,
  onJumpToRound
}: {
  match: MatchResult;
  onJumpToRound: (rn: number) => void;
}) {
  const rounds = match.rounds;
  if (!rounds.length) return null;

  const conv = ([0, 1] as const).map((ti) => {
    const c: Record<EconType, [number, number]> = {
      Pistol: [0, 0],
      Eco: [0, 0],
      Force: [0, 0],
      Full: [0, 0]
    };
    rounds.forEach((r) => {
      const k = r.econ[ti] || "Full";
      c[k][1]++;
      if (r.win === ti) c[k][0]++;
    });
    return c;
  });

  const renderTeamRow = (ti: 0 | 1) => {
    const teamName = match.teams[ti].name;
    const colorCls = ti === 0 ? "ca" : "cb";
    const winCls = ti === 0 ? "is-win-a" : "is-win-b";
    const c = conv[ti];
    const summaryPairs: Array<[string, [number, number]]> = [
      ["FULL", c.Full],
      ["FRC", c.Force],
      ["ECO", c.Eco],
      ["PST", c.Pistol]
    ];

    return (
      <div className="econ-row" key={ti}>
        <div className="econ-team">
          <span
            className="team-dot"
            style={{ background: `var(${ti ? "--b" : "--a"})` }}
          />
          <b className={colorCls}>{teamName}</b>
        </div>

        <div className="econ-track">
          {rounds.map((r, i) => {
            const type = r.econ[ti] || "Full";
            const oppType = r.econ[1 - ti] || "Full";
            const won = r.win === ti;
            const thrifty = won && type === "Eco" && oppType === "Full";
            const title = `R${r.n} · ${teamName}: ${type} vs ${oppType} · ${
              won ? "GANADA" : "PERDIDA"
            }${thrifty ? " (THRIFTY)" : ""}`;

            return (
              <Fragment key={r.n}>
                {(i === 12 || i === 24) && <span className="econ-half-sep" />}
                <button
                  type="button"
                  className={`econ-cell mono ${ECON_CLS[type]} ${won ? winCls : "is-loss"}${
                    thrifty ? " is-thrifty" : ""
                  }`}
                  onClick={() => onJumpToRound(r.n)}
                  title={title}
                >
                  {ECON_CODE[type]}
                </button>
              </Fragment>
            );
          })}
        </div>

        <div className="econ-conv mono">
          {summaryPairs
            .filter(([, pair]) => pair[1] > 0)
            .map(([label, pair]) => (
              <span key={label}>
                {label}{" "}
                <b>
                  {pair[0]}/{pair[1]}
                </b>
              </span>
            ))}
        </div>
      </div>
    );
  };

  return (
    <div className="econ-matrix-wrap">
      <div className="econ-matrix-head mono">
        <span>ECONOMÍA POR RONDA ({match.mapName.toUpperCase()})</span>
        <span style={{ color: "var(--mut)" }}>
          CLIC EN UNA RONDA PARA INSPECCIONAR EN EL VISOR 2D
        </span>
      </div>

      <div className="sc">
        <div className="econ-matrix">
          <div className="econ-row is-head">
            <div className="econ-team mono" style={{ fontSize: "10px", color: "var(--mut)" }}>
              EQUIPO
            </div>
            <div className="econ-track">
              {rounds.map((r, i) => (
                <Fragment key={r.n}>
                  {(i === 12 || i === 24) && (
                    <span
                      className="econ-half-sep"
                      title={i === 12 ? "Cambio de lado" : "Overtime"}
                    />
                  )}
                  <span className="econ-rnum mono">{r.n}</span>
                </Fragment>
              ))}
            </div>
            <div className="econ-conv mono" style={{ fontSize: "10px", color: "var(--mut)" }}>
              CONVERSIÓN (G/J)
            </div>
          </div>

          {renderTeamRow(0)}
          {renderTeamRow(1)}
        </div>
      </div>

      <div className="econ-legend mono">
        <span>
          <i className="econ-swatch is-pistol">P</i> Pistol
        </span>
        <span>
          <i className="econ-swatch is-eco">E</i> Eco
        </span>
        <span>
          <i className="econ-swatch is-force">F</i> Force
        </span>
        <span>
          <i className="econ-swatch is-full">$</i> Full buy
        </span>
        <span>
          <i className="econ-swatch is-win-demo" /> Ronda ganada
        </span>
        <span>
          <i className="econ-swatch is-thrifty-demo">E</i> Thrifty (Eco vs Full)
        </span>
      </div>
    </div>
  );
}

export function StorySummary({
  series,
  match,
  stats,
  isSeriesSummary,
  onJumpToRound
}: StorySummaryProps) {
  const teamMeta = useDbStore((s) => s.teamMeta);
  const ids = Object.keys(stats);
  if (!ids.length) return null;

  const mvpId = ids.reduce(
    (best, id) => (parseFloat(stats[id].rating) > parseFloat(stats[best].rating) ? id : best),
    ids[0]
  );
  const m = stats[mvpId];
  const color0 = teamMeta[match.teams[0].name]?.color || "#E5484D";
  const color1 = teamMeta[match.teams[1].name]?.color || "#3B82F6";
  const mvpColor = m.ti === 0 ? color0 : color1;

  return (
    <section className="box story">
      <div className="box-head">
        <h2>Resumen del {isSeriesSummary ? "partido" : "mapa"}</h2>
      </div>

      <div className="story-grid">
        <div className="mvp" style={{ "--tc": mvpColor } as CSSProperties}>
          <small>MVP {isSeriesSummary ? "de la serie" : "del mapa"}</small>
          <b>{m.u.p.n}</b>
          <span>{match.teams[m.ti].name}</span>
          <div className="mvp-stats">
            <span>
              <b>
                {m.k}/{m.d}/{m.a}
              </b>
              K/D/A
            </span>
            <span>
              <b>{m.acs || "-"}</b>ACS
            </span>
            <span>
              <b>{m.rating}</b>Rating
            </span>
          </div>
        </div>

        {isSeriesSummary ? (
          <div>
            <h3>Cómo se decidió</h3>
            <p>
              {series.maps.map((x) => `${x.mapName} ${x.sc[0]}-${x.sc[1]}`).join(" · ")}
            </p>
          </div>
        ) : (
          <div>
            <h3>Por qué ganó</h3>
            <ul>
              {whyWon(match, stats).map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {!isSeriesSummary && (
        <>
          <h3>Ventaja de rondas</h3>
          <MomentumChart match={match} color0={color0} color1={color1} />
          <EconomyMatrix match={match} onJumpToRound={onJumpToRound} />
        </>
      )}
    </section>
  );
}