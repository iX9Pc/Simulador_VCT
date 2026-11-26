import { create } from "zustand";
import {
  ALL_MAPS,
  DEFAULT_ACTIVE_MAPS,
  PLAYER_AGENTS,
  ROLE_DEFAULT_AGENTS,
  STORAGE_KEYS,
  getPrimaryRoleFromStr,
  rotateActiveMapPool,
  runCoachVeto,
  simMatch
} from "../core/index.ts";
import type { MapName, SeriesFormat, SeriesResult, TeamInput } from "../core/index.ts";
import { applyTeamColorsForPair, computeSeriesStats } from "../features/broadcast/stats.ts";
import {
  COACH_COURSES,
  DIFFICULTY_CFG,
  FREE_AGENTS_SEED,
  FREE_COACHES_SEED,
  INJURIES_CATALOG,
  MARKET_PACE_CFG,
  PLAYER_PLANS,
  ROLE_PROMISE_LABELS,
  SPONSORS_CATALOG,
  TRAINING_MODES
} from "../features/manager/constants.ts";
import {
  buildFullYearSchedule,
  buildRegionalLeagueForStage,
  buildSeasonObjective,
  calcAcademyPriceByPot,
  calcLearningWeeks,
  calcManagerReputation,
  calcPlayerOvr,
  calcPlayerSalary,
  calcPlayerValue,
  calcRosterOvr,
  clamp,
  collectUsedNames,
  computeStageStandings,
  enrichPlayer,
  evaluateSeasonObjective,
  fmtMoney,
  generateAcademyBatch,
  generateAcademyProspect,
  getClubPersonality,
  getClubRequiredRep,
  getDiffCfg,
  getMarketCfg,
  getMatchesForWeek,
  isRookiePlayer,
  isTravelWeek,
  migrateCareerState,
  syncLearnedPoolsFromCareer,
  validateStartingLineup
} from "../features/manager/managerHelpers.ts";
import {
  buildBoardMeetingNews,
  buildMapPoolNews,
  buildMatchStarNews,
  buildMatchThrillerNews,
  buildMatchUpsetNews,
  buildObjectiveCompletedNews,
  buildObjectiveRiskNews,
  buildSeasonStartNews,
  buildTitleNews,
  buildTransferNews,
  buildWeeklyDramaNews,
  buildWeeklyRumorNews
} from "../features/manager/newsTemplates.ts";
import type { NewsDraft } from "../features/manager/newsTemplates.ts";
import type {
  ActiveNegotiation,
  ActiveRenewal,
  DeltaStatKey,
  DifficultyId,
  ManagerCareerState,
  ManagerClub,
  ManagerMatch,
  ManagerPlayer,
  ManagerSaveV3Payload,
  ManagerTabId,
  ManagerViewerPayload,
  MarketPaceId,
  NewsCategory,
  PlayerPlanId,
  PromisedRole,
  TrainingModeId
} from "../features/manager/types.ts";
import { VCTSound } from "../lib/sound.ts";
import { useDbStore } from "./useDbStore.ts";

let mgrLiveTimer: number | null = null;
function clearMgrLiveInterval() {
  if (mgrLiveTimer !== null) {
    window.clearInterval(mgrLiveTimer);
    mgrLiveTimer = null;
  }
}

function cloneCareer(c: ManagerCareerState): ManagerCareerState {
  return JSON.parse(JSON.stringify(c)) as ManagerCareerState;
}

function persistCareer(career: ManagerCareerState | null): void {
  try {
    if (career) {
      career.lastSavedAt = new Date().toTimeString().slice(0, 5);
      localStorage.setItem(STORAGE_KEYS.MANAGER_CAREER, JSON.stringify(career));
    } else {
      localStorage.removeItem(STORAGE_KEYS.MANAGER_CAREER);
    }
  } catch {
    // noop
  }
}

function loadInitialCareer(): ManagerCareerState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MANAGER_CAREER);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ManagerCareerState;
    if (!parsed?.userTeam || !parsed?.clubs?.[parsed.userTeam]) return null;
    const migrated = migrateCareerState(parsed);
    syncLearnedPoolsFromCareer(migrated);
    if (migrated.activeMapPool?.length === 7) {
      useDbStore.getState().setActiveMapPool(migrated.activeMapPool);
    }
    return migrated;
  } catch {
    return null;
  }
}

// ===== HELPERS MUTABLES SOBRE UN CLON DE CARRERA =====
function addInbox(M: ManagerCareerState, tag: string, title: string, text: string): void {
  M.inbox.unshift({
    id: `MSG-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    season: M.season,
    week: M.week,
    tag,
    title,
    text
  });
  if (M.inbox.length > 50) M.inbox = M.inbox.slice(0, 50);
}

function pushNewsDraft(M: ManagerCareerState, draft: NewsDraft): void {
  M.news = M.news || [];
  M.news.unshift({
    id: `N-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    s: M.season,
    w: M.week,
    ...draft
  });
  if (M.news.length > 45) M.news = M.news.slice(0, 45);
}

function adjustBoard(M: ManagerCareerState, delta: number, reason: string | null = null): void {
  if (delta === 0) return;
  const cfg = getDiffCfg(M);
  let eff = delta > 0 ? Math.round(delta * cfg.gainMult) : Math.round(delta * cfg.lossPenMult);
  if (delta < 0 && M.graceWeeks > 0) eff = Math.min(-1, Math.round(eff * 0.45));
  M.boardConfidence = clamp(M.boardConfidence + eff, -100, 100);
  if (reason && Math.abs(eff) >= 6) {
    addInbox(
      M,
      "DIRECTIVA",
      `${eff > 0 ? "+" : ""}${eff} Confianza · ${reason}`,
      `La valoración actual de la directiva es ${M.boardConfidence > 0 ? "+" : ""}${M.boardConfidence} (umbral de despido: ${cfg.fireThreshold}).`
    );
  }
}

function recordBoardSnapshot(M: ManagerCareerState): void {
  M.boardHistory = M.boardHistory || [];
  const last = M.boardHistory[M.boardHistory.length - 1];
  if (!last || last.s !== M.season || last.w !== M.week) {
    M.boardHistory.push({ s: M.season, w: M.week, val: M.boardConfidence });
    if (M.boardHistory.length > 120) M.boardHistory.shift();
  } else {
    last.val = M.boardConfidence;
  }
}

function ensureHealthyLineupForAI(M: ManagerCareerState, club: ManagerClub): void {
  const db = useDbStore.getState();
  const healthy = club.players.filter((p) => !(p.injuredWeeks > 0));
  if (healthy.length < 5) {
    const used = collectUsedNames(M, db.teams);
    const need = 5 - healthy.length;
    for (let i = 0; i < need; i++) {
      const kid = generateAcademyProspect(used, club.name, db.academies, db.teamMeta, M.clubs);
      kid.sub = 0;
      club.players.push(kid);
    }
  }
  const starters = club.players.filter((p) => !p.sub && !(p.injuredWeeks > 0));
  if (starters.length < 5) {
    club.players.forEach((p) => {
      if (p.injuredWeeks > 0) p.sub = 1;
    });
    let activeCount = club.players.filter((p) => !p.sub && !(p.injuredWeeks > 0)).length;
    for (const p of club.players) {
      if (activeCount >= 5) break;
      if (p.sub && !(p.injuredWeeks > 0)) {
        p.sub = 0;
        activeCount++;
      }
    }
  }
}

function getPlayerMgrMod(p: ManagerPlayer, extraPrep = 0): number {
  const moraleMod = ((p.morale - 75) / 100) * 0.1;
  const fatiguePen = p.fatigue > 55 ? -((p.fatigue - 55) / 45) * 0.06 : 0;
  return clamp(moraleMod + fatiguePen + extraPrep, -0.085, 0.065);
}

function buildTeamPayloadForEngine(M: ManagerCareerState, clubName: string): TeamInput {
  const club = M.clubs[clubName];
  if (clubName !== M.userTeam) ensureHealthyLineupForAI(M, club);
  const diffCfg = getDiffCfg(M);
  const isUser = clubName === M.userTeam;
  const prep = isUser ? M.nextMatchPrepBonus || 0 : 0;
  const diffMod = isUser ? 0 : diffCfg.rivalMod;

  const activePlayers = club.players
    .filter((p) => !p.sub && !(p.injuredWeeks > 0))
    .slice(0, 5)
    .map((p) => ({ ...p, _mgrMod: getPlayerMgrMod(p, prep + diffMod) }));

  return {
    name: clubName,
    players: activePlayers,
    coach: { ...club.coach },
    customComp: isUser ? M.customComps || {} : undefined,
    mapPrep: isUser ? M.mapPrep || {} : undefined
  };
}

