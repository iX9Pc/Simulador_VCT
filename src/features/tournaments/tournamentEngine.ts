import { getTeamOvr, runCoachVeto, simMatch } from "../../core/index.ts";
import type {
  Coach,
  MapName,
  Player,
  Region,
  SeriesFormat,
  SeriesResult,
  TeamMeta
} from "../../core/index.ts";
import { computeSeriesStats, computeStatsForMatch } from "../broadcast/stats.ts";

export type TournamentPresetId = "masters16" | "masters8" | "americas6" | "emea6" | "china6";

export interface TournamentPreset {
  id: TournamentPresetId;
  name: string;
  size: number;
  groups: number;
  qualifyPerGroup: number;
  groupFmt: SeriesFormat;
  playoffFmt: SeriesFormat;
  finalFmt: SeriesFormat;
  regionFilter: "ALL" | Region;
  desc: string;
}

export const TOURNAMENT_PRESETS: Record<TournamentPresetId, TournamentPreset> = {
  masters16: {
    id: "masters16",
    name: "VCT Champions / Masters (16 Equipos)",
    size: 16,
    groups: 4,
    qualifyPerGroup: 2,
    groupFmt: 3,
    playoffFmt: 3,
    finalFmt: 5,
    regionFilter: "ALL",
    desc: "4 grupos de 4 (Round-Robin Bo3) · Top 2 avanza a Playoffs de 8 (Cuartos/Semis Bo3 · Gran Final Bo5)"
  },
  masters8: {
    id: "masters8",
    name: "VCT Masters Compacto (8 Equipos)",
    size: 8,
    groups: 2,
    qualifyPerGroup: 2,
    groupFmt: 3,
    playoffFmt: 3,
    finalFmt: 5,
    regionFilter: "ALL",
    desc: "2 grupos de 4 (Round-Robin Bo3) · Top 2 avanza a Semifinales Bo3 y Gran Final Bo5"
  },
  americas6: {
    id: "americas6",
    name: "Liga VCT Americas (6 Equipos)",
    size: 6,
    groups: 1,
    qualifyPerGroup: 4,
    groupFmt: 3,
    playoffFmt: 3,
    finalFmt: 5,
    regionFilter: "AMERICAS",
    desc: "Liga todos contra todos (5 jornadas Bo3) · Top 4 juega Playoffs (Semis Bo3 · Gran Final Bo5)"
  },
  emea6: {
    id: "emea6",
    name: "Liga VCT EMEA (6 Equipos)",
    size: 6,
    groups: 1,
    qualifyPerGroup: 4,
    groupFmt: 3,
    playoffFmt: 3,
    finalFmt: 5,
    regionFilter: "EMEA",
    desc: "Liga todos contra todos (5 jornadas Bo3) · Top 4 juega Playoffs (Semis Bo3 · Gran Final Bo5)"
  },
  china6: {
    id: "china6",
    name: "Liga VCT China (6 Equipos)",
    size: 6,
    groups: 1,
    qualifyPerGroup: 4,
    groupFmt: 3,
    playoffFmt: 3,
    finalFmt: 5,
    regionFilter: "CHINA",
    desc: "Liga todos contra todos (5 jornadas Bo3) · Top 4 juega Playoffs (Semis Bo3 · Gran Final Bo5)"
  }
};

export interface TournamentMatch {
  id: string;
  stage: "group" | "playoff";
  groupKey?: string;
  roundNum?: number;
  roundKey?: "QF" | "SF" | "GF";
  roundLabel?: string;
  label: string;
  teamA: string | null;
  teamB: string | null;
  fmt: SeriesFormat;
  played: boolean;
  scoreA: number;
  scoreB: number;
  winner: string | null;
  series: SeriesResult | null;
  nextId?: string | null;
  nextSlot?: 0 | 1 | null;
}

export interface TournamentNewsItem {
  cat: "OFICIAL" | "UPSET" | "DRAMA" | "RUMOR";
  tag: string;
  headline: string;
  body: string;
  hot: boolean;
}

