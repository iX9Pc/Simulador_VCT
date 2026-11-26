import {
  AGENTS,
  DEFAULT_ACTIVE_MAPS,
  HUSH_MASTERY,
  PLAYER_AGENTS,
  ROLE_DEFAULT_AGENTS,
  getPrimaryRoleFromStr,
  parsePlayerRoles
} from "../../core/index.ts";
import type { AcademiesJson, Coach, Player, Region, RoleName, TeamMeta } from "../../core/index.ts";
import {
  ACADEMY_NICKS,
  ACADEMY_ROLES,
  AGENT_COMPLEXITY,
  DIFFICULTY_CFG,
  FALLBACK_ACADEMIES,
  FREE_AGENTS_SEED,
  FREE_COACHES_SEED,
  MARKET_PACE_CFG,
  ROLE_DISTANCE
} from "./constants.ts";
import type { DifficultyConfig, MarketPaceConfig } from "./constants.ts";
import type {
  ManagerCareerState,
  ManagerClub,
  ManagerMatch,
  ManagerPlayer,
  SeasonSchedule,
  StageSchedule
} from "./types.ts";

// Inicializar pools de agentes de los Free Agents reales al cargar el módulo
for (const fa of FREE_AGENTS_SEED) {
  if (!PLAYER_AGENTS[fa.n] && fa.agents.length) {
    PLAYER_AGENTS[fa.n] = [...fa.agents];
  }
}

export const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

export const fmtMoney = (n: number): string =>
  `${n < 0 ? "-$" : "$"}${Math.abs(Math.round(n)).toLocaleString("en-US")}`;

export const calcPlayerOvr = (
  p: Pick<Player, "aim" | "fd" | "clutch" | "entry" | "util">
): number =>
  Math.round(p.aim * 0.35 + p.fd * 0.18 + p.clutch * 0.15 + p.entry * 0.15 + p.util * 0.17);

export function calcRosterOvr(players: ManagerPlayer[], coach?: Coach | null): number {
  const starters = players.filter((p) => !p.sub && !(p.injuredWeeks > 0)).slice(0, 5);
  const active = starters.length === 5 ? starters : players.slice(0, 5);
  if (!active.length) return 70;
  const avg =
    active.reduce(
      (a, p) =>
        a + (p.aim * 0.35 + p.fd * 0.18 + p.clutch * 0.15 + p.entry * 0.15 + p.util * 0.17),
      0
    ) / active.length;
  const cb = coach ? ((coach.macro + coach.micro + coach.disc) / 3 - 80) * 0.18 : 0;
  return Number((avg + cb).toFixed(1));
}

export function getDiffCfg(career: ManagerCareerState | null): DifficultyConfig {
  const id = career?.settings?.difficulty || "normal";
  return DIFFICULTY_CFG[id] || DIFFICULTY_CFG.normal;
}

export function getMarketCfg(career: ManagerCareerState | null): MarketPaceConfig {
  const id = career?.settings?.marketPace || "normal";
  return MARKET_PACE_CFG[id] || MARKET_PACE_CFG.normal;
}

export function calcPlayerSalary(p: Partial<ManagerPlayer> & Player): number {
  const ovr = calcPlayerOvr(p);
  if (p.isAcademy && ovr <= 80) {
    return Math.round((900 + Math.max(0, ovr - 70) * 110) / 100) * 100;
  }
  return Math.round((1000 + Math.pow(Math.max(1, ovr - 72), 1.44) * 68) / 100) * 100;
}

export function calcPlayerValue(p: Partial<ManagerPlayer> & Player): number {
  const ovr = calcPlayerOvr(p);
  const potGap = Math.max(0, (p.pot || ovr) - ovr);
  const age = p.age || 21;
  const ageMult = age <= 20 ? 1.2 : age <= 23 ? 1.08 : age >= 27 ? 0.78 : 1.0;
  const base = Math.pow(Math.max(1, ovr - 68), 2.05) * 240;
  const potBonus = potGap * 9500;
  const hushBonus =
    (HUSH_MASTERY[p.n] ?? 0) >= 0.9 || (p._hushMastery ?? 0) >= 0.9 ? 22000 : 0;
  return Math.round(((base + potBonus + hushBonus) * ageMult) / 1000) * 1000;
}

export function calcAcademyPriceByPot(pot: number): number {
  return Math.round((12000 + Math.pow(Math.max(1, pot - 76), 2.05) * 320) / 1000) * 1000;
}

export function isRookiePlayer(p: ManagerPlayer): boolean {
  return Boolean(p.isAcademy || (p.age || 21) <= 20 || (p.conf || 80) < 74);
}