function simManagerSeries(
  M: ManagerCareerState,
  teamAName: string,
  teamBName: string,
  fmt: SeriesFormat
): SeriesResult {
  const pA = buildTeamPayloadForEngine(M, teamAName);
  const pB = buildTeamPayloadForEngine(M, teamBName);
  const vetoData = runCoachVeto(pA, pB, fmt, {
    forcedFirstMap: "AUTO",
    activeMaps: M.activeMapPool
  });
  const needed = Math.ceil(fmt / 2);
  const maps = [];
  const seriesScore: [number, number] = [0, 0];

  for (let i = 0; i < vetoData.scheduledMaps.length; i++) {
    if (seriesScore[0] >= needed || seriesScore[1] >= needed) break;
    const m = simMatch(pA, pB, vetoData.scheduledMaps[i]);
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

function checkPlayerInjury(
  M: ManagerCareerState,
  club: ManagerClub,
  p: ManagerPlayer,
  extraMult: number,
  isUser: boolean
): void {
  if (p.injuredWeeks > 0 || p.fatigue < 76 || extraMult <= 0) return;
  const discMit = 1 - Math.max(0, club.coach.disc - 75) / 140;
  const rookieMult = isRookiePlayer(p) ? 1.65 : 0.55;
  const risk = ((p.fatigue - 74) / 26) * 0.065 * extraMult * discMit * rookieMult;
  if (Math.random() < risk) {
    const inj = INJURIES_CATALOG[Math.floor(Math.random() * INJURIES_CATALOG.length)];
    const weeks = inj.minW + Math.floor(Math.random() * (inj.maxW - inj.minW + 1));
    p.injuredWeeks = weeks;
    p.injuryType = inj.name;
    p.morale = clamp(p.morale - 8, 15, 100);
    p.sub = 1;
    if (isUser) {
      const healthySub = club.players.find((x) => x.sub && !(x.injuredWeeks > 0) && x.n !== p.n);
      let extra = "Sin suplentes sanos: ve a Plantilla o Academia antes del próximo partido.";
      if (healthySub) {
        healthySub.sub = 0;
        extra = `${healthySub.n} tomó su lugar automáticamente en el quinteto titular.`;
      }
      addInbox(
        M,
        "MÉDICO",
        `LESIÓN: ${p.n} (${weeks} sem.)`,
        `${p.n} (${isRookiePlayer(p) ? "Rookie" : "Consolidado"}) sufrió ${inj.name} con Fatiga ${p.fatigue}%. ${extra}`
      );
    }
  }
}

function grantPlayerProgression(
  M: ManagerCareerState,
  p: ManagerPlayer,
  coach: ManagerClub["coach"],
  rawXp: number,
  preferredKeys: DeltaStatKey[],
  isUser: boolean,
  fromMatch = false,
  hushMult = 1.0
): void {
  const ovr = calcPlayerOvr(p);
  const potGap = (p.pot || ovr) - ovr;
  const planObj = PLAYER_PLANS[p.plan || "balanced"] || PLAYER_PLANS.balanced;

  if ((planObj.trainsHush || hushMult > 1.2) && p._hushMastery < 1.0) {
    const baseHush = planObj.trainsHush ? rawXp * 0.72 : rawXp * 0.35;
    const gain = Math.round(baseHush * hushMult * (1 + (coach.dev - 75) / 100));
    p.hushProgress = clamp((p.hushProgress || 0) + gain, 0, 100);
    if (p.hushProgress >= 100 && p._hushMastery < 1.0) {
      p._hushMastery = 1.0;
      const curPool = PLAYER_AGENTS[p.n] || [];
      if (!curPool.includes("Hush")) PLAYER_AGENTS[p.n] = ["Hush", ...curPool];
      if (isUser) {
        addInbox(
          M,
          "PROGRESO",
          `${p.n} domina a Hush`,
          `${p.n} completó el 100% de Maestría Hush y ahora recibe bono completo al jugarlo.`
        );
      }
    } else if (p.hushProgress >= 55 && p._hushMastery < 0.55) {
      p._hushMastery = 0.55;
    }
  }

  if (potGap <= 0 && p.age >= 25) return;

  const devMult = 0.76 + (coach.dev - 70) * 0.022;
  const ageMult = p.age <= 19 ? 1.65 : p.age <= 21 ? 1.35 : p.age <= 24 ? 1.0 : 0.5;
  const gapMult = potGap > 0 ? 0.8 + Math.min(1.8, potGap * 0.16) : 0.15;
  const moraleMult = p.morale >= 80 ? 1.15 : p.morale <= 45 ? 0.7 : 1.0;
  const academyMatchMult = p.isAcademy && fromMatch ? 2.4 : p.isAcademy ? 1.25 : 1.0;

  p.xp = (p.xp || 0) + rawXp * devMult * ageMult * gapMult * moraleMult * academyMatchMult;

  while (p.xp >= 100) {
    p.xp -= 100;
    const curOvr = calcPlayerOvr(p);
    if (curOvr >= (p.pot || 95)) break;

    const candidateKeys = Array.from(new Set([...planObj.keys, ...preferredKeys]));
    const valid = candidateKeys.filter(
      (k) => typeof p[k] === "number" && p[k] < Math.min(97, (p.pot || 94) + 2)
    );
    if (!valid.length) break;
    const chosen = valid[Math.floor(Math.random() * valid.length)];
    p[chosen] = Math.min(97, p[chosen] + 1);
    p.deltas[chosen] = (p.deltas[chosen] || 0) + 1;
    p.salary = calcPlayerSalary(p);

    if (isUser) {
      addInbox(
        M,
        "PROGRESO",
        `${p.n} sube +1 ${chosen.toUpperCase()}`,
        `OVR ${calcPlayerOvr(p)} / POT ${p.pot}${
          p.isAcademy ? ` (Academia · ${p.matchesPlayed} partidos)` : ""
        }.`
      );
    }
  }
}

function advancePlayerLearning(M: ManagerCareerState, p: ManagerPlayer, club: ManagerClub): void {
  if (!p.learning || p.injuredWeeks > 0) return;
  p.learning.done = Math.min(p.learning.total, (p.learning.done || 0) + 1);
  if (p.learning.done < p.learning.total) return;

  const { type, target } = p.learning;
  p.learning = null;

  if (type === "agent") {
    if (!p.learnedAgents.includes(target)) p.learnedAgents.unshift(target);
    const cur = PLAYER_AGENTS[p.n] ? PLAYER_AGENTS[p.n].slice() : [];
    if (!cur.includes(target)) PLAYER_AGENTS[p.n] = [target, ...cur];
    if (target === "Hush") {
      p._hushMastery = 1.0;
      p.hushProgress = 100;
    }
    p.morale = clamp((p.morale || 75) + 4, 15, 100);
    addInbox(
      M,
      "MAESTRÍA",
      `${p.n} domina a ${target}`,
      `${p.n} completó su entrenamiento y añadió a ${target} a su pool competitivo de confort.`
    );
  } else if (type === "role") {
    if (!p.learnedRoles.includes(target)) p.learnedRoles.push(target);
    const primary = (p.r || "Flex").split("/")[0].trim();
    if (target === "IGL") {
      if (!p.r.toLowerCase().includes("igl")) p.r = `${primary}/IGL`;
      const gain = Math.min(90, Math.max(p.igl + 5, 78)) - p.igl;
      if (gain > 0) {
        p.igl += gain;
        p.deltas.igl = (p.deltas.igl || 0) + gain;
      }
    } else {
      if (primary.toLowerCase() !== target.toLowerCase()) p.r = `${primary}/${target}`;
      const cur = PLAYER_AGENTS[p.n] ? PLAYER_AGENTS[p.n].slice() : [];
      const starterAgents = (ROLE_DEFAULT_AGENTS[target as keyof typeof ROLE_DEFAULT_AGENTS] || []).slice(0, 2);
      starterAgents.forEach((a) => {
        if (!cur.includes(a)) cur.push(a);
        if (!p.learnedAgents.includes(a)) p.learnedAgents.push(a);
      });
      PLAYER_AGENTS[p.n] = cur;
      const roleStatKey: DeltaStatKey =
        target === "Duelista"
          ? "entry"
          : target === "Centinela"
            ? "clutch"
            : target === "Flex"
              ? "cons"
              : "util";
      if (p[roleStatKey] < 95) {
        p[roleStatKey] = Math.min(95, p[roleStatKey] + 2);
        p.deltas[roleStatKey] = (p.deltas[roleStatKey] || 0) + 2;
      }
    }
    p.morale = clamp((p.morale || 75) + 5, 15, 100);
    addInbox(
      M,
      "MAESTRÍA",
      `${p.n} aprendió el rol ${target}`,
      `${p.n} amplió su versatilidad táctica (nuevo perfil: ${p.r}) gracias al trabajo con DT ${club.coach.n}.`
    );
  }
}

function advanceCoachCourse(M: ManagerCareerState): void {
  if (!M.coachCourse) return;
  const cc = M.coachCourse;
  cc.done++;
  if (cc.done < cc.weeks) return;

  const coach = M.clubs[M.userTeam].coach;
  const isProspect = coach.tier === "prospect" || (coach.exp || 5) <= 2;
  const cap = Math.min(99, coach.pot || 94);
  const gains: string[] = [];
  cc.stats.forEach((k) => {
    const step = cc.id === "pro" ? (isProspect ? 2 : 1) : isProspect ? 4 : 2;
    const before = coach[k] || 80;
    const after = Math.min(cap, before + step);
    if (after > before) {
      coach[k] = after;
      gains.push(`${k.toUpperCase()} +${after - before}`);
    }
  });
  coach.exp = (coach.exp || 1) + 1;
  M.coachCourse = null;
  addInbox(
    M,
    "STAFF",
    `DT ${coach.n} completó ${cc.name}`,
    gains.length
      ? `Mejoras: ${gains.join(" · ")} (POT ${cap}).`
      : `El DT alcanzó su techo actual (POT ${cap}).`
  );
}

function applySellOnPayout(
  M: ManagerCareerState,
  player: ManagerPlayer,
  saleAmount: number,
  sellerName: string
): number {
  if (!player.sellOn || !player.sellOn.pct || !M.clubs[player.sellOn.club]) return 0;
  if (player.sellOn.club === sellerName) return 0;
  const cut = Math.round((saleAmount * (player.sellOn.pct / 100)) / 500) * 500;
  if (cut <= 0) return 0;
  M.clubs[player.sellOn.club].budget += cut;
  if (player.sellOn.club === M.userTeam) {
    M.financeLog.unshift({
      s: M.season,
      w: M.week,
      concept: `Cláusula % venta (${player.sellOn.pct}%) de ${player.n}`,
      amount: cut
    });
    addInbox(
      M,
      "FINANZAS",
      `Ingreso por % de venta: ${player.n}`,
      `Recibiste ${fmtMoney(cut)} (${player.sellOn.pct}%) por el traspaso de ${player.n}.`
    );
  } else if (sellerName === M.userTeam) {
    M.financeLog.unshift({
      s: M.season,
      w: M.week,
      concept: `Pago % futura venta a ${player.sellOn.club} (${player.n})`,
      amount: -cut
    });
  }
  return cut;
}

function executeTransferDeal(
  M: ManagerCareerState,
  buyerName: string,
  sellerName: string,
  playerName: string,
  cash: number,
  swapPlayerName: string,
  sellOnPct: number,
  contractObj: {
    years?: number;
    salary?: number;
    promisedRole?: PromisedRole;
    releaseClause?: number;
    winBonus?: number;
  } | null
): boolean {
  const buyer = M.clubs[buyerName];
  const seller = M.clubs[sellerName];
  if (!buyer || !seller) return false;
  const pIdx = seller.players.findIndex((p) => p.n === playerName);
  if (pIdx < 0) return false;

  const [moved] = seller.players.splice(pIdx, 1);
  const prevSellCut = applySellOnPayout(M, moved, cash, sellerName);

  buyer.budget -= cash;
  seller.budget += cash - prevSellCut;

  if (swapPlayerName) {
    const sIdx = buyer.players.findIndex((p) => p.n === swapPlayerName);
    if (sIdx >= 0) {
      const [swapped] = buyer.players.splice(sIdx, 1);
      swapped.sub = 1;
      swapped.forSale = false;
      swapped.transferRequested = false;
      seller.players.push(swapped);
    }
  }

  if (seller.players.length < 5 && sellerName !== M.userTeam) {
    if (M.freeAgents.length) {
      const rep = M.freeAgents.shift()!;
      rep.sub = 0;
      seller.players.push(rep);
    } else {
      ensureHealthyLineupForAI(M, seller);
    }
  }

  moved.forSale = false;
  moved.weeksOnMarket = 0;
  moved.transferRequested = false;
  moved.unhappyWeeks = 0;
  moved.morale = 86;
  moved.sellOn = sellOnPct > 0 ? { club: sellerName, pct: sellOnPct } : null;

  if (contractObj) {
    moved.contractYears = clamp(contractObj.years || 2, 1, 4);
    moved.salary = contractObj.salary || moved.salary;
    moved.promisedRole = contractObj.promisedRole || "starter";
    moved.releaseClause = Math.max(
      calcPlayerValue(moved),
      contractObj.releaseClause || moved.releaseClause
    );
    moved.winBonus = contractObj.winBonus || 2500;
  }

  const activeCount = buyer.players.filter((p) => !p.sub && !(p.injuredWeeks > 0)).length;
  moved.sub = activeCount >= 5 ? 1 : 0;
  buyer.players.push(moved);

  const isUserBuy = buyerName === M.userTeam;
  const swapTxt = swapPlayerName ? ` (+ ${swapPlayerName})` : "";
  const sellTxt = sellOnPct > 0 ? ` · ${sellOnPct}% fut. venta` : "";

  M.transferLog.unshift({
    s: M.season,
    w: M.week,
    type: isUserBuy ? "FICHAJE" : "VENTA",
    player: moved.n,
    from: sellerName,
    to: buyerName,
    fee: cash
  });
  if (isUserBuy || sellerName === M.userTeam) {
    M.financeLog.unshift({
      s: M.season,
      w: M.week,
      concept: `${isUserBuy ? "Fichaje" : "Venta"} ${moved.n} (${
        isUserBuy ? sellerName : buyerName
      }${swapTxt}${sellTxt})`,
      amount: isUserBuy ? -cash : cash
    });
    addInbox(
      M,
      "FICHAJE",
      `TRASPASO CERRADO: ${moved.n}`,
      `${moved.n} pasa de ${sellerName} a ${buyerName} por ${fmtMoney(cash)}${swapTxt}${sellTxt}.`
    );
  }
  if (cash >= 90000 || isUserBuy || sellerName === M.userTeam) {
    pushNewsDraft(
      M,
      buildTransferNews({
        playerName: moved.n,
        playerRole: moved.r,
        playerOvr: calcPlayerOvr(moved),
        playerAge: moved.age,
        buyerName,
        sellerName,
        cash,
        cashFormatted: fmtMoney(cash),
        swapPlayer: swapPlayerName,
        sellOnPct
      })
    );
  }
  return true;
}

function runAiTransferMarket(M: ManagerCareerState): void {
  const db = useDbStore.getState();
  const mktCfg = getMarketCfg(M);
  const movesTarget = mktCfg.aiMovesPerWindow || 5;
  const aiClubs = Object.keys(M.clubs).filter((c) => c !== M.userTeam);
  let movesDone = 0;

  for (let attempt = 0; attempt < movesTarget * 3 && movesDone < movesTarget; attempt++) {
    const clubName = aiClubs[Math.floor(Math.random() * aiClubs.length)];
    const club = M.clubs[clubName];
    const roll = Math.random();

    if (roll < 0.28 && club.players.length < 7) {
      const used = collectUsedNames(M, db.teams);
      const kid = generateAcademyProspect(used, clubName, db.academies, db.teamMeta, M.clubs);
      kid.sub = club.players.length >= 5 ? 1 : 0;
      club.players.push(kid);
      M.transferLog.unshift({
        s: M.season,
        w: M.week,
        type: "ACADEMIA",
        player: kid.n,
        from: `Academia ${clubName}`,
        to: clubName,
        fee: 0
      });
      if (kid.pot >= 92) {
        addInbox(
          M,
          "MERCADO IA",
          `Joya promovida en ${clubName}: ${kid.n}`,
          `${clubName} sube desde su cantera a ${kid.n} (${kid.r}, ${kid.age} años, POT ${kid.pot}).`
        );
      }
      movesDone++;
      continue;
    }

    if (roll < 0.62 && M.freeAgents.length) {
      const sortedFa = M.freeAgents
        .map((p, idx) => ({ p, idx }))
        .sort((a, b) => calcPlayerOvr(b.p) - calcPlayerOvr(a.p));
      const worst = club.players.slice().sort((a, b) => calcPlayerOvr(a) - calcPlayerOvr(b))[0];
      const pick = sortedFa.find(
        (x) =>
          calcPlayerOvr(x.p) >= calcPlayerOvr(worst) + 1 &&
          club.budget >= calcPlayerValue(x.p) * 0.35
      );
      if (pick) {
        const fee = Math.round((calcPlayerValue(pick.p) * 0.35) / 1000) * 1000;
        const [fa] = M.freeAgents.splice(pick.idx, 1);
        club.budget -= fee;
        fa.sub = club.players.length >= 5 ? 1 : 0;
        club.players.push(fa);
        M.transferLog.unshift({
          s: M.season,
          w: M.week,
          type: "FICHAJE",
          player: fa.n,
          from: "Agente Libre",
          to: clubName,
          fee
        });
        if (calcPlayerOvr(fa) >= 88) {
          addInbox(
            M,
            "MERCADO IA",
            `${clubName} ficha libre a ${fa.n}`,
            `${clubName} refuerza su roster con ${fa.n} (OVR ${calcPlayerOvr(fa)}).`
          );
        }
        movesDone++;
        continue;
      }
    }

    const sellers = aiClubs.filter((c) => c !== clubName && M.clubs[c].players.length >= 6);
    if (!sellers.length) continue;
    const sellerName = sellers[Math.floor(Math.random() * sellers.length)];
    const seller = M.clubs[sellerName];
    const worstMine = club.players.slice().sort((a, b) => calcPlayerOvr(a) - calcPlayerOvr(b))[0];
    const candidate = seller.players.find(
      (p) =>
        calcPlayerOvr(p) >= calcPlayerOvr(worstMine) + 2 &&
        club.budget >= calcPlayerValue(p) * 1.15
    );
    if (candidate) {
      const fee = Math.round((calcPlayerValue(candidate) * 1.12) / 1000) * 1000;
      executeTransferDeal(M, clubName, sellerName, candidate.n, fee, "", 0, null);
      if (calcPlayerOvr(candidate) >= 89) {
        addInbox(
          M,
          "MERCADO IA",
          `BOMBAZO: ${candidate.n} ficha por ${clubName}`,
          `${clubName} pagó ${fmtMoney(fee)} a ${sellerName} por ${candidate.n} (OVR ${calcPlayerOvr(candidate)}).`
        );
      }
      movesDone++;
    }
  }
}

function rewardUserTitle(
  M: ManagerCareerState,
  tier: "regional" | "masters" | "champions",
  titleLabel: string,
  prizeMoney: number,
  confBoost: number
): void {
  const club = M.clubs[M.userTeam];
  club.budget += prizeMoney;
  M.trophies.push({ season: M.season, title: titleLabel, club: M.userTeam });
  if (tier === "regional") M.career.regionalTitles++;
  else if (tier === "masters") M.career.mastersTitles++;
  else M.career.championsTitles++;

  M.boardConfidence = clamp(M.boardConfidence + confBoost, -100, 100);
  M.financeLog.unshift({
    s: M.season,
    w: M.week,
    concept: `Premio Título: ${titleLabel}`,
    amount: prizeMoney
  });
  addInbox(
    M,
    "TÍTULO",
    `CAMPEONES: ${titleLabel}`,
    `Premio de ${fmtMoney(prizeMoney)} acreditado (+${confBoost} Confianza).`
  );
  pushNewsDraft(
    M,
    buildTitleNews({
      teamName: M.userTeam,
      titleLabel,
      prizeFormatted: fmtMoney(prizeMoney),
      coachName: club.coach.n,
      tier
    })
  );

  const candidates = SPONSORS_CATALOG.filter((sp) => sp.tier === tier);
  const sp = candidates[Math.floor(Math.random() * candidates.length)] || SPONSORS_CATALOG[0];
  M.pendingSponsorOffer = { ...sp, reason: titleLabel };
  addInbox(
    M,
    "SPONSOR",
    `Oferta de patrocinio: ${sp.name}`,
    `Tras ganar ${titleLabel}, ${sp.name} ofrece ${fmtMoney(sp.upfront)} al contado + ${fmtMoney(sp.weekly)}/sem.`
  );

  const otherClubs = Object.keys(M.clubs)
    .filter((c) => c !== M.userTeam)
    .sort(
      (a, b) =>
        calcRosterOvr(M.clubs[b].players, M.clubs[b].coach) -
        calcRosterOvr(M.clubs[a].players, M.clubs[a].coach)
    );
  const topPicks = otherClubs
    .slice(0, 8)
    .sort(() => Math.random() - 0.5)
    .slice(0, 2);
  M.pendingJobOffers = topPicks.map((cName) => ({
    club: cName,
    reg: M.clubs[cName].reg,
    ovr: calcRosterOvr(M.clubs[cName].players, M.clubs[cName].coach),
    budget: M.clubs[cName].budget,
    reason: `Campeón de ${titleLabel}`
  }));
  addInbox(
    M,
    "OFERTA DT",
    "Clubes top te ofrecen el banquillo",
    `${topPicks.join(" y ")} quieren ficharte como Manager tras levantar ${titleLabel}.`
  );
}

function applyMatchImpactToClub(
  M: ManagerCareerState,
  clubName: string,
  series: SeriesResult,
  teamIdx: 0 | 1,
  matchStage: string
): void {
  const club = M.clubs[clubName];
  const isUser = clubName === M.userTeam;
  const won =
    (teamIdx === 0 && series.seriesScore[0] > series.seriesScore[1]) ||
    (teamIdx === 1 && series.seriesScore[1] > series.seriesScore[0]);
  const mapsPlayed = series.maps.length;
  const S = computeSeriesStats(series, series.maps.length, true);

  const byName: Record<string, (typeof S)[string]> = {};
  for (const id of Object.keys(S)) {
    if (S[id].ti === teamIdx) byName[S[id].u.p.n] = S[id];
  }

  club.players.forEach((p) => {
    const perf = byName[p.n];
    if (perf) {
      const rat = parseFloat(perf.rating) || 1.0;
      p.matchesPlayed = (p.matchesPlayed || 0) + 1;
      p.seasonMaps = (p.seasonMaps || 0) + mapsPlayed;
      p.seasonRatingSum = (p.seasonRatingSum || 0) + rat * mapsPlayed;

      if (isUser && p.isAcademy && M.schedule.objective) {
        M.schedule.objective.academyStarterPromoted = true;
      }

      if (isUser) {
        const cs = M.careerPlayerStats[p.n] || {
          name: p.n,
          role: p.r,
          club: clubName,
          maps: 0,
          ratingSum: 0,
          acsSum: 0,
          bestOvr: calcPlayerOvr(p)
        };
        cs.maps += mapsPlayed;
        cs.ratingSum += rat * mapsPlayed;
        cs.acsSum += (perf.acs || 190) * mapsPlayed;
        cs.bestOvr = Math.max(cs.bestOvr, calcPlayerOvr(p));
        cs.club = clubName;
        M.careerPlayerStats[p.n] = cs;
      }

      const fatGain = Math.round(mapsPlayed * 5.2 * (1 - (club.coach.disc - 75) / 180));
      p.fatigue = clamp(p.fatigue + fatGain, 0, 100);
      const moraleDelta = (won ? 5 : -4) + Math.round((rat - 1.0) * 14);
      p.morale = clamp(p.morale + moraleDelta, 15, 100);

      if (p.conf < 86 && Math.random() < (p.isAcademy ? 0.65 : won ? 0.45 : 0.2)) {
        p.conf = Math.min(95, p.conf + 1);
        p.deltas.conf = (p.deltas.conf || 0) + 1;
      }

      const matchXp = (won ? 18 : 12) + Math.max(0, (rat - 0.92) * 28);
      grantPlayerProgression(M, p, club.coach, matchXp, ["aim", "clutch", "cons", "fd"], isUser, true, 1.0);

      if (p.isAcademy && p.matchesPlayed % 2 === 0 && calcPlayerOvr(p) < p.pot) {
        grantPlayerProgression(M, p, club.coach, 55, ["aim", "util", "cons"], isUser, true, 1.0);
      }

      checkPlayerInjury(M, club, p, 1.0, isUser);
    } else if (!(p.injuredWeeks > 0)) {
      p.fatigue = clamp(p.fatigue - 14, 0, 100);
      if (calcPlayerOvr(p) >= 84) p.morale = clamp(p.morale - 2, 20, 100);
    }
  });

  if (won && (matchStage === "stage1_league" || matchStage === "stage2_league")) {
    M.schedule.vctPoints[clubName] = (M.schedule.vctPoints[clubName] || 0) + 1;
  }

  if (isUser) {
    const oppName = series.maps[0].teams[1 - teamIdx].name;
    const myOvr = calcRosterOvr(club.players, club.coach);
    const oppOvr = M.clubs[oppName]
      ? calcRosterOvr(M.clubs[oppName].players, M.clubs[oppName].coach)
      : myOvr;
    const ovrDiff = myOvr - oppOvr;
    const diffCfg = getDiffCfg(M);

    if (won) {
      M.career.wins++;
      M.lossStreak = 0;
      const basePrize =
        matchStage === "champions"
          ? 60000
          : matchStage.startsWith("masters")
            ? 40000
            : matchStage.endsWith("_po")
              ? 28000
              : 18000;
      const matchPrize = Math.round((basePrize * diffCfg.prizeMult) / 500) * 500;
      club.budget += matchPrize;
      M.financeLog.unshift({
        s: M.season,
        w: M.week,
        concept: `Victoria vs ${oppName} (${matchStage.toUpperCase()})`,
        amount: matchPrize
      });

      M.winStreak = (M.winStreak || 0) + 1;
      M.bestStreak = Math.max(M.bestStreak || 0, M.winStreak);

      const baseGain = matchStage === "champions" ? 7 : matchStage.startsWith("masters") ? 5 : 3;
      const upsetBonus = ovrDiff <= -2.5 ? 3 : ovrDiff >= 3.0 ? -1 : 0;
      adjustBoard(M, Math.max(1, baseGain + upsetBonus));

      if (M.winStreak >= 5) {
        const streakBonus =
          Math.round(((20000 + (M.winStreak - 5) * 10000) * diffCfg.prizeMult) / 500) * 500;
        club.budget += streakBonus;
        adjustBoard(M, 3);
        M.financeLog.unshift({
          s: M.season,
          w: M.week,
          concept: `Bono Racha Ganadora (${M.winStreak}W)`,
          amount: streakBonus
        });
        addInbox(
          M,
          "RACHA",
          `BONO DE RACHA: ${M.winStreak} VICTORIAS SEGUIDAS`,
          `La directiva premia tu racha con ${fmtMoney(streakBonus)}.`
        );
      }
    } else {
      M.career.losses++;
      M.winStreak = 0;
      M.lossStreak = (M.lossStreak || 0) + 1;

      const baseLoss = matchStage === "champions" ? -5 : matchStage.startsWith("masters") ? -6 : -7;
      const upsetPen = ovrDiff >= 2.5 ? -4 : ovrDiff <= -3.0 ? 2 : 0;
      const streakPen = M.lossStreak >= 2 ? -(M.lossStreak * 2) : 0;
      adjustBoard(
        M,
        baseLoss + upsetPen + streakPen,
        M.lossStreak >= 3 ? `Mala racha (${M.lossStreak} derrotas)` : null
      );
    }
  }
}

function recordMatchNews(M: ManagerCareerState, m: ManagerMatch, s: SeriesResult): void {
  if (!m.winner || !m.teamA || !m.teamB) return;
  const wTeam = m.winner;
  const lTeam = wTeam === m.teamA ? m.teamB : m.teamA;
  const wClub = M.clubs[wTeam];
  const lClub = M.clubs[lTeam];
  const wOvr = calcRosterOvr(wClub.players, wClub.coach);
  const lOvr = calcRosterOvr(lClub.players, lClub.coach);
  const S = computeSeriesStats(s, s.maps.length, true);
  const topP = Object.values(S).sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating))[0];
  const scoreTxt = `${m.scoreA}-${m.scoreB}`;

  if (lOvr - wOvr >= 1.8) {
    pushNewsDraft(
      M,
      buildMatchUpsetNews({
        winner: wTeam,
        loser: lTeam,
        wOvr,
        lOvr,
        scoreTxt,
        label: m.label,
        mapsLine: m.mapsLine,
        mvpName: topP?.u.p.n,
        mvpRating: topP?.rating,
        mvpAcs: topP?.acs,
        winnerCoach: wClub.coach.n,
        loserCoach: lClub.coach.n
      })
    );
    return;
  }

  if (topP && parseFloat(topP.rating) >= 1.36) {
    const pTeam = s.maps[0].teams[topP.ti].name;
    const oppTeam = pTeam === m.teamA ? m.teamB : m.teamA;
    pushNewsDraft(
      M,
      buildMatchStarNews({
        playerName: topP.u.p.n,
        playerRole: topP.u.p.r,
        playerTeam: pTeam,
        oppTeam,
        rating: topP.rating,
        acs: topP.acs,
        kda: `${topP.k}/${topP.d}/${topP.a}`,
        scoreTxt,
        label: m.label,
        mapsLine: m.mapsLine,
        won: pTeam === wTeam
      })
    );
    return;
  }

  const isCloseSeries = (m.fmt === 3 && s.maps.length === 3) || (m.fmt === 5 && s.maps.length === 5);
  const isBigStage =
    m.stage.startsWith("masters") || m.stage === "champions" || m.stage.endsWith("_po");
  const involvesUser = m.teamA === M.userTeam || m.teamB === M.userTeam;

  if (isCloseSeries && (isBigStage || involvesUser)) {
    pushNewsDraft(
      M,
      buildMatchThrillerNews({
        winner: wTeam,
        loser: lTeam,
        scoreTxt,
        label: m.label,
        mapsLine: m.mapsLine,
        mvpName: topP?.u.p.n,
        mvpRating: topP?.rating,
        isInternational: m.stage.startsWith("masters") || m.stage === "champions"
      })
    );
  }
}

