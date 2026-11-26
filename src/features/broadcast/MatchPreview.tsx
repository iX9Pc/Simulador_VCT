import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { buildSeries, getTeamOvr } from "../../core/index.ts";
import type { Player, SeriesFormat } from "../../core/index.ts";
import { useDbStore } from "../../stores/useDbStore.ts";

interface MatchPreviewProps {
  teamA: string;
  teamB: string;
  format: SeriesFormat;
}

const pOvr = (p: Player) =>
  Math.round(p.aim * 0.35 + p.fd * 0.18 + p.clutch * 0.15 + p.entry * 0.15 + p.util * 0.17);

const tier = (o: number) =>
  o >= 90 ? "Élite" : o >= 85 ? "Estrella" : o >= 78 ? "Sólido" : "Regular";

const confTxt = (c: number) =>
  c >= 80 ? "Datos fiables" : c >= 65 ? "Datos medios" : "Pocos datos: rinde más irregular";

function PlayerRadarSvg({ player, color }: { player: Player; color: string }) {
  const ax: Array<[string, number]> = [
    ["AIM", player.aim],
    ["FD", player.fd],
    ["CLU", player.clutch],
    ["ENT", player.entry],
    ["UTI", player.util],
    ["IGL", player.igl]
  ];
  const c = 60;
  const R = 40;
  const pt = (i: number, f: number): [number, number] => {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    return [c + Math.cos(a) * R * f, c + Math.sin(a) * R * f];
  };
  const ring = (f: number) => ax.map((_, i) => pt(i, f).join(",")).join(" ");
  const poly = ax
    .map((a, i) => pt(i, Math.max(0.08, Math.min(1, (a[1] - 40) / 60))).join(","))
    .join(" ");

  return (
    <svg viewBox="0 0 120 120" className="radar" role="img" aria-label={`Estadísticas de ${player.n}`}>
      <polygon points={ring(1)} fill="none" stroke="var(--bd-hi)" />
      <polygon points={ring(0.5)} fill="none" stroke="var(--bd)" />
      <polygon
        points={poly}
        fill={color}
        fillOpacity={0.28}
        stroke={color}
        strokeWidth={1.6}
      />
      {ax.map((a, i) => {
        const [x, y] = pt(i, 1.32);
        return (
          <text
            key={a[0]}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={8.5}
            fill="var(--mut)"
          >
            {a[0]}
          </text>
        );
      })}
    </svg>
  );
}