export function enrichPlayer(
  raw: Partial<ManagerPlayer> & Omit<Player, "sub"> & { sub?: number },
  isFreeAgent = false
): ManagerPlayer {
  const basePlayer: Player = {
    n: raw.n,
    r: raw.r,
    aim: raw.aim,
    fd: raw.fd,
    clutch: raw.clutch,
    entry: raw.entry,
    util: raw.util,
    igl: raw.igl,
    conf: raw.conf,
    cons: raw.cons,
    pot: raw.pot,
    sub: raw.sub ? 1 : 0
  };
  const ovr = calcPlayerOvr(basePlayer);
  const gap = Math.max(0, (raw.pot || ovr) - ovr);
  const estAge =
    raw.age || clamp(24 - Math.round(gap * 0.55) + (raw.conf < 72 ? -2 : 0), 18, 28);
  const hushInit = HUSH_MASTERY[raw.n] ?? raw._hushMastery ?? 0;

  const obj: ManagerPlayer = {
    ...basePlayer,
    age: estAge,
    isAcademy: Boolean(raw.isAcademy),
    matchesPlayed: raw.matchesPlayed || 0,
    morale: isFreeAgent ? 76 : clamp(76 + Math.round((raw.conf - 80) * 0.35), 65, 90),
    fatigue: isFreeAgent ? 6 : 10,
    injuredWeeks: 0,
    injuryType: "",
    plan: raw.plan || "balanced",
    learning: null,
    learnedAgents: [],
    learnedRoles: [],
    xp: 0,
    _hushMastery: hushInit,
    hushProgress: Math.round(hushInit * 100),
    deltas: { aim: 0, fd: 0, clutch: 0, entry: 0, util: 0, igl: 0, conf: 0, cons: 0 },
    seasonMaps: 0,
    seasonRatingSum: 0,
    contractYears: raw.contractYears || (raw.isAcademy ? 3 : estAge <= 21 ? 3 : 2),
    promisedRole:
      raw.promisedRole || (raw.isAcademy ? "prospect" : basePlayer.sub ? "rotation" : "starter"),
    winBonus: raw.winBonus || (raw.isAcademy ? 1000 : 2500),
    forSale: false,
    weeksOnMarket: 0,
    unhappyWeeks: 0,
    transferRequested: false,
    sellOn: raw.sellOn || null,
    salary: 2500,
    releaseClause: 50000,
    askingPrice: 50000
  };
  obj.salary = calcPlayerSalary(obj);
  obj.releaseClause =
    raw.releaseClause || Math.round((calcPlayerValue(obj) * 1.35) / 1000) * 1000;
  obj.askingPrice = Math.round((calcPlayerValue(obj) * 1.18) / 1000) * 1000;
  return obj;
}

export interface AcademyClubSummary {
  quality: number;
  rank: number | null;
  source: string;
  jewelMult: number;
  jewelChancePct: number;
  tierLabel: string;
}

export function getClubAcademyInfo(
  clubName: string,
  academiesData: AcademiesJson | null,
  teamMeta: Record<string, TeamMeta>,
  careerClubs?: Record<string, ManagerClub>
): AcademyClubSummary {
  const cfg = academiesData || FALLBACK_ACADEMIES;
  const entry = cfg.clubs?.[clubName];
  const reg: Region =
    careerClubs?.[clubName]?.reg || teamMeta[clubName]?.reg || "AMERICAS";
  const hasOwn = Boolean(entry && entry.hasOwnAcademy && typeof entry.quality === "number");
  const quality = clamp(
    hasOwn ? (entry!.quality as number) : cfg.regionalTier2?.[reg] || 5.0,
    1,
    10
  );
  const jewelMult = Number((0.45 + (quality / 10) * 1.45).toFixed(2));
  const jewelChancePct = Math.min(38, Math.round(10 * jewelMult));
  const tierLabel =
    quality >= 9.0
      ? "ÉLITE MUNDIAL"
      : quality >= 7.2
        ? "ALTA"
        : quality >= 5.0
          ? "MEDIA"
          : "EN DESARROLLO";
  return {
    quality: Number(quality.toFixed(1)),
    rank: hasOwn ? entry!.rank : null,
    source: hasOwn ? `Academia Propia (#${entry!.rank})` : `Escena Tier 2 ${reg}`,
    jewelMult,
    jewelChancePct,
    tierLabel
  };
}

export function collectUsedNames(
  career: ManagerCareerState | null,
  dbTeams: Record<string, Player[]>
): Set<string> {
  const used = new Set<string>();
  if (career) {
    for (const c of Object.keys(career.clubs)) {
      career.clubs[c].players.forEach((p) => used.add(p.n.toLowerCase()));
    }
    career.freeAgents.forEach((p) => used.add(p.n.toLowerCase()));
    career.academy.forEach((p) => used.add(p.n.toLowerCase()));
  }
  for (const t of Object.keys(dbTeams)) {
    dbTeams[t].forEach((p) => used.add(p.n.toLowerCase()));
  }
  return used;
}

function pickUniqueNick(usedSet: Set<string>): string {
  const avail = ACADEMY_NICKS.filter((n) => !usedSet.has(n.toLowerCase()));
  if (avail.length) {
    const chosen = avail[Math.floor(Math.random() * avail.length)];
    usedSet.add(chosen.toLowerCase());
    return chosen;
  }
  const base = ACADEMY_NICKS[Math.floor(Math.random() * ACADEMY_NICKS.length)];
  let num = 2;
  while (usedSet.has(`${base}${num}`.toLowerCase())) num++;
  const full = `${base}${num}`;
  usedSet.add(full.toLowerCase());
  return full;
}

