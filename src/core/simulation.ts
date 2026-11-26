import { draftTeamComp } from "./composition.ts";
import { DEFAULT_EXP } from "./constants.ts";
import { getMapConfig } from "./maps.ts";
import { runCoachVeto } from "./veto.ts";
import type {
  AxisRecord,
  ClutchInfo,
  Coach,
  EconType,
  HighlightEvent,
  KillEvent,
  MapConfig,
  MapName,
  MatchResult,
  MatchTeamState,
  MatchUnit,
  Player,
  RoundResult,
  ScheduledMap,
  SeriesFormat,
  SeriesOptions,
  SeriesResult,
  SimOptions,
  TeamInput,
  TimeoutEvent
} from "./types.ts";

const gauss = () =>
  Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());

const rnd = <T,>(a: readonly T[]): T => a[(Math.random() * a.length) | 0];

function wpick(a: MatchUnit[], mapMod: MapConfig): MatchUnit {
  const w = a.map((u) => {
    const opW = u.isOpBoost ? 1.12 : u.hushMastery >= 0.9 ? 1.1 : 1.0;
    return Math.pow((u.p.entry * (mapMod ? mapMod.entry : 1) * opW) / 100, 3);
  });
  const t = w.reduce((x, y) => x + y, 0);
  let r = Math.random() * t;
  for (let i = 0; i < a.length; i++) {
    r -= w[i];
    if (r <= 0) return a[i];
  }
  return a[0];
}

function calcStrength(
  u: MatchUnit,
  open: boolean,
  clu: boolean,
  econ: number,
  igm: number,
  mapMod: MapConfig,
  roundType: EconType,
  isAtkNow: boolean,
  compBonuses: AxisRecord,
  eqBonus: number,
  exp: number
): number {
  const p = u.p;
  let effEcon = econ;
  if (u.ecoBoost > 1 && (roundType === "Eco" || roundType === "Force")) {
    effEcon = Math.min(1.0, econ * u.ecoBoost);
  }

  const agentMult = 1 + ((u.agentFit || 86) - 86) / 380 + (u.comfort ? 0.008 : -0.012);
  const opMult = u.isOpBoost && roundType === "Full" ? (open ? 1.05 : 1.025) : 1.0;
  const hushMult = u.hushMastery >= 0.9 ? (open ? 1.035 : 1.02) : u.hushMastery > 0 ? 1.012 : 1.0;

  const b = compBonuses;
  const phaseMult =
    1 +
    (eqBonus || 0) +
    b.macro * 0.45 +
    (open ? b.entrada * 0.7 : b.util * 0.55) +
    (isAtkNow ? b.entrada * 0.35 : b.defensa * 0.65) +
    (clu ? b.defensa * 0.5 : 0);

  const aim = p.aim * mapMod.aim;
  const fd = p.fd * mapMod.fd;
  const ent = p.entry * mapMod.entry;
  const util = p.util * mapMod.util;

  let s = open
    ? aim * 0.5 + fd * 0.3 + ent * 0.2
    : aim * 0.6 + util * 0.15 + ent * 0.1 + fd * 0.15;
  s = s * u.form * effEcon * igm * agentMult * opMult * hushMult * phaseMult;
  if (clu) s += (p.clutch * mapMod.clu - 80) * 0.4;
  return Math.pow(Math.max(s, 1) / 100, exp);
}