export function MatchPreview({ teamA, teamB, format }: MatchPreviewProps) {
  const teams = useDbStore((s) => s.teams);
  const coaches = useDbStore((s) => s.coaches);
  const teamMeta = useDbStore((s) => s.teamMeta);
  const activeMapPool = useDbStore((s) => s.activeMapPool);
  const dataVersion = useDbStore((s) => s.dataVersion);

  const [probA, setProbA] = useState<number | null>(null);

  const rosterA = teams[teamA];
  const rosterB = teams[teamB];
  const coachA = coaches[teamA];
  const coachB = coaches[teamB];

  useEffect(() => {
    if (!teamA || !teamB || teamA === teamB || !rosterA || !rosterB || !coachA || !coachB) {
      setProbA(null);
      return;
    }

    setProbA(null);
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      const N = 60;
      const tA = { name: teamA, players: rosterA, coach: coachA };
      const tB = { name: teamB, players: rosterB, coach: coachB };
      let wins = 0;
      for (let i = 0; i < N; i++) {
        const s = buildSeries(tA, tB, format, { activeMaps: activeMapPool });
        if (s.seriesScore[0] > s.seriesScore[1]) wins++;
      }
      if (!cancelled) setProbA(Math.round((wins / N) * 100));
    }, 30);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [teamA, teamB, format, rosterA, rosterB, coachA, coachB, activeMapPool, dataVersion]);

  if (!teamA || !teamB || teamA === teamB || !rosterA || !rosterB || !coachA || !coachB) {
    return null;
  }

  const colorA = teamMeta[teamA]?.color || "#E5484D";
  const colorB = teamMeta[teamB]?.color || "#3B82F6";
  const ovrA = getTeamOvr(rosterA, coachA);
  const ovrB = getTeamOvr(rosterB, coachB);
  const startersA = rosterA.filter((p) => !p.sub).slice(0, 5);
  const startersB = rosterB.filter((p) => !p.sub).slice(0, 5);

  const coachRows: Array<{ label: string; key: "macro" | "micro" | "adapt" }> = [
    { label: "Coach · macro", key: "macro" },
    { label: "Coach · micro", key: "micro" },
    { label: "Coach · adaptación", key: "adapt" }
  ];

  const renderTeamCards = (name: string, starters: Player[], color: string) => (
    <div className="pv-team">
      <h3 style={{ color }}>{name}</h3>
      <div className="pcards">
        {starters.map((p) => {
          const o = pOvr(p);
          return (
            <article key={p.n} className="pcard" style={{ "--tc": color } as CSSProperties}>
              <div className="pcard-top">
                <div>
                  <b>{p.n}</b>
                  <small>{p.r}</small>
                </div>
                <div className="pcard-ovr">
                  <strong>{o}</strong>
                  <small>{tier(o)}</small>
                </div>
              </div>
              <PlayerRadarSvg player={p} color={color} />
              <small className="pcard-foot">
                {confTxt(p.conf)} · Potencial {p.pot}
              </small>
            </article>
          );
        })}
      </div>
    </div>
  );

  return (
    <section id="preview" className="box story">
      <div className="box-head">
        <div>
          <h2>Previa del partido</h2>
          <small style={{ color: "var(--mut)" }}>
            {teamA} vs {teamB} · Bo{format}
          </small>
        </div>
      </div>

      <div className="pv-prob">
        {probA === null ? (
          <small style={{ color: "var(--mut)" }}>Calculando probabilidades…</small>
        ) : (
          <>
            <div className="pv-probrow">
              <b style={{ color: colorA }}>
                {teamA} {probA}%
              </b>
              <b style={{ color: colorB }}>
                {100 - probA}% {teamB}
              </b>
            </div>
            <div className="cmp-bar big">
              <i style={{ width: `${probA}%`, background: colorA }} />
              <i style={{ width: `${100 - probA}%`, background: colorB }} />
            </div>
            <small style={{ color: "var(--mut)" }}>
              Estimación con 60 series simuladas; el resultado real puede salir distinto.
            </small>
          </>
        )}
      </div>

      <div className="pv-meta">
        <div className="cmp">
          <span>{ovrA}</span>
          <div className="cmp-bar">
            <i style={{ width: "50%", background: colorA }} />
            <i style={{ width: "50%", background: colorB }} />
          </div>
          <span>{ovrB}</span>
          <small>Nivel del equipo</small>
        </div>

        {coachRows.map(({ label, key }) => {
          const va = coachA[key];
          const vb = coachB[key];
          const sum = Math.max(1, va + vb);
          return (
            <div className="cmp" key={key}>
              <span>{va}</span>
              <div className="cmp-bar">
                <i style={{ width: `${(va / sum) * 100}%`, background: colorA }} />
                <i style={{ width: `${(vb / sum) * 100}%`, background: colorB }} />
              </div>
              <span>{vb}</span>
              <small>{label}</small>
            </div>
          );
        })}

        <p className="pv-coach" style={{ color: "var(--mut)" }}>
          Coaches: <b>{coachA.n}</b> ({teamA}) y <b>{coachB.n}</b> ({teamB}).
        </p>
      </div>

      <div className="pv-teams">
        {renderTeamCards(teamA, startersA, colorA)}
        {renderTeamCards(teamB, startersB, colorB)}
      </div>
    </section>
  );
}