export function generateAcademyProspect(
  usedSet: Set<string>,
  clubName: string,
  academiesData: AcademiesJson | null,
  teamMeta: Record<string, TeamMeta>,
  careerClubs?: Record<string, ManagerClub>,
  forcedRole: string | null = null
): ManagerPlayer {
  const nick = pickUniqueNick(usedSet);
  const role = forcedRole || ACADEMY_ROLES[Math.floor(Math.random() * ACADEMY_ROLES.length)];
  const rLow = role.toLowerCase();
  const acadInfo = getClubAcademyInfo(clubName, academiesData, teamMeta, careerClubs);

  const pElite = clamp(0.05 * acadInfo.jewelMult, 0.02, 0.16);
  const pJewel = clamp(0.14 * acadInfo.jewelMult, 0.06, 0.3);
  const pSolid = clamp(0.36 + (acadInfo.quality - 5) * 0.02, 0.28, 0.48);
  const roll = Math.random();

  let pot: number;
  if (roll < pElite) pot = 94 + Math.floor(Math.random() * 4);
  else if (roll < pElite + pJewel) pot = 90 + Math.floor(Math.random() * 4);
  else if (roll < pElite + pJewel + pSolid) pot = 85 + Math.floor(Math.random() * 5);
  else pot = clamp(78 + Math.floor(Math.random() * 7) + Math.round((acadInfo.quality - 5) * 0.4), 76, 85);

  const age = 16 + Math.floor(Math.random() * 4);
  const qBaseBoost = Math.round((acadInfo.quality - 5.5) * 0.65);
  const base = clamp(71 + Math.floor(Math.random() * 6) + qBaseBoost + (pot >= 92 ? 2 : 0), 68, 82);

  const isDuel = rLow.includes("duelista");
  const isInit = rLow.includes("iniciador");
  const isCtrl = rLow.includes("controlador");
  const isSent = rLow.includes("centinela");
  const isIgl = rLow.includes("igl");
  const jitter = () => Math.floor(Math.random() * 5) - 2;

  const prim: RoleName = isDuel
    ? "Duelista"
    : isInit
      ? "Iniciador"
      : isCtrl
        ? "Controlador"
        : isSent
          ? "Centinela"
          : "Flex";
  PLAYER_AGENTS[nick] = (ROLE_DEFAULT_AGENTS[prim] || ROLE_DEFAULT_AGENTS.Flex)
    .slice()
    .sort(() => Math.random() - 0.5)
    .slice(0, 4);

  const prospect = enrichPlayer(
    {
      n: nick,
      r: role,
      aim: clamp(base + (isDuel ? 6 : isSent ? 3 : 1) + jitter(), 68, 87),
      fd: clamp(base + (isDuel ? 7 : -1) + jitter(), 65, 86),
      clutch: clamp(base + (isSent ? 6 : isCtrl ? 4 : 0) + jitter(), 66, 85),
      entry: clamp(base + (isDuel ? 8 : -2) + jitter(), 64, 87),
      util: clamp(base + (isInit || isCtrl ? 8 : isDuel ? -4 : 2) + jitter(), 64, 87),
      igl: clamp(isIgl ? 76 + Math.floor(Math.random() * 7) : 58 + Math.floor(Math.random() * 10), 56, 85),
      conf: clamp(58 + Math.floor(Math.random() * 15), 55, 74),
      cons: clamp(base - 2 + Math.floor(Math.random() * 6), 65, 83),
      pot,
      age,
      isAcademy: true,
      sub: 0
    },
    true
  );
  prospect.hireCost = calcAcademyPriceByPot(pot);
  return prospect;
}

export function generateAcademyBatch(
  count: number,
  clubName: string,
  career: ManagerCareerState | null,
  dbTeams: Record<string, Player[]>,
  academiesData: AcademiesJson | null,
  teamMeta: Record<string, TeamMeta>
): ManagerPlayer[] {
  const used = collectUsedNames(career, dbTeams);
  const guaranteed = [
    "Duelista",
    "Iniciador",
    "Controlador",
    "Centinela",
    "Flex",
    "Iniciador/IGL",
    "Duelista/Flex",
    "Controlador/IGL"
  ];
  const batch: ManagerPlayer[] = [];
  for (let i = 0; i < count; i++) {
    batch.push(
      generateAcademyProspect(
        used,
        clubName,
        academiesData,
        teamMeta,
        career?.clubs,
        i < guaranteed.length ? guaranteed[i] : null
      )
    );
  }
  return batch.sort((a, b) => b.pot - a.pot || calcPlayerOvr(b) - calcPlayerOvr(a));
}

export function getPlayerRoleDistance(player: Pick<Player, "r">, targetRole: RoleName): number {
  const parsed = parsePlayerRoles(player.r);
  if (parsed.primary === targetRole || parsed.secondary === targetRole) return 0;
  const d1 = ROLE_DISTANCE[parsed.primary]?.[targetRole] ?? 1;
  const d2 = parsed.secondary ? (ROLE_DISTANCE[parsed.secondary]?.[targetRole] ?? 9) : 9;
  return Math.min(d1, d2);
}

export function getKnownAgentsForPlayer(p: ManagerPlayer): string[] {
  const base = PLAYER_AGENTS[p.n] || [];
  const learned = Array.isArray(p.learnedAgents) ? p.learnedAgents : [];
  return Array.from(new Set([...learned, ...base])).filter((a) => Boolean(AGENTS[a]));
}

