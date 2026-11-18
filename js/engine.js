// ===== ESTADO / DATOS (se cargan desde data/*.json en index.html) =====
const TEAM_META = {};
const DEFAULT_TEAMS = {};
for (const k in DATA.teams.teams) {
  const { players, ...meta } = DATA.teams.teams[k];
  TEAM_META[k] = meta;
  DEFAULT_TEAMS[k] = players;
}
const COACH = DATA.coaches;
const DATA_UPDATED = DATA.teams.updated;
const STORAGE_KEY = "vct_sim_2027_rosters_v5";
let TEAMS = JSON.parse(JSON.stringify(DEFAULT_TEAMS));
try {
  const saved = typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    for (const k in DEFAULT_TEAMS) if (!parsed[k]) parsed[k] = DEFAULT_TEAMS[k];
    TEAMS = parsed;
  }
} catch (e) {}
function saveTeams() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(TEAMS)); } catch (e) {}
}

    const MAP_POOL = {
      "Ascent": { desc: "Ascent · Duelos de medio y Operator (+AIM/FD, ligeramente Defensor)", aim: 1.06, fd: 1.08, util: 0.97, entry: 1.0,  clu: 1.0,  igl: 1.02, atkBias: 0.97, defBias: 1.03 },
      "Lotus":  { desc: "Lotus · 3 sitios, rotaciones y utilidad pesada (+UTI/IGL, Atacante)", aim: 0.98, fd: 0.98, util: 1.12, entry: 1.03, clu: 1.02, igl: 1.12, atkBias: 1.04, defBias: 0.96 },
      "Haven":  { desc: "Haven · Control de 3 sitios y post-plant (+IGL/CLU, Atacante)",        aim: 1.0,  fd: 1.0,  util: 1.05, entry: 1.0,  clu: 1.10, igl: 1.10, atkBias: 1.03, defBias: 0.97 },
      "Bind":   { desc: "Bind · Teleporters y ejecuciones explosivas (+ENT/UTI)",              aim: 0.99, fd: 1.02, util: 1.10, entry: 1.10, clu: 1.0,  igl: 1.02, atkBias: 1.01, defBias: 0.99 },
      "Split":  { desc: "Split · Cuellos de botella y defensa cerrada (+AIM/CONS, Defensor)",  aim: 1.05, fd: 1.04, util: 1.04, entry: 1.04, clu: 1.02, igl: 1.0,  atkBias: 0.96, defBias: 1.04 },
      "Sunset": { desc: "Sunset · Pelea de medio y retake agresivo (+ENT/CLU)",                aim: 1.02, fd: 1.02, util: 1.04, entry: 1.08, clu: 1.08, igl: 1.0,  atkBias: 1.02, defBias: 0.98 },
      "Abyss":  { desc: "Abyss · Líneas largas y alto riesgo (+AIM/FD)",                       aim: 1.08, fd: 1.08, util: 0.96, entry: 1.02, clu: 1.02, igl: 1.0,  atkBias: 1.01, defBias: 0.99 }
    };


    // CORE MATHEMATICAL SIMULATION ENGINE + COACH TACTICAL VETO & 1v1 DUEL
    const EXP = 1.5;
    const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
    const rnd = a => a[Math.random() * a.length | 0];

    function wpick(a, mapMod) {
      const w = a.map(u => Math.pow((u.p.entry * (mapMod ? mapMod.entry : 1)) / 100, 3)), t = w.reduce((x, y) => x + y);
      let r = Math.random() * t;
      for (let i = 0; i < a.length; i++) {
        r -= w[i];
        if (r <= 0) return a[i];
      }
      return a[0];
    }

    function str(u, open, clu, econ, igm, mapMod) {
      const p = u.p;
      const m = mapMod || { aim: 1, fd: 1, util: 1, entry: 1, clu: 1 };
      const aim = p.aim * m.aim, fd = p.fd * m.fd, ent = p.entry * m.entry, util = p.util * m.util;
      let s = open ? aim * .5 + fd * .3 + ent * .2 : aim * .6 + util * .15 + ent * .1 + fd * .15;
      s = s * u.form * econ * igm;
      if (clu) s += (p.clutch * m.clu - 80) * .4;
      return Math.pow(Math.max(s, 1) / 100, EXP);
    }

    // EVALUATE HOW STRONG A TEAM IS ON A SPECIFIC MAP (FOR COACH VETO AI)
    function scoreTeamOnMap(teamObj, mapName) {
      const m = MAP_POOL[mapName];
      const starters = teamObj.players.filter(p => !p.sub).slice(0, 5);
      const c = teamObj.coach;
      let total = 0;
      starters.forEach(p => {
        total += (p.aim * 0.34 * m.aim) +
                 (p.fd * 0.18 * m.fd) +
                 (p.entry * 0.15 * m.entry) +
                 (p.util * 0.18 * m.util) +
                 (p.clutch * 0.15 * m.clu);
      });
      const avgP = total / starters.length;
      const iglMax = Math.max(...starters.map(p => p.igl));
      const tacScore = ((iglMax * 0.5 + c.macro * 0.5) - 80) * 0.25 * m.igl;
      return avgP + tacScore;
    }

    // COACH DECIDES STARTING SIDE (ATK OR DEF) ON A GIVEN MAP
    function coachPickStartingSide(choosingTeam, otherTeam, mapName) {
      const m = MAP_POOL[mapName];
      const starters = choosingTeam.players.filter(p => !p.sub).slice(0, 5);
      const aggr = starters.reduce((a, p) => a + p.entry * 0.55 + p.fd * 0.45, 0) / starters.length;
      const ctrl = starters.reduce((a, p) => a + p.util * 0.55 + p.clutch * 0.45, 0) / starters.length;
      const atkPref = (aggr * m.atkBias) - (ctrl * m.defBias);
      return atkPref >= 0 ? "ATK" : "DEF";
    }

    // PRE-MATCH 1v1 DUEL (COACH PICKS PLAYER WITH HIGHEST AIM + CONFIDENCE + MOMENTUM)
    function runPreMatch1v1(tLeft, tRight) {
      const pickChampion = t => {
        const starters = t.players.filter(p => !p.sub).slice(0, 5);
        let best = starters[0], bestVal = -1, bestReason = "";
        starters.forEach(p => {
          const dailyFeeling = gauss() * 2.2;
          const score = p.aim * 0.62 + p.conf * 0.26 + p.fd * 0.12 + dailyFeeling;
          if (score > bestVal) {
            bestVal = score;
            best = p;
            bestReason = (p.aim >= 93 && p.conf >= 86) ? "estrella en racha de confianza y AIM"
                       : (p.aim >= 93) ? "techo mecánico puro (AIM " + p.aim + ")"
                       : "máxima confianza del día (CONF " + p.conf + ")";
          }
        });
        return { player: best, score: bestVal, reason: bestReason };
      };

      const c0 = pickChampion(tLeft);
      const c1 = pickChampion(tRight);

      // Simulate best-of-9 aim duel rounds (first to 5 kills)
      const p0Strength = Math.pow((c0.player.aim * 0.65 + c0.player.fd * 0.20 + c0.player.conf * 0.15) / 100, 2.2);
      const p1Strength = Math.pow((c1.player.aim * 0.65 + c1.player.fd * 0.20 + c1.player.conf * 0.15) / 100, 2.2);
      let k0 = 0, k1 = 0;
      while (k0 < 5 && k1 < 5) {
        if (Math.random() < p0Strength / (p0Strength + p1Strength)) k0++;
        else k1++;
      }
      const winnerIdx = k0 === 5 ? 0 : 1;
      const winTeam = winnerIdx === 0 ? tLeft : tRight;
      const loseTeam = winnerIdx === 0 ? tRight : tLeft;

      // Coach of winning player decides whether to be Equipo A (2 side choices + Map 1 pick) or Equipo B (counter-pick + Map 1 side choice)
      // Coaches with high Macro/IGL prefer Equipo A (control of veto & decider side)
      const prefersRoleA = (winTeam.coach.macro + Math.max(...winTeam.players.map(p => p.igl))) >= 165;
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

    // OFFICIAL 7-STEP VETO SEQUENCE DIRECTED BY COACHES
    function runCoachVeto(tLeft, tRight, fmt, forcedFirstMap = "AUTO") {
      const duel = runPreMatch1v1(tLeft, tRight);
      const A = duel.teamA;
      const B = duel.teamB;
      let remaining = Object.keys(MAP_POOL);

      const removeMap = m => { remaining = remaining.filter(x => x !== m); };

      // Helper: Coach bans the map where the opponent has the biggest advantage over them
      const coachBan = (myTeam, oppTeam) => {
        let worstMap = remaining[0], worstNet = Infinity;
        remaining.forEach(m => {
          // Do not ban the user's forced first map if specified
          if (forcedFirstMap !== "AUTO" && m === forcedFirstMap && remaining.length > 1) return;
          const net = scoreTeamOnMap(myTeam, m) - scoreTeamOnMap(oppTeam, m) + gauss() * 0.45;
          if (net < worstNet) {
            worstNet = net;
            worstMap = m;
          }
        });
        removeMap(worstMap);
        return worstMap;
      };

      // Helper: Coach picks the map where their team has the strongest tactical/mechanical edge
      const coachPick = (myTeam, oppTeam, forceMap = null) => {
        if (forceMap && remaining.includes(forceMap)) {
          removeMap(forceMap);
          return forceMap;
        }
        let bestMap = remaining[0], bestNet = -Infinity;
        remaining.forEach(m => {
          const net = (scoreTeamOnMap(myTeam, m) * 1.15 - scoreTeamOnMap(oppTeam, m) * 0.85) + gauss() * 0.45;
          if (net > bestNet) {
            bestNet = net;
            bestMap = m;
          }
        });
        removeMap(bestMap);
        return bestMap;
      };

      const steps = [];
      const scheduledMaps = [];

      const registerPlayableMap = (mapName, pickedBy, sideChooserTeam, stepNumber, stepTitle) => {
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
          detail: `${sideChooserTeam.name} (DT ${sideChooserTeam.coach.n}) elige iniciar en ${chosenSide === "ATK" ? "ATAQUE" : "DEFENSA"}`
        });
      };

      if (fmt === 3) {
        // EXACT 7-STEP VCT BO3 VETO SEQUENCE REQUESTED BY USER
        const ban1 = coachBan(A, B);
        steps.push({ step: 1, type: "ban", actor: `1. Veto Equipo A (${A.name})`, mapName: ban1, detail: `DT ${A.coach.n} bloquea ${ban1}` });

        const ban2 = coachBan(B, A);
        steps.push({ step: 2, type: "ban", actor: `2. Veto Equipo B (${B.name})`, mapName: ban2, detail: `DT ${B.coach.n} bloquea ${ban2}` });

        const pick1 = coachPick(A, B, forcedFirstMap !== "AUTO" ? forcedFirstMap : null);
        registerPlayableMap(pick1, A.name, B, 3, `3. Pick Mapa 1 · Equipo A (${A.name})`);

        const pick2 = coachPick(B, A);
        registerPlayableMap(pick2, B.name, A, 4, `4. Pick Mapa 2 · Equipo B (${B.name})`);

        const ban3 = coachBan(A, B);
        steps.push({ step: 5, type: "ban", actor: `5. Veto Equipo A (${A.name})`, mapName: ban3, detail: `DT ${A.coach.n} descarta ${ban3}` });

        const ban4 = coachBan(B, A);
        steps.push({ step: 6, type: "ban", actor: `6. Veto Equipo B (${B.name})`, mapName: ban4, detail: `DT ${B.coach.n} descarta ${ban4}` });

        const decider = remaining[0];
        removeMap(decider);
        registerPlayableMap(decider, "DECIDER", A, 7, `7. Mapa 3 (Decider Automático)`);
      } else if (fmt === 5) {
        // BO5 VETO SEQUENCE (2 Bans, 4 Picks, 1 Decider)
        const ban1 = coachBan(A, B);
        steps.push({ step: 1, type: "ban", actor: `1. Veto Equipo A (${A.name})`, mapName: ban1, detail: `DT ${A.coach.n} bloquea ${ban1}` });

        const ban2 = coachBan(B, A);
        steps.push({ step: 2, type: "ban", actor: `2. Veto Equipo B (${B.name})`, mapName: ban2, detail: `DT ${B.coach.n} bloquea ${ban2}` });

        const pick1 = coachPick(A, B, forcedFirstMap !== "AUTO" ? forcedFirstMap : null);
        registerPlayableMap(pick1, A.name, B, 3, `3. Pick Mapa 1 · Equipo A (${A.name})`);

        const pick2 = coachPick(B, A);
        registerPlayableMap(pick2, B.name, A, 4, `4. Pick Mapa 2 · Equipo B (${B.name})`);

        const pick3 = coachPick(A, B);
        registerPlayableMap(pick3, A.name, B, 5, `5. Pick Mapa 3 · Equipo A (${A.name})`);

        const pick4 = coachPick(B, A);
        registerPlayableMap(pick4, B.name, A, 6, `6. Pick Mapa 4 · Equipo B (${B.name})`);

        const decider = remaining[0];
        removeMap(decider);
        registerPlayableMap(decider, "DECIDER", A, 7, `7. Mapa 5 (Decider Automático)`);
      } else {
        // BO1 VETO SEQUENCE (6 Bans, 1 Decider)
        if (forcedFirstMap !== "AUTO" && remaining.includes(forcedFirstMap)) {
          while (remaining.length > 1) {
            const turnTeam = (7 - remaining.length) % 2 === 1 ? A : B;
            const oppTeam = turnTeam.name === A.name ? B : A;
            const bMap = coachBan(turnTeam, oppTeam);
            steps.push({ step: steps.length + 1, type: "ban", actor: `${steps.length + 1}. Veto ${turnTeam.name === A.name ? 'Equipo A' : 'Equipo B'} (${turnTeam.name})`, mapName: bMap, detail: `DT ${turnTeam.coach.n} descarta ${bMap}` });
          }
          const decider = remaining[0];
          registerPlayableMap(decider, "DECIDER", A, 7, `7. Mapa Único (Decider)`);
        } else {
          for (let s = 1; s <= 6; s++) {
            const turnTeam = s % 2 === 1 ? A : B;
            const oppTeam = s % 2 === 1 ? B : A;
            const bMap = coachBan(turnTeam, oppTeam);
            steps.push({ step: s, type: "ban", actor: `${s}. Veto ${s % 2 === 1 ? 'Equipo A' : 'Equipo B'} (${turnTeam.name})`, mapName: bMap, detail: `DT ${turnTeam.coach.n} descarta ${bMap}` });
          }
          const decider = remaining[0];
          registerPlayableMap(decider, "DECIDER", A, 7, `7. Mapa Único (Decider)`);
        }
      }

      return { duel, steps, scheduledMaps };
    }

    // SIMULATE A SINGLE MAP WITH EXPLICIT STARTING ATTACKER / DEFENDER SIDE
    function simMatch(tLeft, tRight, mapSpec) {
      const mapName = typeof mapSpec === "string" ? mapSpec : mapSpec.mapName;
      const mapMod = MAP_POOL[mapName] || MAP_POOL["Ascent"];
      const leftStartsAtk = typeof mapSpec === "object" && mapSpec.atkTeamName
        ? mapSpec.atkTeamName === tLeft.name
        : true;

      const teams = [tLeft, tRight].map(t => ({
        name: t.name,
        coach: t.coach,
        units: t.players.filter(p => !p.sub).slice(0, 5).map(p => ({
          p,
          form: 1 + gauss() * ((.015 + (100 - p.cons) / 1250 + (100 - p.conf) / 1250 * (1 - (t.coach.dev - 70) / 150)) * (1 - (t.coach.disc - 70) / 250))
        }))
      }));

      const igm = teams.map(t => 1 + ((Math.max(...t.units.map(u => u.p.igl)) * mapMod.igl - 80) / 800) + ((t.coach.macro * mapMod.igl - 80) / 1000));
      let sc = [0, 0], cr = [800, 800], ls = [0, 0], timeoutsLeft = [2, 2], timeoutActive = [0, 0], rounds = [], n = 0;

      while (true) {
        n++;
        if (n == 13) { cr = [800, 800]; ls = [0, 0]; }
        const ot = n > 24, pist = n == 1 || n == 13;

        // Determine who is attacking in round n
        const leftIsAtkNow = n <= 12 ? leftStartsAtk : !ot ? !leftStartsAtk : (n % 2 === 1 ? leftStartsAtk : !leftStartsAtk);
        const sideBias0 = leftIsAtkNow ? mapMod.atkBias : mapMod.defBias;
        const sideBias1 = leftIsAtkNow ? mapMod.defBias : mapMod.atkBias;

        const tp = [0, 1].map(i => pist ? ["Pistol", 1, 800] : ot ? ["Full", 1, 0] : cr[i] >= 3900 ? ["Full", 1, 3900] : cr[i] >= 2400 ? ["Force", .9, 2400] : ["Eco", .72, 0]);

        const calledTimeouts = [];
        for (const i of [0, 1]) {
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

        const adp = [0, 1].map(i => {
          let base = !pist && ls[i] >= 2 ? 1 + (teams[i].coach.adapt - 75) / 600 : 1;
          if (timeoutActive[i] > 0) base *= 1 + (teams[i].coach.adapt - 68) / 380;
          return base;
        });

        const al = [teams[0].units.slice(), teams[1].units.slice()], ev = [], cs = [null, null];
        const idOf = (ti, u) => ti + "-" + teams[ti].units.indexOf(u);
        let last = null, first = true;

        while (al[0].length && al[1].length) {
          const a = first ? wpick(al[0], mapMod) : rnd(al[0]), b = first ? wpick(al[1], mapMod) : rnd(al[1]);
          const s0 = str(a, first, al[0].length == 1 && al[1].length >= 2, tp[0][1], igm[0] * adp[0] * sideBias0 * (first ? 1 + (teams[0].coach.micro - 80) / 800 : 1), mapMod);
          const s1 = str(b, first, al[1].length == 1 && al[0].length >= 2, tp[1][1], igm[1] * adp[1] * sideBias1 * (first ? 1 + (teams[1].coach.micro - 80) / 800 : 1), mapMod);
          const kt = Math.random() < s0 / (s0 + s1) ? 0 : 1, k = kt ? b : a, v = kt ? a : b;
          const mates = al[kt].filter(u => u !== k);
          const e = {
            k: idOf(kt, k),
            v: idOf(1 - kt, v),
            fb: first,
            tr: !!(last && last.kt !== kt && v === last.k),
            as: mates.length && Math.random() < .45 ? idOf(kt, rnd(mates)) : null
          };
          ev.push(e);
          last = { kt, k, v };
          first = false;
          al[1 - kt] = al[1 - kt].filter(u => u !== v);
          for (const i of [0, 1]) if (al[i].length == 1 && al[1 - i].length >= 2 && !cs[i]) cs[i] = { id: idOf(i, al[i][0]), x: al[1 - i].length };
        }

        const win = al[0].length ? 0 : 1, before = sc.slice();
        const cl = cs[win] ? { ...cs[win], won: true } : null;
        const nm = id => { const [t, i] = id.split("-"); return teams[t].units[i].p.n; };
        const cnt = {};
        ev.forEach(e => cnt[e.k] = (cnt[e.k] || 0) + 1);
        const ctx = `[${before[0]}-${before[1]}]`, tn = teams[win].name, hl = [];
        const end = before[win] == 12 ? " Con esa ronda cierra el mapa." : before[1 - win] == 12 ? " Evita el match point rival." : "";

        calledTimeouts.forEach(to => {
          hl.push({
            r: n,
            t: "to",
            x: `⏸️ TIMEOUT TÁCTICO: DT ${to.coach} (${to.team}) pide pausa en ${to.scoreCtx} para ajustar lecturas (+Bono Adaptación ${teams[to.ti].coach.adapt}).`
          });
        });

        const isDecisiveRound = n === 12 || n >= 22 || (tp[win][0] === "Eco" && tp[1 - win][0] === "Full");
        for (const id in cnt) {
          const c = cnt[id], name = nm(id);
          if (c == 5) {
            hl.push({ r: n, t: "ace", x: rnd([`¡ACE de ${name}! Limpia a los cinco rivales en la ronda ${n} ${ctx}.`, `Ronda ${n} ${ctx}: ${name} borra al equipo rival completo. ACE.`, `${name} firma un ACE monumental en la ronda ${n} ${ctx}.`]) + end });
          } else if (c == 4) {
            hl.push({ r: n, t: "mk", x: `${name} conecta un 4K decisivo en la ronda ${n} ${ctx}.` + end });
          } else if (c == 3 && isDecisiveRound) {
            hl.push({ r: n, t: "mk", x: `Triple kill clave de ${name} en ronda crítica (R${n} ${ctx}).` + end });
          }
        }
        if (cl && cl.x >= 2) {
          hl.unshift({ r: n, t: cl.x >= 3 ? "ace" : "cl", x: rnd([`Ronda ${n} ${ctx}: ¡CLUTCH 1v${cl.x} de ${nm(cl.id)}! Lo da vuelta para ${tn}.`, `¡${nm(cl.id)} gana un 1v${cl.x}! Sangre fría en la ronda ${n} ${ctx}.`, `1v${cl.x} imposible: ${nm(cl.id)} salva la ronda ${n} ${ctx} para ${tn}.`]) + end });
        }
        if (tp[win][0] == "Eco" && tp[1 - win][0] == "Full") {
          hl.push({ r: n, t: "up", x: `Batacazo eco (Thrifty): ${tn} gana la ronda ${n} ${ctx} contra un full buy.` });
        }

        for (let i = 0; i < 2; i++) {
          const w = i == win;
          cr[i] = Math.min(9000, Math.max(0, cr[i] - tp[i][2] * (w ? .5 : 1)) + (w ? 3000 : 1900 + 500 * Math.min(ls[i], 2)));
          ls[i] = w ? 0 : ls[i] + 1;
          if (timeoutActive[i] > 0) timeoutActive[i]--;
        }
        if (ot) { cr = [5000, 5000]; }
        sc[win]++;
        const survivors = new Set([...al[0].map(u => idOf(0, u)), ...al[1].map(u => idOf(1, u))]);
        rounds.push({ n, before, win, econ: [tp[0][0], tp[1][0]], ev, cl, hl, timeouts: calledTimeouts, survivors: Array.from(survivors), score: sc.slice() });
        if (((sc[0] >= 13 || sc[1] >= 13) && Math.abs(sc[0] - sc[1]) >= 2) || n >= 40) break;
      }
      return {
        teams,
        rounds,
        sc,
        mapName,
        leftStartsAtk,
        pickedBy: typeof mapSpec === "object" ? mapSpec.pickedBy : "VCT",
        sideChooser: typeof mapSpec === "object" ? mapSpec.sideChooser : tLeft.name,
        sideChosen: typeof mapSpec === "object" ? mapSpec.sideChosen : "ATK"
      };
    }

    function getTeamOvr(teamName) {
      const starters = TEAMS[teamName].filter(p => !p.sub).slice(0, 5);
      const pAvg = starters.reduce((acc, p) => acc + (p.aim * 0.35 + p.fd * 0.18 + p.clutch * 0.15 + p.entry * 0.15 + p.util * 0.17), 0) / starters.length;
      const c = COACH[teamName];
      const cBonus = ((c.macro + c.micro + c.disc) / 3 - 80) * 0.18;
      return (pAvg + cBonus).toFixed(1);
    }

function buildSeries(pLeft, pRight, fmt, startProgressive = false) {
  const mapChoice = (typeof $ === "function" && $("#mapSel")) ? $("#mapSel").value : "AUTO";
      const vetoData = runCoachVeto(pLeft, pRight, fmt, mapChoice);
      const needed = Math.ceil(fmt / 2);
      const maps = [];
      const finalSeriesScore = [0, 0];

      for (let i = 0; i < vetoData.scheduledMaps.length; i++) {
        if (finalSeriesScore[0] >= needed || finalSeriesScore[1] >= needed) break;
        const m = simMatch(pLeft, pRight, vetoData.scheduledMaps[i]);
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
        activeTab: startProgressive ? 0 : (fmt > 1 ? "SERIES" : 0)
      };
    }