function generateWeeklyRumorsAndDrama(M: ManagerCareerState): void {
  const allClubs = Object.keys(M.clubs);
  const mktPace = getMarketCfg(M).id;
  const rumorProb = mktPace === "active" ? 0.85 : mktPace === "normal" ? 0.62 : 0.38;

  if (Math.random() < rumorProb) {
    const buyer = allClubs[Math.floor(Math.random() * allClubs.length)];
    const otherClubs = allClubs.filter((c) => c !== buyer);
    const seller = otherClubs[Math.floor(Math.random() * otherClubs.length)];
    const sellerStar = M.clubs[seller].players
      .slice()
      .sort((a, b) => calcPlayerOvr(b) - calcPlayerOvr(a))[0];

    if (sellerStar && Math.random() < 0.65) {
      pushNewsDraft(
        M,
        buildWeeklyRumorNews({
          buyer,
          seller,
          playerName: sellerStar.n,
          playerRole: sellerStar.r,
          playerOvr: calcPlayerOvr(sellerStar),
          playerAge: sellerStar.age,
          contractYears: sellerStar.contractYears,
          buyerBudgetFormatted: fmtMoney(M.clubs[buyer].budget),
          isFreeAgent: false
        })
      );
    } else if (M.freeAgents.length) {
      const fa = M.freeAgents[Math.floor(Math.random() * Math.min(6, M.freeAgents.length))];
      pushNewsDraft(
        M,
        buildWeeklyRumorNews({
          buyer,
          playerName: fa.n,
          playerRole: fa.r,
          playerOvr: calcPlayerOvr(fa),
          playerAge: fa.age,
          buyerBudgetFormatted: fmtMoney(M.clubs[buyer].budget),
          isFreeAgent: true
        })
      );
    }
  }

  if (Math.random() < 0.42) {
    const userClub = M.clubs[M.userTeam];
    const unhappyUserP = userClub.players.find((p) => p.transferRequested || p.morale <= 45);
    const risingKid = userClub.players.find((p) => p.isAcademy && !p.sub && p.pot >= 88);

    if (unhappyUserP) {
      pushNewsDraft(
        M,
        buildWeeklyDramaNews({
          type: "unhappy_player",
          clubName: M.userTeam,
          coachName: userClub.coach.n,
          playerName: unhappyUserP.n,
          playerMorale: unhappyUserP.morale
        })
      );
    } else if ((M.lossStreak || 0) >= 3) {
      pushNewsDraft(
        M,
        buildWeeklyDramaNews({
          type: "losing_streak",
          clubName: M.userTeam,
          coachName: userClub.coach.n,
          lossStreak: M.lossStreak,
          boardConfidence: M.boardConfidence
        })
      );
    } else if (risingKid && Math.random() < 0.35) {
      pushNewsDraft(
        M,
        buildWeeklyDramaNews({
          type: "academy_hype",
          clubName: M.userTeam,
          coachName: userClub.coach.n,
          playerName: risingKid.n,
          playerPot: risingKid.pot
        })
      );
    } else {
      const rndClub = allClubs[Math.floor(Math.random() * allClubs.length)];
      const rndCoach = M.clubs[rndClub].coach.n;
      const kinds = ["coach_debate", "secret_strats", "staff_rumor"] as const;
      const chosen = kinds[Math.floor(Math.random() * kinds.length)];
      pushNewsDraft(
        M,
        buildWeeklyDramaNews({
          type: chosen,
          clubName: rndClub,
          coachName: rndCoach,
          activeMapsSample: M.activeMapPool.slice(0, 3).join(", ")
        })
      );
    }
  }
}

function runWeeklyTrainingAndHealth(M: ManagerCareerState): void {
  const travel = isTravelWeek(M.week);

  for (const clubName of Object.keys(M.clubs)) {
    const club = M.clubs[clubName];
    const isUser = clubName === M.userTeam;
    const mode = isUser ? TRAINING_MODES[M.training] || TRAINING_MODES.balanced : TRAINING_MODES.balanced;

    if (isUser) {
      M.nextMatchPrepBonus = mode.matchPrepBonus || 0;
      if (mode.cost > 0 && club.budget >= mode.cost) {
        club.budget -= mode.cost;
        M.financeLog.unshift({ s: M.season, w: M.week, concept: mode.name, amount: -mode.cost });
      }
      if (mode.trainsMap) {
        const targetMap: MapName = M.prepMapTarget || M.activeMapPool[0] || "Ascent";
        const prev = M.mapPrep[targetMap] || 0;
        if (prev < 0.045) {
          M.mapPrep[targetMap] = Number(Math.min(0.045, prev + 0.015).toFixed(3));
          addInbox(
            M,
            "TÁCTICA",
            `Preparación de ${targetMap}`,
            `El equipo elevó su dominio táctico en ${targetMap} a +${(M.mapPrep[targetMap]! * 100).toFixed(1)}%.`
          );
        }
      }
    }

    const payroll = club.players.reduce((s, p) => s + (p.salary || 2500), 0);
    const net = club.sponsorWeekly - payroll;
    club.budget += net;
    if (isUser) {
      M.financeLog.unshift({
        s: M.season,
        w: M.week,
        concept: `Semanal (Sponsors ${fmtMoney(club.sponsorWeekly)} - Nómina ${fmtMoney(payroll)})`,
        amount: net
      });
      if (M.financeLog.length > 50) M.financeLog = M.financeLog.slice(0, 50);
      if (club.budget < 0) {
        const defPen = club.budget < -60000 ? -6 : -3;
        adjustBoard(M, defPen, club.budget < -60000 ? "Déficit severo" : null);
        if (club.budget < -50000) {
          addInbox(
            M,
            "FINANZAS",
            "Alerta de Déficit",
            `Tu caja está en ${fmtMoney(club.budget)}. Ajusta sueldos o vende jugadores.`
          );
        }
      }
      const startersNow = club.players.filter((p) => !p.sub && !(p.injuredWeeks > 0));
      if (startersNow.length) {
        const avgMor = startersNow.reduce((s, p) => s + p.morale, 0) / startersNow.length;
        const avgFat = startersNow.reduce((s, p) => s + p.fatigue, 0) / startersNow.length;
        if (avgMor < 55) adjustBoard(M, -3);
        if (avgFat > 74) adjustBoard(M, -2);
      }
    }

    club.players.forEach((p) => {
      if (p.injuredWeeks > 0) {
        p.injuredWeeks--;
        p.fatigue = clamp(p.fatigue - (travel ? 30 : 24), 0, 100);
        if (p.injuredWeeks === 0) {
          const prevInj = p.injuryType;
          p.injuryType = "";
          p.morale = clamp(p.morale + 6, 20, 100);
          if (isUser) {
            addInbox(M, "MÉDICO", `ALTA MÉDICA: ${p.n}`, `${p.n} superó su ${prevInj} y vuelve a estar disponible.`);
          }
        }
        return;
      }

      const discFactor = 1 - Math.max(0, club.coach.disc - 75) / 160;
      let fDelta = mode.fatigueDelta > 0 ? Math.round(mode.fatigueDelta * discFactor) : mode.fatigueDelta;
      if (travel) fDelta -= 15;
      p.fatigue = clamp(p.fatigue + fDelta, 0, 100);
      p.morale = clamp(p.morale + mode.moraleDelta + (travel ? 2 : 0), 15, 100);

      let focusKeys: DeltaStatKey[] = mode.focus;
      if (mode.roleAdaptive) {
        const pr = getPrimaryRoleFromStr(p.r);
        focusKeys =
          pr === "Duelista"
            ? ["aim", "fd", "entry"]
            : pr === "Iniciador"
              ? ["util", "igl", "cons"]
              : pr === "Controlador"
                ? ["util", "clutch", "igl"]
                : pr === "Centinela"
                  ? ["clutch", "aim", "cons"]
                  : ["aim", "util", "cons"];
      }
      grantPlayerProgression(
        M,
        p,
        club.coach,
        (mode.xpBase || 17) * (p.sub ? 0.65 : 1.0),
        focusKeys,
        isUser,
        false,
        mode.hushMult || 1.0
      );
      checkPlayerInjury(M, club, p, travel ? mode.injuryMult * 0.35 : mode.injuryMult * 0.75, isUser);

      if (isUser) {
        advancePlayerLearning(M, p, club);
        if (mode.extraLearnTick && p.learning && Math.random() < 0.45) {
          advancePlayerLearning(M, p, club);
        }

        if (p.forSale) p.weeksOnMarket = (p.weeksOnMarket || 0) + 1;
        if (p.promisedRole === "starter" && p.sub && !(p.injuredWeeks > 0)) {
          p.unhappyWeeks = (p.unhappyWeeks || 0) + 1;
          p.morale = clamp(p.morale - 6, 15, 100);
          if (p.unhappyWeeks === 2) {
            addInbox(
              M,
              "CONTRATO",
              `${p.n} reclama titularidad`,
              `${p.n} tiene promesa de Titular garantizado y lleva 2 semanas en banca (Moral ${p.morale}).`
            );
          } else if (p.unhappyWeeks >= 3 && !p.transferRequested) {
            p.transferRequested = true;
            p.forSale = true;
            adjustBoard(M, -3);
            addInbox(
              M,
              "CONTRATO",
              `${p.n} PIDE SALIR DEL CLUB`,
              `Por incumplir su promesa de titularidad, ${p.n} pidió traspaso y entró al mercado.`
            );
          }
        } else if (!p.sub) {
          p.unhappyWeeks = Math.max(0, (p.unhappyWeeks || 0) - 1);
        }
      }
    });
  }

  advanceCoachCourse(M);
}