export function calcLearningWeeks(
  p: ManagerPlayer,
  type: "agent" | "role",
  target: string
): number {
  if (type === "agent") {
    const ag = AGENTS[target];
    if (!ag) return 2;
    if (target === "Hush") {
      const curHush = Math.max(HUSH_MASTERY[p.n] || 0, p._hushMastery || 0);
      if (curHush >= 0.5 && curHush < 0.9) return 2;
      const dist = getPlayerRoleDistance(p, "Duelista");
      return clamp(3 + dist, 3, 4);
    }
    const comp = AGENT_COMPLEXITY[target] || 2;
    const dist = getPlayerRoleDistance(p, ag.role);
    return clamp(comp + dist, 1, 4);
  }

  if (target === "IGL") {
    return p.igl >= 76 ? 2 : p.igl >= 66 ? 3 : 4;
  }
  const dist = getPlayerRoleDistance(p, target as RoleName);
  if (target === "Flex") return 3;
  return clamp(dist === 0 ? 1 : dist === 1 ? 2 : 4, 2, 4);
}

export function syncLearnedPoolsFromCareer(career: ManagerCareerState): void {
  for (const cName of Object.keys(career.clubs)) {
    career.clubs[cName].players.forEach((p) => {
      if (!PLAYER_AGENTS[p.n]) {
        const prim = getPrimaryRoleFromStr(p.r);
        PLAYER_AGENTS[p.n] = (ROLE_DEFAULT_AGENTS[prim] || ROLE_DEFAULT_AGENTS.Flex).slice(0, 4);
      }
      if (Array.isArray(p.learnedAgents) && p.learnedAgents.length) {
        const cur = PLAYER_AGENTS[p.n] ? PLAYER_AGENTS[p.n].slice() : [];
        p.learnedAgents.forEach((a) => {
          if (!cur.includes(a)) cur.unshift(a);
        });
        PLAYER_AGENTS[p.n] = cur;
      }
    });
  }
  (career.academy || []).forEach((p) => {
    if (!PLAYER_AGENTS[p.n]) {
      const prim = getPrimaryRoleFromStr(p.r);
      PLAYER_AGENTS[p.n] = (ROLE_DEFAULT_AGENTS[prim] || ROLE_DEFAULT_AGENTS.Flex).slice(0, 4);
    }
  });
}

export function calcManagerReputation(career: ManagerCareerState | null): number {
  if (!career) return 50;
  const c = career.career;
  const total = c.wins + c.losses;
  const wr = total >= 3 ? c.wins / total : 0.5;
  const wrBonus = total >= 3 ? (wr - 0.5) * 38 : 0;
  const trophyBonus =
    c.regionalTitles * 7 + c.mastersTitles * 14 + c.championsTitles * 24;
  const streakBonus = Math.min(8, Math.max(0, (career.bestStreak || 0) - 2) * 1.5);
  const boardFactor = (career.boardConfidence - 50) * 0.14;
  return clamp(Math.round(50 + wrBonus + trophyBonus + streakBonus + boardFactor), 12, 99);
}

export function getClubRequiredRep(club: ManagerClub): number {
  const ovr = calcRosterOvr(club.players, club.coach);
  return clamp(Math.round(40 + (ovr - 79) * 3.4), 38, 86);
}

export function getClubPersonality(club: ManagerClub): {
  id: "ambitious" | "seller" | "balanced";
  label: string;
  sellMult: number;
  sellOnPref: number;
} {
  const ovr = calcRosterOvr(club.players, club.coach);
  if (ovr >= 87.5) return { id: "ambitious", label: "Ambicioso", sellMult: 1.16, sellOnPref: 0.7 };
  if (ovr <= 83.5 || club.budget < 180000) {
    return { id: "seller", label: "Vendedor", sellMult: 0.94, sellOnPref: 1.35 };
  }
  return { id: "balanced", label: "Equilibrado", sellMult: 1.04, sellOnPref: 1.0 };
}

export const isTravelWeek = (w: number): boolean =>
  w === 9 || w === 10 || w === 22 || w === 23 || w === 27 || w === 28;

export function getWeekPhaseName(w: number): string {
  if (w === 1) return "PRETEMPORADA & MERCADO";
  if (w <= 6) return `STAGE 1 · LIGA J${w - 1}/5`;
  if (w === 7) return "STAGE 1 · SEMIFINALES REGIONALES";
  if (w === 8) return "STAGE 1 · GRAN FINAL REGIONAL";
  if (w === 9 || w === 10) return `VIAJE Y DESCANSO PRE-MASTERS 1 (SEM ${w - 8}/2)`;
  if (w <= 13) return `VCT MASTERS 1 · ${w === 11 ? "CUARTOS" : w === 12 ? "SEMIS" : "GRAN FINAL"}`;
  if (w === 14) return "VENTANA DE MITAD DE TEMPORADA";
  if (w <= 19) return `STAGE 2 · LIGA J${w - 14}/5`;
  if (w === 20) return "STAGE 2 · SEMIFINALES REGIONALES";
  if (w === 21) return "STAGE 2 · GRAN FINAL REGIONAL";
  if (w === 22 || w === 23) return `VIAJE Y DESCANSO PRE-MASTERS 2 (SEM ${w - 21}/2)`;
  if (w <= 26) return `VCT MASTERS 2 · ${w === 24 ? "CUARTOS" : w === 25 ? "SEMIS" : "GRAN FINAL"}`;
  if (w === 27 || w === 28) return `VIAJE Y DESCANSO PRE-CHAMPIONS (SEM ${w - 26}/2)`;
  if (w === 29) return "VALORANT CHAMPIONS · OCTAVOS (R16)";
  if (w === 30) return "VALORANT CHAMPIONS · CUARTOS";
  if (w === 31) return "VALORANT CHAMPIONS · SEMIFINALES";
  if (w === 32) return "VALORANT CHAMPIONS · GRAN FINAL";
  return "CIERRE DE TEMPORADA & GALA VCT";
}