export function simMatch(
  tLeft: TeamInput,
  tRight: TeamInput,
  mapSpec: MapName | ScheduledMap,
  options: SimOptions = {}
): MatchResult {
  const exp = options.exp ?? DEFAULT_EXP;
  const mapName: MapName = typeof mapSpec === "string" ? mapSpec : mapSpec.mapName;
  const mapMod = getMapConfig(mapName);
  const leftStartsAtk =
    typeof mapSpec === "object" && mapSpec.atkTeamName ? mapSpec.atkTeamName === tLeft.name : true;

  const comps = [draftTeamComp(tLeft, mapName), draftTeamComp(tRight, mapName)] as [
    ReturnType<typeof draftTeamComp>,
    ReturnType<typeof draftTeamComp>
  ];

  const teams = ([tLeft, tRight] as const).map((t, ti): MatchTeamState => ({
    name: t.name,
    coach: t.coach,
    comp: comps[ti],
    units: t.players
      .filter((p) => !p.sub)
      .slice(0, 5)
      .map((p, idx): MatchUnit => {
        const ag = comps[ti].assignments[idx];
        const mgrMod = typeof p._mgrMod === "number" ? p._mgrMod : 0;
        const persistentBonus =
          typeof p._mgrMod !== "number" && options.getPersistentFormBonus
            ? options.getPersistentFormBonus(p.n)
            : 0;
        return {
          p,
          agent: ag.agent,
          agentRole: ag.role,
          agentFit: ag.mapFit,
          comfort: ag.comfort,
          isOpBoost: ag.isOpBoost,
          hushMastery: ag.hushMastery,
          ecoBoost: ag.ecoBoost,
          form:
            1 +
            mgrMod +
            persistentBonus +
            gauss() *
              ((0.015 +
                (100 - p.cons) / 1250 +
                ((100 - p.conf) / 1250) * (1 - (t.coach.dev - 70) / 150)) *
                (1 - (t.coach.disc - 70) / 250))
        };
      })
  })) as [MatchTeamState, MatchTeamState];

  const igm = teams.map((t, idx) => {
    const rawT = idx === 0 ? tLeft : tRight;
    const prepBonus = rawT.mapPrep?.[mapName] ?? 0;
    return (
      1 +
      prepBonus +
      (Math.max(...t.units.map((u) => u.p.igl)) * mapMod.igl - 80) / 800 +
      (t.coach.macro * mapMod.igl - 80) / 1000
    );
  });

  const sc: [number, number] = [0, 0];
  let cr: [number, number] = [800, 800];
  let ls: [number, number] = [0, 0];
  const timeoutsLeft: [number, number] = [2, 2];
  const timeoutActive: [number, number] = [0, 0];
  const rounds: RoundResult[] = [];
  let n = 0;

  while (true) {
    n++;
    if (n === 13) {
      cr = [800, 800];
      ls = [0, 0];
    }
    const ot = n > 24;
    const pist = n === 1 || n === 13;

    const leftIsAtkNow =
      n <= 12 ? leftStartsAtk : !ot ? !leftStartsAtk : n % 2 === 1 ? leftStartsAtk : !leftStartsAtk;
    const sideBias0 = leftIsAtkNow ? mapMod.atkBias : mapMod.defBias;
    const sideBias1 = leftIsAtkNow ? mapMod.defBias : mapMod.atkBias;

    const tp = ([0, 1] as const).map((i): [EconType, number, number] =>
      pist
        ? ["Pistol", 1, 800]
        : ot
          ? ["Full", 1, 0]
          : cr[i] >= 3900
            ? ["Full", 1, 3900]
            : cr[i] >= 2400
              ? ["Force", 0.9, 2400]
              : ["Eco", 0.72, 0]
    );

    const calledTimeouts: TimeoutEvent[] = [];
    for (const i of [0, 1] as const) {
      if (!pist && timeoutsLeft[i] > 0 && (ls[i] === 3 || (n >= 10 && ls[i] === 2 && sc[1 - i] >= 11))) {
        timeoutsLeft[i]--;
        timeoutActive[i] = 2;
        calledTimeouts.push({
          ti: i,
          coach: teams[i].coach.n,
          team: teams[i].name,
          scoreCtx: `[${sc[0]}-${sc[1]}]`
        });
      }
    }

    const adp = ([0, 1] as const).map((i) => {
      const flexBoost = 1 + Math.max(0, teams[i].comp.bonuses.flex) * 0.5;
      let base = !pist && ls[i] >= 2 ? 1 + ((teams[i].coach.adapt - 75) / 600) * flexBoost : 1;
      if (timeoutActive[i] > 0) base *= 1 + ((teams[i].coach.adapt - 68) / 380) * flexBoost;
      return base;
    });

    const roundSwing = ([0, 1] as const).map(
      (i) => 1 + gauss() * (0.012 + teams[i].comp.varianceBoost)
    );

    const al: [MatchUnit[], MatchUnit[]] = [teams[0].units.slice(), teams[1].units.slice()];
    const ev: KillEvent[] = [];
    const cs: [Omit<ClutchInfo, "won"> | null, Omit<ClutchInfo, "won"> | null] = [null, null];
    const idOf = (ti: 0 | 1, u: MatchUnit) => `${ti}-${teams[ti].units.indexOf(u)}`;

    let last: { kt: 0 | 1; k: MatchUnit; v: MatchUnit } | null = null;
    let first = true;

    while (al[0].length && al[1].length) {
      const a = first ? wpick(al[0], mapMod) : rnd(al[0]);
      const b = first ? wpick(al[1], mapMod) : rnd(al[1]);

      const s0 = calcStrength(
        a,
        first,
        al[0].length === 1 && al[1].length >= 2,
        tp[0][1],
        igm[0] * adp[0] * sideBias0 * roundSwing[0] * (first ? 1 + (teams[0].coach.micro - 80) / 800 : 1),
        mapMod,
        tp[0][0],
        leftIsAtkNow,
        teams[0].comp.bonuses,
        teams[0].comp.eqBonus,
        exp
      );
      const s1 = calcStrength(
        b,
        first,
        al[1].length === 1 && al[0].length >= 2,
        tp[1][1],
        igm[1] * adp[1] * sideBias1 * roundSwing[1] * (first ? 1 + (teams[1].coach.micro - 80) / 800 : 1),
        mapMod,
        tp[1][0],
        !leftIsAtkNow,
        teams[1].comp.bonuses,
        teams[1].comp.eqBonus,
        exp
      );

      const kt: 0 | 1 = Math.random() < s0 / (s0 + s1) ? 0 : 1;
      const vt: 0 | 1 = kt === 0 ? 1 : 0;
      const k = kt ? b : a;
      const v = kt ? a : b;
      const mates = al[kt].filter((u) => u !== k);

      ev.push({
        k: idOf(kt, k),
        v: idOf(vt, v),
        fb: first,
        tr: Boolean(last && last.kt !== kt && v === last.k),
        as: mates.length && Math.random() < 0.45 ? idOf(kt, rnd(mates)) : null
      });

      last = { kt, k, v };
      first = false;
      al[vt] = al[vt].filter((u) => u !== v);

      for (const i of [0, 1] as const) {
        if (al[i].length === 1 && al[1 - i].length >= 2 && !cs[i]) {
          cs[i] = { id: idOf(i, al[i][0]), x: al[1 - i].length };
        }
      }
    }

    const win: 0 | 1 = al[0].length ? 0 : 1;
    const before: [number, number] = [sc[0], sc[1]];
    const cl: ClutchInfo | null = cs[win] ? { ...cs[win]!, won: true } : null;

    const nm = (id: string) => {
      const [t, i] = id.split("-").map(Number);
      return teams[t].units[i].p.n;
    };
    const agOf = (id: string) => {
      const [t, i] = id.split("-").map(Number);
      return teams[t].units[i].agent;
    };

    const cnt: Record<string, number> = {};
    ev.forEach((e) => {
      cnt[e.k] = (cnt[e.k] || 0) + 1;
    });

    const ctx = `[${before[0]}-${before[1]}]`;
    const tn = teams[win].name;
    const hl: HighlightEvent[] = [];
    const end =
      before[win] === 12
        ? " Con esa ronda cierra el mapa."
        : before[1 - win] === 12
          ? " Evita el match point rival."
          : "";

    calledTimeouts.forEach((to) => {
      hl.push({
        r: n,
        t: "to",
        x: `TIMEOUT TÁCTICO: DT ${to.coach} (${to.team}) pide pausa en ${to.scoreCtx} para ajustar lecturas (+Adaptación ${teams[to.ti].coach.adapt}).`
      });
    });

    const isDecisiveRound = n === 12 || n >= 22 || (tp[win][0] === "Eco" && tp[1 - win][0] === "Full");
    for (const id in cnt) {
      const c = cnt[id];
      const name = nm(id);
      const ag = agOf(id);
      if (c === 5) {
        hl.push({
          r: n,
          t: "ace",
          x:
            rnd([
              `ACE de ${name} (${ag}): limpia a los cinco rivales en R${n} ${ctx}.`,
              `R${n} ${ctx}: ${name} con ${ag} borra al equipo rival completo (ACE).`,
              `${name} (${ag}) firma un ACE monumental en R${n} ${ctx}.`
            ]) + end
        });
      } else if (c === 4) {
        hl.push({ r: n, t: "mk", x: `${name} (${ag}) conecta un 4K decisivo en R${n} ${ctx}.${end}` });
      } else if (c === 3 && isDecisiveRound) {
        hl.push({ r: n, t: "mk", x: `Triple kill clave de ${name} (${ag}) en ronda crítica (R${n} ${ctx}).${end}` });
      }
    }

    if (cl && cl.x >= 2) {
      hl.unshift({
        r: n,
        t: cl.x >= 3 ? "ace" : "cl",
        x:
          rnd([
            `R${n} ${ctx}: CLUTCH 1v${cl.x} de ${nm(cl.id)} (${agOf(cl.id)}) para ${tn}.`,
            `${nm(cl.id)} (${agOf(cl.id)}) resuelve un 1v${cl.x} en R${n} ${ctx}.`,
            `1v${cl.x} imposible: ${nm(cl.id)} (${agOf(cl.id)}) salva R${n} ${ctx} para ${tn}.`
          ]) + end
      });
    }

    if (tp[win][0] === "Eco" && tp[1 - win][0] === "Full") {
      hl.push({
        r: n,
        t: "up",
        x: `Batacazo eco (Thrifty): ${tn} gana R${n} ${ctx} contra un full buy.`
      });
    }

    for (const i of [0, 1] as const) {
      const w = i === win;
      cr[i] =
        Math.min(9000, Math.max(0, cr[i] - tp[i][2] * (w ? 0.5 : 1))) +
        (w ? 3000 : 1900 + 500 * Math.min(ls[i], 2));
      ls[i] = w ? 0 : ls[i] + 1;
      if (timeoutActive[i] > 0) timeoutActive[i]--;
    }

    if (ot) cr = [5000, 5000];
    sc[win]++;

    const survivors = Array.from(
      new Set([...al[0].map((u) => idOf(0, u)), ...al[1].map((u) => idOf(1, u))])
    );
    rounds.push({
      n,
      before,
      win,
      econ: [tp[0][0], tp[1][0]],
      ev,
      cl,
      hl,
      timeouts: calledTimeouts,
      survivors,
      score: [sc[0], sc[1]]
    });

    if (((sc[0] >= 13 || sc[1] >= 13) && Math.abs(sc[0] - sc[1]) >= 2) || n >= 40) break;
  }

  return {
    teams,
    comps,
    rounds,
    sc,
    mapName,
    leftStartsAtk,
    pickedBy: typeof mapSpec === "object" ? mapSpec.pickedBy : "VCT",
    sideChooser: typeof mapSpec === "object" ? mapSpec.sideChooser : tLeft.name,
    sideChosen: typeof mapSpec === "object" ? mapSpec.sideChosen : "ATK"
  };
}