function processStageTransitions(M: ManagerCareerState, stageNum: 1 | 2): void {
  const stageObj = stageNum === 1 ? M.schedule.stage1 : M.schedule.stage2;

  if (!stageObj.poSeeded && stageObj.matches.every((m) => m.played)) {
    const st = computeStageStandings(stageObj, M.clubs);
    stageObj.playoffs[0].teamA = st[0].team;
    stageObj.playoffs[0].teamB = st[3].team;
    stageObj.playoffs[1].teamA = st[1].team;
    stageObj.playoffs[1].teamB = st[2].team;
    stageObj.poSeeded = true;

    const myPos = st.findIndex((x) => x.team === M.userTeam) + 1;
    if (myPos > 0 && myPos <= 4) {
      M.boardConfidence = clamp(M.boardConfidence + 6, -100, 100);
      addInbox(
        M,
        "LIGA",
        `Stage ${stageNum}: Clasificados a Playoffs (#${myPos})`,
        `${M.userTeam} aseguró su lugar en Semifinales Bo3.`
      );
    } else if (myPos > 4) {
      adjustBoard(M, -12, `Stage ${stageNum}: Fuera de Playoffs (#${myPos})`);
      addInbox(
        M,
        "LIGA",
        `Stage ${stageNum}: Fuera de Playoffs (#${myPos})`,
        "No se alcanzó el Top 4 regional. Usa las semanas libres para entrenar o fichar."
      );
    }
  }

  const gfReg = stageObj.playoffs[2];
  if (!stageObj.mastersSeeded && gfReg.played && gfReg.winner && gfReg.teamA && gfReg.teamB) {
    stageObj.regChamp = gfReg.winner;
    const runnerUp = gfReg.winner === gfReg.teamA ? gfReg.teamB : gfReg.teamA;
    M.schedule.vctPoints[stageObj.regChamp] = (M.schedule.vctPoints[stageObj.regChamp] || 0) + 5;
    M.schedule.vctPoints[runnerUp] = (M.schedule.vctPoints[runnerUp] || 0) + 3;

    if (stageObj.regChamp === M.userTeam) {
      rewardUserTitle(M, "regional", `${stageObj.leagueName} ${M.season}`, 100000, 25);
    } else if (runnerUp === M.userTeam) {
      M.clubs[M.userTeam].budget += 55000;
      M.boardConfidence = clamp(M.boardConfidence + 10, -100, 100);
      M.financeLog.unshift({
        s: M.season,
        w: M.week,
        concept: `Subcampeón ${stageObj.leagueName}`,
        amount: 55000
      });
      addInbox(
        M,
        "MASTERS",
        `Clasificados al VCT Masters ${stageNum}`,
        "Premio de $55,000 (+10 Confianza). Tienes 2 semanas de viaje y descanso antes de Cuartos de Final."
      );
    }

    const pool = [stageObj.regChamp, runnerUp];
    const others = Object.keys(M.clubs)
      .filter((t) => !pool.includes(t) && !stageObj.leagueTeams.includes(t))
      .sort(
        (a, b) =>
          calcRosterOvr(M.clubs[b].players, M.clubs[b].coach) +
          Math.random() * 2 -
          (calcRosterOvr(M.clubs[a].players, M.clubs[a].coach) + Math.random() * 2)
      );
    others.forEach((t) => {
      if (pool.length < 8) pool.push(t);
    });
    Object.keys(M.clubs)
      .filter((t) => !pool.includes(t))
      .forEach((t) => {
        if (pool.length < 8) pool.push(t);
      });

    const ms = stageObj.masters;
    ms[0].teamA = pool[0];
    ms[0].teamB = pool[7];
    ms[1].teamA = pool[3];
    ms[1].teamB = pool[4];
    ms[2].teamA = pool[1];
    ms[2].teamB = pool[6];
    ms[3].teamA = pool[2];
    ms[3].teamB = pool[5];
    stageObj.mastersSeeded = true;
  }

  const gfMs = stageObj.masters[6];
  if (!stageObj.mastersChamp && gfMs.played && gfMs.winner && gfMs.teamA && gfMs.teamB) {
    stageObj.mastersChamp = gfMs.winner;
    const runnerUp = gfMs.winner === gfMs.teamA ? gfMs.teamB : gfMs.teamA;
    M.schedule.vctPoints[stageObj.mastersChamp] =
      (M.schedule.vctPoints[stageObj.mastersChamp] || 0) + 7;
    M.schedule.vctPoints[runnerUp] = (M.schedule.vctPoints[runnerUp] || 0) + 4;

    Object.keys(M.clubs).forEach((c) => {
      if (!stageObj.leagueTeams.includes(c)) {
        const ovr = calcRosterOvr(M.clubs[c].players, M.clubs[c].coach);
        M.schedule.vctPoints[c] =
          (M.schedule.vctPoints[c] || 0) + Math.max(1, Math.round((ovr - 80) * 0.55 + Math.random() * 3));
      }
    });

    if (stageObj.mastersChamp === M.userTeam) {
      rewardUserTitle(M, "masters", `VCT Masters ${stageNum} (${M.season})`, 350000, 35);
    } else if (runnerUp === M.userTeam) {
      M.clubs[M.userTeam].budget += 150000;
      M.boardConfidence = clamp(M.boardConfidence + 16, -100, 100);
      M.financeLog.unshift({
        s: M.season,
        w: M.week,
        concept: `Subcampeón VCT Masters ${stageNum}`,
        amount: 150000
      });
      addInbox(
        M,
        "MASTERS",
        `Subcampeones de VCT Masters ${stageNum}`,
        "Gran campaña internacional: +$150,000 (+16 Confianza)."
      );
    }
  }
}

function seedChampionsIfReady(M: ManagerCareerState): void {
  const sc = M.schedule;
  if (sc.championsSeeded || !sc.stage2.mastersChamp) return;

  const guaranteed = Array.from(
    new Set(
      [
        sc.stage1.regChamp,
        sc.stage1.mastersChamp,
        sc.stage2.regChamp,
        sc.stage2.mastersChamp
      ].filter((x): x is string => Boolean(x))
    )
  );

  const ranked = Object.keys(M.clubs).sort((a, b) => {
    const ptsDiff = (sc.vctPoints[b] || 0) - (sc.vctPoints[a] || 0);
    if (ptsDiff !== 0) return ptsDiff;
    return (
      calcRosterOvr(M.clubs[b].players, M.clubs[b].coach) -
      calcRosterOvr(M.clubs[a].players, M.clubs[a].coach)
    );
  });

  const top16 = [...guaranteed];
  ranked.forEach((c) => {
    if (top16.length < 16 && !top16.includes(c)) top16.push(c);
  });

  const pairIdx: Array<[number, number]> = [
    [0, 15],
    [7, 8],
    [3, 12],
    [4, 11],
    [1, 14],
    [6, 9],
    [2, 13],
    [5, 10]
  ];
  pairIdx.forEach(([a, b], i) => {
    sc.champions[i].teamA = top16[a];
    sc.champions[i].teamB = top16[b];
  });
  sc.championsSeeded = true;

  if (top16.includes(M.userTeam)) {
    M.boardConfidence = clamp(M.boardConfidence + 10, -100, 100);
    addInbox(
      M,
      "CHAMPIONS",
      `CLASIFICADOS A VALORANT CHAMPIONS ${M.season}`,
      `${M.userTeam} entra al Top 16 mundial. Tienes 2 semanas de viaje y preparación antes de Octavos (Semana 29).`
    );
  } else {
    adjustBoard(M, -14, "Sin clasificación a Champions");
    addInbox(
      M,
      "CHAMPIONS",
      `Fuera de VALORANT Champions ${M.season}`,
      `${M.userTeam} no alcanzó los Puntos VCT para el Top 16 global.`
    );
  }
}

function triggerBoardSacking(M: ManagerCareerState, title: string, detail: string): void {
  M.fired = true;
  M.pendingBoardMeeting = null;
  const rescueClubs = Object.keys(M.clubs)
    .filter((c) => c !== M.userTeam)
    .sort(
      (a, b) =>
        calcRosterOvr(M.clubs[a].players, M.clubs[a].coach) -
        calcRosterOvr(M.clubs[b].players, M.clubs[b].coach)
    )
    .slice(0, 6)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
  M.pendingJobOffers = rescueClubs.map((c) => ({
    club: c,
    reg: M.clubs[c].reg,
    ovr: calcRosterOvr(M.clubs[c].players, M.clubs[c].coach),
    budget: M.clubs[c].budget,
    reason: "Proyecto de reconstrucción"
  }));
  addInbox(M, "DESPIDO", title, detail);
}

function evaluateObjectiveProgressAndMeetings(M: ManagerCareerState, isSeasonClose = false): void {
  const club = M.clubs[M.userTeam];
  const obj = M.schedule.objective;
  if (!obj || M.fired || M.ended) return;

  if (club.players.some((p) => p.isAcademy && !p.sub && !(p.injuredWeeks > 0))) {
    obj.academyStarterPromoted = true;
  }

  if (obj.tier === "contender") {
    const wonReg = M.schedule.stage1.regChamp === M.userTeam || M.schedule.stage2.regChamp === M.userTeam;
    if (!wonReg) {
      const checks: Array<{ key: number; seeded: boolean; inEvent: boolean; label: string; pen: number }> = [
        {
          key: 1,
          seeded: M.schedule.stage1.mastersSeeded,
          inEvent: M.schedule.stage1.masters.some((m) => m.teamA === M.userTeam || m.teamB === M.userTeam),
          label: "VCT Masters 1",
          pen: -12
        },
        {
          key: 2,
          seeded: M.schedule.stage2.mastersSeeded,
          inEvent: M.schedule.stage2.masters.some((m) => m.teamA === M.userTeam || m.teamB === M.userTeam),
          label: "VCT Masters 2",
          pen: -12
        },
        {
          key: 3,
          seeded: M.schedule.championsSeeded,
          inEvent: M.schedule.champions.some((m) => m.teamA === M.userTeam || m.teamB === M.userTeam),
          label: `VALORANT Champions ${M.season}`,
          pen: -10
        }
      ];

      for (const c of checks) {
        if (c.seeded && !c.inEvent && !obj.missedInternationalsNotified.includes(c.key)) {
          obj.missedInternationalsNotified.push(c.key);
          adjustBoard(M, c.pen, `Fuera de ${c.label}`);
          pushNewsDraft(
            M,
            buildObjectiveRiskNews({
              teamName: M.userTeam,
              eventLabel: c.label,
              boardConfidence: M.boardConfidence
            })
          );
        }
      }
    }
  }

  const evalRes = evaluateSeasonObjective(M);

  if (evalRes.canTriggerEarlyReward) {
    obj.rewarded = true;
    const diffCfg = getDiffCfg(M);
    const bonusBudget = Math.round((obj.rewardBudget * diffCfg.prizeMult) / 1000) * 1000;
    const early = M.week < 33;
    club.budget += bonusBudget;
    M.career.objectiveRepBonus = (M.career.objectiveRepBonus || 0) + obj.rewardRep;
    adjustBoard(M, 12, "Objetivo de temporada cumplido");
    M.financeLog.unshift({
      s: M.season,
      w: M.week,
      concept: `Bono Objetivo ${obj.tierLabel}${early ? " (Anticipado)" : ""}`,
      amount: bonusBudget
    });
    addInbox(
      M,
      "DIRECTIVA",
      `OBJETIVO CUMPLIDO: +${fmtMoney(bonusBudget)} y +${obj.rewardRep} REP`,
      `Completaste "${obj.label}". La directiva liberó ${fmtMoney(bonusBudget)} extra para fichajes y tu reputación de manager subió +${obj.rewardRep} puntos.`
    );
    pushNewsDraft(
      M,
      buildObjectiveCompletedNews({
        teamName: M.userTeam,
        tierLabel: obj.tierLabel,
        objectiveLabel: obj.label,
        bonusFormatted: fmtMoney(bonusBudget),
        repGain: obj.rewardRep,
        early
      })
    );
    return;
  }

  const shouldTriggerMeeting =
    !obj.meetingTriggered &&
    !obj.meetingResolved &&
    !M.pendingBoardMeeting &&
    (evalRes.failedAfterStage2 ||
      (isSeasonClose && evalRes.failedSeasonFinal) ||
      (evalRes.tier === "giant" && evalRes.failedSeasonFinal));

  if (shouldTriggerMeeting) {
    obj.meetingTriggered = true;
    M.pendingBoardMeeting = {
      season: M.season,
      week: M.week,
      phaseLabel: isSeasonClose ? `CIERRE TEMPORADA ${M.season}` : "FIN DE STAGE 2",
      tier: evalRes.tier,
      tierLabel: evalRes.tierLabel,
      objectiveLabel: evalRes.label,
      reason: evalRes.failureReason,
      giantNoTitle: evalRes.giantNoTitle
    };
    addInbox(
      M,
      "DIRECTIVA",
      "CONVOCATORIA URGENTE: REUNIÓN FINAL DE DIRECTIVA",
      `Incumplimiento del objetivo (${evalRes.failureReason}). Debes comparecer ante la junta antes de continuar.`
    );
  }
}

function closeCurrentSeason(M: ManagerCareerState): void {
  const sc = M.schedule;
  if (sc.seasonClosed) return;
  sc.seasonClosed = true;

  const gfCh = sc.champions[sc.champions.length - 1];
  if (gfCh && gfCh.played && gfCh.winner && gfCh.teamA && gfCh.teamB) {
    sc.championsChamp = gfCh.winner;
    const runnerUp = gfCh.winner === gfCh.teamA ? gfCh.teamB : gfCh.teamA;
    if (sc.championsChamp === M.userTeam) {
      rewardUserTitle(M, "champions", `VALORANT Champions ${M.season}`, 1000000, 50);
    } else if (runnerUp === M.userTeam) {
      M.clubs[M.userTeam].budget += 400000;
      M.boardConfidence = clamp(M.boardConfidence + 25, -100, 100);
      M.financeLog.unshift({
        s: M.season,
        w: 33,
        concept: `Subcampeón VALORANT Champions ${M.season}`,
        amount: 400000
      });
      addInbox(
        M,
        "CHAMPIONS",
        `Subcampeones del Mundo (${M.season})`,
        "Premio de $400,000 ingresado (+25 Confianza)."
      );
    }
  }

  M.seasonHistory.unshift({
    season: M.season,
    club: M.userTeam,
    m1: sc.stage1.mastersChamp || "-",
    m2: sc.stage2.mastersChamp || "-",
    champions: sc.championsChamp || "-",
    ovrEnd: calcRosterOvr(M.clubs[M.userTeam].players, M.clubs[M.userTeam].coach)
  });

  evaluateObjectiveProgressAndMeetings(M, true);

  for (const cName of Object.keys(M.clubs)) {
    const clubObj = M.clubs[cName];
    clubObj.players.forEach((p) => {
      p.age = (p.age || 21) + 1;
      p.fatigue = clamp(p.fatigue - 50, 5, 30);
      p.injuredWeeks = 0;
      p.injuryType = "";
      if (p.age >= 29 && Math.random() < 0.5) {
        p.aim = Math.max(70, p.aim - 1);
        p.entry = Math.max(65, p.entry - 1);
        p.deltas.aim = (p.deltas.aim || 0) - 1;
      }
      p.seasonMaps = 0;
      p.seasonRatingSum = 0;
      p.contractYears = (p.contractYears || 2) - 1;
    });

    const expired = clubObj.players.filter((p) => p.contractYears <= 0);
    expired.forEach((expP) => {
      if (cName !== M.userTeam && clubObj.players.length <= 5) {
        expP.contractYears = 1;
        return;
      }
      const idx = clubObj.players.indexOf(expP);
      if (idx >= 0) {
        clubObj.players.splice(idx, 1);
        expP.sub = 0;
        expP.forSale = false;
        expP.contractYears = 2;
        M.freeAgents.unshift(expP);
        if (cName === M.userTeam) {
          addInbox(
            M,
            "CONTRATO",
            `Contrato vencido: ${expP.n}`,
            `${expP.n} finalizó su vínculo sin renovación y quedó como Agente Libre.`
          );
        }
      }
    });
  }

  M.freeAgents.forEach((p) => {
    p.age = (p.age || 22) + 1;
  });

  const db = useDbStore.getState();
  M.academy = generateAcademyBatch(12, M.userTeam, M, db.teams, db.academies, db.teamMeta);
  addInbox(
    M,
    "CIERRE",
    `Fin de Temporada ${M.season}`,
    `Masters 1: ${sc.stage1.mastersChamp} · Masters 2: ${sc.stage2.mastersChamp} · Champions: ${sc.championsChamp}. Nueva camada de 12 juveniles lista en Academia.`
  );
}

function maybeGenerateIncomingOffer(M: ManagerCareerState): void {
  if (M.pendingOffer) return;
  const myClub = M.clubs[M.userTeam];
  const mktCfg = getMarketCfg(M);
  const listed = myClub.players.filter(
    (p) => p.forSale && (p.weeksOnMarket || 0) >= 1 && !(p.injuredWeeks > 0)
  );

  let target: ManagerPlayer | null = null;
  let isListedBid = false;

  if (listed.length && Math.random() < Math.min(0.65, mktCfg.offerChance * 2.2 + 0.14)) {
    target = listed[Math.floor(Math.random() * listed.length)];
    isListedBid = true;
  } else if (myClub.players.length > 5 && Math.random() < mktCfg.offerChance) {
    const candidates = myClub.players.filter((p) => !(p.injuredWeeks > 0));
    if (candidates.length) target = candidates[Math.floor(Math.random() * candidates.length)];
  }
  if (!target) return;

  const baseVal = calcPlayerValue(target);
  const otherClubs = Object.keys(M.clubs).filter(
    (c) => c !== M.userTeam && M.clubs[c].budget >= baseVal * 0.85
  );
  if (!otherClubs.length) return;
  const buyer = otherClubs[Math.floor(Math.random() * otherClubs.length)];
  const mult = isListedBid ? 1.06 + Math.random() * 0.24 : 0.98 + Math.random() * 0.18;
  const targetRef = isListedBid ? Math.max(baseVal, target.askingPrice || baseVal) : baseVal;
  const amount = Math.min(
    M.clubs[buyer].budget,
    Math.round((targetRef * mult) / 1000) * 1000
  );
  const sellOnPct = Math.random() < 0.35 ? 10 : 0;

  M.pendingOffer = { buyer, player: target.n, amount, sellOnPct, isListedBid };
  addInbox(
    M,
    "OFERTA",
    `${isListedBid ? "Oferta por jugador en venta" : "Oferta de"} ${buyer}: ${target.n}`,
    `${buyer} ofrece ${fmtMoney(amount)}${
      sellOnPct ? ` + ${sellOnPct}% futura venta` : ""
    } por ${target.n}. Puedes aceptar, contraofertar o rechazar.`
  );
}

