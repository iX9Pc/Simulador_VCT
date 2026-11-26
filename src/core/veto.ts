import { draftTeamComp } from "./composition.ts";
import { DEFAULT_ACTIVE_MAPS, getMapConfig, normalizeActiveMapPool } from "./maps.ts";
import type {
  Duel1v1Result,
  MapName,
  MapProfileEntry,
  ScheduledMap,
  SeriesFormat,
  StartingSide,
  TeamInput,
  TeamMapProfile,
  VetoOptions,
  VetoResult,
  VetoStep
} from "./types.ts";

const gauss = () =>
  Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());

export function scoreTeamOnMap(teamObj: TeamInput, mapName: MapName): number {
  const m = getMapConfig(mapName);
  const starters = teamObj.players.filter((p) => !p.sub).slice(0, 5);
  const c = teamObj.coach;
  const comp = draftTeamComp(teamObj, mapName);

  let total = 0;
  starters.forEach((p, idx) => {
    const aInfo = comp.assignments[idx];
    const opBonus = aInfo?.isOpBoost ? (mapName === "Breeze" ? 2.4 : 1.2) : 0;
    const hushBonus = aInfo && aInfo.hushMastery >= 0.9 ? 1.4 : aInfo && aInfo.hushMastery > 0 ? 0.5 : 0;
    total +=
      p.aim * 0.34 * m.aim +
      p.fd * 0.18 * m.fd +
      p.entry * 0.15 * m.entry +
      p.util * 0.18 * m.util +
      p.clutch * 0.15 * m.clu +
      opBonus +
      hushBonus;
  });

  const avgP = total / Math.max(1, starters.length);
  const iglMax = Math.max(...starters.map((p) => p.igl));
  const tacScore = ((iglMax * 0.5 + c.macro * 0.5) - 80) * 0.25 * m.igl;
  const compBonus = (comp.compScore - 87) * 0.34;
  return avgP + tacScore + compBonus;
}

export function getTeamMapProfile(
  teamObj: TeamInput,
  activeMaps: readonly MapName[] = DEFAULT_ACTIVE_MAPS
): TeamMapProfile {
  const pool = normalizeActiveMapPool(activeMaps);
  const list: MapProfileEntry[] = pool.map((mapName) => {
    const comp = draftTeamComp(teamObj, mapName);
    const score = Number(scoreTeamOnMap(teamObj, mapName).toFixed(1));
    return { mapName, score, comp };
  });
  const sorted = list.slice().sort((a, b) => b.score - a.score);
  const byMap: Partial<Record<MapName, MapProfileEntry>> = {};
  for (const entry of list) byMap[entry.mapName] = entry;

  return {
    byMap,
    sorted,
    best: sorted.slice(0, 2),
    worst: sorted[sorted.length - 1]
  };
}

export function coachPickStartingSide(
  choosingTeam: TeamInput,
  _otherTeam: TeamInput,
  mapName: MapName
): StartingSide {
  const m = getMapConfig(mapName);
  const comp = draftTeamComp(choosingTeam, mapName);
  const starters = choosingTeam.players.filter((p) => !p.sub).slice(0, 5);
  const aggr = starters.reduce((a, p) => a + p.entry * 0.55 + p.fd * 0.45, 0) / starters.length;
  const ctrl = starters.reduce((a, p) => a + p.util * 0.55 + p.clutch * 0.45, 0) / starters.length;
  const compAtkEdge = (comp.bonuses.entrada - comp.bonuses.defensa) * 45;
  const atkPref = aggr * m.atkBias - ctrl * m.defBias + compAtkEdge;
  return atkPref >= 0 ? "ATK" : "DEF";
}

