import { AGENTS, HUSH_MASTERY, PLAYER_AGENTS, getPlayerAgents, getPrimaryRoleFromStr, parsePlayerRoles } from "./agents.ts";
import { COMP_CONFIG } from "./constants.ts";
import { getMapConfig } from "./maps.ts";
import type {
  AgentAssignment,
  AxisName,
  AxisRecord,
  CompositionEval,
  CoreRole,
  MapName,
  Player,
  RoleName,
  TeamCompDraft,
  TeamInput
} from "./types.ts";

const AXES: readonly AxisName[] = ["macro", "util", "entrada", "defensa", "flex"];

export function evaluateTeamComposition(
  teamObj: TeamInput,
  assignments: AgentAssignment[],
  mapName: MapName
): CompositionEval {
  const starters = teamObj.players.filter((p) => !p.sub).slice(0, 5);
  const coach = teamObj.coach;
  const mapInfo = getMapConfig(mapName);
  const mapAxisMult = mapInfo.axisMult;

  const roleCounts: Record<RoleName, number> = {
    Duelista: 0, Iniciador: 0, Controlador: 0, Centinela: 0, Flex: 0
  };
  const secCounts: Record<RoleName, number> = {
    Duelista: 0, Iniciador: 0, Controlador: 0, Centinela: 0, Flex: 0
  };
  const pts: AxisRecord = { macro: 0, util: 0, entrada: 0, defensa: 0, flex: 0 };

  const addRolePoints = (roleName: RoleName, weight: number) => {
    const tbl = COMP_CONFIG.rol_puntos[roleName];
    if (!tbl) return;
    for (const ax of AXES) pts[ax] += tbl[ax] * weight;
  };

  let pureSmokers = 0, hybridDomeSmokers = 0, hybridWallSmokers = 0;
  let diveDuelists = 0, contactOnlyDuelists = 0;
  let reconInits = 0, flashInits = 0;
  let pureSentinels = 0, hybridSentinels = 0;

  assignments.forEach((a, idx) => {
    const p = starters[idx];
    const ag = AGENTS[a.agent];
    const agRole = a.role;
    const occ = roleCounts[agRole] || 0;
    const dec = COMP_CONFIG.decrecimiento[Math.min(occ, COMP_CONFIG.decrecimiento.length - 1)];
    roleCounts[agRole] = occ + 1;
    addRolePoints(agRole, dec);

    if (ag?.secondaryRole && COMP_CONFIG.rol_puntos[ag.secondaryRole]) {
      const sOcc = secCounts[ag.secondaryRole] || 0;
      const sDec = COMP_CONFIG.decrecimiento[Math.min(sOcc, COMP_CONFIG.decrecimiento.length - 1)];
      secCounts[ag.secondaryRole] = sOcc + 1;
      addRolePoints(ag.secondaryRole, 0.5 * sDec);
    }

    if (p) {
      const { primary, secondary } = parsePlayerRoles(p.r);
      const secRole: RoleName | null =
        secondary && secondary !== agRole ? secondary : primary === "Flex" ? "Flex" : null;
      if (secRole && COMP_CONFIG.rol_puntos[secRole]) {
        const sOcc = secCounts[secRole] || 0;
        const sDec = COMP_CONFIG.decrecimiento[Math.min(sOcc, COMP_CONFIG.decrecimiento.length - 1)];
        secCounts[secRole] = sOcc + 1;
        addRolePoints(secRole, COMP_CONFIG.rol_secundario * sDec);
      }
    }

    if (ag?.smokeType === "pure") pureSmokers++;
    else if (ag?.smokeType === "hybrid_dome") hybridDomeSmokers++;
    else if (ag?.smokeType === "hybrid_wall") hybridWallSmokers++;

    if (ag?.entryType === "dive" || ag?.entryType === "hybrid") diveDuelists++;
    else if (ag?.entryType === "contact") contactOnlyDuelists++;

    if (ag?.initType === "recon") reconInits++;
    else if (ag?.initType === "flash") flashInits++;
    else if (ag?.initType === "hybrid") { reconInits++; flashInits++; }

    if (ag?.sentinelType === "pure") pureSentinels++;
    else if (ag?.sentinelType === "hybrid") hybridSentinels++;
  });

  const avgAttr = (fn: (p: Player) => number) =>
    starters.reduce((sum, p) => sum + fn(p), 0) / Math.max(1, starters.length);
  const maxIgl = Math.max(...starters.map((p) => p.igl));
  const axisAttrs: AxisRecord = {
    macro: (maxIgl + coach.macro) / 2,
    util: avgAttr((p) => p.util),
    entrada: avgAttr((p) => (p.entry + p.aim) / 2),
    defensa: avgAttr((p) => (p.clutch + p.cons) / 2),
    flex: (coach.adapt + avgAttr((p) => p.cons)) / 2
  };

  const warnings: string[] = [];
  const synergies: string[] = [];
  const penalty: AxisRecord = { macro: 0, util: 0, entrada: 0, defensa: 0, flex: 0 };

  const hasViableMainSmoker = pureSmokers >= 1 || (hybridDomeSmokers >= 1 && !mapInfo.longRange);
  if (roleCounts.Controlador === 0) {
    warnings.push("Sin Controlador (-7.5% Macro/Def)");
    penalty.macro -= 0.055;
    penalty.defensa -= 0.045;
  } else if (!hasViableMainSmoker) {
    if (hybridWallSmokers > 0) {
      warnings.push("Sin Smoker Puro (Viper/Harbor no cubren solos)");
      penalty.macro -= 0.045;
      penalty.defensa -= 0.032;
    } else if (hybridDomeSmokers > 0 && mapInfo.longRange) {
      warnings.push(`Clove solo sufre en ${mapName} (mapa largo)`);
      penalty.macro -= 0.025;
      penalty.defensa -= 0.018;
    }
  } else if (pureSmokers >= 1 && hybridWallSmokers >= 1) {
    const wallBonus = mapInfo.preferWall ? 0.026 : 0.014;
    penalty.macro += wallBonus;
    penalty.defensa += wallBonus * 0.8;
    synergies.push("Doble Controller (Smoker Puro + Muro)");
  }

  if (diveDuelists === 0) {
    if (contactOnlyDuelists > 0) {
      warnings.push("Sin Entry Dive (solo duelista de contacto)");
      penalty.entrada -= 0.03;
    } else {
      warnings.push("Sin Duelista de Entrada");
      penalty.entrada -= 0.042;
    }
  }

  if (roleCounts.Iniciador === 0) {
    warnings.push("Sin Iniciador (-4% Util)");
    penalty.util -= 0.04;
    penalty.entrada -= 0.015;
  } else if (reconInits === 0 && flashInits > 0) {
    warnings.push("Sin Recon/Info (solo flash)");
    penalty.util -= 0.016;
  } else if (reconInits > 0 && flashInits > 0) {
    penalty.util += 0.018;
    penalty.entrada += 0.012;
    synergies.push("Sinergia Info + Flash");
  }

  const hasViperAnchor = assignments.some((a) => a.agent === "Viper");
  if (pureSentinels === 0) {
    if (hybridSentinels > 0 && hasViperAnchor) {
      synergies.push("Anclaje Híbrido (Viper + Centinela)");
    } else if (hybridSentinels > 0 || hasViperAnchor) {
      warnings.push("Flank Watch débil (sin Centinela puro)");
      penalty.defensa -= 0.02;
    } else {
      warnings.push("Sin Centinela ni anclaje de sitio");
      penalty.defensa -= 0.04;
    }
  }

  if (diveDuelists >= 1 && reconInits >= 1) {
    penalty.entrada += 0.012;
    synergies.push("Combo Dive + Recon");
  }

  const hasCore4 =
    hasViableMainSmoker &&
    diveDuelists >= 1 &&
    roleCounts.Iniciador >= 1 &&
    (pureSentinels >= 1 || (hybridSentinels >= 1 && hasViperAnchor));
  const isBalanced =
    hasCore4 &&
    warnings.length === 0 &&
    Math.max(roleCounts.Duelista, roleCounts.Iniciador, roleCounts.Controlador, roleCounts.Centinela) <= 2;

  const bonuses = {} as AxisRecord;
  for (const ax of AXES) {
    const diff = pts[ax] - COMP_CONFIG.ideal[ax];
    let val = diff * COMP_CONFIG.factor_eje * (1 + axisAttrs[ax] / 200);
    val *= mapAxisMult[ax] || 1.0;
    val += penalty[ax];

    if (ax === "macro" && val > 0) val *= 1 + Math.max(0, (coach.macro - 80) / 100);
    if (val < 0) {
      const adpMit = Math.max(0.62, 1 - Math.max(0, coach.adapt - 75) / 100);
      val *= adpMit;
    }
    bonuses[ax] = Math.max(-COMP_CONFIG.tope_eje, Math.min(COMP_CONFIG.tope_eje, val));
  }

  const eqBonus = isBalanced ? COMP_CONFIG.bonus_equilibrio : 0;
  const varianceBoost = Math.max(0, bonuses.entrada) * 0.45;

  let archetype = "ESTÁNDAR";
  if (roleCounts.Controlador >= 2 && roleCounts.Duelista >= 2) archetype = "2 CTRL + 2 DUEL";
  else if (roleCounts.Controlador >= 2) archetype = "DOBLE CONTROLADOR";
  else if (roleCounts.Duelista >= 2) archetype = "DOBLE DUELISTA";
  else if (roleCounts.Iniciador >= 2) archetype = "DOBLE INICIADOR";
  else if (roleCounts.Centinela >= 2) archetype = "DOBLE CENTINELA";
  else if (isBalanced) archetype = "1-1-1-1-1 EQUILIBRIO";

  return { roleCounts, pts, bonuses, eqBonus, varianceBoost, isBalanced, archetype, warnings, synergies };
}