function checkBoardFiring(M: ManagerCareerState): void {
  recordBoardSnapshot(M);
  if (M.graceWeeks > 0 || M.pendingBoardMeeting) return;
  const fireAt = getDiffCfg(M).fireThreshold;
  if (M.boardConfidence <= fireAt && !M.fired) {
    triggerBoardSacking(
      M,
      `CESADO DE ${M.userTeam.toUpperCase()}`,
      `Tu confianza directiva cayó a ${M.boardConfidence} (límite ${fireAt}). La junta decidió rescindir tu contrato.`
    );
  }
}

function findBracketListForMatch(M: ManagerCareerState, m: ManagerMatch): ManagerMatch[] | null {
  if (m.stage === "stage1_po") return M.schedule.stage1.playoffs;
  if (m.stage === "masters1") return M.schedule.stage1.masters;
  if (m.stage === "stage2_po") return M.schedule.stage2.playoffs;
  if (m.stage === "masters2") return M.schedule.stage2.masters;
  if (m.stage === "champions") return M.schedule.champions;
  return null;
}

function switchManagerToClub(
  M: ManagerCareerState,
  targetClubName: string,
  sourceLabel: string
): void {
  const oldTeam = M.userTeam;
  M.userTeam = targetClubName;
  M.fired = false;
  M.boardConfidence = 68;
  M.graceWeeks = 8;
  M.winStreak = 0;
  M.pendingJobOffers = [];
  M.pendingOffer = null;
  M.pendingSponsorOffer = null;
  M.pendingBoardMeeting = null;
  if (!M.career.clubsManaged.includes(targetClubName)) {
    M.career.clubsManaged.push(targetClubName);
  }

  if (M.week <= 1) {
    M.schedule = buildFullYearSchedule(M.clubs, M.userTeam, M.season);
  } else {
    if (M.week <= 14) {
      M.schedule.stage2 = buildRegionalLeagueForStage(M.clubs, M.userTeam, M.season, 2, 15);
    }
    const newOvr = calcRosterOvr(M.clubs[targetClubName].players, M.clubs[targetClubName].coach);
    M.schedule.objective = buildSeasonObjective(newOvr);
  }

  addInbox(
    M,
    "OFERTA DT",
    `Nuevo Manager de ${targetClubName}`,
    `Llegaste desde ${oldTeam} (${sourceLabel}). La directiva te recibe con +68 de confianza y 8 semanas de período de gracia.`
  );
}

// ===== INTERFAZ DEL STORE ZUSTAND =====
interface ManagerStoreState {
  career: ManagerCareerState | null;
  activeTab: ManagerTabId;
  setupSettings: { difficulty: DifficultyId; marketPace: MarketPaceId };
  tacticsMap: MapName;
  showMapPoolEditor: boolean;
  newsFilter: "ALL" | NewsCategory;
  marketFilter: { source: "ALL" | "FREE" | "CLUBS"; role: string; query: string; view: "players" | "coaches" };
  clubsFilter: { reg: string; selectedClub: string | null };
  activeNeg: ActiveNegotiation | null;
  activeRenew: ActiveRenewal | null;

  // Última serie y Visor integrado de /manager
  lastSeriesRef: ManagerViewerPayload | null;
  viewerOpen: boolean;
  viewerPayload: ManagerViewerPayload | null;
  viewerLiveFinished: boolean;
  viewerLiveMapIdx: number;
  viewerLiveShown: number;
  viewerRevealedMaps: number;
  viewerActiveTab: number | "SERIES";
  viewerAutoPlaying: boolean;

  // Setup & navegación
  setSetupOpt: <K extends "difficulty" | "marketPace">(key: K, val: ManagerStoreState["setupSettings"][K]) => void;
  startCareer: (teamName: string) => void;
  endCareer: () => void;
  resetToClubSelect: () => void;
  setActiveTab: (tab: ManagerTabId) => void;
  setTacticsMap: (map: MapName) => void;
  toggleMapPoolEditor: () => void;
  setNewsFilter: (cat: "ALL" | NewsCategory) => void;
  setMarketFilter: <K extends keyof ManagerStoreState["marketFilter"]>(
    key: K,
    val: ManagerStoreState["marketFilter"][K]
  ) => void;
  setClubsFilter: <K extends keyof ManagerStoreState["clubsFilter"]>(
    key: K,
    val: ManagerStoreState["clubsFilter"][K]
  ) => void;

  // Avance semanal
  advanceWeek: (watchLive: boolean) => void;
  skipToNextMatch: () => void;

  // Reunión final de directiva
  resolveBoardMeeting: (choice: "promise" | "defend" | "resign" | "accept_sack") => void;

  // Entrenamiento, plantilla, aprendizaje y coach
  setTraining: (modeId: TrainingModeId) => void;
  setPrepMap: (mapName: MapName) => void;
  setPlayerPlan: (idx: number, planId: PlayerPlanId) => void;
  toggleStarter: (idx: number) => void;
  autoFillLineup: () => void;
  physioPlayer: (idx: number) => void;
  startLearning: (idx: number, type: "agent" | "role", target: string) => void;
  cancelLearning: (idx: number) => void;
  buyCoachCourse: (courseId: string) => void;

  // Táctica y Map Pool 7/13
  setCompAgent: (playerName: string, agentName: string) => void;
  resetMapComp: () => void;
  toggleMapInPool: (mapName: MapName) => void;
  manualRotatePool: () => void;

  // Academia & Mercado & Staff
  hireAcademy: (idx: number) => void;
  scoutMoreAcademy: () => void;
  signFreeAgent: (faIdx: number) => void;
  hireCoach: (coachIdx: number) => void;
  toggleForSale: (idx: number) => void;
  setAskingPrice: (idx: number, val: number) => void;

  // Renovaciones & Negociación bidireccional
  openRenew: (idx: number) => void;
  updateRenew: (field: keyof Omit<ActiveRenewal, "idx" | "playerName" | "feedback">, val: number | PromisedRole) => void;
  closeRenew: () => void;
  submitRenew: () => void;

  openBuyNeg: (sellerName: string, playerName: string) => void;
  openSellNeg: () => void;
  updateNeg: (field: string, val: string | number) => void;
  closeNeg: () => void;
  submitNeg: () => void;
  acceptCounter: () => void;

  // Ofertas, sponsors y postulación
  respondOffer: (accept: boolean) => void;
  respondSponsor: (accept: boolean) => void;
  acceptJobOffer: (offerIdx: number) => void;
  dismissJobOffers: () => void;
  applyForClub: (targetClub: string) => void;

  // Persistencia .json v3
  exportSave: () => void;
  importSave: (rawJson: unknown) => { ok: true; summary: string } | { ok: false; err: string };

  // Visor integrado en /manager
  openLastBoxscore: (autoPlay: boolean) => void;
  closeViewer: () => void;
  stepViewerRound: () => void;
  toggleViewerAutoPlay: () => void;
  stopViewerLive: () => void;
  selectViewerTab: (tab: number | "SERIES") => void;
}