export interface TournamentState {
  cfg: TournamentPreset;
  groups: Array<{ key: string; teams: string[] }>;
  groupMatches: TournamentMatch[];
  playoffs: TournamentMatch[];
  playoffsSeeded: boolean;
  champion: string | null;
  runnerUp: string | null;
  news: TournamentNewsItem[];
}

export interface TournamentStandingRow {
  team: string;
  pj: number;
  g: number;
  p: number;
  mw: number;
  ml: number;
  rw: number;
  rl: number;
  pts: number;
}

export interface TournamentPlayerRow {
  team: string;
  player: string;
  role: string;
  maps: number;
  rounds: number;
  k: number;
  d: number;
  a: number;
  fb: number;
  fd: number;
  cl: number;
  kastRounds: number;
  acs: number;
  kast: number;
  rating: number;
  kd: string;
  topAgents: string;
}

export interface TournamentDataCtx {
  teams: Record<string, Player[]>;
  coaches: Record<string, Coach>;
  teamMeta: Record<string, TeamMeta>;
  activeMapPool: readonly MapName[];
  getPersistentFormBonus?: (playerName: string) => number;
}

function teamOvrNum(ctx: TournamentDataCtx, name: string): number {
  const players = ctx.teams[name];
  const coach = ctx.coaches[name];
  if (!players || !coach) return 75;
  return parseFloat(getTeamOvr(players, coach));
}

export function getAllTeamsSortedByOvr(ctx: TournamentDataCtx): string[] {
  return Object.keys(ctx.teams).sort((a, b) => teamOvrNum(ctx, b) - teamOvrNum(ctx, a));
}

export function defaultSelectionForPreset(
  presetId: TournamentPresetId,
  ctx: TournamentDataCtx
): string[] {
  const cfg = TOURNAMENT_PRESETS[presetId];
  const all = getAllTeamsSortedByOvr(ctx);
  if (cfg.regionFilter !== "ALL") {
    const regTeams = all.filter((t) => ctx.teamMeta[t]?.reg === cfg.regionFilter);
    if (regTeams.length >= cfg.size) return regTeams.slice(0, cfg.size);
  }

  const byReg: Record<Region, string[]> = { AMERICAS: [], EMEA: [], PACIFIC: [], CHINA: [] };
  all.forEach((t) => {
    const r = ctx.teamMeta[t]?.reg || "AMERICAS";
    byReg[r].push(t);
  });

  const picked: string[] = [];
  const order: readonly Region[] = ["AMERICAS", "EMEA", "PACIFIC", "CHINA"];
  let guard = 0;
  while (picked.length < cfg.size && guard < 100) {
    guard++;
    for (const r of order) {
      if (picked.length >= cfg.size) break;
      const next = byReg[r].shift();
      if (next) picked.push(next);
    }
  }
  return picked;
}

function simTournamentSeries(
  teamAName: string,
  teamBName: string,
  fmt: SeriesFormat,
  ctx: TournamentDataCtx
): SeriesResult {
  const pA = { name: teamAName, players: ctx.teams[teamAName], coach: ctx.coaches[teamAName] };
  const pB = { name: teamBName, players: ctx.teams[teamBName], coach: ctx.coaches[teamBName] };
  const vetoData = runCoachVeto(pA, pB, fmt, {
    forcedFirstMap: "AUTO",
    activeMaps: ctx.activeMapPool
  });
  const needed = Math.ceil(fmt / 2);
  const maps = [];
  const seriesScore: [number, number] = [0, 0];

  for (let i = 0; i < vetoData.scheduledMaps.length; i++) {
    if (seriesScore[0] >= needed || seriesScore[1] >= needed) break;
    const m = simMatch(pA, pB, vetoData.scheduledMaps[i], {
      getPersistentFormBonus: ctx.getPersistentFormBonus
    });
    maps.push(m);
    if (m.sc[0] > m.sc[1]) seriesScore[0]++;
    else seriesScore[1]++;
  }

  return {
    format: fmt,
    vetoData,
    maps,
    seriesScore,
    revealedMaps: maps.length,
    activeTab: fmt > 1 ? "SERIES" : 0
  };
}