export function draftTeamComp(teamObj: TeamInput, mapName: MapName): TeamCompDraft {
  const m = getMapConfig(mapName);
  const starters = teamObj.players.filter((p) => !p.sub).slice(0, 5);
  const used = new Set<string>();
  const roleCount: Record<CoreRole, number> = {
    Duelista: 0, Iniciador: 0, Controlador: 0, Centinela: 0
  };
  let hasPureSmoker = false;

  const customMap =
    (teamObj.customComp && (teamObj.customComp[mapName] || teamObj.customComp.DEFAULT)) || null;
  const assigned: Array<AgentAssignment | undefined> = new Array(starters.length);

  // 1. Elecciones manuales del jugador
  if (customMap) {
    starters.forEach((p, idx) => {
      const forcedAg = customMap[p.n];
      if (forcedAg && AGENTS[forcedAg] && !used.has(forcedAg)) {
        const agObj = AGENTS[forcedAg];
        const sigList = (PLAYER_AGENTS[p.n] || []).filter((a) => Boolean(AGENTS[a]));
        used.add(forcedAg);
        roleCount[agObj.role] = (roleCount[agObj.role] || 0) + 1;
        if (agObj.smokeType === "pure") hasPureSmoker = true;

        assigned[idx] = {
          playerName: p.n,
          agent: forcedAg,
          role: agObj.role,
          mapFit: agObj.maps[mapName] || 82,
          comfort: sigList.includes(forcedAg),
          isOpBoost: Boolean(agObj.op && m.longRange && p.aim >= 88 && p.fd >= 82),
          hushMastery: agObj.hush ? Math.max(HUSH_MASTERY[p.n] || 0, p._hushMastery || 0) : 0,
          ecoBoost: agObj.ecoBoost || 1.0,
          manual: true
        };
      }
    });
  }

  // 2. Auto-draft para los slots restantes
  const priorityOrder = starters
    .map((p, origIdx) => {
      const pr = getPrimaryRoleFromStr(p.r);
      const prio =
        pr === "Controlador" ? 1 : pr === "Duelista" ? 2 : pr === "Iniciador" ? 3 : pr === "Centinela" ? 4 : 5;
      return { p, origIdx, pr, prio };
    })
    .filter((x) => !assigned[x.origIdx])
    .sort((a, b) => a.prio - b.prio);

  priorityOrder.forEach(({ p, origIdx, pr }) => {
    const sigList = (PLAYER_AGENTS[p.n] || []).filter((a) => Boolean(AGENTS[a]));
    const candidates = getPlayerAgents(p);
    let bestAg = candidates[0] || "Omen";
    let bestScore = -Infinity;

    const pool = candidates.filter((a) => !used.has(a));
    const evalList = pool.length ? pool : Object.keys(AGENTS).filter((a) => !used.has(a));

    evalList.forEach((agName) => {
      const ag = AGENTS[agName];
      const mapFit = ag.maps[mapName] || 82;
      const sigIdx = sigList.indexOf(agName);
      const comfortBonus =
        sigIdx === 0 ? 7.5 : sigIdx === 1 ? 5.5 : sigIdx === 2 ? 3.5 : sigIdx >= 3 ? 1.5 : -4.0;
      const roleMatchBonus = ag.role === pr ? 4.0 : 0;

      let hushMod = 0;
      if (ag.hush) {
        const mastery = Math.max(HUSH_MASTERY[p.n] || 0, p._hushMastery || 0);
        hushMod = mastery >= 0.9 ? 8.5 : mastery > 0 ? 1.5 : -45.0;
      }

      let teamNeedBonus = 0;
      if (!hasPureSmoker && ag.smokeType === "pure") teamNeedBonus += 13;
      if (!hasPureSmoker && ag.smokeType === "hybrid_wall" && roleCount.Controlador === 0) teamNeedBonus -= 10;
      if (hasPureSmoker && m.preferWall && ag.wall && roleCount.Controlador === 1) teamNeedBonus += 8;

      if (ag.role === "Iniciador" && roleCount.Iniciador === 0) teamNeedBonus += ag.cannotSoloRole ? 2 : 7;
      if (ag.role === "Duelista" && roleCount.Duelista === 0) teamNeedBonus += ag.cannotSoloRole ? 1 : 8;
      if (ag.role === "Centinela" && roleCount.Centinela === 0) teamNeedBonus += ag.cannotSoloRole ? 2 : 6;
      if (roleCount[ag.role] >= 2) teamNeedBonus -= 9;

      let opSynergy = 0;
      if (ag.op && m.longRange && p.aim >= 89 && p.fd >= 84) opSynergy = mapName === "Breeze" ? 9.0 : 5.5;
      if (!m.longRange && (agName === "Raze" || agName === "Neon" || agName === "Hush") && p.entry >= 88) {
        opSynergy += 3.8;
      }

      const total = mapFit + comfortBonus + roleMatchBonus + teamNeedBonus + opSynergy + hushMod;
      if (total > bestScore) {
        bestScore = total;
        bestAg = agName;
      }
    });

    used.add(bestAg);
    const agObj = AGENTS[bestAg];
    roleCount[agObj.role] = (roleCount[agObj.role] || 0) + 1;
    if (agObj.smokeType === "pure") hasPureSmoker = true;

    assigned[origIdx] = {
      playerName: p.n,
      agent: bestAg,
      role: agObj.role,
      mapFit: agObj.maps[mapName] || 82,
      comfort: sigList.includes(bestAg),
      isOpBoost: Boolean(agObj.op && m.longRange && p.aim >= 88 && p.fd >= 82),
      hushMastery: agObj.hush ? Math.max(HUSH_MASTERY[p.n] || 0, p._hushMastery || 0) : 0,
      ecoBoost: agObj.ecoBoost || 1.0
    };
  });

  const finalAssignments = assigned.filter((a): a is AgentAssignment => Boolean(a));
  const evalData = evaluateTeamComposition(teamObj, finalAssignments, mapName);
  const avgFit = finalAssignments.reduce((s, a) => s + a.mapFit, 0) / Math.max(1, finalAssignments.length);
  const comfortHits = finalAssignments.filter((a) => a.comfort).length;
  const opCarrier = finalAssignments.find((a) => a.isOpBoost);
  const hushCarrier = finalAssignments.find((a) => a.hushMastery > 0);

  let extraScore = 0;
  const tags: string[] = [evalData.isBalanced ? "1-1-1-1-1 (+2% EQ)" : evalData.archetype];
  if (hushCarrier) {
    extraScore += hushCarrier.hushMastery >= 0.9 ? 2.4 : 0.9;
    tags.push(`Hush ${hushCarrier.hushMastery >= 0.9 ? "Master" : "Flex"} (${hushCarrier.playerName})`);
  }
  if (opCarrier) {
    extraScore += mapName === "Breeze" ? 3.2 : 1.8;
    tags.push(`${opCarrier.agent} OP (${opCarrier.playerName})`);
  }
  evalData.synergies.forEach((s) => tags.push(s));
  evalData.warnings.forEach((w) => tags.push(w));

  const netAxes =
    (evalData.bonuses.macro +
      evalData.bonuses.util +
      evalData.bonuses.entrada +
      evalData.bonuses.defensa +
      evalData.bonuses.flex) /
    5;
  const compScore = Math.max(
    60,
    Math.min(99, avgFit + extraScore + evalData.eqBonus * 100 + netAxes * 75 + (comfortHits - 3) * 0.6)
  );

  return {
    mapName,
    assignments: finalAssignments,
    compScore: Number(compScore.toFixed(1)),
    bonuses: evalData.bonuses,
    eqBonus: evalData.eqBonus,
    varianceBoost: evalData.varianceBoost,
    archetype: evalData.archetype,
    synergies: evalData.synergies,
    warnings: evalData.warnings,
    tags: tags.slice(0, 4)
  };
}