function generateRoundRobinPairs(teams6: string[]): Array<Array<[string, string]>> {
  const list = teams6.slice();
  const fixed = list[0];
  const rot = list.slice(1);
  const weeks: Array<Array<[string, string]>> = [];
  for (let w = 0; w < 5; w++) {
    weeks.push([
      [fixed, rot[0]],
      [rot[1], rot[4]],
      [rot[2], rot[3]]
    ]);
    const last = rot.pop();
    if (last !== undefined) rot.unshift(last);
  }
  return weeks;
}

export function buildRegionalLeagueForStage(
  clubs: Record<string, ManagerClub>,
  userTeam: string,
  season: number,
  stageNum: 1 | 2,
  startWeek: number
): StageSchedule {
  const userClub = clubs[userTeam];
  const userReg = userClub.reg;
  const allNames = Object.keys(clubs).sort(
    (a, b) =>
      calcRosterOvr(clubs[b].players, clubs[b].coach) -
      calcRosterOvr(clubs[a].players, clubs[a].coach)
  );

  const leagueTeams = [userTeam];
  allNames
    .filter((t) => t !== userTeam && clubs[t].reg === userReg)
    .forEach((t) => {
      if (leagueTeams.length < 6) leagueTeams.push(t);
    });

  let leagueName = `Stage ${stageNum} · VCT ${userReg}`;
  if (leagueTeams.length < 6) {
    leagueName = `Stage ${stageNum} · VCT Pacific-Asia`;
    allNames
      .filter((t) => !leagueTeams.includes(t) && (clubs[t].reg === "CHINA" || clubs[t].reg === "PACIFIC"))
      .forEach((t) => {
        if (leagueTeams.length < 6) leagueTeams.push(t);
      });
  }
  if (leagueTeams.length < 6) {
    allNames
      .filter((t) => !leagueTeams.includes(t))
      .forEach((t) => {
        if (leagueTeams.length < 6) leagueTeams.push(t);
      });
  }

  const rrWeeks = generateRoundRobinPairs(leagueTeams.slice().sort(() => Math.random() - 0.5));
  const matches: ManagerMatch[] = [];
  rrWeeks.forEach((pairs, idx) => {
    pairs.forEach(([a, b], mIdx) => {
      matches.push({
        id: `S${season}-ST${stageNum}-W${startWeek + idx}-M${mIdx + 1}`,
        week: startWeek + idx,
        stage: stageNum === 1 ? "stage1_league" : "stage2_league",
        label: `${leagueName} · J${idx + 1}`,
        teamA: a,
        teamB: b,
        fmt: 3,
        played: false,
        scoreA: 0,
        scoreB: 0,
        winner: null,
        mapsLine: ""
      });
    });
  });

  const poWeek = startWeek + 5;
  const msWeek = poWeek + 4;

  const playoffs: ManagerMatch[] = [
    { id: `S${season}-ST${stageNum}-SF1`, week: poWeek, stage: `stage${stageNum}_po`, roundKey: "SF", label: `Stage ${stageNum} Playoffs · Semifinal 1 (1° vs 4°)`, teamA: null, teamB: null, fmt: 3, played: false, scoreA: 0, scoreB: 0, winner: null, mapsLine: "", nextId: `S${season}-ST${stageNum}-GF`, nextSlot: 0 },
    { id: `S${season}-ST${stageNum}-SF2`, week: poWeek, stage: `stage${stageNum}_po`, roundKey: "SF", label: `Stage ${stageNum} Playoffs · Semifinal 2 (2° vs 3°)`, teamA: null, teamB: null, fmt: 3, played: false, scoreA: 0, scoreB: 0, winner: null, mapsLine: "", nextId: `S${season}-ST${stageNum}-GF`, nextSlot: 1 },
    { id: `S${season}-ST${stageNum}-GF`, week: poWeek + 1, stage: `stage${stageNum}_po`, roundKey: "GF", label: `Stage ${stageNum} · Gran Final Regional (Bo5)`, teamA: null, teamB: null, fmt: 5, played: false, scoreA: 0, scoreB: 0, winner: null, mapsLine: "", nextId: null, nextSlot: null }
  ];

  const masters: ManagerMatch[] = [
    { id: `S${season}-M${stageNum}-QF1`, week: msWeek, stage: `masters${stageNum}`, roundKey: "QF", label: `VCT Masters ${stageNum} · Cuartos 1`, teamA: null, teamB: null, fmt: 3, played: false, scoreA: 0, scoreB: 0, winner: null, mapsLine: "", nextId: `S${season}-M${stageNum}-SF1`, nextSlot: 0 },
    { id: `S${season}-M${stageNum}-QF2`, week: msWeek, stage: `masters${stageNum}`, roundKey: "QF", label: `VCT Masters ${stageNum} · Cuartos 2`, teamA: null, teamB: null, fmt: 3, played: false, scoreA: 0, scoreB: 0, winner: null, mapsLine: "", nextId: `S${season}-M${stageNum}-SF1`, nextSlot: 1 },
    { id: `S${season}-M${stageNum}-QF3`, week: msWeek, stage: `masters${stageNum}`, roundKey: "QF", label: `VCT Masters ${stageNum} · Cuartos 3`, teamA: null, teamB: null, fmt: 3, played: false, scoreA: 0, scoreB: 0, winner: null, mapsLine: "", nextId: `S${season}-M${stageNum}-SF2`, nextSlot: 0 },
    { id: `S${season}-M${stageNum}-QF4`, week: msWeek, stage: `masters${stageNum}`, roundKey: "QF", label: `VCT Masters ${stageNum} · Cuartos 4`, teamA: null, teamB: null, fmt: 3, played: false, scoreA: 0, scoreB: 0, winner: null, mapsLine: "", nextId: `S${season}-M${stageNum}-SF2`, nextSlot: 1 },
    { id: `S${season}-M${stageNum}-SF1`, week: msWeek + 1, stage: `masters${stageNum}`, roundKey: "SF", label: `VCT Masters ${stageNum} · Semifinal 1`, teamA: null, teamB: null, fmt: 3, played: false, scoreA: 0, scoreB: 0, winner: null, mapsLine: "", nextId: `S${season}-M${stageNum}-GF`, nextSlot: 0 },
    { id: `S${season}-M${stageNum}-SF2`, week: msWeek + 1, stage: `masters${stageNum}`, roundKey: "SF", label: `VCT Masters ${stageNum} · Semifinal 2`, teamA: null, teamB: null, fmt: 3, played: false, scoreA: 0, scoreB: 0, winner: null, mapsLine: "", nextId: `S${season}-M${stageNum}-GF`, nextSlot: 1 },
    { id: `S${season}-M${stageNum}-GF`, week: msWeek + 2, stage: `masters${stageNum}`, roundKey: "GF", label: `VCT Masters ${stageNum} · Gran Final (Bo5)`, teamA: null, teamB: null, fmt: 5, played: false, scoreA: 0, scoreB: 0, winner: null, mapsLine: "", nextId: null, nextSlot: null }
  ];

  return {
    leagueName,
    leagueTeams,
    matches,
    playoffs,
    masters,
    poSeeded: false,
    mastersSeeded: false,
    regChamp: null,
    mastersChamp: null
  };
}

