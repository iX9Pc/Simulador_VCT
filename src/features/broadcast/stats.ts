import type { MatchResult, MatchUnit, SeriesResult, TeamMeta } from "../../core/index.ts";

export interface PlayerMatchStats {
  k: number;
  d: number;
  a: number;
  fb: number;
  fd: number;
  cl: number;
  kastRounds: number;
  totalRounds?: number;
  formSum?: number;
  acs: number;
  kast: number;
  rating: string;
  u: MatchUnit;
  ti: 0 | 1;
  agents: string[];
}

export function applyTeamColorsForPair(
  teamMeta: Record<string, TeamMeta>,
  a: string,
  b: string
): { colorA: string; colorB: string } {
  const metaA = teamMeta[a] || { color: "#E5484D" };
  const metaB = teamMeta[b] || { color: "#38BDF8" };
  const colorA = metaA.color || "#E5484D";
  let colorB = metaB.color || "#38BDF8";

  if (
    a &&
    b &&
    colorA.startsWith("#") &&
    colorB.startsWith("#") &&
    Math.abs(parseInt(colorA.slice(1, 3), 16) - parseInt(colorB.slice(1, 3), 16)) < 38 &&
    Math.abs(parseInt(colorA.slice(3, 5), 16) - parseInt(colorB.slice(3, 5), 16)) < 48
  ) {
    colorB = "#38BDF8";
  }

  if (typeof document !== "undefined") {
    document.documentElement.style.setProperty("--a", colorA);
    document.documentElement.style.setProperty("--a-soft", `${colorA}22`);
    document.documentElement.style.setProperty("--b", colorB);
    document.documentElement.style.setProperty("--b-soft", `${colorB}22`);
  }

  return { colorA, colorB };
}

export function getLiveSeriesWins(
  series: SeriesResult,
  liveMapIdx: number,
  liveShown: number,
  liveFinished: boolean
): [number, number] {
  if (liveFinished) return series.seriesScore;
  let w0 = 0;
  let w1 = 0;
  for (let i = 0; i <= liveMapIdx && i < series.maps.length; i++) {
    const m = series.maps[i];
    if (i < liveMapIdx || liveShown >= m.rounds.length) {
      if (m.sc[0] > m.sc[1]) w0++;
      else w1++;
    }
  }
  return [w0, w1];
}

export function computeStatsForMatch(
  M: MatchResult,
  maxRounds: number
): Record<string, PlayerMatchStats> {
  const S: Record<string, PlayerMatchStats> = {};
  M.teams.forEach((t, ti) => {
    const teamIdx = ti as 0 | 1;
    t.units.forEach((u, i) => {
      S[`${teamIdx}-${i}`] = {
        k: 0,
        d: 0,
        a: 0,
        fb: 0,
        fd: 0,
        cl: 0,
        kastRounds: 0,
        acs: 0,
        kast: 0,
        rating: "1.00",
        u,
        ti: teamIdx,
        agents: [u.agent]
      };
    });
  });

  for (let r = 0; r < maxRounds; r++) {
    const R = M.rounds[r];
    if (!R) break;
    const roundKast = new Set<string>(R.survivors || []);
    R.ev.forEach((e) => {
      S[e.k].k++;
      S[e.v].d++;
      roundKast.add(e.k);
      if (e.as && S[e.as]) {
        S[e.as].a++;
        roundKast.add(e.as);
      }
      if (e.tr) roundKast.add(e.v);
      if (e.fb) {
        S[e.k].fb++;
        S[e.v].fd++;
      }
    });
    if (R.cl && R.cl.won && S[R.cl.id]) S[R.cl.id].cl++;
    roundKast.forEach((id) => {
      if (S[id]) S[id].kastRounds++;
    });
  }

  for (const id of Object.keys(S)) {
    const s = S[id];
    const rds = Math.max(1, maxRounds);
    s.acs = maxRounds ? Math.round((s.k * 150 + s.a * 40 + s.cl * 100) / rds + 90) : 0;
    s.kast = maxRounds ? Math.round((s.kastRounds / rds) * 100) : 0;
    const kpr = s.k / rds;
    const dpr = s.d / rds;
    const apr = s.a / rds;
    s.rating = maxRounds
      ? (
          0.32 +
          kpr * 0.72 +
          (1 - dpr) * 0.42 +
          apr * 0.28 +
          (s.kast / 100) * 0.26 +
          ((s.fb - s.fd) / rds) * 0.35 +
          (s.cl / rds) * 0.5
        ).toFixed(2)
      : "1.00";
  }

  return S;
}