function generateRoundRobin(
  teamList: string[],
  groupKey: string,
  fmt: SeriesFormat
): TournamentMatch[] {
  const list = teamList.slice();
  if (list.length < 2) return [];
  if (list.length % 2 === 1) list.push("__BYE__");

  const n = list.length;
  const rounds = n - 1;
  const fixed = list[0];
  const rot = list.slice(1);
  const matches: TournamentMatch[] = [];

  for (let r = 0; r < rounds; r++) {
    const pairs: Array<[string, string]> = [[fixed, rot[0]]];
    for (let i = 1; i < n / 2; i++) {
      pairs.push([rot[i], rot[n - 1 - i]]);
    }
    pairs.forEach(([a, b], idx) => {
      if (a === "__BYE__" || b === "__BYE__") return;
      matches.push({
        id: `G-${groupKey}-R${r + 1}-${idx + 1}`,
        stage: "group",
        groupKey,
        roundNum: r + 1,
        label: `${groupKey === "LIGA" ? "Liga" : `Grupo ${groupKey}`} · Jornada ${r + 1}`,
        teamA: a,
        teamB: b,
        fmt,
        played: false,
        scoreA: 0,
        scoreB: 0,
        winner: null,
        series: null
      });
    });
    const last = rot.pop();
    if (last !== undefined) rot.unshift(last);
  }
  return matches;
}