export const useManagerStore = create<ManagerStoreState>((set, get) => {
  const commit = (next: ManagerCareerState, extra: Partial<ManagerStoreState> = {}) => {
    persistCareer(next);
    set({ career: next, ...extra });
  };

  const advanceViewerRound = (): boolean => {
    const st = get();
    const series = st.viewerPayload?.series;
    if (!series || st.viewerLiveFinished) {
      st.stopViewerLive();
      return false;
    }

    const activeM = series.maps[st.viewerLiveMapIdx];
    if (!activeM) {
      st.stopViewerLive();
      return false;
    }

    if (st.viewerLiveShown < activeM.rounds.length) {
      const nextShown = st.viewerLiveShown + 1;
      const justPlayed = activeM.rounds[nextShown - 1];
      const mapDoneNow = nextShown >= activeM.rounds.length;
      const seriesDoneNow = mapDoneNow && st.viewerLiveMapIdx === series.maps.length - 1;

      if (justPlayed) {
        if (mapDoneNow) VCTSound.mapEnd();
        else if (justPlayed.hl.some((h) => h.t === "ace")) VCTSound.ace();
        else if (justPlayed.cl && justPlayed.cl.won && justPlayed.cl.x >= 2) VCTSound.clutch();
        else if (justPlayed.timeouts.length) VCTSound.timeout();
        else VCTSound.roundEnd();
      }

      if (seriesDoneNow) {
        clearMgrLiveInterval();
        set({
          viewerActiveTab: st.viewerLiveMapIdx,
          viewerLiveShown: nextShown,
          viewerLiveFinished: true,
          viewerRevealedMaps: series.maps.length,
          viewerAutoPlaying: false
        });
        return false;
      }

      set({ viewerActiveTab: st.viewerLiveMapIdx, viewerLiveShown: nextShown });
      return true;
    }

    if (st.viewerLiveMapIdx + 1 < series.maps.length) {
      const nextIdx = st.viewerLiveMapIdx + 1;
      const nextM = series.maps[nextIdx];
      const doneNow = 1 >= nextM.rounds.length && nextIdx === series.maps.length - 1;
      if (doneNow) {
        clearMgrLiveInterval();
        set({
          viewerLiveMapIdx: nextIdx,
          viewerRevealedMaps: series.maps.length,
          viewerActiveTab: nextIdx,
          viewerLiveShown: 1,
          viewerLiveFinished: true,
          viewerAutoPlaying: false
        });
        return false;
      }
      set({
        viewerLiveMapIdx: nextIdx,
        viewerRevealedMaps: Math.max(st.viewerRevealedMaps, nextIdx + 1),
        viewerActiveTab: nextIdx,
        viewerLiveShown: 1
      });
      return true;
    }

    clearMgrLiveInterval();
    set({
      viewerLiveFinished: true,
      viewerRevealedMaps: series.maps.length,
      viewerAutoPlaying: false
    });
    return false;
  };

  const openPayloadInViewer = (payload: ManagerViewerPayload, autoPlay: boolean) => {
    clearMgrLiveInterval();
    const db = useDbStore.getState();
    applyTeamColorsForPair(db.teamMeta, payload.teamA, payload.teamB);
    const lastIdx = Math.max(0, payload.series.maps.length - 1);

    set({
      viewerOpen: true,
      viewerPayload: payload,
      viewerLiveFinished: !autoPlay,
      viewerLiveMapIdx: autoPlay ? 0 : lastIdx,
      viewerLiveShown: autoPlay ? 0 : payload.series.maps[lastIdx]?.rounds.length ?? 0,
      viewerRevealedMaps: autoPlay ? 1 : payload.series.maps.length,
      viewerActiveTab: autoPlay ? 0 : payload.series.format > 1 ? "SERIES" : 0,
      viewerAutoPlaying: autoPlay
    });

    if (autoPlay) {
      if (advanceViewerRound()) {
        mgrLiveTimer = window.setInterval(() => {
          if (!advanceViewerRound()) get().stopViewerLive();
        }, 340);
      }
    }
  };

  const initialCareer = loadInitialCareer();

  return {
    career: initialCareer,
    activeTab: "hub",
    setupSettings: { difficulty: "normal", marketPace: "normal" },
    tacticsMap: (initialCareer?.activeMapPool[0] || "Ascent") as MapName,
    showMapPoolEditor: false,
    newsFilter: "ALL",
    marketFilter: { source: "ALL", role: "ALL", query: "", view: "players" },
    clubsFilter: { reg: "ALL", selectedClub: null },
    activeNeg: null,
    activeRenew: null,

    lastSeriesRef: null,
    viewerOpen: false,
    viewerPayload: null,
    viewerLiveFinished: true,
    viewerLiveMapIdx: 0,
    viewerLiveShown: 0,
    viewerRevealedMaps: 0,
    viewerActiveTab: 0,
    viewerAutoPlaying: false,

    setSetupOpt: (key, val) =>
      set((s) => ({ setupSettings: { ...s.setupSettings, [key]: val } })),

    startCareer: (teamName) => {
      const db = useDbStore.getState();
      if (!db.teams[teamName]) return;
      const { setupSettings } = get();
      const diffCfg = DIFFICULTY_CFG[setupSettings.difficulty] || DIFFICULTY_CFG.normal;
      const mktCfg = MARKET_PACE_CFG[setupSettings.marketPace] || MARKET_PACE_CFG.normal;

      const clubs: Record<string, ManagerClub> = {};
      for (const t of Object.keys(db.teams)) {
        const meta = db.teamMeta[t] || {
          reg: "AMERICAS" as const,
          color: "#E5484D",
          code: t.slice(0, 3).toUpperCase(),
          logo: "vct.png",
          logoCls: ""
        };
        const players = db.teams[t].map((p) => enrichPlayer(p, false));
        const baseC = db.coaches[t] || { n: "Coach", macro: 82, micro: 82, adapt: 82, dev: 82, disc: 82 };
        const cAvg = Math.round((baseC.macro + baseC.micro + baseC.adapt + baseC.dev + baseC.disc) / 5);
        const coach = { ...baseC, pot: clamp(cAvg + 4, 84, 96), exp: 5, tier: "established" as const };
        const ovr = calcRosterOvr(players, coach);
        const mult = t === teamName ? diffCfg.budgetMult : 1.0;
        const startBudget =
          Math.round(((360000 + Math.max(0, ovr - 80) * 40000) * mult) / 5000) * 5000;
        const sponsorWeekly = Math.round((24000 + Math.max(0, ovr - 78) * 1500) / 500) * 500;
        clubs[t] = {
          name: t,
          reg: meta.reg,
          color: meta.color,
          code: meta.code,
          players,
          coach,
          budget: startBudget,
          sponsorWeekly,
          activeSponsors: []
        };
      }

      const activePool: MapName[] = [...DEFAULT_ACTIVE_MAPS];
      const schedule = buildFullYearSchedule(clubs, teamName, 2027);

      const M: ManagerCareerState = {
        userTeam: teamName,
        season: 2027,
        week: 1,
        settings: { difficulty: diffCfg.id, marketPace: mktCfg.id },
        boardConfidence: diffCfg.startConf,
        graceWeeks: diffCfg.graceWeeks,
        boardHistory: [{ s: 2027, w: 1, val: diffCfg.startConf }],
        fired: false,
        ended: false,
        winStreak: 0,
        lossStreak: 0,
        bestStreak: 0,
        startBudget: clubs[teamName].budget,
        training: "balanced",
        prepMapTarget: activePool[0],
        nextMatchPrepBonus: 0,
        mapPrep: {},
        customComps: {},
        activeMapPool: activePool,
        news: [],
        coachCourse: null,
        careerPlayerStats: {},
        negCooldown: {},
        career: {
          wins: 0,
          losses: 0,
          regionalTitles: 0,
          mastersTitles: 0,
          championsTitles: 0,
          clubsManaged: [teamName],
          applyCooldown: {},
          objectiveRepBonus: 0
        },
        clubs,
        freeAgents: FREE_AGENTS_SEED.map((p) => enrichPlayer(p, true)),
        freeCoaches: FREE_COACHES_SEED.map((c) => ({ ...c })),
        academy: [],
        inbox: [],
        transferLog: [],
        financeLog: [],
        trophies: [],
        seasonHistory: [],
        schedule,
        lastPlayedMatch: null,
        pendingOffer: null,
        pendingSponsorOffer: null,
        pendingJobOffers: [],
        pendingBoardMeeting: null
      };

      M.academy = generateAcademyBatch(12, teamName, M, db.teams, db.academies, db.teamMeta);
      db.setActiveMapPool(M.activeMapPool);

      pushNewsDraft(
        M,
        buildSeasonStartNews({
          teamName,
          season: M.season,
          coachName: clubs[teamName].coach.n,
          ovr: calcRosterOvr(clubs[teamName].players, clubs[teamName].coach),
          diffLabel: diffCfg.label,
          tier: M.schedule.objective.tier,
          objectiveLabel: M.schedule.objective.label
        })
      );
      addInbox(
        M,
        "DIRECTIVA",
        `Contrato firmado con ${teamName} (${diffCfg.label} · Mercado ${mktCfg.label})`,
        `Inicias con +${diffCfg.startConf} de confianza, ${diffCfg.graceWeeks} semanas de gracia y despido en <= ${diffCfg.fireThreshold}. Presupuesto inicial: ${fmtMoney(clubs[teamName].budget)}. Objetivo anual: ${M.schedule.objective.label}.`
      );

      commit(M, {
        activeTab: "hub",
        tacticsMap: activePool[0],
        activeNeg: null,
        activeRenew: null,
        lastSeriesRef: null,
        viewerOpen: false,
        viewerPayload: null
      });
    },

    endCareer: () => {
      const cur = get().career;
      if (!cur) return;
      if (!window.confirm("¿Finalizar esta carrera para ver el resumen completo y tu calificación final?")) return;
      const M = cloneCareer(cur);
      recordBoardSnapshot(M);
      M.ended = true;
      commit(M, { activeNeg: null, activeRenew: null });
    },

    resetToClubSelect: () => {
      clearMgrLiveInterval();
      persistCareer(null);
      set({
        career: null,
        activeTab: "hub",
        activeNeg: null,
        activeRenew: null,
        lastSeriesRef: null,
        viewerOpen: false,
        viewerPayload: null,
        viewerAutoPlaying: false
      });
    },

    setActiveTab: (tab) => set({ activeTab: tab }),
    setTacticsMap: (map) => set({ tacticsMap: map }),
    toggleMapPoolEditor: () => set((s) => ({ showMapPoolEditor: !s.showMapPoolEditor })),
    setNewsFilter: (cat) => set({ newsFilter: cat }),
    setMarketFilter: (key, val) =>
      set((s) => ({ marketFilter: { ...s.marketFilter, [key]: val } })),
    setClubsFilter: (key, val) =>
      set((s) => ({ clubsFilter: { ...s.clubsFilter, [key]: val } })),

    advanceWeek: (watchLive) => {
      const cur = get().career;
      if (!cur || cur.fired || cur.ended || cur.pendingBoardMeeting) return;
      const M = cloneCareer(cur);

      if (M.week >= 33) {
        M.season++;
        M.week = 1;
        M.pendingOffer = null;
        M.pendingSponsorOffer = null;
        M.pendingBoardMeeting = null;
        const rot = rotateActiveMapPool(M.activeMapPool, 2);
        M.activeMapPool = rot.activePool;
        useDbStore.getState().setActiveMapPool(rot.activePool);
        pushNewsDraft(
          M,
          buildMapPoolNews({
            season: M.season,
            outMaps: rot.outMaps,
            inMaps: rot.inMaps,
            activePool: rot.activePool
          })
        );
        addInbox(
          M,
          "TEMPORADA",
          `Comienza ${M.season} · Nuevo Map Pool`,
          `Salen ${rot.outMaps.join(" y ")} · Entran ${rot.inMaps.join(" y ")}. Calendario de 33 semanas listo.`
        );
        M.schedule = buildFullYearSchedule(M.clubs, M.userTeam, M.season);
        commit(M, { tacticsMap: rot.activePool[0] });
        return;
      }

      const myClub = M.clubs[M.userTeam];
      const weekMatches = getMatchesForWeek(M.schedule, M.week);
      const userMatch = weekMatches.find(
        (m) => !m.played && (m.teamA === M.userTeam || m.teamB === M.userTeam)
      );

      if (userMatch) {
        const check = validateStartingLineup(myClub);
        if (!check.ok) {
          window.alert(
            `Alineación inválida para ${userMatch.label}: necesitas 5 titulares sanos sin duplicados (actual: ${check.count}/5${
              check.hasDup ? ", hay duplicados" : ""
            }).`
          );
          set({ activeTab: "squad" });
          return;
        }
      }

      runWeeklyTrainingAndHealth(M);

      let userSeriesPlayed: ManagerViewerPayload | null = null;
      weekMatches.forEach((m) => {
        if (m.played || !m.teamA || !m.teamB) return;
        const s = simManagerSeries(M, m.teamA, m.teamB, m.fmt);
        m.scoreA = s.seriesScore[0];
        m.scoreB = s.seriesScore[1];
        m.winner = m.scoreA > m.scoreB ? m.teamA : m.teamB;
        m.played = true;
        m.mapsLine = s.maps
          .map((mp) => `${mp.mapName.slice(0, 3).toUpperCase()} ${mp.sc[0]}-${mp.sc[1]}`)
          .join(" · ");

        applyMatchImpactToClub(M, m.teamA, s, 0, m.stage);
        applyMatchImpactToClub(M, m.teamB, s, 1, m.stage);
        recordMatchNews(M, m, s);

        if (m.nextId) {
          const list = findBracketListForMatch(M, m);
          const nextM = list?.find((x) => x.id === m.nextId);
          if (nextM) {
            if (m.nextSlot === 0) nextM.teamA = m.winner;
            else nextM.teamB = m.winner;
          }
        }

        if (m.teamA === M.userTeam || m.teamB === M.userTeam) {
          M.lastPlayedMatch = {
            label: m.label,
            teamA: m.teamA,
            teamB: m.teamB,
            scoreA: m.scoreA,
            scoreB: m.scoreB,
            mapsLine: m.mapsLine,
            fmt: m.fmt
          };
          userSeriesPlayed = {
            teamA: m.teamA,
            teamB: m.teamB,
            series: s,
            label: `MODO MANAGER ${M.season} · ${m.label} (Bo${m.fmt})`
          };
        }
      });

      M.nextMatchPrepBonus = 0;

      processStageTransitions(M, 1);
      processStageTransitions(M, 2);
      seedChampionsIfReady(M);
      evaluateObjectiveProgressAndMeetings(M, false);
      maybeGenerateIncomingOffer(M);
      generateWeeklyRumorsAndDrama(M);

      if (M.graceWeeks > 0) M.graceWeeks--;
      M.week++;

      if (
        M.week === 2 ||
        M.week === 14 ||
        M.week === 33 ||
        (getMarketCfg(M).id === "active" && M.week % 7 === 0)
      ) {
        runAiTransferMarket(M);
      }
      if (M.week === 14) {
        const db = useDbStore.getState();
        M.academy = generateAcademyBatch(12, M.userTeam, M, db.teams, db.academies, db.teamMeta);
        if (!M.schedule.stage2.leagueTeams.includes(M.userTeam)) {
          M.schedule.stage2 = buildRegionalLeagueForStage(M.clubs, M.userTeam, M.season, 2, 15);
        }
        addInbox(
          M,
          "MERCADO",
          "Ventana de Mitad de Temporada (Semana 14)",
          "Se abrió el mercado intermedio con actividad de clubes IA y nueva camada en tu Academia."
        );
      }
      if (M.week === 28) {
        const expiring = M.clubs[M.userTeam].players
          .filter((p) => (p.contractYears || 2) <= 1)
          .map((p) => p.n);
        if (expiring.length) {
          addInbox(
            M,
            "CONTRATO",
            `Contratos por vencer (${expiring.length})`,
            `Quedan 5 semanas de temporada y finalizan contrato: ${expiring.join(", ")}. Renuévalos desde Plantilla.`
          );
        }
      }
      if (M.week === 33) {
        closeCurrentSeason(M);
      }

      checkBoardFiring(M);
      commit(M, userSeriesPlayed ? { lastSeriesRef: userSeriesPlayed } : {});

      if (watchLive && userSeriesPlayed) {
        openPayloadInViewer(userSeriesPlayed, true);
      }
    },

    skipToNextMatch: () => {
      let safety = 0;
      while (safety++ < 22) {
        const cur = get().career;
        if (!cur || cur.fired || cur.ended || cur.pendingBoardMeeting || cur.week >= 33) break;
        const wm = getMatchesForWeek(cur.schedule, cur.week);
        const hasUser = wm.some(
          (m) => !m.played && (m.teamA === cur.userTeam || m.teamB === cur.userTeam)
        );
        if (hasUser) break;
        get().advanceWeek(false);
      }
    },

    resolveBoardMeeting: (choice) => {
      const cur = get().career;
      if (!cur?.pendingBoardMeeting) return;
      const M = cloneCareer(cur);
      const mt = M.pendingBoardMeeting!;
      const club = M.clubs[M.userTeam];
      const fireAt = getDiffCfg(M).fireThreshold;
      const rep = calcManagerReputation(M);
      const total = M.career.wins + M.career.losses;
      const wr = total > 0 ? M.career.wins / total : 0.5;

      if (mt.giantNoTitle) {
        const fierce = choice === "defend";
        pushNewsDraft(
          M,
          buildBoardMeetingNews({
            teamName: M.userTeam,
            outcome: "fired",
            reason: mt.reason,
            giantNoTitle: true
          })
        );
        triggerBoardSacking(
          M,
          `CESADO DE ${M.userTeam.toUpperCase()} · TEMPORADA SIN TÍTULOS`,
          fierce
            ? `Defendiste tu récord en la reunión, pero la directiva de ${M.userTeam} fue tajante: en un gigante solo cuentan los trofeos.`
            : `Aceptaste la resolución de la junta de ${M.userTeam}: sin títulos oficiales, el ciclo llega a su fin.`
        );
        commit(M);
        return;
      }

      if (choice === "resign") {
        M.schedule.objective.meetingResolved = true;
        M.career.objectiveRepBonus = (M.career.objectiveRepBonus || 0) - 2;
        pushNewsDraft(
          M,
          buildBoardMeetingNews({
            teamName: M.userTeam,
            outcome: "resigned",
            reason: mt.reason
          })
        );
        triggerBoardSacking(
          M,
          `RENUNCIA PRESENTADA EN ${M.userTeam.toUpperCase()}`,
          `Decidiste dar un paso al costado tras la reunión final (${mt.reason}). Varios clubes se interesaron de inmediato en tu disponibilidad.`
        );
        commit(M);
        return;
      }

      let survived = false;
      if (choice === "promise") {
        survived =
          mt.tier === "giant"
            ? M.boardConfidence >= 10 || rep >= 65
            : M.boardConfidence >= fireAt + 12 || rep >= 56;
      } else if (choice === "defend") {
        let points = 0;
        if (wr >= 0.5) points++;
        if (club.budget >= 180000) points++;
        if (rep >= 58) points++;
        if (
          M.schedule.objective.academyStarterPromoted ||
          M.trophies.some((t) => t.season === M.season && t.club === M.userTeam)
        ) {
          points++;
        }
        survived = mt.tier === "giant" ? points >= 3 : points >= 2;
      }

      if (survived) {
        M.schedule.objective.meetingResolved = true;
        M.pendingBoardMeeting = null;
        if (choice === "promise") {
          M.boardConfidence = clamp(Math.max(fireAt + 14, M.boardConfidence - 8), fireAt + 10, 35);
          M.graceWeeks = 0;
        } else {
          M.boardConfidence = clamp(Math.max(fireAt + 18, M.boardConfidence - 4), fireAt + 15, 45);
          M.graceWeeks = 2;
        }
        addInbox(
          M,
          "DIRECTIVA",
          `RESPALDO CONDICIONADO EN ${M.userTeam.toUpperCase()}`,
          choice === "promise"
            ? `La directiva aceptó tu ultimátum. Sigues en el cargo con Confianza ${M.boardConfidence} y 0 semanas de gracia.`
            : `Tus argumentos deportivos y económicos convencieron a la junta. Continúas al frente con Confianza ${M.boardConfidence}.`
        );
        pushNewsDraft(
          M,
          buildBoardMeetingNews({
            teamName: M.userTeam,
            outcome: "survived",
            reason: mt.reason
          })
        );
        commit(M);
        return;
      }

      pushNewsDraft(
        M,
        buildBoardMeetingNews({
          teamName: M.userTeam,
          outcome: "fired",
          reason: mt.reason
        })
      );
      triggerBoardSacking(
        M,
        `CESADO TRAS REUNIÓN FINAL · ${M.userTeam.toUpperCase()}`,
        `Tus argumentos no convencieron a la directiva (${mt.reason}). El club decidió rescindir tu contrato.`
      );
      commit(M);
    },

    setTraining: (modeId) => {
      const cur = get().career;
      if (!cur || !TRAINING_MODES[modeId]) return;
      const M = cloneCareer(cur);
      M.training = modeId;
      commit(M);
    },

    setPrepMap: (mapName) => {
      const cur = get().career;
      if (!cur || !ALL_MAPS[mapName]) return;
      const M = cloneCareer(cur);
      M.prepMapTarget = mapName;
      commit(M);
    },

    setPlayerPlan: (idx, planId) => {
      const cur = get().career;
      if (!cur || !PLAYER_PLANS[planId]) return;
      const M = cloneCareer(cur);
      const p = M.clubs[M.userTeam].players[idx];
      if (!p) return;
      p.plan = planId;
      commit(M);
    },

    toggleStarter: (idx) => {
      const cur = get().career;
      if (!cur) return;
      const M = cloneCareer(cur);
      const roster = M.clubs[M.userTeam].players;
      const target = roster[idx];
      if (!target) return;
      if (target.injuredWeeks > 0) {
        window.alert(`${target.n} está lesionado (${target.injuryType}) por ${target.injuredWeeks} semana(s).`);
        return;
      }
      if (target.sub) {
        const activeStarters = roster.filter((p) => !p.sub && !(p.injuredWeeks > 0));
        if (activeStarters.length >= 5) {
          window.alert("Ya tienes 5 titulares activos. Primero pasa a la banca a un titular para dejar espacio.");
          return;
        }
        if (activeStarters.some((p) => p.n.toLowerCase() === target.n.toLowerCase())) {
          window.alert(`Ya existe un jugador duplicado llamado ${target.n} en la alineación.`);
          return;
        }
        target.sub = 0;
        target.morale = clamp(target.morale + 4, 15, 100);
      } else {
        target.sub = 1;
      }
      commit(M);
    },

    autoFillLineup: () => {
      const cur = get().career;
      if (!cur) return;
      const M = cloneCareer(cur);
      const roster = M.clubs[M.userTeam].players;
      const healthy = roster
        .filter((p) => !(p.injuredWeeks > 0))
        .sort((a, b) => calcPlayerOvr(b) - calcPlayerOvr(a));
      const seen = new Set<string>();
      let count = 0;
      roster.forEach((p) => {
        p.sub = 1;
      });
      healthy.forEach((p) => {
        const k = p.n.toLowerCase();
        if (count < 5 && !seen.has(k)) {
          p.sub = 0;
          seen.add(k);
          count++;
        }
      });
      commit(M);
    },

    physioPlayer: (idx) => {
      const cur = get().career;
      if (!cur) return;
      const M = cloneCareer(cur);
      const club = M.clubs[M.userTeam];
      const p = club.players[idx];
      if (!p || !(p.injuredWeeks > 0)) return;
      const cost = 15000;
      if (club.budget < cost) {
        window.alert("Presupuesto insuficiente ($15,000).");
        return;
      }
      club.budget -= cost;
      p.injuredWeeks = Math.max(0, p.injuredWeeks - 1);
      p.fatigue = clamp(p.fatigue - 16, 0, 100);
      M.financeLog.unshift({
        s: M.season,
        w: M.week,
        concept: `Fisioterapia privada (${p.n})`,
        amount: -cost
      });
      if (p.injuredWeeks === 0) {
        p.injuryType = "";
        addInbox(M, "MÉDICO", `Alta acelerada: ${p.n}`, `Fisioterapia exitosa: ${p.n} está listo para volver.`);
      }
      commit(M);
    },

    startLearning: (idx, type, target) => {
      const cur = get().career;
      if (!cur) return;
      const M = cloneCareer(cur);
      const p = M.clubs[M.userTeam].players[idx];
      if (!p) return;
      if (p.learning && p.learning.done > 0) {
        if (
          !window.confirm(
            `${p.n} ya lleva ${p.learning.done}/${p.learning.total} semanas aprendiendo ${p.learning.target}. ¿Reemplazar por ${target}?`
          )
        ) {
          return;
        }
      }
      const total = calcLearningWeeks(p, type, target);
      p.learning = { type, target, done: 0, total };
      commit(M);
    },

    cancelLearning: (idx) => {
      const cur = get().career;
      if (!cur) return;
      const M = cloneCareer(cur);
      const p = M.clubs[M.userTeam].players[idx];
      if (!p || !p.learning) return;
      p.learning = null;
      commit(M);
    },

    buyCoachCourse: (courseId) => {
      const cur = get().career;
      if (!cur) return;
      if (cur.coachCourse) {
        window.alert(`DT ${cur.clubs[cur.userTeam].coach.n} ya está cursando "${cur.coachCourse.name}".`);
        return;
      }
      const course = COACH_COURSES.find((c) => c.id === courseId);
      if (!course) return;
      const M = cloneCareer(cur);
      const club = M.clubs[M.userTeam];
      const effCost = Math.round((course.cost * getDiffCfg(M).costMult) / 1000) * 1000;
      if (club.budget < effCost) {
        window.alert(`Necesitas ${fmtMoney(effCost)} para inscribir al Head Coach.`);
        return;
      }
      club.budget -= effCost;
      M.coachCourse = { ...course, cost: effCost, done: 0 };
      M.financeLog.unshift({
        s: M.season,
        w: M.week,
        concept: `Curso DT ${club.coach.n}: ${course.name}`,
        amount: -effCost
      });
      addInbox(
        M,
        "STAFF",
        `Curso iniciado: ${course.name}`,
        `DT ${club.coach.n} completará la formación en ${course.weeks} semana(s).`
      );
      commit(M);
    },

    setCompAgent: (playerName, agentName) => {
      const cur = get().career;
      if (!cur) return;
      const map = get().tacticsMap;
      const M = cloneCareer(cur);
      const mapEntry = { ...(M.customComps[map] || {}) };
      if (!agentName) {
        delete mapEntry[playerName];
      } else {
        for (const p of Object.keys(mapEntry)) {
          if (mapEntry[p] === agentName && p !== playerName) delete mapEntry[p];
        }
        mapEntry[playerName] = agentName;
      }
      M.customComps[map] = mapEntry;
      commit(M);
    },

    resetMapComp: () => {
      const cur = get().career;
      if (!cur) return;
      const map = get().tacticsMap;
      const M = cloneCareer(cur);
      delete M.customComps[map];
      commit(M);
    },

    toggleMapInPool: (mapName) => {
      const cur = get().career;
      if (!cur || !ALL_MAPS[mapName]) return;
      const M = cloneCareer(cur);
      if (M.activeMapPool.includes(mapName)) {
        window.alert(
          "El pool competitivo debe tener 7 mapas activos. Selecciona primero un mapa inactivo para entrar o usa 'Rotar 2 Mapas Ahora'."
        );
        return;
      }
      if (M.activeMapPool.length >= 7) M.activeMapPool.shift();
      M.activeMapPool.push(mapName);
      useDbStore.getState().setActiveMapPool(M.activeMapPool);
      const nextTac = M.activeMapPool.includes(get().tacticsMap)
        ? get().tacticsMap
        : M.activeMapPool[0];
      commit(M, { tacticsMap: nextTac });
    },

    manualRotatePool: () => {
      const cur = get().career;
      if (!cur) return;
      const M = cloneCareer(cur);
      const rot = rotateActiveMapPool(M.activeMapPool, 2);
      M.activeMapPool = rot.activePool;
      useDbStore.getState().setActiveMapPool(rot.activePool);
      pushNewsDraft(
        M,
        buildMapPoolNews({
          season: M.season,
          outMaps: rot.outMaps,
          inMaps: rot.inMaps,
          activePool: rot.activePool,
          isManual: true
        })
      );
      addInbox(
        M,
        "MAP POOL",
        `Nuevo Map Pool (${M.season})`,
        `Salen: ${rot.outMaps.join(", ")} · Entran: ${rot.inMaps.join(", ")}.`
      );
      const nextTac = rot.activePool.includes(get().tacticsMap)
        ? get().tacticsMap
        : rot.activePool[0];
      commit(M, { tacticsMap: nextTac });
    },

    hireAcademy: (idx) => {
      const cur = get().career;
      if (!cur || !cur.academy[idx]) return;
      const M = cloneCareer(cur);
      const club = M.clubs[M.userTeam];
      const kid = M.academy[idx];
      const cost = kid.hireCost || calcAcademyPriceByPot(kid.pot);
      if (club.budget < cost) {
        window.alert(`Necesitas ${fmtMoney(cost)} para contratar a ${kid.n} (POT ${kid.pot}).`);
        return;
      }
      club.budget -= cost;
      M.academy.splice(idx, 1);
      const activeCount = club.players.filter((p) => !p.sub && !(p.injuredWeeks > 0)).length;
      kid.sub = activeCount >= 5 ? 1 : 0;
      kid.morale = 86;
      club.players.push(kid);
      M.transferLog.unshift({
        s: M.season,
        w: M.week,
        type: "ACADEMIA",
        player: kid.n,
        from: "Cantera",
        to: M.userTeam,
        fee: cost
      });
      M.financeLog.unshift({
        s: M.season,
        w: M.week,
        concept: `Contrato Academia: ${kid.n} (POT ${kid.pot})`,
        amount: -cost
      });
      addInbox(
        M,
        "ACADEMIA",
        `Fichaje juvenil: ${kid.n}`,
        `${kid.n} (${kid.r}, ${kid.age} años, OVR ${calcPlayerOvr(kid)} / POT ${kid.pot}) se incorpora al club.`
      );
      commit(M);
    },

    scoutMoreAcademy: () => {
      const cur = get().career;
      if (!cur) return;
      const M = cloneCareer(cur);
      const club = M.clubs[M.userTeam];
      const cost = 10000;
      if (club.budget < cost) {
        window.alert("Necesitas $10,000 para enviar ojeadores.");
        return;
      }
      club.budget -= cost;
      const db = useDbStore.getState();
      M.academy = generateAcademyBatch(12, M.userTeam, M, db.teams, db.academies, db.teamMeta);
      M.financeLog.unshift({
        s: M.season,
        w: M.week,
        concept: "Campaña de Ojeo Juvenil (12 prospectos)",
        amount: -cost
      });
      commit(M);
    },

    signFreeAgent: (faIdx) => {
      const cur = get().career;
      if (!cur || !cur.freeAgents[faIdx]) return;
      const M = cloneCareer(cur);
      const club = M.clubs[M.userTeam];
      const fa = M.freeAgents[faIdx];
      const signBonus = Math.round((calcPlayerValue(fa) * 0.35) / 1000) * 1000;
      if (club.budget < signBonus) {
        window.alert(`Necesitas ${fmtMoney(signBonus)} de prima para fichar a ${fa.n}.`);
        return;
      }
      club.budget -= signBonus;
      M.freeAgents.splice(faIdx, 1);
      const activeCount = club.players.filter((p) => !p.sub && !(p.injuredWeeks > 0)).length;
      fa.sub = activeCount >= 5 ? 1 : 0;
      fa.morale = 85;
      club.players.push(fa);
      M.transferLog.unshift({
        s: M.season,
        w: M.week,
        type: "FICHAJE",
        player: fa.n,
        from: "Agente Libre",
        to: M.userTeam,
        fee: signBonus
      });
      M.financeLog.unshift({
        s: M.season,
        w: M.week,
        concept: `Fichaje libre: ${fa.n}`,
        amount: -signBonus
      });
      addInbox(
        M,
        "FICHAJE",
        `Fichado: ${fa.n}`,
        `${fa.n} (OVR ${calcPlayerOvr(fa)} / POT ${fa.pot}) se une a ${M.userTeam}.`
      );
      commit(M);
    },

    hireCoach: (coachIdx) => {
      const cur = get().career;
      if (!cur || !cur.freeCoaches[coachIdx]) return;
      const M = cloneCareer(cur);
      const club = M.clubs[M.userTeam];
      const c = M.freeCoaches[coachIdx];
      const effFee = Math.round(((c.fee || 45000) * getDiffCfg(M).costMult) / 1000) * 1000;
      if (club.budget < effFee) {
        window.alert(`Necesitas ${fmtMoney(effFee)} para contratar a ${c.n}.`);
        return;
      }
      club.budget -= effFee;
      const oldCoach = {
        ...club.coach,
        fee: club.coach.tier === "prospect" ? 24000 : 45000
      };
      M.freeCoaches.splice(coachIdx, 1);
      M.freeCoaches.push(oldCoach);
      club.coach = {
        n: c.n,
        macro: c.macro,
        micro: c.micro,
        adapt: c.adapt,
        dev: c.dev,
        disc: c.disc,
        pot: c.pot || 90,
        exp: c.exp || 3,
        tier: c.tier || "established"
      };
      M.coachCourse = null;
      M.financeLog.unshift({
        s: M.season,
        w: M.week,
        concept: `Contratación DT ${c.n}`,
        amount: -effFee
      });
      addInbox(
        M,
        "STAFF",
        `Nuevo Head Coach: ${c.n}`,
        `${c.n} (${club.coach.tier === "prospect" ? "Promesa" : "Consagrado"} · POT ${club.coach.pot}) asume el banquillo.`
      );
      commit(M);
    },

    toggleForSale: (idx) => {
      const cur = get().career;
      if (!cur) return;
      const M = cloneCareer(cur);
      const p = M.clubs[M.userTeam].players[idx];
      if (!p) return;
      p.forSale = !p.forSale;
      p.weeksOnMarket = 0;
      if (p.forSale) {
        p.askingPrice = Math.round((calcPlayerValue(p) * 1.18) / 1000) * 1000;
        addInbox(
          M,
          "MERCADO",
          `${p.n} puesto en el mercado`,
          `Precio objetivo: ${fmtMoney(p.askingPrice)}. Los clubes interesados enviarán ofertas en las próximas semanas.`
        );
      }
      commit(M);
    },

    setAskingPrice: (idx, val) => {
      const cur = get().career;
      if (!cur) return;
      const M = cloneCareer(cur);
      const p = M.clubs[M.userTeam].players[idx];
      if (!p) return;
      p.askingPrice = Math.max(10000, Math.round((val || calcPlayerValue(p)) / 1000) * 1000);
      commit(M);
    },

    openRenew: (idx) => {
      const cur = get().career;
      if (!cur) return;
      const p = cur.clubs[cur.userTeam].players[idx];
      if (!p) return;
      const minSal = Math.max(p.salary, calcPlayerSalary(p));
      set({
        activeNeg: null,
        activeRenew: {
          idx,
          playerName: p.n,
          years: 2,
          salary: Math.round((minSal * 1.08) / 100) * 100,
          promisedRole: calcPlayerOvr(p) >= 85 ? "starter" : p.promisedRole || "rotation",
          releaseClause: Math.round((calcPlayerValue(p) * 1.4) / 1000) * 1000,
          winBonus: p.winBonus || 2500,
          feedback: ""
        }
      });
    },

    updateRenew: (field, val) =>
      set((s) => (s.activeRenew ? { activeRenew: { ...s.activeRenew, [field]: val } } : s)),

    closeRenew: () => set({ activeRenew: null }),

    submitRenew: () => {
      const { career: cur, activeRenew } = get();
      if (!cur || !activeRenew) return;
      const M = cloneCareer(cur);
      const p = M.clubs[M.userTeam].players[activeRenew.idx];
      if (!p) {
        set({ activeRenew: null });
        return;
      }

      const diffMult = getDiffCfg(M).costMult;
      const ovr = calcPlayerOvr(p);
      const wantedSal =
        Math.round(
          (Math.max(p.salary, calcPlayerSalary(p)) * (p.transferRequested ? 1.25 : 1.05) * diffMult) /
            100
        ) * 100;
      const wantsStarter = ovr >= 86;

      if (wantsStarter && activeRenew.promisedRole !== "starter" && activeRenew.salary < wantedSal * 1.18) {
        set({
          activeRenew: {
            ...activeRenew,
            feedback: `${p.n} (OVR ${ovr}) exige rol de Titular garantizado o un salario >= ${fmtMoney(wantedSal * 1.18)}/sem.`
          }
        });
        return;
      }
      if (activeRenew.salary < wantedSal * 0.94) {
        set({
          activeRenew: {
            ...activeRenew,
            feedback: `Oferta rechazada: ${p.n} pide al menos ${fmtMoney(wantedSal)}/sem para renovar ${activeRenew.years} temporada(s).`
          }
        });
        return;
      }

      p.contractYears = clamp(activeRenew.years, 1, 4);
      p.salary = activeRenew.salary;
      p.promisedRole = activeRenew.promisedRole;
      p.releaseClause = Math.max(calcPlayerValue(p), activeRenew.releaseClause);
      p.winBonus = activeRenew.winBonus;
      p.transferRequested = false;
      p.unhappyWeeks = 0;
      p.morale = clamp(p.morale + 10, 15, 100);
      addInbox(
        M,
        "CONTRATO",
        `Renovación cerrada: ${p.n}`,
        `${p.n} firmó por ${p.contractYears} temp. (${fmtMoney(p.salary)}/sem · ${ROLE_PROMISE_LABELS[p.promisedRole]} · Cláusula ${fmtMoney(p.releaseClause)}).`
      );
      commit(M, { activeRenew: null });
    },

    openBuyNeg: (sellerName, playerName) => {
      const cur = get().career;
      if (!cur || sellerName === cur.userTeam) return;
      const cdKey = `${sellerName}::${playerName}`;
      const nowTick = cur.season * 100 + cur.week;
      if (cur.negCooldown[cdKey] && nowTick < cur.negCooldown[cdKey]) {
        window.alert(
          `${sellerName} rompió conversaciones por ${playerName}. Espera ${cur.negCooldown[cdKey] - nowTick} semana(s).`
        );
        return;
      }
      const seller = cur.clubs[sellerName];
      const target = seller?.players.find((p) => p.n === playerName);
      if (!target) return;

      const val = calcPlayerValue(target) || 50000;
      const targetClause = target.releaseClause || Math.round((val * 1.35) / 1000) * 1000;
      const baseSal = target.salary || calcPlayerSalary(target);

      set({
        activeRenew: null,
        activeNeg: {
          dir: "buy",
          clubName: sellerName,
          playerName: target.n,
          round: 1,
          cash: Math.round((val * 0.95) / 1000) * 1000,
          swapPlayer: "",
          sellOnPct: 0,
          years: 2,
          salary: Math.round((Math.max(baseSal, calcPlayerSalary(target)) * 1.05) / 100) * 100,
          promisedRole: calcPlayerOvr(target) >= 85 ? "starter" : "rotation",
          releaseClause: Math.round((val * 1.45) / 1000) * 1000,
          winBonus: target.winBonus || 2500,
          counter: null,
          status: "open",
          log: [
            `Negociación abierta con ${sellerName} (${getClubPersonality(seller).label}) por ${target.n} (Valor est. ${fmtMoney(val)} · Cláusula ${fmtMoney(targetClause)}).`
          ]
        }
      });
    },

    openSellNeg: () => {
      const cur = get().career;
      if (!cur?.pendingOffer) return;
      const off = cur.pendingOffer;
      const target = cur.clubs[cur.userTeam].players.find((p) => p.n === off.player);
      if (!target) return;

      set({
        activeRenew: null,
        activeNeg: {
          dir: "sell",
          clubName: off.buyer,
          playerName: off.player,
          round: 1,
          cash: off.amount,
          swapPlayer: off.swapPlayer || "",
          sellOnPct: off.sellOnPct || 0,
          years: 2,
          salary: target.salary,
          promisedRole: target.promisedRole,
          releaseClause: target.releaseClause,
          winBonus: target.winBonus,
          counter: null,
          status: "open",
          log: [
            `${off.buyer} ofrece ${fmtMoney(off.amount)}${
              off.sellOnPct ? ` + ${off.sellOnPct}% futura venta` : ""
            } por ${off.player}. Puedes aceptar, contraofertar o rechazar.`
          ]
        }
      });
    },

    updateNeg: (field, val) =>
      set((s) => {
        if (!s.activeNeg) return s;
        return {
          activeNeg: {
            ...s.activeNeg,
            [field]: val
          }
        };
      }),

    closeNeg: () => set({ activeNeg: null }),

    submitNeg: () => {
      const { career: cur, activeNeg } = get();
      if (!cur || !activeNeg) return;
      const M = cloneCareer(cur);
      const neg: ActiveNegotiation = { ...activeNeg, log: [...activeNeg.log] };
      const diffMult = getDiffCfg(M).costMult;

      if (neg.dir === "buy") {
        const buyer = M.clubs[M.userTeam];
        const seller = M.clubs[neg.clubName];
        const target = seller?.players.find((p) => p.n === neg.playerName);
        if (!target) {
          set({ activeNeg: null });
          return;
        }

        const offerCash = Number(neg.cash) || 0;
        const offerSellOn = Number(neg.sellOnPct) || 0;
        const offerSal = Number(neg.salary) || calcPlayerSalary(target);

        if (buyer.budget < offerCash) {
          neg.log.unshift(`Presupuesto insuficiente: ofreces ${fmtMoney(offerCash)} y tienes ${fmtMoney(buyer.budget)}.`);
          set({ activeNeg: neg });
          return;
        }
        if (neg.swapPlayer && buyer.players.length <= 5) {
          neg.log.unshift("No puedes incluir un jugador en intercambio si tu plantilla tiene 5 jugadores.");
          set({ activeNeg: neg });
          return;
        }

        const pers = getClubPersonality(seller);
        const baseVal = calcPlayerValue(target) || 50000;
        const targetClause = target.releaseClause || Math.round((baseVal * 1.35) / 1000) * 1000;
        const contractYrs = target.contractYears || 2;
        const targetSal = target.salary || calcPlayerSalary(target);

        const sortedOvr = seller.players.slice().sort((a, b) => calcPlayerOvr(b) - calcPlayerOvr(a));
        const isKeyStar = sortedOvr.slice(0, 2).some((x) => x.n === target.n);
        const sameRoleCnt = seller.players.filter(
          (x) => getPrimaryRoleFromStr(x.r) === getPrimaryRoleFromStr(target.r)
        ).length;
        const needMult =
          (isKeyStar ? 1.14 : 1.0) * (sameRoleCnt <= 1 ? 1.09 : 0.96) * (contractYrs <= 1 ? 0.85 : 1.0);

        const clauseCap = Math.round((targetClause * diffMult) / 1000) * 1000;
        const valuationReq = Math.round((baseVal * pers.sellMult * needMult * diffMult) / 1000) * 1000;
        const requiredClubVal = Math.min(clauseCap, valuationReq);

        let swapVal = 0;
        if (neg.swapPlayer) {
          const sp = buyer.players.find((p) => p.n === neg.swapPlayer);
          if (sp) {
            const fillsNeed =
              getPrimaryRoleFromStr(sp.r) === getPrimaryRoleFromStr(target.r) ? 1.08 : 0.88;
            swapVal = calcPlayerValue(sp) * fillsNeed;
          }
        }
        const sellOnVal =
          (offerSellOn / 100) * baseVal * 0.55 * pers.sellOnPref * ((target.age || 22) <= 22 ? 1.25 : 0.85);
        const offeredTotal = offerCash + swapVal + sellOnVal;

        const minSal = Math.round((Math.max(targetSal, calcPlayerSalary(target)) * 0.96 * diffMult) / 100) * 100;
        const wantsStarter = calcPlayerOvr(target) >= 86;
        const contractBad =
          offerSal < minSal || (wantsStarter && neg.promisedRole !== "starter" && offerSal < minSal * 1.2);
        const clauseTriggered = offerCash >= targetClause;

        if ((clauseTriggered || offeredTotal >= requiredClubVal * 0.97) && !contractBad) {
          executeTransferDeal(M, M.userTeam, neg.clubName, target.n, offerCash, neg.swapPlayer, offerSellOn, neg);
          commit(M, { activeNeg: null });
          return;
        }

        if (!clauseTriggered && (offeredTotal < requiredClubVal * 0.65 || neg.round >= 3)) {
          M.negCooldown[`${neg.clubName}::${target.n}`] = M.season * 100 + M.week + 4;
          neg.status = "rejected";
          neg.log.unshift(
            `${neg.clubName} RECHAZA y cierra negociaciones (oferta muy por debajo de su valoración de ${fmtMoney(requiredClubVal)}).`
          );
          commit(M, { activeNeg: neg });
          return;
        }

        neg.round++;
        const gap = Math.max(0, requiredClubVal - offeredTotal);
        const counterCash = Math.max(10000, Math.round((offerCash + gap * 1.06) / 1000) * 1000);
        const counterSellOn = pers.id === "seller" ? Math.max(offerSellOn, 15) : offerSellOn;
        const counterSal = contractBad ? Math.round((minSal * 1.08) / 100) * 100 : offerSal;
        const counterRole: PromisedRole = wantsStarter ? "starter" : neg.promisedRole;

        neg.counter = {
          cash: counterCash,
          swapPlayer: neg.swapPlayer,
          sellOnPct: counterSellOn,
          salary: counterSal,
          promisedRole: counterRole
        };
        neg.log.unshift(
          `${neg.clubName} CONTRAOFERTA (Ronda ${neg.round}/3): pide ${fmtMoney(counterCash)}${
            neg.swapPlayer ? ` + ${neg.swapPlayer}` : ""
          }${counterSellOn ? ` + ${counterSellOn}% fut. venta` : ""}${
            contractBad
              ? ` · ${target.n} exige ${fmtMoney(counterSal)}/sem y ${ROLE_PROMISE_LABELS[counterRole]}`
              : ""
          }.`
        );
        set({ activeNeg: neg });
        return;
      }

      const myClub = M.clubs[M.userTeam];
      const buyer = M.clubs[neg.clubName];
      const target = myClub.players.find((p) => p.n === neg.playerName);
      if (!target || !buyer) {
        set({ activeNeg: null });
        return;
      }
      if (myClub.players.length <= 5 && !neg.swapPlayer) {
        neg.log.unshift("No puedes quedar con menos de 5 jugadores (pide un jugador en intercambio o ficha antes).");
        set({ activeNeg: neg });
        return;
      }

      const pers = getClubPersonality(buyer);
      const baseVal = calcPlayerValue(target);
      const maxWilling = Math.min(
        buyer.budget,
        Math.round((baseVal * (pers.id === "ambitious" ? 1.32 : 1.18) / diffMult) / 1000) * 1000
      );

      let swapCost = 0;
      if (neg.swapPlayer) {
        const sp = buyer.players.find((p) => p.n === neg.swapPlayer);
        if (sp) swapCost = calcPlayerValue(sp) * 1.1;
      }
      const sellOnCost = (neg.sellOnPct / 100) * baseVal * 0.45;
      const demandTotal = neg.cash + swapCost + sellOnCost;

      if (demandTotal <= maxWilling && neg.cash <= buyer.budget) {
        executeTransferDeal(M, neg.clubName, M.userTeam, target.n, neg.cash, neg.swapPlayer, neg.sellOnPct, null);
        M.pendingOffer = null;
        commit(M, { activeNeg: null });
        return;
      }

      if (demandTotal > maxWilling * 1.28 || neg.round >= 3) {
        neg.status = "rejected";
        neg.log.unshift(
          `${neg.clubName} RETIRA su oferta por ${target.n}: tus exigencias (${fmtMoney(demandTotal)}) exceden su límite.`
        );
        M.pendingOffer = null;
        commit(M, { activeNeg: neg });
        return;
      }

      neg.round++;
      const counterCash = Math.min(
        buyer.budget,
        Math.round((Math.min(maxWilling, demandTotal * 0.9) - sellOnCost) / 1000) * 1000
      );
      neg.counter = {
        cash: Math.max(15000, counterCash),
        swapPlayer: "",
        sellOnPct: Math.min(neg.sellOnPct, 15)
      };
      neg.log.unshift(
        `${neg.clubName} CONTRAOFERTA: llega hasta ${fmtMoney(neg.counter.cash)}${
          neg.counter.sellOnPct ? ` + ${neg.counter.sellOnPct}% fut. venta` : ""
        } (sin intercambio).`
      );
      set({ activeNeg: neg });
    },

    acceptCounter: () => {
      const { career: cur, activeNeg } = get();
      if (!cur || !activeNeg?.counter) return;
      const M = cloneCareer(cur);
      const ct = activeNeg.counter;

      if (activeNeg.dir === "buy") {
        if (M.clubs[M.userTeam].budget < ct.cash) {
          window.alert(`No tienes presupuesto suficiente (${fmtMoney(ct.cash)}).`);
          return;
        }
        executeTransferDeal(
          M,
          M.userTeam,
          activeNeg.clubName,
          activeNeg.playerName,
          ct.cash,
          ct.swapPlayer,
          ct.sellOnPct,
          {
            years: activeNeg.years,
            salary: ct.salary,
            promisedRole: ct.promisedRole,
            releaseClause: activeNeg.releaseClause,
            winBonus: activeNeg.winBonus
          }
        );
      } else {
        executeTransferDeal(
          M,
          activeNeg.clubName,
          M.userTeam,
          activeNeg.playerName,
          ct.cash,
          ct.swapPlayer,
          ct.sellOnPct,
          null
        );
        M.pendingOffer = null;
      }
      commit(M, { activeNeg: null });
    },

    respondOffer: (accept) => {
      const cur = get().career;
      if (!cur?.pendingOffer) return;
      const M = cloneCareer(cur);
      const off = M.pendingOffer!;
      M.pendingOffer = null;
      if (accept) {
        const club = M.clubs[M.userTeam];
        if (club.players.length <= 5) {
          window.alert("No puedes quedar con menos de 5 jugadores.");
          commit(M);
          return;
        }
        executeTransferDeal(M, off.buyer, M.userTeam, off.player, off.amount, "", off.sellOnPct || 0, null);
      }
      commit(M);
    },

    respondSponsor: (accept) => {
      const cur = get().career;
      if (!cur?.pendingSponsorOffer) return;
      const M = cloneCareer(cur);
      const sp = M.pendingSponsorOffer!;
      M.pendingSponsorOffer = null;
      if (accept) {
        const club = M.clubs[M.userTeam];
        club.budget += sp.upfront;
        club.sponsorWeekly += sp.weekly;
        club.activeSponsors = club.activeSponsors || [];
        club.activeSponsors.push({ name: sp.name, weekly: sp.weekly, season: M.season });
        M.boardConfidence = clamp(M.boardConfidence + 6, -100, 100);
        M.financeLog.unshift({
          s: M.season,
          w: M.week,
          concept: `Contrato Sponsor: ${sp.name} (+${fmtMoney(sp.weekly)}/sem)`,
          amount: sp.upfront
        });
        addInbox(
          M,
          "SPONSOR",
          `Acuerdo firmado con ${sp.name}`,
          `Ingresaste ${fmtMoney(sp.upfront)} y tu ingreso semanal subió a ${fmtMoney(club.sponsorWeekly)}/sem.`
        );
      }
      commit(M);
    },

    acceptJobOffer: (offerIdx) => {
      const cur = get().career;
      if (!cur?.pendingJobOffers?.[offerIdx]) return;
      const M = cloneCareer(cur);
      const offer = M.pendingJobOffers[offerIdx];
      switchManagerToClub(M, offer.club, offer.reason);
      commit(M, { activeTab: "hub", activeNeg: null, activeRenew: null });
    },

    dismissJobOffers: () => {
      const cur = get().career;
      if (!cur) return;
      const M = cloneCareer(cur);
      M.pendingJobOffers = [];
      commit(M);
    },

    applyForClub: (targetClub) => {
      const cur = get().career;
      if (!cur || targetClub === cur.userTeam || !cur.clubs[targetClub]) return;
      const nowTick = cur.season * 100 + cur.week;
      const cdMap = cur.career.applyCooldown || {};
      if (cdMap[targetClub] && nowTick < cdMap[targetClub]) {
        window.alert(
          `Ya te postulaste recientemente a ${targetClub}. Espera ${cdMap[targetClub] - nowTick} semana(s) antes de volver a aplicar.`
        );
        return;
      }

      const rep = calcManagerReputation(cur);
      const req = getClubRequiredRep(cur.clubs[targetClub]);
      const diff = rep - req;
      let accepted = false;
      if (diff >= 2) accepted = true;
      else if (diff >= -5) accepted = Math.random() < 0.55 + diff * 0.08;
      else if (diff >= -10) accepted = Math.random() < 0.12;

      const M = cloneCareer(cur);
      if (accepted) {
        if (
          !window.confirm(
            `¡${targetClub} ACEPTÓ tu postulación! (Tu Rep: ${rep} vs Req: ${req}).\n¿Quieres dejar ${M.userTeam} y asumir ahora?`
          )
        ) {
          return;
        }
        switchManagerToClub(M, targetClub, `Postulación aceptada · Rep ${rep}`);
        commit(M, { activeTab: "hub", activeNeg: null, activeRenew: null });
      } else {
        M.career.applyCooldown[targetClub] = nowTick + 4;
        addInbox(
          M,
          "POSTULACIÓN",
          `${targetClub} rechazó tu candidatura`,
          `Tu reputación actual (${rep}) no convenció a ${targetClub} (exigen ~${req}). Vuelve a intentarlo en 4 semanas.`
        );
        commit(M);
        window.alert(`${targetClub} rechazó tu postulación (Tu Rep: ${rep} / Exigencia: ~${req}).`);
      }
    },

    exportSave: () => {
      const M = get().career;
      if (!M) return;
      const academyAgentPools: Record<string, string[]> = {};
      for (const c of Object.keys(M.clubs)) {
        M.clubs[c].players.forEach((p) => {
          if (p.isAcademy && PLAYER_AGENTS[p.n]) academyAgentPools[p.n] = PLAYER_AGENTS[p.n];
        });
      }
      M.academy.forEach((p) => {
        if (PLAYER_AGENTS[p.n]) academyAgentPools[p.n] = PLAYER_AGENTS[p.n];
      });

      const payload: ManagerSaveV3Payload = {
        format: "vct-sim-manager-save",
        version: 3,
        exportedAt: new Date().toISOString(),
        academyAgentPools,
        career: M
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const slug = M.userTeam.replace(/[^a-z0-9]/gi, "").toLowerCase();
      const a = document.createElement("a");
      a.href = url;
      a.download = `vct-career-${slug}-T${M.season}-S${M.week}.json`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    },

    importSave: (rawJson) => {
      if (!rawJson || typeof rawJson !== "object") {
        return { ok: false, err: "Archivo JSON vacío o inválido." };
      }
      const parsed = rawJson as Partial<ManagerSaveV3Payload> & Partial<ManagerCareerState>;
      const careerData = (parsed.career ?? parsed) as Partial<ManagerCareerState>;
      if (!careerData?.userTeam || !careerData?.clubs?.[careerData.userTeam]) {
        return { ok: false, err: "El archivo no corresponde a una partida válida de VCT Manager." };
      }
      if (parsed.academyAgentPools && typeof parsed.academyAgentPools === "object") {
        Object.assign(PLAYER_AGENTS, parsed.academyAgentPools);
      }
      const migrated = migrateCareerState(careerData as ManagerCareerState);
      syncLearnedPoolsFromCareer(migrated);
      useDbStore.getState().setActiveMapPool(migrated.activeMapPool);

      commit(migrated, {
        activeTab: "hub",
        tacticsMap: migrated.activeMapPool[0] || "Ascent",
        activeNeg: null,
        activeRenew: null,
        viewerOpen: false,
        viewerPayload: null
      });
      return {
        ok: true,
        summary: `Partida cargada: ${migrated.userTeam} (Temporada ${migrated.season}, Semana ${migrated.week}).`
      };
    },

    openLastBoxscore: (autoPlay) => {
      const ref = get().lastSeriesRef;
      if (!ref) return;
      openPayloadInViewer(ref, autoPlay);
    },

    closeViewer: () => {
      clearMgrLiveInterval();
      set({ viewerOpen: false, viewerAutoPlaying: false });
    },

    stopViewerLive: () => {
      clearMgrLiveInterval();
      if (get().viewerAutoPlaying) set({ viewerAutoPlaying: false });
    },

    stepViewerRound: () => {
      get().stopViewerLive();
      const st = get();
      if (!st.viewerPayload) return;
      if (st.viewerLiveFinished) {
        set({
          viewerLiveFinished: false,
          viewerLiveMapIdx: 0,
          viewerLiveShown: 0,
          viewerRevealedMaps: 1,
          viewerActiveTab: 0
        });
      }
      advanceViewerRound();
    },

    toggleViewerAutoPlay: () => {
      if (mgrLiveTimer !== null) {
        get().stopViewerLive();
        return;
      }
      const st = get();
      if (!st.viewerPayload) return;
      if (st.viewerLiveFinished) {
        set({
          viewerLiveFinished: false,
          viewerLiveMapIdx: 0,
          viewerLiveShown: 0,
          viewerRevealedMaps: 1,
          viewerActiveTab: 0,
          viewerAutoPlaying: true
        });
      } else {
        set({ viewerActiveTab: st.viewerLiveMapIdx, viewerAutoPlaying: true });
      }

      if (!advanceViewerRound()) return;
      mgrLiveTimer = window.setInterval(() => {
        if (!advanceViewerRound()) get().stopViewerLive();
      }, 340);
    },

    selectViewerTab: (tab) => {
      get().stopViewerLive();
      const st = get();
      const series = st.viewerPayload?.series;
      if (!series) return;
      if (tab === "SERIES") {
        if (!st.viewerLiveFinished) return;
        set({ viewerActiveTab: "SERIES" });
        return;
      }
      if (tab < 0 || tab >= series.maps.length) return;
      if (!st.viewerLiveFinished && tab > st.viewerLiveMapIdx) return;
      set({ viewerActiveTab: tab });
    }
  };
});