export function computeSeriesStats(
  series: SeriesResult,
  revealedMaps: number,
  liveFinished: boolean
): Record<string, PlayerMatchStats> {
  const firstM = series.maps[0];
  const S: Record<string, PlayerMatchStats> = {};
  firstM.teams.forEach((t, ti) => {
    const teamIdx = ti as 0 | 1;
    t.units.forEach((u, i) => {
      S[`${teamIdx}-${i}`] = {
        k: 0,
        d: 0,
        a: 0,
        fb: 0,
        fd: 0,
        cl: 0,
        kastRounds: 0,
        totalRounds: 0,
        formSum: 0,
        acs: 0,
        kast: 0,
        rating: "1.00",
        u,
        ti: teamIdx,
        agents: []
      };
    });
  });

  const playedCount = liveFinished ? series.maps.length : revealedMaps;
  for (let idx = 0; idx < playedCount; idx++) {
    const m = series.maps[idx];
    const mStats = computeStatsForMatch(m, m.rounds.length);
    const rLen = m.rounds.length;
    for (const id of Object.keys(mStats)) {
      S[id].k += mStats[id].k;
      S[id].d += mStats[id].d;
      S[id].a += mStats[id].a;
      S[id].fb += mStats[id].fb;
      S[id].fd += mStats[id].fd;
      S[id].cl += mStats[id].cl;
      S[id].kastRounds += mStats[id].kastRounds;
      S[id].totalRounds = (S[id].totalRounds ?? 0) + rLen;
      S[id].formSum = (S[id].formSum ?? 0) + mStats[id].u.form;
      const ag = mStats[id].u.agent;
      if (ag && !S[id].agents.includes(ag)) S[id].agents.push(ag);
    }
  }

  for (const id of Object.keys(S)) {
    const s = S[id];
    const rds = Math.max(1, s.totalRounds ?? 1);
    s.acs = Math.round((s.k * 150 + s.a * 40 + s.cl * 100) / rds + 90);
    s.kast = Math.round((s.kastRounds / rds) * 100);
    const kpr = s.k / rds;
    const dpr = s.d / rds;
    const apr = s.a / rds;
    s.rating = (
      0.32 +
      kpr * 0.72 +
      (1 - dpr) * 0.42 +
      apr * 0.28 +
      (s.kast / 100) * 0.26 +
      ((s.fb - s.fd) / rds) * 0.35 +
      (s.cl / rds) * 0.5
    ).toFixed(2);
    s.u = { ...s.u, form: (s.formSum ?? playedCount) / Math.max(1, playedCount) };
  }

  return S;
}

export function getHalfSplits(M: MatchResult, maxR: number): string {
  const rounds = M.rounds;
  const h1 = [0, 0];
  const h2 = [0, 0];
  const ot = [0, 0];
  for (let i = 0; i < maxR; i++) {
    const w = rounds[i].win;
    if (i < 12) h1[w]++;
    else if (i < 24) h2[w]++;
    else ot[w]++;
  }
  const s1 = M.leftStartsAtk ? "ATK/DEF" : "DEF/ATK";
  const s2 = M.leftStartsAtk ? "DEF/ATK" : "ATK/DEF";
  let txt = `1H (${s1}): ${h1[0]}-${h1[1]}`;
  if (maxR > 12) txt += ` · 2H (${s2}): ${h2[0]}-${h2[1]}`;
  if (maxR > 24) txt += ` · OT: ${ot[0]}-${ot[1]}`;
  return txt;
}