export function createTournament(
  presetId: TournamentPresetId,
  ctx: TournamentDataCtx,
  customTeams: string[] | null = null,
  randomizeDraw = false
): TournamentState {
  const cfg = TOURNAMENT_PRESETS[presetId] || TOURNAMENT_PRESETS.masters16;
  let pool =
    customTeams && customTeams.length === cfg.size
      ? customTeams.slice()
      : defaultSelectionForPreset(presetId, ctx);

  if (randomizeDraw) {
    pool = pool.slice().sort(() => Math.random() - 0.5);
  } else {
    pool = pool.slice().sort((a, b) => teamOvrNum(ctx, b) - teamOvrNum(ctx, a));
  }

  const groupNames = cfg.groups === 1 ? ["LIGA"] : ["A", "B", "C", "D"].slice(0, cfg.groups);
  const groups = groupNames.map((k) => ({ key: k, teams: [] as string[] }));

  pool.forEach((teamName, i) => {
    const band = Math.floor(i / cfg.groups);
    const pos = i % cfg.groups;
    const gIdx = band % 2 === 0 ? pos : cfg.groups - 1 - pos;
    groups[gIdx].teams.push(teamName);
  });

  const groupMatches: TournamentMatch[] = [];
  groups.forEach((g) => {
    groupMatches.push(...generateRoundRobin(g.teams, g.key, cfg.groupFmt));
  });

  const playoffs: TournamentMatch[] = [];
  if (cfg.size === 16) {
    playoffs.push(
      { id: "PO-QF1", stage: "playoff", roundKey: "QF", roundLabel: "Cuartos de Final", label: "Cuartos 1 (1°A vs 2°B)", teamA: null, teamB: null, fmt: cfg.playoffFmt, played: false, scoreA: 0, scoreB: 0, winner: null, series: null, nextId: "PO-SF1", nextSlot: 0 },
      { id: "PO-QF2", stage: "playoff", roundKey: "QF", roundLabel: "Cuartos de Final", label: "Cuartos 2 (1°C vs 2°D)", teamA: null, teamB: null, fmt: cfg.playoffFmt, played: false, scoreA: 0, scoreB: 0, winner: null, series: null, nextId: "PO-SF1", nextSlot: 1 },
      { id: "PO-QF3", stage: "playoff", roundKey: "QF", roundLabel: "Cuartos de Final", label: "Cuartos 3 (1°B vs 2°A)", teamA: null, teamB: null, fmt: cfg.playoffFmt, played: false, scoreA: 0, scoreB: 0, winner: null, series: null, nextId: "PO-SF2", nextSlot: 0 },
      { id: "PO-QF4", stage: "playoff", roundKey: "QF", roundLabel: "Cuartos de Final", label: "Cuartos 4 (1°D vs 2°C)", teamA: null, teamB: null, fmt: cfg.playoffFmt, played: false, scoreA: 0, scoreB: 0, winner: null, series: null, nextId: "PO-SF2", nextSlot: 1 },
      { id: "PO-SF1", stage: "playoff", roundKey: "SF", roundLabel: "Semifinales", label: "Semifinal 1", teamA: null, teamB: null, fmt: cfg.playoffFmt, played: false, scoreA: 0, scoreB: 0, winner: null, series: null, nextId: "PO-GF", nextSlot: 0 },
      { id: "PO-SF2", stage: "playoff", roundKey: "SF", roundLabel: "Semifinales", label: "Semifinal 2", teamA: null, teamB: null, fmt: cfg.playoffFmt, played: false, scoreA: 0, scoreB: 0, winner: null, series: null, nextId: "PO-GF", nextSlot: 1 },
      { id: "PO-GF", stage: "playoff", roundKey: "GF", roundLabel: "Gran Final", label: "Gran Final (Bo5)", teamA: null, teamB: null, fmt: cfg.finalFmt, played: false, scoreA: 0, scoreB: 0, winner: null, series: null, nextId: null, nextSlot: null }
    );
  } else {
    const sf1Label = cfg.groups === 2 ? "Semifinal 1 (1°A vs 2°B)" : "Semifinal 1 (1° vs 4°)";
    const sf2Label = cfg.groups === 2 ? "Semifinal 2 (1°B vs 2°A)" : "Semifinal 2 (2° vs 3°)";
    playoffs.push(
      { id: "PO-SF1", stage: "playoff", roundKey: "SF", roundLabel: "Semifinales", label: sf1Label, teamA: null, teamB: null, fmt: cfg.playoffFmt, played: false, scoreA: 0, scoreB: 0, winner: null, series: null, nextId: "PO-GF", nextSlot: 0 },
      { id: "PO-SF2", stage: "playoff", roundKey: "SF", roundLabel: "Semifinales", label: sf2Label, teamA: null, teamB: null, fmt: cfg.playoffFmt, played: false, scoreA: 0, scoreB: 0, winner: null, series: null, nextId: "PO-GF", nextSlot: 1 },
      { id: "PO-GF", stage: "playoff", roundKey: "GF", roundLabel: "Gran Final", label: "Gran Final (Bo5)", teamA: null, teamB: null, fmt: cfg.finalFmt, played: false, scoreA: 0, scoreB: 0, winner: null, series: null, nextId: null, nextSlot: null }
    );
  }

  return {
    cfg,
    groups,
    groupMatches,
    playoffs,
    playoffsSeeded: false,
    champion: null,
    runnerUp: null,
    news: [
      {
        cat: "OFICIAL",
        tag: "PREVIA",
        headline: `Arranca ${cfg.name} con ${pool.length} franquicias`,
        body: `Favoritos por OVR: ${pool.slice(0, 3).join(", ")}. Map pool activo: ${ctx.activeMapPool.join(", ")}.`,
        hot: false
      }
    ]
  };
}

export function computeGroupStandings(
  T: TournamentState,
  groupKey: string,
  ctx: TournamentDataCtx
): TournamentStandingRow[] {
  const grp = T.groups.find((g) => g.key === groupKey);
  if (!grp) return [];

  const table: Record<string, TournamentStandingRow> = {};
  grp.teams.forEach((t) => {
    table[t] = { team: t, pj: 0, g: 0, p: 0, mw: 0, ml: 0, rw: 0, rl: 0, pts: 0 };
  });

  T.groupMatches
    .filter((m) => m.groupKey === groupKey && m.played && m.teamA && m.teamB)
    .forEach((m) => {
      const a = table[m.teamA!];
      const b = table[m.teamB!];
      if (!a || !b) return;
      a.pj++;
      b.pj++;
      a.mw += m.scoreA;
      a.ml += m.scoreB;
      b.mw += m.scoreB;
      b.ml += m.scoreA;
      if (m.series?.maps) {
        m.series.maps.forEach((mp) => {
          a.rw += mp.sc[0];
          a.rl += mp.sc[1];
          b.rw += mp.sc[1];
          b.rl += mp.sc[0];
        });
      }
      if (m.winner === m.teamA) {
        a.g++;
        a.pts += 3;
        b.p++;
      } else {
        b.g++;
        b.pts += 3;
        a.p++;
      }
    });

  return Object.values(table).sort((x, y) => {
    if (y.pts !== x.pts) return y.pts - x.pts;
    const mdX = x.mw - x.ml;
    const mdY = y.mw - y.ml;
    if (mdY !== mdX) return mdY - mdX;
    const rdX = x.rw - x.rl;
    const rdY = y.rw - y.rl;
    if (rdY !== rdX) return rdY - rdX;
    return teamOvrNum(ctx, y.team) - teamOvrNum(ctx, x.team);
  });
}