export function runPreMatch1v1(tLeft: TeamInput, tRight: TeamInput): Duel1v1Result {
  const pickChampion = (t: TeamInput) => {
    const starters = t.players.filter((p) => !p.sub).slice(0, 5);
    let best = starters[0];
    let bestVal = -1;
    let bestReason = "";
    starters.forEach((p) => {
      const dailyFeeling = gauss() * 2.2;
      const score = p.aim * 0.62 + p.conf * 0.26 + p.fd * 0.12 + dailyFeeling;
      if (score > bestVal) {
        bestVal = score;
        best = p;
        bestReason =
          p.aim >= 93 && p.conf >= 86
            ? "estrella en racha de confianza y AIM"
            : p.aim >= 93
              ? `techo mecánico puro (AIM ${p.aim})`
              : `máxima confianza del día (CONF ${p.conf})`;
      }
    });
    return { player: best, score: bestVal, reason: bestReason };
  };

  const c0 = pickChampion(tLeft);
  const c1 = pickChampion(tRight);

  const p0Strength = Math.pow((c0.player.aim * 0.65 + c0.player.fd * 0.2 + c0.player.conf * 0.15) / 100, 2.2);
  const p1Strength = Math.pow((c1.player.aim * 0.65 + c1.player.fd * 0.2 + c1.player.conf * 0.15) / 100, 2.2);

  let k0 = 0;
  let k1 = 0;
  while (k0 < 5 && k1 < 5) {
    if (Math.random() < p0Strength / (p0Strength + p1Strength)) k0++;
    else k1++;
  }

  const winnerIdx = k0 === 5 ? 0 : 1;
  const winTeam = winnerIdx === 0 ? tLeft : tRight;
  const loseTeam = winnerIdx === 0 ? tRight : tLeft;

  const prefersRoleA = winTeam.coach.macro + Math.max(...winTeam.players.map((p) => p.igl)) >= 165;
  const teamA = prefersRoleA ? winTeam : loseTeam;
  const teamB = prefersRoleA ? loseTeam : winTeam;

  return {
    repLeft: c0.player,
    reasonLeft: c0.reason,
    repRight: c1.player,
    reasonRight: c1.reason,
    score1v1: [k0, k1],
    winnerPlayer: winnerIdx === 0 ? c0.player : c1.player,
    winnerTeamName: winTeam.name,
    winnerCoachName: winTeam.coach.n,
    chosenRole: prefersRoleA ? "Equipo A" : "Equipo B",
    teamA,
    teamB
  };
}