export function buildChampionsBracket(seasonYear: number): ManagerMatch[] {
  const ch: ManagerMatch[] = [];
  for (let i = 1; i <= 8; i++) {
    const qfNum = Math.ceil(i / 2);
    ch.push({
      id: `S${seasonYear}-CH-R16-${i}`,
      week: 29,
      stage: "champions",
      roundKey: "R16",
      label: `Champions · Octavos ${i}`,
      teamA: null,
      teamB: null,
      fmt: 3,
      played: false,
      scoreA: 0,
      scoreB: 0,
      winner: null,
      mapsLine: "",
      nextId: `S${seasonYear}-CH-QF-${qfNum}`,
      nextSlot: ((i - 1) % 2) as 0 | 1
    });
  }
  for (let i = 1; i <= 4; i++) {
    const sfNum = Math.ceil(i / 2);
    ch.push({
      id: `S${seasonYear}-CH-QF-${i}`,
      week: 30,
      stage: "champions",
      roundKey: "QF",
      label: `Champions · Cuartos ${i}`,
      teamA: null,
      teamB: null,
      fmt: 3,
      played: false,
      scoreA: 0,
      scoreB: 0,
      winner: null,
      mapsLine: "",
      nextId: `S${seasonYear}-CH-SF-${sfNum}`,
      nextSlot: ((i - 1) % 2) as 0 | 1
    });
  }
  ch.push(
    { id: `S${seasonYear}-CH-SF-1`, week: 31, stage: "champions", roundKey: "SF", label: "Champions · Semifinal 1", teamA: null, teamB: null, fmt: 3, played: false, scoreA: 0, scoreB: 0, winner: null, mapsLine: "", nextId: `S${seasonYear}-CH-GF`, nextSlot: 0 },
    { id: `S${seasonYear}-CH-SF-2`, week: 31, stage: "champions", roundKey: "SF", label: "Champions · Semifinal 2", teamA: null, teamB: null, fmt: 3, played: false, scoreA: 0, scoreB: 0, winner: null, mapsLine: "", nextId: `S${seasonYear}-CH-GF`, nextSlot: 1 },
    { id: `S${seasonYear}-CH-GF`, week: 32, stage: "champions", roundKey: "GF", label: "VALORANT CHAMPIONS · GRAN FINAL (Bo5)", teamA: null, teamB: null, fmt: 5, played: false, scoreA: 0, scoreB: 0, winner: null, mapsLine: "", nextId: null, nextSlot: null }
  );
  return ch;
}