function cloneTournament(T: TournamentState): TournamentState {
  return {
    ...T,
    groupMatches: T.groupMatches.map((m) => ({ ...m })),
    playoffs: T.playoffs.map((m) => ({ ...m })),
    news: [...T.news]
  };
}

export function trySeedPlayoffsInPlace(T: TournamentState, ctx: TournamentDataCtx): void {
  if (T.playoffsSeeded) return;
  if (T.groupMatches.some((m) => !m.played)) return;

  const byKey: Record<string, TournamentStandingRow[]> = {};
  T.groups.forEach((g) => {
    byKey[g.key] = computeGroupStandings(T, g.key, ctx);
  });

  const setSlot = (id: string, a?: string, b?: string) => {
    const m = T.playoffs.find((x) => x.id === id);
    if (m && a && b) {
      m.teamA = a;
      m.teamB = b;
    }
  };

  if (T.cfg.size === 16) {
    setSlot("PO-QF1", byKey.A?.[0]?.team, byKey.B?.[1]?.team);
    setSlot("PO-QF2", byKey.C?.[0]?.team, byKey.D?.[1]?.team);
    setSlot("PO-QF3", byKey.B?.[0]?.team, byKey.A?.[1]?.team);
    setSlot("PO-QF4", byKey.D?.[0]?.team, byKey.C?.[1]?.team);
  } else if (T.cfg.groups === 2) {
    setSlot("PO-SF1", byKey.A?.[0]?.team, byKey.B?.[1]?.team);
    setSlot("PO-SF2", byKey.B?.[0]?.team, byKey.A?.[1]?.team);
  } else {
    const L = byKey.LIGA || [];
    setSlot("PO-SF1", L[0]?.team, L[3]?.team);
    setSlot("PO-SF2", L[1]?.team, L[2]?.team);
  }

  T.playoffsSeeded = true;
}