export function getTeamOvr(players: Player[], coach: Coach): string {
  const starters = players.filter((p) => !p.sub).slice(0, 5);
  const pAvg =
    starters.reduce(
      (acc, p) => acc + (p.aim * 0.35 + p.fd * 0.18 + p.clutch * 0.15 + p.entry * 0.15 + p.util * 0.17),
      0
    ) / Math.max(1, starters.length);
  const cBonus = ((coach.macro + coach.micro + coach.disc) / 3 - 80) * 0.18;
  return (pAvg + cBonus).toFixed(1);
}

export function buildSeries(
  tLeft: TeamInput,
  tRight: TeamInput,
  fmt: SeriesFormat,
  options: SeriesOptions = {}
): SeriesResult {
  const { startProgressive = false, forcedFirstMap = "AUTO", activeMaps, exp, getPersistentFormBonus } =
    options;
  const vetoData = runCoachVeto(tLeft, tRight, fmt, { forcedFirstMap, activeMaps });
  const needed = Math.ceil(fmt / 2);
  const maps: MatchResult[] = [];
  const finalSeriesScore: [number, number] = [0, 0];

  for (let i = 0; i < vetoData.scheduledMaps.length; i++) {
    if (finalSeriesScore[0] >= needed || finalSeriesScore[1] >= needed) break;
    const m = simMatch(tLeft, tRight, vetoData.scheduledMaps[i], { exp, getPersistentFormBonus });
    maps.push(m);
    if (m.sc[0] > m.sc[1]) finalSeriesScore[0]++;
    else finalSeriesScore[1]++;
  }

  return {
    format: fmt,
    vetoData,
    maps,
    seriesScore: finalSeriesScore,
    revealedMaps: startProgressive ? 1 : maps.length,
    activeTab: startProgressive ? 0 : fmt > 1 ? "SERIES" : 0
  };
}