export function buildFullYearSchedule(
  clubs: Record<string, ManagerClub>,
  userTeam: string,
  seasonYear: number
): SeasonSchedule {
  const vctPoints: Record<string, number> = {};
  for (const c of Object.keys(clubs)) vctPoints[c] = 0;

  const st1 = buildRegionalLeagueForStage(clubs, userTeam, seasonYear, 1, 2);
  const st2 = buildRegionalLeagueForStage(clubs, userTeam, seasonYear, 2, 15);
  const champions = buildChampionsBracket(seasonYear);

  const myOvr = calcRosterOvr(clubs[userTeam].players, clubs[userTeam].coach);
  const objective =
    myOvr >= 88.5
      ? ({ id: "title", label: "Ganar al menos 1 título (Regional, Masters o Champions)" } as const)
      : myOvr >= 85.5
        ? ({ id: "champions", label: "Clasificar a VALORANT Champions (Top 16 VCT)" } as const)
        : ({ id: "playoffs", label: "Entrar a Playoffs Regionales en Stage 1 o Stage 2" } as const);

  return {
    vctPoints,
    stage1: st1,
    stage2: st2,
    champions,
    championsSeeded: false,
    championsChamp: null,
    objective,
    seasonClosed: false
  };
}

export function getMatchesForWeek(sc: SeasonSchedule, w: number): ManagerMatch[] {
  return [
    ...sc.stage1.matches.filter((m) => m.week === w),
    ...sc.stage1.playoffs.filter((m) => m.week === w && m.teamA && m.teamB),
    ...sc.stage1.masters.filter((m) => m.week === w && m.teamA && m.teamB),
    ...sc.stage2.matches.filter((m) => m.week === w),
    ...sc.stage2.playoffs.filter((m) => m.week === w && m.teamA && m.teamB),
    ...sc.stage2.masters.filter((m) => m.week === w && m.teamA && m.teamB),
    ...sc.champions.filter((m) => m.week === w && m.teamA && m.teamB)
  ];
}

export interface StageStandingRow {
  team: string;
  pj: number;
  g: number;
  p: number;
  mw: number;
  ml: number;
  pts: number;
}