export function runCoachVeto(
  tLeft: TeamInput,
  tRight: TeamInput,
  fmt: SeriesFormat,
  options: VetoOptions = {}
): VetoResult {
  const forcedFirstMap = options.forcedFirstMap ?? "AUTO";
  const duel = runPreMatch1v1(tLeft, tRight);
  const A = duel.teamA;
  const B = duel.teamB;
  let remaining: MapName[] = normalizeActiveMapPool(options.activeMaps ?? DEFAULT_ACTIVE_MAPS);

  const removeMap = (m: MapName) => {
    remaining = remaining.filter((x) => x !== m);
  };

  const coachBan = (myTeam: TeamInput, oppTeam: TeamInput): MapName => {
    let worstMap = remaining[0];
    let worstNet = Infinity;
    remaining.forEach((m) => {
      if (forcedFirstMap !== "AUTO" && m === forcedFirstMap && remaining.length > 1) return;
      const net = scoreTeamOnMap(myTeam, m) - scoreTeamOnMap(oppTeam, m) + gauss() * 0.4;
      if (net < worstNet) {
        worstNet = net;
        worstMap = m;
      }
    });
    removeMap(worstMap);
    return worstMap;
  };

  const coachPick = (myTeam: TeamInput, oppTeam: TeamInput, forceMap: MapName | null = null): MapName => {
    if (forceMap && remaining.includes(forceMap)) {
      removeMap(forceMap);
      return forceMap;
    }
    let bestMap = remaining[0];
    let bestNet = -Infinity;
    remaining.forEach((m) => {
      const net = scoreTeamOnMap(myTeam, m) * 1.15 - scoreTeamOnMap(oppTeam, m) * 0.85 + gauss() * 0.4;
      if (net > bestNet) {
        bestNet = net;
        bestMap = m;
      }
    });
    removeMap(bestMap);
    return bestMap;
  };

  const steps: VetoStep[] = [];
  const scheduledMaps: ScheduledMap[] = [];

  const registerPlayableMap = (
    mapName: MapName,
    pickedBy: string,
    sideChooserTeam: TeamInput,
    stepNumber: number,
    stepTitle: string
  ) => {
    const other = sideChooserTeam.name === A.name ? B : A;
    const chosenSide = coachPickStartingSide(sideChooserTeam, other, mapName);
    const atkTeamName = chosenSide === "ATK" ? sideChooserTeam.name : other.name;
    const defTeamName = chosenSide === "ATK" ? other.name : sideChooserTeam.name;
    scheduledMaps.push({
      mapName,
      pickedBy,
      sideChooser: sideChooserTeam.name,
      sideChosen: chosenSide,
      atkTeamName,
      defTeamName
    });
    steps.push({
      step: stepNumber,
      type: pickedBy === "DECIDER" ? "decider" : "pick",
      actor: stepTitle,
      mapName,
      detail: `${sideChooserTeam.name} (DT ${sideChooserTeam.coach.n}) elige iniciar en ${
        chosenSide === "ATK" ? "ATAQUE" : "DEFENSA"
      }`
    });
  };

  if (fmt === 3) {
    const ban1 = coachBan(A, B);
    steps.push({ step: 1, type: "ban", actor: `1. Veto A (${A.name})`, mapName: ban1, detail: `DT ${A.coach.n} bloquea ${ban1}` });

    const ban2 = coachBan(B, A);
    steps.push({ step: 2, type: "ban", actor: `2. Veto B (${B.name})`, mapName: ban2, detail: `DT ${B.coach.n} bloquea ${ban2}` });

    const pick1 = coachPick(A, B, forcedFirstMap !== "AUTO" ? forcedFirstMap : null);
    registerPlayableMap(pick1, A.name, B, 3, `3. Pick M1 · A (${A.name})`);

    const pick2 = coachPick(B, A);
    registerPlayableMap(pick2, B.name, A, 4, `4. Pick M2 · B (${B.name})`);

    const ban3 = coachBan(A, B);
    steps.push({ step: 5, type: "ban", actor: `5. Veto A (${A.name})`, mapName: ban3, detail: `DT ${A.coach.n} descarta ${ban3}` });

    const ban4 = coachBan(B, A);
    steps.push({ step: 6, type: "ban", actor: `6. Veto B (${B.name})`, mapName: ban4, detail: `DT ${B.coach.n} descarta ${ban4}` });

    const decider = remaining[0];
    removeMap(decider);
    registerPlayableMap(decider, "DECIDER", A, 7, "7. M3 (Decider)");
  } else if (fmt === 5) {
    const ban1 = coachBan(A, B);
    steps.push({ step: 1, type: "ban", actor: `1. Veto A (${A.name})`, mapName: ban1, detail: `DT ${A.coach.n} bloquea ${ban1}` });

    const ban2 = coachBan(B, A);
    steps.push({ step: 2, type: "ban", actor: `2. Veto B (${B.name})`, mapName: ban2, detail: `DT ${B.coach.n} bloquea ${ban2}` });

    const pick1 = coachPick(A, B, forcedFirstMap !== "AUTO" ? forcedFirstMap : null);
    registerPlayableMap(pick1, A.name, B, 3, `3. Pick M1 · A (${A.name})`);

    const pick2 = coachPick(B, A);
    registerPlayableMap(pick2, B.name, A, 4, `4. Pick M2 · B (${B.name})`);

    const pick3 = coachPick(A, B);
    registerPlayableMap(pick3, A.name, B, 5, `5. Pick M3 · A (${A.name})`);

    const pick4 = coachPick(B, A);
    registerPlayableMap(pick4, B.name, A, 6, `6. Pick M4 · B (${B.name})`);

    const decider = remaining[0];
    removeMap(decider);
    registerPlayableMap(decider, "DECIDER", A, 7, "7. M5 (Decider)");
  } else {
    for (let s = 1; s <= 6; s++) {
      const turnTeam = s % 2 === 1 ? A : B;
      const oppTeam = s % 2 === 1 ? B : A;
      const bMap = coachBan(turnTeam, oppTeam);
      steps.push({
        step: s,
        type: "ban",
        actor: `${s}. Veto ${s % 2 === 1 ? "A" : "B"} (${turnTeam.name})`,
        mapName: bMap,
        detail: `DT ${turnTeam.coach.n} descarta ${bMap}`
      });
    }
    const decider = remaining[0];
    registerPlayableMap(decider, "DECIDER", A, 7, "7. Mapa Único");
  }

  return { duel, steps, scheduledMaps };
}