function executeMatchInPlace(
  T: TournamentState,
  m: TournamentMatch,
  ctx: TournamentDataCtx
): boolean {
  if (!m || m.played || !m.teamA || !m.teamB) return false;
  const s = simTournamentSeries(m.teamA, m.teamB, m.fmt, ctx);
  m.series = s;
  m.scoreA = s.seriesScore[0];
  m.scoreB = s.seriesScore[1];
  m.winner = m.scoreA > m.scoreB ? m.teamA : m.teamB;
  m.played = true;

  if (m.stage === "group") {
    trySeedPlayoffsInPlace(T, ctx);
  } else if (m.stage === "playoff") {
    if (m.nextId) {
      const nextM = T.playoffs.find((x) => x.id === m.nextId);
      if (nextM) {
        if (m.nextSlot === 0) nextM.teamA = m.winner;
        else nextM.teamB = m.winner;
      }
    } else {
      T.champion = m.winner;
      T.runnerUp = m.winner === m.teamA ? m.teamB : m.teamA;
    }
  }

  const loser = m.winner === m.teamA ? m.teamB : m.teamA;
  const wOvr = teamOvrNum(ctx, m.winner);
  const lOvr = teamOvrNum(ctx, loser);
  const S = computeSeriesStats(s, s.maps.length, true);
  const topP = Object.values(S).sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating))[0];
  const mapStr = s.maps.map((x) => `${x.mapName} ${x.sc[0]}-${x.sc[1]}`).join(" · ");

  if (T.champion && m.id === "PO-GF") {
    T.news.unshift({
      cat: "OFICIAL",
      tag: "CAMPEÓN",
      hot: true,
      headline: `${T.champion} CONQUISTA ${T.cfg.name.toUpperCase()} (${m.scoreA}-${m.scoreB})`,
      body: `${T.champion} superó a ${T.runnerUp} en la Gran Final (${mapStr})${
        topP ? ` con ${topP.u.p.n} en ${topP.rating} R2.0` : ""
      }.`
    });
  } else if (lOvr - wOvr >= 1.6) {
    T.news.unshift({
      cat: "UPSET",
      tag: m.label,
      hot: true,
      headline: `SORPRESA EN ${m.label.toUpperCase()}: ${m.winner} derrota a ${loser} (${m.scoreA}-${m.scoreB})`,
      body: `${m.winner} (OVR ${wOvr}) da el golpe contra el favorito ${loser} (OVR ${lOvr}) · ${mapStr}.`
    });
  } else if (topP && parseFloat(topP.rating) >= 1.38) {
    T.news.unshift({
      cat: "OFICIAL",
      tag: m.label,
      hot: false,
      headline: `Recital de ${topP.u.p.n}: ${topP.rating} Rating 2.0 en ${m.winner} vs ${loser}`,
      body: `${topP.u.p.n} lideró con ${topP.acs} ACS (${topP.k}/${topP.d}/${topP.a}) en la serie ${m.scoreA}-${m.scoreB}.`
    });
  } else if (m.stage === "playoff") {
    T.news.unshift({
      cat: "DRAMA",
      tag: m.label,
      hot: true,
      headline: `${loser} queda eliminado en ${m.roundLabel || "Playoffs"} ante ${m.winner}`,
      body: `Dura caída ${m.scoreA}-${m.scoreB} (${mapStr}). Crecen los rumores de cambios en el roster de ${loser}.`
    });
  } else if (Math.random() < 0.25) {
    const loserStar = ctx.teams[loser]?.[0]?.n || "su estrella";
    const loserCoach = ctx.coaches[loser]?.n || "su DT";
    T.news.unshift({
      cat: "RUMOR",
      tag: "PADDOCK VCT",
      hot: false,
      headline: `Rumor en el torneo: dudas en el planteamiento de DT ${loserCoach} (${loser})`,
      body: `Tras caer ante ${m.winner} (${m.scoreA}-${m.scoreB}), analistas debaten si ${loser} depende demasiado de ${loserStar}.`
    });
  }

  if (T.news.length > 35) T.news = T.news.slice(0, 35);
  return true;
}

export function simulateTournamentMatchById(
  T: TournamentState,
  matchId: string,
  ctx: TournamentDataCtx
): { next: TournamentState; match: TournamentMatch | null } {
  const next = cloneTournament(T);
  const m =
    next.groupMatches.find((x) => x.id === matchId) ||
    next.playoffs.find((x) => x.id === matchId) ||
    null;
  if (m && !m.played) executeMatchInPlace(next, m, ctx);
  return { next, match: m };
}

export function simulateNextMatch(
  T: TournamentState,
  ctx: TournamentDataCtx
): { next: TournamentState; enteredPlayoffs: boolean } {
  const next = cloneTournament(T);
  const nextG = next.groupMatches.find((m) => !m.played);
  if (nextG) {
    executeMatchInPlace(next, nextG, ctx);
    return { next, enteredPlayoffs: false };
  }
  trySeedPlayoffsInPlace(next, ctx);
  const nextP = next.playoffs.find((m) => !m.played && m.teamA && m.teamB);
  if (nextP) {
    executeMatchInPlace(next, nextP, ctx);
    return { next, enteredPlayoffs: true };
  }
  return { next, enteredPlayoffs: false };
}