export function computeStageStandings(
  stageObj: StageSchedule,
  clubs: Record<string, ManagerClub>
): StageStandingRow[] {
  const tbl: Record<string, StageStandingRow> = {};
  stageObj.leagueTeams.forEach((t) => {
    tbl[t] = { team: t, pj: 0, g: 0, p: 0, mw: 0, ml: 0, pts: 0 };
  });
  stageObj.matches
    .filter((m) => m.played && m.teamA && m.teamB)
    .forEach((m) => {
      const a = tbl[m.teamA!];
      const b = tbl[m.teamB!];
      if (!a || !b) return;
      a.pj++;
      b.pj++;
      a.mw += m.scoreA;
      a.ml += m.scoreB;
      b.mw += m.scoreB;
      b.ml += m.scoreA;
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
  return Object.values(tbl).sort((x, y) => {
    if (y.pts !== x.pts) return y.pts - x.pts;
    const md = y.mw - y.ml - (x.mw - x.ml);
    if (md !== 0) return md;
    return (
      calcRosterOvr(clubs[y.team].players, clubs[y.team].coach) -
      calcRosterOvr(clubs[x.team].players, clubs[x.team].coach)
    );
  });
}

export function validateStartingLineup(club: ManagerClub): {
  ok: boolean;
  count: number;
  hasDup: boolean;
} {
  const starters = club.players.filter((p) => !p.sub && !(p.injuredWeeks > 0));
  const names = starters.map((p) => p.n.toLowerCase());
  const hasDup = new Set(names).size !== names.length;
  return { ok: starters.length === 5 && !hasDup, count: starters.length, hasDup };
}

export function getAgentSpecLabel(agName: string): string {
  const ag = AGENTS[agName];
  if (!ag) return "";
  if (ag.smokeType === "pure") return "Smoker Puro";
  if (ag.smokeType === "hybrid_wall") return "Híbrido Muro (req. Smoker Puro)";
  if (ag.smokeType === "hybrid_dome") return "Híbrido Corto Alcance";
  if (ag.sentinelType === "pure") return "Centinela Puro";
  if (ag.sentinelType === "hybrid") return `Híbrido ${ag.secondaryRole || ""}`.trim();
  if (ag.initType === "recon") return "Recon / Info";
  if (ag.initType === "flash") return "Flash / Apoyo";
  if (ag.initType === "hybrid") return "Info + Flash";
  if (ag.entryType === "dive") return "Entry Dive";
  if (ag.entryType === "contact") return "Contacto (no solo entry)";
  return ag.secondaryRole ? `Híbrido ${ag.secondaryRole}` : ag.role;
}

export function calcCareerScore(career: ManagerCareerState): {
  score: number;
  grade: "S" | "A" | "B" | "C" | "D" | "F";
  verdict: string;
} {
  const c = career.career;
  const totalMatches = c.wins + c.losses;
  const wr = totalMatches > 0 ? c.wins / totalMatches : 0.5;
  const club = career.clubs[career.userTeam];
  const diffBonus =
    career.settings?.difficulty === "hard" ? 8 : career.settings?.difficulty === "easy" ? -5 : 0;

  const titlePts = Math.min(
    40,
    c.regionalTitles * 8 + c.mastersTitles * 16 + c.championsTitles * 26
  );
  const wrPts = totalMatches >= 3 ? Math.round(wr * 30) : 12;
  const boardPts = Math.round(clamp((career.boardConfidence + 40) / 140, 0, 1) * 15);
  const econDelta = club.budget - (career.startBudget || club.budget);
  const econPts = club.budget < 0 ? 2 : clamp(8 + Math.round(econDelta / 150000), 4, 15);

  const score = clamp(
    titlePts + wrPts + boardPts + econPts + diffBonus - (career.fired ? 15 : 0),
    5,
    100
  );
  const grade =
    score >= 90 ? "S" : score >= 78 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : score >= 35 ? "D" : "F";
  const verdict =
    score >= 90
      ? "Dinastía Histórica VCT"
      : score >= 78
        ? "Proyecto de Élite Internacional"
        : score >= 65
          ? "Gestión Sólida y Competitiva"
          : score >= 50
            ? "Etapa Irregular con Altibajos"
            : "Ciclo Fallido";
  return { score, grade, verdict };
}

export function migrateCareerState(raw: ManagerCareerState): ManagerCareerState {
  const career = JSON.parse(JSON.stringify(raw)) as ManagerCareerState;
  if (!career.settings) career.settings = { difficulty: "normal", marketPace: "normal" };
  if (typeof career.lossStreak !== "number") career.lossStreak = 0;
  if (!Array.isArray(career.boardHistory)) {
    career.boardHistory = [
      { s: career.season || 2027, w: career.week || 1, val: career.boardConfidence ?? 45 }
    ];
  }
  if (!career.careerPlayerStats) career.careerPlayerStats = {};
  if (!career.customComps) career.customComps = {};
  if (!career.mapPrep) career.mapPrep = {};
  if (career.coachCourse === undefined) career.coachCourse = null;
  if (typeof career.ended !== "boolean") career.ended = false;
  if (!career.negCooldown) career.negCooldown = {};
  if (!Array.isArray(career.activeMapPool) || career.activeMapPool.length !== 7) {
    career.activeMapPool = [...DEFAULT_ACTIVE_MAPS];
  }
  if (!Array.isArray(career.news)) career.news = [];
  if (!career.career.applyCooldown) career.career.applyCooldown = {};

  const ensureContractFields = (p: ManagerPlayer) => {
    if (typeof p.contractYears !== "number") p.contractYears = p.isAcademy ? 3 : 2;
    if (!p.promisedRole) p.promisedRole = p.isAcademy ? "prospect" : p.sub ? "rotation" : "starter";
    if (typeof p.releaseClause !== "number") {
      p.releaseClause = Math.round((calcPlayerValue(p) * 1.35) / 1000) * 1000;
    }
    if (typeof p.winBonus !== "number") p.winBonus = p.isAcademy ? 1000 : 2500;
    if (typeof p.forSale !== "boolean") p.forSale = false;
    if (typeof p.askingPrice !== "number") {
      p.askingPrice = Math.round((calcPlayerValue(p) * 1.18) / 1000) * 1000;
    }
    if (typeof p.weeksOnMarket !== "number") p.weeksOnMarket = 0;
    if (typeof p.unhappyWeeks !== "number") p.unhappyWeeks = 0;
    if (typeof p.transferRequested !== "boolean") p.transferRequested = false;
    if (p.sellOn === undefined) p.sellOn = null;
    if (!p.deltas) {
      p.deltas = { aim: 0, fd: 0, clutch: 0, entry: 0, util: 0, igl: 0, conf: 0, cons: 0 };
    }
    if (!Array.isArray(p.learnedAgents)) p.learnedAgents = [];
    if (!Array.isArray(p.learnedRoles)) p.learnedRoles = [];
  };

  for (const cName of Object.keys(career.clubs || {})) {
    const cl = career.clubs[cName];
    (cl.players || []).forEach(ensureContractFields);
    if (cl.coach) {
      const avg = Math.round(
        (cl.coach.macro + cl.coach.micro + cl.coach.adapt + cl.coach.dev + cl.coach.disc) / 5
      );
      if (typeof cl.coach.pot !== "number") cl.coach.pot = clamp(avg + 4, 84, 96);
      if (typeof cl.coach.exp !== "number") cl.coach.exp = 5;
      if (!cl.coach.tier) cl.coach.tier = "established";
    }
  }
  (career.freeAgents || []).forEach(ensureContractFields);
  (career.academy || []).forEach(ensureContractFields);

  if (typeof career.startBudget !== "number" && career.clubs?.[career.userTeam]) {
    career.startBudget = career.clubs[career.userTeam].budget;
  }

  if (Array.isArray(career.freeCoaches)) {
    const existingNames = new Set(career.freeCoaches.map((x) => x.n));
    FREE_COACHES_SEED.forEach((seed) => {
      if (!existingNames.has(seed.n) && seed.tier === "prospect") {
        career.freeCoaches.push({ ...seed });
      }
    });
    career.freeCoaches.forEach((c) => {
      const avg = Math.round((c.macro + c.micro + c.adapt + c.dev + c.disc) / 5);
      if (typeof c.pot !== "number") c.pot = clamp(avg + 4, 84, 96);
      if (typeof c.exp !== "number") c.exp = 4;
      if (!c.tier) c.tier = "established";
    });
  }

  return career;
}