export function simulateCurrentRound(
  T: TournamentState,
  ctx: TournamentDataCtx
): { next: TournamentState; switchToBracket: boolean } {
  const next = cloneTournament(T);
  const pendingG = next.groupMatches.filter((m) => !m.played);
  if (pendingG.length) {
    const minR = Math.min(...pendingG.map((m) => m.roundNum ?? 1));
    pendingG.filter((m) => m.roundNum === minR).forEach((m) => executeMatchInPlace(next, m, ctx));
    return { next, switchToBracket: next.playoffsSeeded };
  }
  trySeedPlayoffsInPlace(next, ctx);
  const pendingP = next.playoffs.filter((m) => !m.played && m.teamA && m.teamB);
  if (pendingP.length) {
    const targetKey = pendingP[0].roundKey;
    pendingP
      .filter((m) => m.roundKey === targetKey)
      .forEach((m) => executeMatchInPlace(next, m, ctx));
    return { next, switchToBracket: true };
  }
  return { next, switchToBracket: false };
}

export function simulateEntireTournament(
  T: TournamentState,
  ctx: TournamentDataCtx
): TournamentState {
  const next = cloneTournament(T);
  next.groupMatches.forEach((m) => {
    if (!m.played) executeMatchInPlace(next, m, ctx);
  });
  trySeedPlayoffsInPlace(next, ctx);
  let safety = 0;
  while (safety++ < 10) {
    const ready = next.playoffs.filter((m) => !m.played && m.teamA && m.teamB);
    if (!ready.length) break;
    ready.forEach((m) => executeMatchInPlace(next, m, ctx));
  }
  return next;
}

export function computeTournamentPlayers(T: TournamentState): TournamentPlayerRow[] {
  const allPlayed = [...T.groupMatches, ...T.playoffs].filter((m) => m.played && m.series);
  const agg: Record<
    string,
    {
      team: string;
      player: string;
      role: string;
      maps: number;
      rounds: number;
      k: number;
      d: number;
      a: number;
      fb: number;
      fd: number;
      cl: number;
      kastRounds: number;
      agents: Record<string, number>;
    }
  > = {};

  allPlayed.forEach((match) => {
    match.series!.maps.forEach((mp) => {
      const ms = computeStatsForMatch(mp, mp.rounds.length);
      const rLen = mp.rounds.length;
      for (const id of Object.keys(ms)) {
        const s = ms[id];
        const tName = mp.teams[s.ti].name;
        const pName = s.u.p.n;
        const key = `${tName}::${pName}`;
        if (!agg[key]) {
          agg[key] = {
            team: tName,
            player: pName,
            role: s.u.p.r,
            maps: 0,
            rounds: 0,
            k: 0,
            d: 0,
            a: 0,
            fb: 0,
            fd: 0,
            cl: 0,
            kastRounds: 0,
            agents: {}
          };
        }
        const rec = agg[key];
        rec.maps++;
        rec.rounds += rLen;
        rec.k += s.k;
        rec.d += s.d;
        rec.a += s.a;
        rec.fb += s.fb;
        rec.fd += s.fd;
        rec.cl += s.cl;
        rec.kastRounds += s.kastRounds;
        if (s.u.agent) rec.agents[s.u.agent] = (rec.agents[s.u.agent] || 0) + 1;
      }
    });
  });

  return Object.values(agg)
    .map((rec) => {
      const rds = Math.max(1, rec.rounds);
      const acs = Math.round((rec.k * 150 + rec.a * 40 + rec.cl * 100) / rds + 90);
      const kast = Math.round((rec.kastRounds / rds) * 100);
      const kpr = rec.k / rds;
      const dpr = rec.d / rds;
      const apr = rec.a / rds;
      const rating = Number(
        (
          0.32 +
          kpr * 0.72 +
          (1 - dpr) * 0.42 +
          apr * 0.28 +
          (kast / 100) * 0.26 +
          ((rec.fb - rec.fd) / rds) * 0.35 +
          (rec.cl / rds) * 0.5
        ).toFixed(2)
      );
      const kd = (rec.k / Math.max(1, rec.d)).toFixed(2);
      const topAgents = Object.entries(rec.agents)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map((x) => x[0])
        .join(", ");
      return { ...rec, acs, kast, rating, kd, topAgents };
    })
    .sort((a, b) => b.rating - a.rating || b.acs - a.acs);
}