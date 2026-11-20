// ===== MÓDULO P5: MODO MANAGER VCT (FICHAJES, PRESUPUESTO, PROGRESIÓN POT, MORAL, FATIGA Y LESIONES) =====
(function () {
  const SAVE_KEY = "vct_sim_manager_career_v1";
  const mEsc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const fmtMoney = n => (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString("en-US");
  const calcPlayerOvr = p => Math.round(p.aim * 0.35 + p.fd * 0.18 + p.clutch * 0.15 + p.entry * 0.15 + p.util * 0.17);

  function calcRosterOvr(players, coach) {
    const starters = players.filter(p => !p.sub && !(p.injuredWeeks > 0)).slice(0, 5);
    const active = starters.length === 5 ? starters : players.slice(0, 5);
    if (!active.length) return 70;
    const avg = active.reduce((a, p) => a + (p.aim * 0.35 + p.fd * 0.18 + p.clutch * 0.15 + p.entry * 0.15 + p.util * 0.17), 0) / active.length;
    const cb = coach ? ((coach.macro + coach.micro + coach.disc) / 3 - 80) * 0.18 : 0;
    return Number((avg + cb).toFixed(1));
  }

  // ===== POOL DE AGENTES LIBRES REALES (SIN DUPLICAR A NINGÚN JUGADOR DE LOS 21 CLUBES) =====
  const FREE_AGENTS_SEED = [
    { n: "Derke",    r: "Duelista",         aim: 93, fd: 92, clutch: 85, entry: 94, util: 75, igl: 63, conf: 88, cons: 84, pot: 93, age: 23, agents: ["Jett", "Raze", "Yoru", "Waylay"] },
    { n: "Less",     r: "Centinela",        aim: 92, fd: 82, clutch: 93, entry: 77, util: 88, igl: 70, conf: 88, cons: 91, pot: 94, age: 21, agents: ["Viper", "Cypher", "Killjoy", "Veto"] },
    { n: "Leo",      r: "Iniciador",        aim: 91, fd: 77, clutch: 94, entry: 73, util: 96, igl: 74, conf: 90, cons: 93, pot: 94, age: 22, agents: ["Sova", "Fade", "Tejo", "Skye"] },
    { n: "Demon1",   r: "Duelista/Controlador", aim: 93, fd: 88, clutch: 86, entry: 86, util: 78, igl: 62, conf: 79, cons: 79, pot: 93, age: 24, agents: ["Jett", "Brimstone", "Astra", "Chamber"] },
    { n: "nAts",     r: "Centinela/IGL",    aim: 90, fd: 79, clutch: 93, entry: 74, util: 89, igl: 87, conf: 89, cons: 90, pot: 91, age: 24, agents: ["Cypher", "Viper", "Veto", "Chamber"] },
    { n: "Meteor",   r: "Centinela/Duelista", aim: 92, fd: 88, clutch: 89, entry: 87, util: 78, igl: 65, conf: 86, cons: 85, pot: 92, age: 26, agents: ["Cypher", "Killjoy", "Jett", "Neon"] },
    { n: "cauanzin", r: "Iniciador",        aim: 88, fd: 79, clutch: 87, entry: 78, util: 91, igl: 70, conf: 84, cons: 86, pot: 92, age: 21, agents: ["Sova", "Fade", "Skye", "Tejo"] },
    { n: "Jinggg",   r: "Duelista",         aim: 90, fd: 89, clutch: 82, entry: 95, util: 78, igl: 62, conf: 86, cons: 81, pot: 91, age: 23, agents: ["Raze", "Phoenix", "Sage", "Neon"] },
    { n: "Munchkin", r: "Flex/IGL",         aim: 85, fd: 78, clutch: 86, entry: 78, util: 91, igl: 91, conf: 88, cons: 88, pot: 87, age: 28, agents: ["Viper", "KAY/O", "Omen", "Harbor"] },
    { n: "saadhak",  r: "Flex/IGL",         aim: 81, fd: 77, clutch: 84, entry: 78, util: 92, igl: 94, conf: 90, cons: 84, pot: 84, age: 29, agents: ["KAY/O", "Breach", "Viper", "Veto"] },
    { n: "s0m",      r: "Controlador",      aim: 88, fd: 79, clutch: 88, entry: 78, util: 91, igl: 72, conf: 85, cons: 87, pot: 90, age: 24, agents: ["Omen", "Harbor", "Miks", "Viper"] },
    { n: "trexx",    r: "Iniciador",        aim: 89, fd: 81, clutch: 86, entry: 81, util: 91, igl: 69, conf: 83, cons: 86, pot: 91, age: 22, agents: ["Sova", "Fade", "Tejo", "Breach"] },
    { n: "MiniBoo",  r: "Duelista",         aim: 89, fd: 90, clutch: 81, entry: 93, util: 74, igl: 61, conf: 80, cons: 79, pot: 93, age: 21, agents: ["Neon", "Yoru", "Raze", "Jett"] },
    { n: "verno",    r: "Iniciador",        aim: 89, fd: 78, clutch: 86, entry: 76, util: 90, igl: 70, conf: 74, cons: 84, pot: 94, age: 20, agents: ["Sova", "Fade", "Tejo", "Gekko"] }
  ];

  const FREE_COACHES_SEED = [
    { n: "Potter",   macro: 91, micro: 87, adapt: 92, dev: 91, disc: 90, fee: 95000 },
    { n: "mini",     macro: 92, micro: 84, adapt: 90, dev: 86, disc: 88, fee: 90000 },
    { n: "d00mbr0s", macro: 88, micro: 85, adapt: 88, dev: 86, disc: 87, fee: 75000 },
    { n: "Chet",     macro: 86, micro: 86, adapt: 85, dev: 82, disc: 82, fee: 65000 },
    { n: "Termi",    macro: 89, micro: 84, adapt: 86, dev: 85, disc: 92, fee: 80000 },
    { n: "bzkA",     macro: 85, micro: 83, adapt: 84, dev: 88, disc: 86, fee: 60000 },
    { n: "FrosT",    macro: 82, micro: 85, adapt: 84, dev: 84, disc: 79, fee: 50000 }
  ];

  const TRAINING_MODES = {
    scrims: {
      id: "scrims",
      name: "Scrims Intensivos",
      desc: "Alto crecimiento en AIM / FD / ENT (+14 Fatiga · Riesgo médico moderado)",
      fatigueDelta: 14,
      moraleDelta: -2,
      cost: 0,
      injuryMult: 1.45,
      focus: ["aim", "fd", "entry"]
    },
    tactics: {
      id: "tactics",
      name: "Táctica & VOD Review",
      desc: "Crecimiento en UTI / IGL / CONS (+6 Fatiga · +2 Moral)",
      fatigueDelta: 6,
      moraleDelta: 2,
      cost: 0,
      injuryMult: 0.9,
      focus: ["util", "igl", "cons"]
    },
    balanced: {
      id: "balanced",
      name: "Rutina Equilibrada",
      desc: "Progreso estable hacia POT con fatiga controlada (+4 Fatiga · +1 Moral)",
      fatigueDelta: 4,
      moraleDelta: 1,
      cost: 0,
      injuryMult: 0.75,
      focus: ["aim", "util", "clutch", "cons"]
    },
    rest: {
      id: "rest",
      name: "Descanso & Psicología",
      desc: "Recuperación física y mental (-26 Fatiga · +9 Moral · Sin lesiones)",
      fatigueDelta: -26,
      moraleDelta: 9,
      cost: 0,
      injuryMult: 0.1,
      focus: ["conf"]
    },
    bootcamp: {
      id: "bootcamp",
      name: "Bootcamp Privado ($20k)",
      desc: "Doble XP hacia POT + avance acelerado de Maestría Hush (+10 Fatiga · +4 Moral)",
      fatigueDelta: 10,
      moraleDelta: 4,
      cost: 20000,
      injuryMult: 1.0,
      focus: ["aim", "fd", "clutch", "util", "cons"]
    }
  };

  const PLAYER_PLANS = {
    balanced: { label: "Equilibrado",    keys: ["aim", "util", "cons", "clutch"] },
    aim:      { label: "Duelos (AIM/FD)", keys: ["aim", "fd", "entry"] },
    iq:       { label: "Utilidad / IGL", keys: ["util", "igl", "cons"] },
    mental:   { label: "Clutch / Mental", keys: ["clutch", "conf", "cons"] },
    hush:     { label: "Maestría Hush",  keys: ["entry", "fd", "aim"], trainsHush: true }
  };

  const INJURIES_CATALOG = [
    { name: "Tendinitis de muñeca",       minW: 2, maxW: 3 },
    { name: "Sobrecarga cervical",        minW: 1, maxW: 2 },
    { name: "Fatiga visual / Migraña",    minW: 1, maxW: 1 },
    { name: "Distensión dedo índice",     minW: 2, maxW: 2 },
    { name: "Túnel carpiano leve",        minW: 3, maxW: 4 },
    { name: "Burnout competitivo",        minW: 2, maxW: 3 }
  ];

  // Registrar pools de agentes de Agentes Libres en el motor global
  if (typeof PLAYER_AGENTS === "object") {
    FREE_AGENTS_SEED.forEach(fa => {
      if (!PLAYER_AGENTS[fa.n] && fa.agents) PLAYER_AGENTS[fa.n] = fa.agents.slice();
    });
  }

  // ===== VALORACIÓN Y SALARIOS =====
  function calcPlayerValue(p) {
    const ovr = calcPlayerOvr(p);
    const potGap = Math.max(0, (p.pot || ovr) - ovr);
    const age = p.age || 21;
    const ageMult = age <= 20 ? 1.24 : age <= 23 ? 1.1 : age >= 27 ? 0.78 : 1.0;
    const base = Math.pow(Math.max(1, ovr - 68), 2.15) * 285;
    const potBonus = potGap * 11500;
    const hushBonus = ((typeof HUSH_MASTERY === "object" && HUSH_MASTERY[p.n] >= 0.9) || (p._hushMastery || 0) >= 0.9) ? 28000 : 0;
    return Math.round(((base + potBonus + hushBonus) * ageMult) / 1000) * 1000;
  }

  function calcPlayerSalary(p) {
    const ovr = calcPlayerOvr(p);
    return Math.round((2500 + Math.pow(Math.max(1, ovr - 70), 1.75) * 115) / 100) * 100;
  }

  function enrichPlayer(raw, isFreeAgent = false) {
    const ovr = calcPlayerOvr(raw);
    const gap = Math.max(0, (raw.pot || ovr) - ovr);
    const estAge = raw.age || clamp(24 - Math.round(gap * 0.55) + (raw.conf < 72 ? -2 : 0), 18, 28);
    const hushInit = (typeof HUSH_MASTERY === "object" && HUSH_MASTERY[raw.n]) ? HUSH_MASTERY[raw.n] : (raw._hushMastery || 0);
    return {
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
      sub: raw.sub ? 1 : 0,
      age: estAge,
      morale: isFreeAgent ? 74 : clamp(74 + Math.round((raw.conf - 80) * 0.35), 62, 88),
      fatigue: isFreeAgent ? 8 : 14,
      injuredWeeks: 0,
      injuryType: "",
      plan: "balanced",
      xp: 0,
      _hushMastery: hushInit,
      hushProgress: Math.round(hushInit * 100),
      deltas: { aim: 0, fd: 0, clutch: 0, entry: 0, util: 0, igl: 0, conf: 0, cons: 0 },
      salary: calcPlayerSalary(raw),
      seasonMaps: 0,
      seasonRatingSum: 0
    };
  }

  // ===== ESTADO DEL CARRER SAVE =====
  let M = null;
  let activeTab = "hub"; // hub | squad | market | calendar | finance
  let marketFilter = { source: "ALL", role: "ALL", maxPrice: 9999999, query: "", view: "players" };

  function saveCareer() {
    try {
      if (M) localStorage.setItem(SAVE_KEY, JSON.stringify(M));
      else localStorage.removeItem(SAVE_KEY);
    } catch (e) {}
  }

  function loadCareer() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.userTeam && parsed.clubs && parsed.clubs[parsed.userTeam]) {
          M = parsed;
        }
      }
    } catch (e) { M = null; }
  }

  function addInbox(tag, title, text) {
    if (!M) return;
    M.inbox.unshift({
      id: "MSG-" + Date.now() + "-" + Math.random().toString(36).slice(2, 5),
      season: M.season,
      week: M.week,
      tag,
      title,
      text
    });
    if (M.inbox.length > 35) M.inbox = M.inbox.slice(0, 35);
  }

  // ===== CONSTRUCCIÓN DE TEMPORADA (12 SEMANAS) =====
  function generateRoundRobinPairs(teams6) {
    const list = teams6.slice();
    const fixed = list[0];
    const rot = list.slice(1);
    const weeks = [];
    for (let w = 0; w < 5; w++) {
      const pairs = [[fixed, rot[0]], [rot[1], rot[4]], [rot[2], rot[3]]];
      weeks.push(pairs);
      rot.unshift(rot.pop());
    }
    return weeks;
  }

  function buildSeasonSchedule(seasonYear) {
    const userClub = M.clubs[M.userTeam];
    const userReg = userClub.reg;
    const allNames = Object.keys(M.clubs).sort((a, b) => calcRosterOvr(M.clubs[b].players, M.clubs[b].coach) - calcRosterOvr(M.clubs[a].players, M.clubs[a].coach));

    let leagueTeams = [M.userTeam];
    const sameReg = allNames.filter(t => t !== M.userTeam && M.clubs[t].reg === userReg);
    sameReg.forEach(t => { if (leagueTeams.length < 6) leagueTeams.push(t); });

    let leagueName = `Liga Regional VCT ${userReg}`;
    if (leagueTeams.length < 6) {
      // Si Pacific tiene 3 equipos, completa una Liga Pacífico-Asia con clubes de China
      leagueName = "Liga VCT Pacific-Asia";
      const extras = allNames.filter(t => !leagueTeams.includes(t) && (M.clubs[t].reg === "CHINA" || M.clubs[t].reg === "PACIFIC"));
      extras.forEach(t => { if (leagueTeams.length < 6) leagueTeams.push(t); });
    }
    if (leagueTeams.length < 6) {
      allNames.filter(t => !leagueTeams.includes(t)).forEach(t => { if (leagueTeams.length < 6) leagueTeams.push(t); });
    }

    const rrWeeks = generateRoundRobinPairs(leagueTeams.slice().sort(() => Math.random() - 0.5));
    const leagueMatches = [];
    rrWeeks.forEach((pairs, wIdx) => {
      pairs.forEach(([a, b], mIdx) => {
        leagueMatches.push({
          id: `S${seasonYear}-W${wIdx + 2}-M${mIdx + 1}`,
          week: wIdx + 2, // Semanas 2 a 6
          stage: "league",
          label: `${leagueName} · Jornada ${wIdx + 1}`,
          teamA: a,
          teamB: b,
          fmt: 3,
          played: false,
          scoreA: 0,
          scoreB: 0,
          winner: null,
          mapsLine: "",
          seriesRef: null
        });
      });
    });

    const regionalPlayoffs = [
      { id: `S${seasonYear}-RP-SF1`, week: 7, stage: "reg_po", roundKey: "SF", label: "Playoffs Regionales · Semifinal 1 (1° vs 4°)", teamA: null, teamB: null, fmt: 3, played: false, scoreA: 0, scoreB: 0, winner: null, mapsLine: "", nextId: `S${seasonYear}-RP-GF`, nextSlot: 0 },
      { id: `S${seasonYear}-RP-SF2`, week: 7, stage: "reg_po", roundKey: "SF", label: "Playoffs Regionales · Semifinal 2 (2° vs 3°)", teamA: null, teamB: null, fmt: 3, played: false, scoreA: 0, scoreB: 0, winner: null, mapsLine: "", nextId: `S${seasonYear}-RP-GF`, nextSlot: 1 },
      { id: `S${seasonYear}-RP-GF`,  week: 8, stage: "reg_po", roundKey: "GF", label: "Gran Final Regional (Bo5)",                   teamA: null, teamB: null, fmt: 5, played: false, scoreA: 0, scoreB: 0, winner: null, mapsLine: "", nextId: null, nextSlot: null }
    ];

    const mastersBracket = [
      { id: `S${seasonYear}-MS-QF1`, week: 9,  stage: "masters", roundKey: "QF", label: "VCT Masters · Cuartos 1",    teamA: null, teamB: null, fmt: 3, played: false, scoreA: 0, scoreB: 0, winner: null, mapsLine: "", nextId: `S${seasonYear}-MS-SF1`, nextSlot: 0 },
      { id: `S${seasonYear}-MS-QF2`, week: 9,  stage: "masters", roundKey: "QF", label: "VCT Masters · Cuartos 2",    teamA: null, teamB: null, fmt: 3, played: false, scoreA: 0, scoreB: 0, winner: null, mapsLine: "", nextId: `S${seasonYear}-MS-SF1`, nextSlot: 1 },
      { id: `S${seasonYear}-MS-QF3`, week: 9,  stage: "masters", roundKey: "QF", label: "VCT Masters · Cuartos 3",    teamA: null, teamB: null, fmt: 3, played: false, scoreA: 0, scoreB: 0, winner: null, mapsLine: "", nextId: `S${seasonYear}-MS-SF2`, nextSlot: 0 },
      { id: `S${seasonYear}-MS-QF4`, week: 9,  stage: "masters", roundKey: "QF", label: "VCT Masters · Cuartos 4",    teamA: null, teamB: null, fmt: 3, played: false, scoreA: 0, scoreB: 0, winner: null, mapsLine: "", nextId: `S${seasonYear}-MS-SF2`, nextSlot: 1 },
      { id: `S${seasonYear}-MS-SF1`, week: 10, stage: "masters", roundKey: "SF", label: "VCT Masters · Semifinal 1",  teamA: null, teamB: null, fmt: 3, played: false, scoreA: 0, scoreB: 0, winner: null, mapsLine: "", nextId: `S${seasonYear}-MS-GF`,  nextSlot: 0 },
      { id: `S${seasonYear}-MS-SF2`, week: 10, stage: "masters", roundKey: "SF", label: "VCT Masters · Semifinal 2",  teamA: null, teamB: null, fmt: 3, played: false, scoreA: 0, scoreB: 0, winner: null, mapsLine: "", nextId: `S${seasonYear}-MS-GF`,  nextSlot: 1 },
      { id: `S${seasonYear}-MS-GF`,  week: 11, stage: "masters", roundKey: "GF", label: "VCT Masters · Gran Final (Bo5)", teamA: null, teamB: null, fmt: 5, played: false, scoreA: 0, scoreB: 0, winner: null, mapsLine: "", nextId: null, nextSlot: null }
    ];

    // Expectativa de la directiva basada en OVR
    const myOvr = calcRosterOvr(userClub.players, userClub.coach);
    const objective = myOvr >= 88.5
      ? { id: "win_reg", label: "Ganar la Liga Regional y pelear el título de Masters" }
      : myOvr >= 85.5
        ? { id: "masters", label: "Clasificar al VCT Masters (Top 2 Regional)" }
        : { id: "playoffs", label: "Clasificar a Playoffs Regionales (Top 4)" };

    M.schedule = {
      leagueName,
      leagueTeams,
      leagueMatches,
      regionalPlayoffs,
      mastersBracket,
      regPlayoffsSeeded: false,
      mastersSeeded: false,
      regChampion: null,
      mastersChampion: null,
      objective,
      seasonClosed: false
    };
  }

  function startNewCareer(teamName) {
    const clubs = {};
    for (const t in TEAMS) {
      const meta = TEAM_META[t] || { reg: "AMERICAS", color: "#E5484D", code: t.slice(0, 3).toUpperCase() };
      const players = TEAMS[t].map(p => enrichPlayer(p, false));
      const coach = { ...COACH[t] };
      const ovr = calcRosterOvr(players, coach);
      const startBudget = Math.round((320000 + Math.max(0, ovr - 80) * 42000) / 5000) * 5000;
      const sponsorWeekly = Math.round((28000 + Math.max(0, ovr - 80) * 2400) / 500) * 500;
      clubs[t] = {
        name: t,
        reg: meta.reg,
        color: meta.color,
        code: meta.code,
        players,
        coach,
        budget: startBudget,
        sponsorWeekly
      };
    }

    const freeAgents = FREE_AGENTS_SEED.map(p => enrichPlayer(p, true));
    const freeCoaches = FREE_COACHES_SEED.map(c => ({ ...c }));

    M = {
      userTeam: teamName,
      season: 2027,
      week: 1, // 1=Pretemporada, 2-6=Liga, 7-8=Playoffs Reg, 9-11=Masters, 12=Cierre
      boardConfidence: 75,
      training: "balanced",
      clubs,
      freeAgents,
      freeCoaches,
      inbox: [],
      transferLog: [],
      financeLog: [],
      trophies: [],
      seasonHistory: [],
      lastPlayedMatch: null,
      pendingOffer: null
    };

    buildSeasonSchedule(2027);
    const club = M.clubs[teamName];
    addInbox("DIRECTIVA", `Bienvenido a ${teamName}`, `Presupuesto inicial: ${fmtMoney(club.budget)}. Objetivo de la temporada 2027: ${M.schedule.objective.label}. La ventana de fichajes está abierta.`);
    activeTab = "hub";
    saveCareer();
    renderManager();
  }

  // ===== MOTOR DE PARTIDOS EN MODO MANAGER (CON MORAL, FATIGA Y LESIONES) =====
  function getPlayerMgrMod(p) {
    // Moral: 75 es neutro. 100 -> +3.0%, 30 -> -4.5%
    const moraleMod = ((p.morale - 75) / 100) * 0.11;
    // Fatiga: <50 sin penalización; 50..100 degrada hasta -6.5%
    const fatiguePen = p.fatigue > 50 ? -((p.fatigue - 50) / 50) * 0.065 : 0;
    return clamp(moraleMod + fatiguePen, -0.09, 0.045);
  }

  function ensureHealthyLineupForAI(club) {
    // Reemplaza lesionados con suplentes sanos; si faltan, convoca canterano de emergencia
    const healthy = club.players.filter(p => !(p.injuredWeeks > 0));
    if (healthy.length < 5) {
      // Buscar agente libre barato o generar academia
      const need = 5 - healthy.length;
      for (let i = 0; i < need; i++) {
        const subName = `${club.code}_Acad${Math.floor(10 + Math.random() * 89)}`;
        club.players.push(enrichPlayer({
          n: subName, r: "Flex", aim: 75, fd: 73, clutch: 74, entry: 74, util: 75, igl: 64, conf: 65, cons: 74, pot: 82, sub: 0
        }, false));
      }
    }
    const starters = club.players.filter(p => !p.sub && !(p.injuredWeeks > 0));
    if (starters.length < 5) {
      club.players.forEach(p => { if (p.injuredWeeks > 0) p.sub = 1; });
      let activeCount = club.players.filter(p => !p.sub && !(p.injuredWeeks > 0)).length;
      for (const p of club.players) {
        if (activeCount >= 5) break;
        if (p.sub && !(p.injuredWeeks > 0)) { p.sub = 0; activeCount++; }
      }
    }
  }

  function buildTeamPayloadForEngine(clubName) {
    const club = M.clubs[clubName];
    if (clubName !== M.userTeam) ensureHealthyLineupForAI(club);
    const activePlayers = club.players
      .filter(p => !p.sub && !(p.injuredWeeks > 0))
      .slice(0, 5)
      .map(p => ({ ...p, _mgrMod: getPlayerMgrMod(p) }));

    return {
      name: clubName,
      players: activePlayers,
      coach: { ...club.coach }
    };
  }

  function simManagerSeries(teamAName, teamBName, fmt) {
    const pA = buildTeamPayloadForEngine(teamAName);
    const pB = buildTeamPayloadForEngine(teamBName);
    const vetoData = runCoachVeto(pA, pB, fmt, "AUTO");
    const needed = Math.ceil(fmt / 2);
    const maps = [];
    const seriesScore = [0, 0];

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

  // ===== EFECTOS POST-PARTIDO: MORAL, FATIGA, XP/POT Y LESIONES =====
  function applyMatchImpactToClub(clubName, series, teamIdx) {
    const club = M.clubs[clubName];
    const isUser = clubName === M.userTeam;
    const won = (teamIdx === 0 && series.seriesScore[0] > series.seriesScore[1]) ||
                (teamIdx === 1 && series.seriesScore[1] > series.seriesScore[0]);
    const mapsPlayed = series.maps.length;
    const S = computeSeriesStats(series);

    const byName = {};
    for (const id in S) {
      if (S[id].ti === teamIdx) byName[S[id].u.p.n] = S[id];
    }

    club.players.forEach(p => {
      const perf = byName[p.n];
      if (perf) {
        const rat = parseFloat(perf.rating) || 1.0;
        p.seasonMaps = (p.seasonMaps || 0) + mapsPlayed;
        p.seasonRatingSum = (p.seasonRatingSum || 0) + (rat * mapsPlayed);

        // Fatiga por serie jugada (Bo5 cansa mucho más que un 2-0 rápido)
        const fatGain = Math.round(mapsPlayed * 6.5 * (1 - (club.coach.disc - 75) / 180));
        p.fatigue = clamp(p.fatigue + fatGain, 0, 100);

        // Moral por resultado y actuación individual
        const moraleDelta = (won ? 5 : -5) + Math.round((rat - 1.0) * 14);
        p.morale = clamp(p.morale + moraleDelta, 15, 100);

        // Experiencia en escenario Tier 1 sube CONF en rookies
        if (p.conf < 82 && Math.random() < (won ? 0.55 : 0.25)) {
          p.conf = Math.min(95, p.conf + 1);
          p.deltas.conf = (p.deltas.conf || 0) + 1;
        }

        // XP por partido (crecimiento hacia POT)
        const matchXp = (won ? 14 : 8) + Math.max(0, (rat - 0.95) * 26);
        grantPlayerProgression(p, club.coach, matchXp, ["aim", "clutch", "cons", "fd"], isUser);

        // Chequeo de lesión post-partido si está fatigado
        if (p.fatigue >= 66 && !(p.injuredWeeks > 0)) {
          const discMit = 1 - Math.max(0, club.coach.disc - 75) / 140;
          const risk = ((p.fatigue - 62) / 38) * 0.16 * discMit;
          if (Math.random() < risk) {
            triggerInjury(club, p, isUser);
          }
        }
      } else if (!(p.injuredWeeks > 0)) {
        // Suplente descansando
        p.fatigue = clamp(p.fatigue - 12, 0, 100);
        if (calcPlayerOvr(p) >= 84) p.morale = clamp(p.morale - 3, 20, 100);
      }
    });

    // Premio económico por victoria y confianza directiva para el usuario
    if (isUser) {
      if (won) {
        const winBonus = series.format === 5 ? 60000 : 15000;
        club.budget += winBonus;
        M.financeLog.unshift({ s: M.season, w: M.week, concept: `Premio victoria (${series.maps[0].teams[1 - teamIdx].name})`, amount: winBonus });
        M.boardConfidence = clamp(M.boardConfidence + 4, 10, 100);
      } else {
        M.boardConfidence = clamp(M.boardConfidence - 3, 10, 100);
      }
    }
  }

  function triggerInjury(club, p, isUser) {
    const inj = INJURIES_CATALOG[Math.floor(Math.random() * INJURIES_CATALOG.length)];
    const weeks = inj.minW + Math.floor(Math.random() * (inj.maxW - inj.minW + 1));
    p.injuredWeeks = weeks;
    p.injuryType = inj.name;
    p.morale = clamp(p.morale - 10, 15, 100);
    p.sub = 1; // Sale automáticamente del quinteto titular

    if (isUser) {
      // Si hay un suplente sano, avisar y promover automáticamente si hay solo 4 titulares
      const healthySub = club.players.find(x => x.sub && !(x.injuredWeeks > 0) && x.n !== p.n);
      let extra = "No tienes suplentes sanos: ve a Plantilla o Fichajes antes del próximo partido.";
      if (healthySub) {
        healthySub.sub = 0;
        extra = `${healthySub.n} ha ingresado automáticamente al quinteto titular.`;
      }
      addInbox("MÉDICO", `LESIÓN: ${p.n} (${weeks} sem.)`, `${p.n} sufrió ${inj.name} por sobrecarga (Fatiga ${p.fatigue}%). Baja estimada: ${weeks} semana(s). ${extra}`);
    }
  }

  // ===== PROGRESIÓN HACIA POT + ENTRENAMIENTO DE HUSH =====
  function grantPlayerProgression(p, coach, rawXp, preferredKeys, isUser) {
    const ovr = calcPlayerOvr(p);
    const potGap = (p.pot || ovr) - ovr;

    // Entrenamiento de Maestría Hush si el jugador lo tiene seleccionado
    const planObj = PLAYER_PLANS[p.plan || "balanced"] || PLAYER_PLANS.balanced;
    if (planObj.trainsHush && p._hushMastery < 1.0) {
      const gain = Math.round((rawXp * 0.65) * (1 + (coach.dev - 75) / 100));
      p.hushProgress = clamp((p.hushProgress || 0) + gain, 0, 100);
      if (p.hushProgress >= 100 && p._hushMastery < 1.0) {
        p._hushMastery = 1.0;
        if (typeof PLAYER_AGENTS === "object") {
          const curPool = PLAYER_AGENTS[p.n] || [];
          if (!curPool.includes("Hush")) PLAYER_AGENTS[p.n] = ["Hush", ...curPool];
        }
        if (isUser) {
          addInbox("PROGRESO", `${p.n} domina a Hush`, `${p.n} completó la Maestría de Hush (100%). Ya puede seleccionarlo con bono completo en el draft.`);
        }
      } else if (p.hushProgress >= 55 && p._hushMastery < 0.55) {
        p._hushMastery = 0.55;
      }
    }

    if (potGap <= 0 && p.age >= 25) return;

    const devMult = 0.72 + (coach.dev - 70) * 0.022;
    const ageMult = p.age <= 20 ? 1.45 : p.age <= 22 ? 1.2 : p.age <= 25 ? 0.9 : 0.45;
    const gapMult = potGap > 0 ? (0.75 + Math.min(1.6, potGap * 0.16)) : 0.2;
    const moraleMult = p.morale >= 80 ? 1.15 : p.morale <= 45 ? 0.65 : 1.0;

    p.xp = (p.xp || 0) + (rawXp * devMult * ageMult * gapMult * moraleMult);

    while (p.xp >= 100) {
      p.xp -= 100;
      const curOvr = calcPlayerOvr(p);
      if (curOvr >= (p.pot || 95)) break;

      const candidateKeys = [...new Set([...planObj.keys, ...preferredKeys])];
      // Elegir un atributo del foco que esté por debajo del techo POT+2
      const valid = candidateKeys.filter(k => typeof p[k] === "number" && p[k] < Math.min(97, (p.pot || 94) + 2));
      if (!valid.length) break;
      const chosen = valid[Math.floor(Math.random() * valid.length)];
      p[chosen] = Math.min(97, p[chosen] + 1);
      p.deltas[chosen] = (p.deltas[chosen] || 0) + 1;
      p.salary = calcPlayerSalary(p);

      if (isUser) {
        addInbox("PROGRESO", `${p.n} sube +1 ${chosen.toUpperCase()}`, `Evolución hacia su potencial (OVR ${calcPlayerOvr(p)} / POT ${p.pot}) gracias al plan ${planObj.label} y DT ${coach.n}.`);
      }
    }
  }

  function runWeeklyTrainingAndHealth() {
    for (const clubName in M.clubs) {
      const club = M.clubs[clubName];
      const isUser = clubName === M.userTeam;
      const mode = isUser ? (TRAINING_MODES[M.training] || TRAINING_MODES.balanced) : TRAINING_MODES.balanced;

      if (isUser && mode.cost > 0) {
        if (club.budget >= mode.cost) {
          club.budget -= mode.cost;
          M.financeLog.unshift({ s: M.season, w: M.week, concept: mode.name, amount: -mode.cost });
        }
      }

      // Ingresos y salarios semanales
      const payroll = club.players.reduce((s, p) => s + (p.salary || 3500), 0);
      const net = club.sponsorWeekly - payroll;
      club.budget += net;
      if (isUser) {
        M.financeLog.unshift({ s: M.season, w: M.week, concept: `Balance Semanal (Sponsors ${fmtMoney(club.sponsorWeekly)} - Nómina ${fmtMoney(payroll)})`, amount: net });
        if (M.financeLog.length > 40) M.financeLog = M.financeLog.slice(0, 40);
        if (club.budget < 0) {
          M.boardConfidence = clamp(M.boardConfidence - 6, 5, 100);
          addInbox("FINANZAS", "Alerta de Déficit", `La caja del club cayó en negativo (${fmtMoney(club.budget)}). Vende jugadores o reduce la masa salarial.`);
        }
      }

      club.players.forEach(p => {
        // Recuperación de lesión
        if (p.injuredWeeks > 0) {
          p.injuredWeeks--;
          p.fatigue = clamp(p.fatigue - 22, 0, 100);
          if (p.injuredWeeks === 0) {
            const prevInj = p.injuryType;
            p.injuryType = "";
            p.morale = clamp(p.morale + 6, 20, 100);
            if (isUser) {
              addInbox("MÉDICO", `ALTA MÉDICA: ${p.n}`, `${p.n} se recuperó de su ${prevInj} y está disponible para volver al quinteto titular.`);
            }
          }
          return;
        }

        // Fatiga y moral semanal por entrenamiento
        const discFactor = 1 - Math.max(0, club.coach.disc - 75) / 160;
        const fDelta = mode.fatigueDelta > 0 ? Math.round(mode.fatigueDelta * discFactor) : mode.fatigueDelta;
        p.fatigue = clamp(p.fatigue + fDelta, 0, 100);
        p.morale = clamp(p.morale + mode.moraleDelta, 15, 100);

        // XP semanal hacia POT
        const baseXp = mode.id === "bootcamp" ? 36 : mode.id === "scrims" ? 24 : mode.id === "tactics" ? 21 : mode.id === "rest" ? 6 : 18;
        grantPlayerProgression(p, club.coach, baseXp * (p.sub ? 0.65 : 1.0), mode.focus, isUser);

        // Riesgo de lesión en entrenamientos intensos con fatiga alta
        if (p.fatigue >= 72 && mode.injuryMult > 0.2) {
          const injChance = ((p.fatigue - 68) / 32) * 0.09 * mode.injuryMult * discFactor;
          if (Math.random() < injChance) {
            triggerInjury(club, p, isUser);
          }
        }
      });
    }
  }

  // ===== TABLA DE POSICIONES Y SEEDING DE PLAYOFFS / MASTERS =====
  function computeLeagueStandings() {
    const tbl = {};
    M.schedule.leagueTeams.forEach(t => {
      tbl[t] = { team: t, pj: 0, g: 0, p: 0, mw: 0, ml: 0, pts: 0 };
    });
    M.schedule.leagueMatches.filter(m => m.played).forEach(m => {
      const a = tbl[m.teamA], b = tbl[m.teamB];
      a.pj++; b.pj++;
      a.mw += m.scoreA; a.ml += m.scoreB;
      b.mw += m.scoreB; b.ml += m.scoreA;
      if (m.winner === m.teamA) { a.g++; a.pts += 3; b.p++; }
      else { b.g++; b.pts += 3; a.p++; }
    });
    return Object.values(tbl).sort((x, y) => {
      if (y.pts !== x.pts) return y.pts - x.pts;
      const md = (y.mw - y.ml) - (x.mw - x.ml);
      if (md !== 0) return md;
      return calcRosterOvr(M.clubs[y.team].players, M.clubs[y.team].coach) - calcRosterOvr(M.clubs[x.team].players, M.clubs[x.team].coach);
    });
  }

  function seedRegionalPlayoffsIfReady() {
    const sc = M.schedule;
    if (sc.regPlayoffsSeeded) return;
    if (sc.leagueMatches.some(m => !m.played)) return;

    const st = computeLeagueStandings();
    sc.regionalPlayoffs[0].teamA = st[0].team;
    sc.regionalPlayoffs[0].teamB = st[3].team;
    sc.regionalPlayoffs[1].teamA = st[1].team;
    sc.regionalPlayoffs[1].teamB = st[2].team;
    sc.regPlayoffsSeeded = true;

    const myPos = st.findIndex(x => x.team === M.userTeam) + 1;
    if (myPos <= 4) {
      addInbox("LIGA", `Clasificados a Playoffs Regionales (#${myPos})`, `${M.userTeam} terminó #${myPos} en la tabla. Semifinales Bo3 en la Semana 7.`);
    } else {
      addInbox("LIGA", `Eliminados en Fase Regular (#${myPos})`, `${M.userTeam} quedó fuera del Top 4. Usa las semanas restantes para entrenar jóvenes y preparar fichajes.`);
      M.boardConfidence = clamp(M.boardConfidence - 10, 10, 100);
    }
  }

  function seedMastersIfReady() {
    const sc = M.schedule;
    if (sc.mastersSeeded) return;
    const gf = sc.regionalPlayoffs[2];
    if (!gf.played) return;

    sc.regChampion = gf.winner;
    const runnerUp = gf.winner === gf.teamA ? gf.teamB : gf.teamA;

    // Premios de Playoffs Regionales
    if (sc.regChampion === M.userTeam) {
      M.clubs[M.userTeam].budget += 120000;
      M.trophies.push({ season: M.season, title: sc.leagueName });
      M.boardConfidence = clamp(M.boardConfidence + 14, 10, 100);
      M.financeLog.unshift({ s: M.season, w: M.week, concept: `Campeón ${sc.leagueName}`, amount: 120000 });
      addInbox("TÍTULO", `CAMPEONES DE ${sc.leagueName.toUpperCase()}`, `Premio de $120,000 acreditado y clasificación directa al VCT Masters Internacional.`);
    } else if (runnerUp === M.userTeam) {
      M.clubs[M.userTeam].budget += 65000;
      M.boardConfidence = clamp(M.boardConfidence + 7, 10, 100);
      M.financeLog.unshift({ s: M.season, w: M.week, concept: `Subcampeón ${sc.leagueName}`, amount: 65000 });
      addInbox("MASTERS", `Clasificados al VCT Masters (Subcampeón)`, `Premio de $65,000 acreditado. ${M.userTeam} entra al cuadro de 8 mejores del mundo.`);
    }

    // Armar Top 8 Global: Top 2 de la liga del usuario + 6 mejores de las otras regiones
    const pool = [sc.regChampion, runnerUp];
    const others = Object.keys(M.clubs)
      .filter(t => !pool.includes(t) && !sc.leagueTeams.includes(t))
      .sort((a, b) => calcRosterOvr(M.clubs[b].players, M.clubs[b].coach) - calcRosterOvr(M.clubs[a].players, M.clubs[a].coach));
    others.forEach(t => { if (pool.length < 8) pool.push(t); });
    const rest = Object.keys(M.clubs).filter(t => !pool.includes(t));
    rest.forEach(t => { if (pool.length < 8) pool.push(t); });

    const qf = sc.mastersBracket;
    qf[0].teamA = pool[0]; qf[0].teamB = pool[7];
    qf[1].teamA = pool[3]; qf[1].teamB = pool[4];
    qf[2].teamA = pool[1]; qf[2].teamB = pool[6];
    qf[3].teamA = pool[2]; qf[3].teamB = pool[5];
    sc.mastersSeeded = true;
  }

  function getMatchesForWeek(w) {
    const sc = M.schedule;
    return [
      ...sc.leagueMatches.filter(m => m.week === w),
      ...sc.regionalPlayoffs.filter(m => m.week === w && m.teamA && m.teamB),
      ...sc.mastersBracket.filter(m => m.week === w && m.teamA && m.teamB)
    ];
  }

  function maybeGenerateIncomingOffer() {
    if (M.pendingOffer || Math.random() > 0.28) return;
    const myClub = M.clubs[M.userTeam];
    if (myClub.players.length <= 5) return; // Solo llegan ofertas si tienes margen o un crack destacado
    const candidates = myClub.players.filter(p => !(p.injuredWeeks > 0));
    if (!candidates.length) return;
    const target = candidates[Math.floor(Math.random() * candidates.length)];
    const otherClubs = Object.keys(M.clubs).filter(c => c !== M.userTeam && M.clubs[c].budget >= calcPlayerValue(target) * 0.9);
    if (!otherClubs.length) return;
    const buyer = otherClubs[Math.floor(Math.random() * otherClubs.length)];
    const amount = Math.round((calcPlayerValue(target) * (1.05 + Math.random() * 0.22)) / 1000) * 1000;

    M.pendingOffer = { buyer, player: target.n, amount };
    addInbox("OFERTA", `Oferta de ${buyer} por ${target.n}`, `${buyer} ofrece ${fmtMoney(amount)} por el traspaso inmediato de ${target.n}. Revisa la pestaña Resumen para aceptar o rechazar.`);
  }

  function closeCurrentSeason() {
    const sc = M.schedule;
    if (sc.seasonClosed) return;
    sc.seasonClosed = true;

    const gfMasters = sc.mastersBracket[6];
    if (gfMasters && gfMasters.played) {
      sc.mastersChampion = gfMasters.winner;
      if (sc.mastersChampion === M.userTeam) {
        M.clubs[M.userTeam].budget += 250000;
        M.trophies.push({ season: M.season, title: `VCT Masters ${M.season}` });
        M.boardConfidence = clamp(M.boardConfidence + 20, 10, 100);
        M.financeLog.unshift({ s: M.season, w: 12, concept: `Campeón VCT Masters ${M.season}`, amount: 250000 });
        addInbox("CAMPEÓN", `CAMPEONES DEL VCT MASTERS ${M.season}`, `Título internacional histórico para ${M.userTeam}. Premio de $250,000 ingresado a caja.`);
      }
    }

    const st = computeLeagueStandings();
    const myPos = st.findIndex(x => x.team === M.userTeam) + 1;
    M.seasonHistory.unshift({
      season: M.season,
      leaguePos: myPos,
      regChamp: sc.regChampion || "-",
      mastersChamp: sc.mastersChampion || "-",
      ovrEnd: calcRosterOvr(M.clubs[M.userTeam].players, M.clubs[M.userTeam].coach)
    });

    // Envejecimiento + evolución/declive de fin de año en todos los clubes
    for (const cName in M.clubs) {
      M.clubs[cName].players.forEach(p => {
        p.age = (p.age || 21) + 1;
        p.fatigue = clamp(p.fatigue - 45, 5, 40);
        p.injuredWeeks = 0;
        p.injuryType = "";
        if (p.age >= 28 && Math.random() < 0.55) {
          p.aim = Math.max(70, p.aim - 1);
          p.entry = Math.max(65, p.entry - 1);
          p.deltas.aim = (p.deltas.aim || 0) - 1;
        }
        p.seasonMaps = 0;
        p.seasonRatingSum = 0;
      });
    }
    M.freeAgents.forEach(p => { p.age = (p.age || 22) + 1; });

    addInbox("CIERRE", `Fin de Temporada ${M.season}`, `Resumen archivado: #${myPos} en Liga · Campeón Regional: ${sc.regChampion} · Campeón Masters: ${sc.mastersChampion || "-"}. Pulsa "Iniciar Temporada ${M.season + 1}" cuando estés listo.`);
  }

  function advanceWeekInternal(watchUserMatchLive) {
    if (!M) return;
    if (M.week >= 12) {
      // Iniciar nueva temporada
      M.season++;
      M.week = 1;
      M.pendingOffer = null;
      buildSeasonSchedule(M.season);
      addInbox("TEMPORADA", `Comienza la Temporada ${M.season}`, `Nuevo objetivo de la directiva: ${M.schedule.objective.label}. Ventana de fichajes activa.`);
      saveCareer();
      renderManager();
      return;
    }

    const myClub = M.clubs[M.userTeam];
    const weekMatches = getMatchesForWeek(M.week);
    const userMatch = weekMatches.find(m => !m.played && (m.teamA === M.userTeam || m.teamB === M.userTeam));

    // Validar que el usuario tenga 5 titulares sanos antes de jugar partido oficial
    if (userMatch) {
      const healthyStarters = myClub.players.filter(p => !p.sub && !(p.injuredWeeks > 0));
      if (healthyStarters.length < 5) {
        alert(`Necesitas exactamente 5 titulares sanos para disputar ${userMatch.label} (tienes ${healthyStarters.length}). Rota suplentes en Plantilla, ficha un Agente Libre o convoca un canterano.`);
        activeTab = "squad";
        renderManager();
        return;
      }
    }

    // 1. Ejecutar entrenamiento semanal, finanzas y recuperación de lesiones
    runWeeklyTrainingAndHealth();

    // 2. Simular todos los partidos programados esta semana
    let userSeriesPlayed = null;
    weekMatches.forEach(m => {
      if (m.played || !m.teamA || !m.teamB) return;
      const s = simManagerSeries(m.teamA, m.teamB, m.fmt);
      m.scoreA = s.seriesScore[0];
      m.scoreB = s.seriesScore[1];
      m.winner = m.scoreA > m.scoreB ? m.teamA : m.teamB;
      m.played = true;
      m.mapsLine = s.maps.map(mp => `${mp.mapName.slice(0, 3).toUpperCase()} ${mp.sc[0]}-${mp.sc[1]}`).join(" · ");

      applyMatchImpactToClub(m.teamA, s, 0);
      applyMatchImpactToClub(m.teamB, s, 1);

      // Avanzar ganador en brackets de Playoffs / Masters
      if (m.nextId) {
        const list = m.stage === "reg_po" ? M.schedule.regionalPlayoffs : M.schedule.mastersBracket;
        const nextM = list.find(x => x.id === m.nextId);
        if (nextM) {
          if (m.nextSlot === 0) nextM.teamA = m.winner;
          else nextM.teamB = m.winner;
        }
      }

      if (m.teamA === M.userTeam || m.teamB === M.userTeam) {
        userSeriesPlayed = { match: m, series: s };
        M.lastPlayedMatch = {
          label: m.label,
          teamA: m.teamA,
          teamB: m.teamB,
          scoreA: m.scoreA,
          scoreB: m.scoreB,
          mapsLine: m.mapsLine,
          fmt: m.fmt
        };
        window._mgrLastSeries = { teamA: m.teamA, teamB: m.teamB, series: s, label: `Temporada ${M.season} · ${m.label}` };
      }
    });

    // 3. Evaluar si se sembraron Playoffs Regionales o Masters
    seedRegionalPlayoffsIfReady();
    seedMastersIfReady();
    maybeGenerateIncomingOffer();

    // 4. Avanzar reloj semanal
    M.week++;
    if (M.week === 12) {
      closeCurrentSeason();
    }

    saveCareer();
    renderManager();

    // Si el usuario eligió "Jugar En Vivo", abrir la serie directo en el Visor Broadcast en Auto-Play
    if (watchUserMatchLive && userSeriesPlayed && typeof window.loadExternalSeriesIntoViewer === "function") {
      window.loadExternalSeriesIntoViewer(
        userSeriesPlayed.match.teamA,
        userSeriesPlayed.match.teamB,
        userSeriesPlayed.series,
        true,
        `MODO MANAGER ${M.season} · ${userSeriesPlayed.match.label} (Bo${userSeriesPlayed.match.fmt})`
      );
    }
  }

  // ===== ACCIONES DE INTERFAZ (GLOBALES window.mgr*) =====
  window.mgrStartCareer = function (teamName) {
    if (!TEAMS[teamName]) return;
    startNewCareer(teamName);
  };

  window.mgrResetCareer = function () {
    if (!confirm("¿Reiniciar la carrera actual y volver a la selección de club?")) return;
    M = null;
    window._mgrLastSeries = null;
    saveCareer();
    renderManager();
  };

  window.mgrSwitchTab = function (tab) {
    activeTab = tab;
    renderManager();
  };

  window.mgrSetTraining = function (modeId) {
    if (!M || !TRAINING_MODES[modeId]) return;
    M.training = modeId;
    saveCareer();
    renderManager();
  };

  window.mgrSetPlayerPlan = function (idx, planId) {
    if (!M || !PLAYER_PLANS[planId]) return;
    const p = M.clubs[M.userTeam].players[idx];
    if (!p) return;
    p.plan = planId;
    saveCareer();
    renderManager();
  };

  window.mgrToggleStarter = function (idx) {
    if (!M) return;
    const roster = M.clubs[M.userTeam].players;
    const target = roster[idx];
    if (!target) return;
    if (target.injuredWeeks > 0) {
      alert(`${target.n} está lesionado (${target.injuryType}) por ${target.injuredWeeks} semana(s) y no puede ser titular.`);
      return;
    }
    if (target.sub) {
      const activeStarters = roster.filter(p => !p.sub && !(p.injuredWeeks > 0));
      if (activeStarters.length >= 5) {
        activeStarters[activeStarters.length - 1].sub = 1;
      }
      target.sub = 0;
      target.morale = clamp(target.morale + 5, 15, 100);
    } else {
      const healthySub = roster.find((p, i) => p.sub && !(p.injuredWeeks > 0) && i !== idx);
      if (healthySub) {
        healthySub.sub = 0;
        target.sub = 1;
      } else {
        alert("No tienes otro suplente sano disponible para intercambiar.");
        return;
      }
    }
    saveCareer();
    renderManager();
  };

  window.mgrPhysio = function (idx) {
    if (!M) return;
    const club = M.clubs[M.userTeam];
    const p = club.players[idx];
    if (!p || !(p.injuredWeeks > 0)) return;
    const cost = 15000;
    if (club.budget < cost) {
      alert("Presupuesto insuficiente para fisioterapia privada ($15,000).");
      return;
    }
    club.budget -= cost;
    p.injuredWeeks = Math.max(0, p.injuredWeeks - 1);
    p.fatigue = clamp(p.fatigue - 15, 0, 100);
    M.financeLog.unshift({ s: M.season, w: M.week, concept: `Fisioterapia privada (${p.n})`, amount: -cost });
    if (p.injuredWeeks === 0) {
      p.injuryType = "";
      addInbox("MÉDICO", `Recuperación acelerada: ${p.n}`, `La fisioterapia permitió el alta médica inmediata de ${p.n}.`);
    }
    saveCareer();
    renderManager();
  };

  window.mgrCallAcademySub = function () {
    if (!M) return;
    const club = M.clubs[M.userTeam];
    const idx = club.players.length + 1;
    const newAcad = enrichPlayer({
      n: `${club.code}_Youth${idx}`,
      r: "Flex",
      aim: 76, fd: 74, clutch: 75, entry: 75, util: 76, igl: 65, conf: 62, cons: 74, pot: 86,
      age: 18, sub: 0
    }, false);
    const activeCount = club.players.filter(p => !p.sub && !(p.injuredWeeks > 0)).length;
    newAcad.sub = activeCount >= 5 ? 1 : 0;
    club.players.push(newAcad);
    addInbox("ACADEMIA", `Promovido ${newAcad.n}`, `Jugador juvenil de academia (OVR ${calcPlayerOvr(newAcad)} / POT ${newAcad.pot}) ascendido sin coste de traspaso.`);
    saveCareer();
    renderManager();
  };

  window.mgrSellPlayer = function (idx) {
    if (!M) return;
    const club = M.clubs[M.userTeam];
    if (club.players.length <= 5) {
      alert("Debes mantener al menos 5 jugadores en tu plantilla antes de vender.");
      return;
    }
    const p = club.players[idx];
    if (!p) return;
    const sellPrice = Math.round((calcPlayerValue(p) * 0.85) / 1000) * 1000;
    if (!confirm(`¿Vender a ${p.n} al mercado libre por ${fmtMoney(sellPrice)}?`)) return;

    club.players.splice(idx, 1);
    p.sub = 0;
    M.freeAgents.unshift(p);
    club.budget += sellPrice;
    M.transferLog.unshift({ s: M.season, w: M.week, type: "VENTA", player: p.n, from: M.userTeam, to: "Mercado Libre", fee: sellPrice });
    M.financeLog.unshift({ s: M.season, w: M.week, concept: `Venta de ${p.n}`, amount: sellPrice });
    addInbox("FICHAJE", `Venta completada: ${p.n}`, `Se ingresaron ${fmtMoney(sellPrice)} por la salida de ${p.n}.`);
    saveCareer();
    renderManager();
  };

  window.mgrRespondOffer = function (accept) {
    if (!M || !M.pendingOffer) return;
    const off = M.pendingOffer;
    const club = M.clubs[M.userTeam];
    M.pendingOffer = null;

    if (accept) {
      if (club.players.length <= 5) {
        alert("No puedes aceptar la venta porque te quedarías con menos de 5 jugadores.");
        saveCareer();
        renderManager();
        return;
      }
      const idx = club.players.findIndex(p => p.n === off.player);
      if (idx >= 0) {
        const [sold] = club.players.splice(idx, 1);
        sold.sub = 1;
        M.clubs[off.buyer].players.push(sold);
        M.clubs[off.buyer].budget = Math.max(0, M.clubs[off.buyer].budget - off.amount);
        club.budget += off.amount;
        M.transferLog.unshift({ s: M.season, w: M.week, type: "VENTA", player: sold.n, from: M.userTeam, to: off.buyer, fee: off.amount });
        M.financeLog.unshift({ s: M.season, w: M.week, concept: `Traspaso de ${sold.n} a ${off.buyer}`, amount: off.amount });
        addInbox("FICHAJE", `${sold.n} transferido a ${off.buyer}`, `Ingresaste ${fmtMoney(off.amount)} por el traspaso.`);
      }
    } else {
      addInbox("FICHAJE", `Oferta rechazada por ${off.player}`, `Rechazaste ${fmtMoney(off.amount)} de ${off.buyer}.`);
    }
    saveCareer();
    renderManager();
  };

  window.mgrSignFreeAgent = function (faIdx) {
    if (!M) return;
    const club = M.clubs[M.userTeam];
    const fa = M.freeAgents[faIdx];
    if (!fa) return;
    const signBonus = Math.round((calcPlayerValue(fa) * 0.35) / 1000) * 1000;
    if (club.budget < signBonus) {
      alert(`Necesitas ${fmtMoney(signBonus)} de prima de fichaje para contratar a ${fa.n}.`);
      return;
    }
    club.budget -= signBonus;
    M.freeAgents.splice(faIdx, 1);
    const activeCount = club.players.filter(p => !p.sub && !(p.injuredWeeks > 0)).length;
    fa.sub = activeCount >= 5 ? 1 : 0;
    fa.morale = 84;
    club.players.push(fa);
    M.transferLog.unshift({ s: M.season, w: M.week, type: "FICHAJE", player: fa.n, from: "Agente Libre", to: M.userTeam, fee: signBonus });
    M.financeLog.unshift({ s: M.season, w: M.week, concept: `Prima de fichaje (${fa.n})`, amount: -signBonus });
    addInbox("FICHAJE", `Nuevo fichaje: ${fa.n}`, `${fa.n} (OVR ${calcPlayerOvr(fa)} / POT ${fa.pot}) se une a ${M.userTeam} por ${fmtMoney(signBonus)} de prima.`);
    saveCareer();
    renderManager();
  };

  window.mgrBuyFromClub = function (sellerName, playerName) {
    if (!M || sellerName === M.userTeam) return;
    const buyer = M.clubs[M.userTeam];
    const seller = M.clubs[sellerName];
    if (!seller) return;
    const idx = seller.players.findIndex(p => p.n === playerName);
    if (idx < 0) return;
    const target = seller.players[idx];
    const buyout = Math.round((calcPlayerValue(target) * 1.15) / 1000) * 1000;

    if (buyer.budget < buyout) {
      alert(`Presupuesto insuficiente. La cláusula de ${target.n} es ${fmtMoney(buyout)} y tienes ${fmtMoney(buyer.budget)}.`);
      return;
    }
    if (!confirm(`¿Pagar ${fmtMoney(buyout)} a ${sellerName} por ${target.n} (OVR ${calcPlayerOvr(target)} / POT ${target.pot})?`)) return;

    buyer.budget -= buyout;
    seller.budget += buyout;
    seller.players.splice(idx, 1);

    // Si el club vendedor queda con <5 jugadores, ficha un agente libre automáticamente
    if (seller.players.length < 5) {
      if (M.freeAgents.length) {
        const rep = M.freeAgents.shift();
        rep.sub = 0;
        seller.players.push(rep);
      } else {
        ensureHealthyLineupForAI(seller);
      }
    }

    const activeCount = buyer.players.filter(p => !p.sub && !(p.injuredWeeks > 0)).length;
    target.sub = activeCount >= 5 ? 1 : 0;
    target.morale = 86;
    buyer.players.push(target);

    M.transferLog.unshift({ s: M.season, w: M.week, type: "FICHAJE", player: target.n, from: sellerName, to: M.userTeam, fee: buyout });
    M.financeLog.unshift({ s: M.season, w: M.week, concept: `Fichaje de ${target.n} (${sellerName})`, amount: -buyout });
    addInbox("FICHAJE", `BOMBAZO: ${target.n} ficha por ${M.userTeam}`, `Traspaso cerrado con ${sellerName} por ${fmtMoney(buyout)}.`);
    saveCareer();
    renderManager();
  };

  window.mgrHireCoach = function (coachIdx) {
    if (!M) return;
    const club = M.clubs[M.userTeam];
    const c = M.freeCoaches[coachIdx];
    if (!c) return;
    if (club.budget < c.fee) {
      alert(`Presupuesto insuficiente para contratar a DT ${c.n} (${fmtMoney(c.fee)}).`);
      return;
    }
    club.budget -= c.fee;
    const oldCoach = { ...club.coach, fee: 45000 };
    M.freeCoaches.splice(coachIdx, 1);
    M.freeCoaches.push(oldCoach);
    club.coach = { n: c.n, macro: c.macro, micro: c.micro, adapt: c.adapt, dev: c.dev, disc: c.disc };
    M.financeLog.unshift({ s: M.season, w: M.week, concept: `Contratación DT ${c.n}`, amount: -c.fee });
    addInbox("STAFF", `Nuevo Head Coach: ${c.n}`, `${c.n} reemplaza a ${oldCoach.n} (MAC ${c.macro} · ADP ${c.adapt} · DEV ${c.dev}).`);
    saveCareer();
    renderManager();
  };

  window.mgrAdvanceWeek = function (liveMode) {
    advanceWeekInternal(!!liveMode);
  };

  window.mgrOpenLastBoxscore = function (autoPlay) {
    if (!window._mgrLastSeries || typeof window.loadExternalSeriesIntoViewer !== "function") return;
    const ref = window._mgrLastSeries;
    window.loadExternalSeriesIntoViewer(ref.teamA, ref.teamB, ref.series, !!autoPlay, ref.label);
  };

  window.mgrSetMarketFilter = function (key, val) {
    marketFilter[key] = val;
    renderManager();
  };

  // ===== RENDER DE PANTALLAS =====
  function renderClubSelectScreen() {
    const allClubs = Object.keys(TEAMS).sort((a, b) => parseFloat(getTeamOvr(b)) - parseFloat(getTeamOvr(a)));
    return `
      <div class="box-head">
        <div>
          <h2>Modo Manager VCT 2027 · Elige tu Franquicia</h2>
          <small class="mut">Gestiona presupuesto, fichajes, progresión hacia POT, entrenamientos, moral, fatiga y lesiones a lo largo de múltiples temporadas.</small>
        </div>
        <span class="mono mut" style="font-size:11px">NUEVA CARRERA · 21 CLUBES DISPONIBLES</span>
      </div>

      <div class="mgr-club-grid">
        ${allClubs.map(name => {
          const meta = TEAM_META[name] || { reg: "VCT", color: "#E5484D" };
          const ovr = parseFloat(getTeamOvr(name));
          const avgPot = (TEAMS[name].reduce((s, p) => s + p.pot, 0) / TEAMS[name].length).toFixed(1);
          const budget = Math.round((320000 + Math.max(0, ovr - 80) * 42000) / 5000) * 5000;
          return `<div class="mgr-club-card" style="border-top:2px solid ${mEsc(meta.color)}">
            <div class="mgr-club-top">
              ${renderTeamLogo(name, "mini-team-logo")}
              <div>
                <b>${mEsc(name)}</b>
                <small class="mono mut">${meta.reg} · DT ${mEsc(COACH[name].n)}</small>
              </div>
            </div>
            <div class="mgr-club-stats mono">
              <span>OVR <b>${ovr.toFixed(1)}</b></span>
              <span>POT <b>${avgPot}</b></span>
              <span>CAJA <b class="kd-pos">${fmtMoney(budget)}</b></span>
            </div>
            <button type="button" class="p mono" style="width:100%;justify-content:center;padding:6px" onclick="mgrStartCareer('${mEsc(name)}')">Dirigir Club</button>
          </div>`;
        }).join("")}
      </div>`;
  }

  function getWeekPhaseName(w) {
    if (w === 1) return "PRETEMPORADA & MERCADO";
    if (w <= 6) return `LIGA REGIONAL · JORNADA ${w - 1}/5`;
    if (w === 7) return "PLAYOFFS REGIONALES · SEMIFINALES";
    if (w === 8) return "PLAYOFFS REGIONALES · GRAN FINAL";
    if (w === 9) return "VCT MASTERS · CUARTOS DE FINAL";
    if (w === 10) return "VCT MASTERS · SEMIFINALES";
    if (w === 11) return "VCT MASTERS · GRAN FINAL";
    return "CIERRE DE TEMPORADA";
  }

  function renderHubTab() {
    const club = M.clubs[M.userTeam];
    const weekMatches = getMatchesForWeek(M.week);
    const nextMatch = weekMatches.find(m => !m.played && (m.teamA === M.userTeam || m.teamB === M.userTeam));
    const injured = club.players.filter(p => p.injuredWeeks > 0);
    const healthyStarters = club.players.filter(p => !p.sub && !(p.injuredWeeks > 0));
    const payroll = club.players.reduce((s, p) => s + (p.salary || 3500), 0);

    let matchCard = "";
    if (M.week === 12) {
      matchCard = `<div class="mgr-panel">
        <div class="t-group-head"><b class="mono">RESUMEN DE TEMPORADA ${M.season}</b><span class="duel-badge">OFF-SEASON</span></div>
        <p style="margin:6px 0 10px;font-size:13px">Temporada concluida. Campeón Regional: <b>${mEsc(M.schedule.regChampion || "-")}</b> · Campeón Masters: <b>${mEsc(M.schedule.mastersChampion || "-")}</b>.</p>
        <button type="button" class="p mono" onclick="mgrAdvanceWeek(false)">Iniciar Temporada ${M.season + 1}</button>
      </div>`;
    } else if (nextMatch) {
      const oppName = nextMatch.teamA === M.userTeam ? nextMatch.teamB : nextMatch.teamA;
      const oppClub = M.clubs[oppName];
      matchCard = `<div class="mgr-panel mgr-matchday">
        <div class="t-group-head">
          <b class="mono">PRÓXIMO PARTIDO · SEMANA ${M.week}</b>
          <span class="t-fmt-tag mono">BO${nextMatch.fmt}</span>
        </div>
        <div class="mgr-versus">
          <div class="t-team-cell">${renderTeamLogo(M.userTeam, "score-logo-sm")}<div><b>${mEsc(M.userTeam)}</b><small class="mono mut" style="display:block">OVR ${calcRosterOvr(club.players, club.coach)}</small></div></div>
          <span class="mono mut" style="font-size:14px;font-weight:700">VS</span>
          <div class="t-team-cell" style="flex-direction:row-reverse;text-align:right">${renderTeamLogo(oppName, "score-logo-sm")}<div><b>${mEsc(oppName)}</b><small class="mono mut" style="display:block">OVR ${calcRosterOvr(oppClub.players, oppClub.coach)}</small></div></div>
        </div>
        <div class="mono mut" style="font-size:11px;margin-bottom:10px">${mEsc(nextMatch.label)} · Titulares sanos listos: <b class="${healthyStarters.length === 5 ? 'kd-pos' : 'kd-neg'}">${healthyStarters.length}/5</b></div>
        <div class="btn-group">
          <button type="button" class="p mono" onclick="mgrAdvanceWeek(false)">Simular Semana</button>
          <button type="button" class="mono t-btn-live" style="border-color:var(--ok);color:var(--ok)" onclick="mgrAdvanceWeek(true)">Jugar Partido En Vivo</button>
        </div>
      </div>`;
    } else {
      matchCard = `<div class="mgr-panel">
        <div class="t-group-head"><b class="mono">SEMANA ${M.week} · SIN PARTIDO OFICIAL</b><span class="mono mut">${getWeekPhaseName(M.week)}</span></div>
        <p class="mut" style="margin:6px 0 10px;font-size:12.5px">Aprovecha esta semana para ajustar tu entrenamiento, cerrar fichajes o recuperar la fatiga del plantel.</p>
        <button type="button" class="p mono" onclick="mgrAdvanceWeek(false)">Avanzar Semana (${M.week} → ${M.week + 1})</button>
      </div>`;
    }

    const offerBanner = M.pendingOffer
      ? `<div class="mgr-alert-bar" style="border-color:var(--gold)">
          <span class="mono"><b>OFERTA ENTRANTE:</b> ${mEsc(M.pendingOffer.buyer)} ofrece <b class="kd-pos">${fmtMoney(M.pendingOffer.amount)}</b> por <b>${mEsc(M.pendingOffer.player)}</b></span>
          <div class="btn-group">
            <button type="button" class="t-btn-sm mono t-btn-live" onclick="mgrRespondOffer(true)">Aceptar Venta</button>
            <button type="button" class="t-btn-sm mono" onclick="mgrRespondOffer(false)">Rechazar</button>
          </div>
        </div>`
      : "";

    const lastMatchBar = M.lastPlayedMatch
      ? `<div class="mgr-last-bar mono">
          <span>ÚLTIMO PARTIDO: <b>${mEsc(M.lastPlayedMatch.teamA)} ${M.lastPlayedMatch.scoreA}-${M.lastPlayedMatch.scoreB} ${mEsc(M.lastPlayedMatch.teamB)}</b> (${mEsc(M.lastPlayedMatch.mapsLine)})</span>
          ${window._mgrLastSeries ? `<div class="btn-group"><button type="button" class="t-btn-sm mono" onclick="mgrOpenLastBoxscore(false)">Ver Boxscore</button><button type="button" class="t-btn-sm mono" onclick="mgrOpenLastBoxscore(true)">Replay Vivo</button></div>` : ""}
        </div>`
      : "";

    return `
      ${offerBanner}
      ${lastMatchBar}
      <div class="mgr-hub-grid">
        <div style="display:flex;flex-direction:column;gap:10px">
          ${matchCard}
          <div class="mgr-panel">
            <div class="t-group-head"><b class="mono">PLAN DE ENTRENAMIENTO SEMANAL</b><span class="mono mut">DT ${mEsc(club.coach.n)} · DEV ${club.coach.dev}</span></div>
            <div class="mgr-train-list">
              ${Object.values(TRAINING_MODES).map(tm => `
                <button type="button" class="mgr-train-btn ${M.training === tm.id ? 'active' : ''}" onclick="mgrSetTraining('${tm.id}')">
                  <b class="mono">${mEsc(tm.name)}</b>
                  <small>${mEsc(tm.desc)}</small>
                </button>
              `).join("")}
            </div>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px">
          <div class="mgr-panel">
            <div class="t-group-head"><b class="mono">ESTADO DEL CLUB</b><span class="mono mut">OBJETIVO ${M.season}</span></div>
            <div class="mgr-kpi-row mono">
              <div><small class="mut">DIRECTIVA</small><b class="${M.boardConfidence >= 65 ? 'kd-pos' : M.boardConfidence <= 40 ? 'kd-neg' : ''}">${M.boardConfidence}%</b></div>
              <div><small class="mut">FLUJO/SEM</small><b class="${club.sponsorWeekly - payroll >= 0 ? 'kd-pos' : 'kd-neg'}">${fmtMoney(club.sponsorWeekly - payroll)}</b></div>
              <div><small class="mut">LESIONADOS</small><b class="${injured.length ? 'kd-neg' : 'kd-pos'}">${injured.length}</b></div>
              <div><small class="mut">TÍTULOS</small><b style="color:var(--gold)">${M.trophies.length}</b></div>
            </div>
            <div class="mono mut" style="font-size:11px;margin-top:8px;padding-top:8px;border-top:1px solid var(--bd)">Meta: <span style="color:var(--fg)">${mEsc(M.schedule.objective.label)}</span></div>
          </div>

          <div class="mgr-panel">
            <div class="t-group-head"><b class="mono">BUZÓN DEL MANAGER</b><span class="mono mut">${M.inbox.length} MENSAJES</span></div>
            <div class="mgr-inbox-scroll">
              ${M.inbox.map(msg => `<div class="mgr-msg">
                <div class="mgr-msg-top mono"><span class="mgr-tag tag-${msg.tag.toLowerCase()}">${mEsc(msg.tag)}</span><span class="mut">T${msg.season} · S${msg.week}</span></div>
                <b>${mEsc(msg.title)}</b>
                <p>${mEsc(msg.text)}</p>
              </div>`).join("")}
            </div>
          </div>
        </div>
      </div>`;
  }

  function renderSquadTab() {
    const club = M.clubs[M.userTeam];
    const healthyStarters = club.players.filter(p => !p.sub && !(p.injuredWeeks > 0)).length;

    const fmtDelta = d => d > 0 ? `<sup class="kd-pos">+${d}</sup>` : d < 0 ? `<sup class="kd-neg">${d}</sup>` : "";

    return `
      ${healthyStarters < 5 ? `<div class="mgr-alert-bar" style="border-color:var(--vct-red)">
        <span class="mono"><b>ALERTA DE QUINTETO:</b> Solo tienes ${healthyStarters}/5 titulares sanos. Activa un suplente, ficha un agente libre o promueve un canterano.</span>
        <button type="button" class="t-btn-sm mono" onclick="mgrCallAcademySub()">Convocar Academia ($0)</button>
      </div>` : ""}

      <div class="sc">
        <table>
          <thead>
            <tr>
              <th style="text-align:left">Jugador</th>
              <th style="text-align:left">Estado</th>
              <th>EDAD</th>
              <th>OVR / POT</th>
              <th>MORAL</th>
              <th>FATIGA</th>
              <th>MOD</th>
              <th>AIM</th><th>FD</th><th>CLU</th><th>ENT</th><th>UTI</th><th>IGL</th><th>CONS</th>
              <th style="text-align:left">Plan Individual</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${club.players.map((p, idx) => {
              const ovr = calcPlayerOvr(p);
              const modPct = (getPlayerMgrMod(p) * 100).toFixed(1);
              const modCls = parseFloat(modPct) > 0.3 ? "kd-pos" : parseFloat(modPct) < -0.5 ? "kd-neg" : "mut";
              const isInj = p.injuredWeeks > 0;
              const statusEl = isInj
                ? `<span class="sub-swap-btn" style="border-color:var(--vct-red);color:var(--vct-red);cursor:default">LESIÓN ${p.injuredWeeks}S</span>`
                : `<button type="button" class="sub-swap-btn ${p.sub ? 'is-sub' : 'is-starter'}" onclick="mgrToggleStarter(${idx})">${p.sub ? "6TH SUB ⇄" : "TITULAR ⇄"}</button>`;

              const fatCol = p.fatigue >= 72 ? "var(--vct-red)" : p.fatigue >= 50 ? "var(--gold)" : "var(--ok)";
              const morCol = p.morale >= 75 ? "var(--ok)" : p.morale <= 45 ? "var(--vct-red)" : "var(--gold)";
              const hushBadge = p._hushMastery >= 0.9 ? `<span class="igl-tag" style="color:var(--purple);border-color:var(--purple)">HUSH</span>`
                              : p.hushProgress > 0 ? `<span class="igl-tag">HUSH ${p.hushProgress}%</span>` : "";

              return `<tr>
                <td style="text-align:left">
                  <div><b>${mEsc(p.n)}</b>${hushBadge}</div>
                  <small class="mut">${getRoleIcon(p.r)} ${mEsc(p.r)}${isInj ? ` · <span class="kd-neg">${mEsc(p.injuryType)}</span>` : ""}</small>
                </td>
                <td style="text-align:left">${statusEl}</td>
                <td class="mono mut">${p.age}</td>
                <td class="mono"><b>${ovr}</b> <span class="mut">/ ${p.pot}</span></td>
                <td class="mono">
                  <div class="mgr-meter"><span>${p.morale}</span><div class="mgr-bar"><i style="width:${p.morale}%;background:${morCol}"></i></div></div>
                </td>
                <td class="mono">
                  <div class="mgr-meter"><span>${p.fatigue}%</span><div class="mgr-bar"><i style="width:${p.fatigue}%;background:${fatCol}"></i></div></div>
                </td>
                <td class="mono ${modCls}">${parseFloat(modPct) > 0 ? "+" : ""}${modPct}%</td>
                <td class="mono">${p.aim}${fmtDelta(p.deltas.aim)}</td>
                <td class="mono">${p.fd}${fmtDelta(p.deltas.fd)}</td>
                <td class="mono">${p.clutch}${fmtDelta(p.deltas.clutch)}</td>
                <td class="mono">${p.entry}${fmtDelta(p.deltas.entry)}</td>
                <td class="mono">${p.util}${fmtDelta(p.deltas.util)}</td>
                <td class="mono">${p.igl}${fmtDelta(p.deltas.igl)}</td>
                <td class="mono">${p.cons}${fmtDelta(p.deltas.cons)}</td>
                <td style="text-align:left">
                  <select class="cb-mini-sel mono" style="width:128px" onchange="mgrSetPlayerPlan(${idx}, this.value)">
                    ${Object.entries(PLAYER_PLANS).map(([k, obj]) => `<option value="${k}" ${p.plan === k ? "selected" : ""}>${obj.label}</option>`).join("")}
                  </select>
                </td>
                <td>
                  <div class="btn-group" style="justify-content:flex-end">
                    ${isInj ? `<button type="button" class="t-btn-sm mono t-btn-live" onclick="mgrPhysio(${idx})" title="Reduce 1 semana de lesión">Fisio $15k</button>` : ""}
                    <button type="button" class="t-btn-sm mono" onclick="mgrSellPlayer(${idx})" title="Vender jugador">Vender</button>
                  </div>
                </td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>`;
  }

  function renderMarketTab() {
    const club = M.clubs[M.userTeam];

    if (marketFilter.view === "coaches") {
      return `
        <div class="db-controls">
          <div class="region-tabs">
            <button type="button" class="tab-btn mono" onclick="mgrSetMarketFilter('view','players')">JUGADORES</button>
            <button type="button" class="tab-btn mono active" onclick="mgrSetMarketFilter('view','coaches')">HEAD COACHES (${M.freeCoaches.length})</button>
          </div>
          <span class="mono mut" style="font-size:11px">DT ACTUAL: <b style="color:var(--fg)">${mEsc(club.coach.n)}</b> (MAC ${club.coach.macro} · MIC ${club.coach.micro} · ADP ${club.coach.adapt} · DEV ${club.coach.dev} · DISC ${club.coach.disc})</span>
        </div>
        <div class="sc">
          <table>
            <thead><tr><th style="text-align:left">Head Coach</th><th>MAC</th><th>MIC</th><th>ADP</th><th>DEV</th><th>DISC</th><th>Coste</th><th>Acción</th></tr></thead>
            <tbody>
              ${M.freeCoaches.map((c, idx) => `<tr>
                <td style="text-align:left"><b>${mEsc(c.n)}</b></td>
                <td class="mono">${c.macro}</td><td class="mono">${c.micro}</td><td class="mono">${c.adapt}</td>
                <td class="mono kd-pos"><b>${c.dev}</b></td><td class="mono">${c.disc}</td>
                <td class="mono">${fmtMoney(c.fee)}</td>
                <td><button type="button" class="t-btn-sm mono t-btn-live" onclick="mgrHireCoach(${idx})">Contratar</button></td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>`;
    }

    const q = (marketFilter.query || "").trim().toLowerCase();
    const list = [];

    if (marketFilter.source === "ALL" || marketFilter.source === "FREE") {
      M.freeAgents.forEach((p, idx) => {
        const fee = Math.round((calcPlayerValue(p) * 0.35) / 1000) * 1000;
        list.push({ p, source: "Agente Libre", isFree: true, faIdx: idx, fee });
      });
    }
    if (marketFilter.source === "ALL" || marketFilter.source === "CLUBS") {
      for (const cName in M.clubs) {
        if (cName === M.userTeam) continue;
        M.clubs[cName].players.forEach(p => {
          const fee = Math.round((calcPlayerValue(p) * 1.15) / 1000) * 1000;
          list.push({ p, source: cName, isFree: false, fee });
        });
      }
    }

    const filtered = list.filter(item => {
      if (marketFilter.role !== "ALL" && !item.p.r.toLowerCase().includes(marketFilter.role.toLowerCase())) return false;
      if (q && !item.p.n.toLowerCase().includes(q) && !item.source.toLowerCase().includes(q) && !item.p.r.toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => {
      if (a.isFree !== b.isFree && marketFilter.source === "ALL") return a.isFree ? -1 : 1;
      return calcPlayerOvr(b.p) - calcPlayerOvr(a.p);
    }).slice(0, 45);

    return `
      <div class="db-controls">
        <div class="region-tabs">
          <button type="button" class="tab-btn mono active" onclick="mgrSetMarketFilter('view','players')">JUGADORES</button>
          <button type="button" class="tab-btn mono" onclick="mgrSetMarketFilter('view','coaches')">HEAD COACHES (${M.freeCoaches.length})</button>
          <select class="cb-mini-sel mono" onchange="mgrSetMarketFilter('source', this.value)">
            <option value="ALL" ${marketFilter.source === "ALL" ? "selected" : ""}>Origen: Todos</option>
            <option value="FREE" ${marketFilter.source === "FREE" ? "selected" : ""}>Solo Agentes Libres (${M.freeAgents.length})</option>
            <option value="CLUBS" ${marketFilter.source === "CLUBS" ? "selected" : ""}>Solo Traspasos de Clubes</option>
          </select>
          <select class="cb-mini-sel mono" onchange="mgrSetMarketFilter('role', this.value)">
            <option value="ALL" ${marketFilter.role === "ALL" ? "selected" : ""}>Rol: Todos</option>
            <option value="Duelista" ${marketFilter.role === "Duelista" ? "selected" : ""}>Duelista</option>
            <option value="Iniciador" ${marketFilter.role === "Iniciador" ? "selected" : ""}>Iniciador</option>
            <option value="Controlador" ${marketFilter.role === "Controlador" ? "selected" : ""}>Controlador</option>
            <option value="Centinela" ${marketFilter.role === "Centinela" ? "selected" : ""}>Centinela</option>
            <option value="Flex" ${marketFilter.role === "Flex" ? "selected" : ""}>Flex</option>
          </select>
        </div>
        <input type="search" class="search-input" value="${mEsc(marketFilter.query)}" placeholder="Buscar jugador o club..." oninput="mgrSetMarketFilter('query', this.value)">
      </div>

      <div class="sc">
        <table>
          <thead>
            <tr>
              <th style="text-align:left">Jugador</th>
              <th style="text-align:left">Club Actual</th>
              <th>EDAD</th>
              <th>OVR</th>
              <th>POT</th>
              <th>AIM</th><th>CLU</th><th>UTI</th><th>IGL</th>
              <th>Salario/Sem</th>
              <th>Coste Fichaje</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(item => {
              const p = item.p;
              const ovr = calcPlayerOvr(p);
              const canAfford = club.budget >= item.fee;
              return `<tr>
                <td style="text-align:left"><b>${mEsc(p.n)}</b> <small class="mut">${getRoleIcon(p.r)} ${mEsc(p.r)}</small></td>
                <td style="text-align:left" class="mono ${item.isFree ? 'kd-pos' : 'mut'}" style="font-size:11px">${mEsc(item.source)}</td>
                <td class="mono mut">${p.age}</td>
                <td class="mono"><b>${ovr}</b></td>
                <td class="mono ${p.pot >= 92 ? 'stat-elite' : ''}">${p.pot}</td>
                <td class="mono">${p.aim}</td>
                <td class="mono">${p.clutch}</td>
                <td class="mono">${p.util}</td>
                <td class="mono">${p.igl}</td>
                <td class="mono mut">${fmtMoney(p.salary)}</td>
                <td class="mono ${canAfford ? '' : 'kd-neg'}"><b>${fmtMoney(item.fee)}</b></td>
                <td>
                  ${item.isFree
                    ? `<button type="button" class="t-btn-sm mono t-btn-live" ${canAfford ? "" : "disabled"} onclick="mgrSignFreeAgent(${item.faIdx})">Fichar</button>`
                    : `<button type="button" class="t-btn-sm mono" ${canAfford ? "" : "disabled"} onclick="mgrBuyFromClub('${mEsc(item.source)}','${mEsc(p.n)}')">Cláusula</button>`
                  }
                </td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>`;
  }

  function renderCalendarTab() {
    const st = computeLeagueStandings();
    const sc = M.schedule;
    const renderMiniBracket = (title, list) => `<div class="t-group-card">
      <div class="t-group-head"><b class="mono">${title}</b></div>
      <div class="mgr-bracket-list">
        ${list.map(m => `<div class="mgr-b-row ${m.teamA === M.userTeam || m.teamB === M.userTeam ? 't-friend-border' : ''}">
          <span class="mono mut" style="font-size:10px">S${m.week} · ${mEsc(m.label)}</span>
          <div class="mono" style="display:flex;justify-content:space-between;font-size:12px">
            <b class="${m.played && m.winner === m.teamA ? 'kd-pos' : ''}">${mEsc(m.teamA || "TBD")}</b>
            <span>${m.played ? `${m.scoreA} : ${m.scoreB}` : `BO${m.fmt}`}</span>
            <b class="${m.played && m.winner === m.teamB ? 'kd-pos' : ''}">${mEsc(m.teamB || "TBD")}</b>
          </div>
          ${m.mapsLine ? `<small class="mono mut" style="font-size:10px">${mEsc(m.mapsLine)}</small>` : ""}
        </div>`).join("")}
      </div>
    </div>`;

    return `<div class="t-groups-grid">
      <div class="t-group-card">
        <div class="t-group-head"><b class="mono">${mEsc(sc.leagueName.toUpperCase())} · TEMPORADA ${M.season}</b><span class="mono mut">TOP 4 PLAYOFFS</span></div>
        <div class="sc">
          <table>
            <thead><tr><th>#</th><th style="text-align:left">Club</th><th>PJ</th><th>G-P</th><th>MAP</th><th>PTS</th></tr></thead>
            <tbody>
              ${st.map((r, idx) => `<tr class="${r.team === M.userTeam ? 't-friend-row' : ''}">
                <td class="mono ${idx < 4 ? 'kd-pos' : 'mut'}"><b>${idx + 1}</b></td>
                <td style="text-align:left"><span class="t-team-cell">${renderTeamLogo(r.team, "mini-team-logo")}<b>${mEsc(r.team)}</b></span></td>
                <td class="mono">${r.pj}</td>
                <td class="mono"><b>${r.g}-${r.p}</b></td>
                <td class="mono mut">${r.mw}-${r.ml}</td>
                <td class="mono"><b>${r.pts}</b></td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>

      ${renderMiniBracket("PLAYOFFS REGIONALES (SEM 7-8)", sc.regionalPlayoffs)}
    </div>
    <div style="margin-top:10px">${renderMiniBracket("VCT MASTERS INTERNACIONAL · TOP 8 GLOBAL (SEM 9-11)", sc.mastersBracket)}</div>`;
  }

  function renderFinanceTab() {
    const club = M.clubs[M.userTeam];
    const payroll = club.players.reduce((s, p) => s + (p.salary || 3500), 0);

    return `<div class="t-groups-grid">
      <div class="t-group-card">
        <div class="t-group-head"><b class="mono">MOVIMIENTOS FINANCIEROS</b><span class="mono mut">NÓMINA: ${fmtMoney(payroll)}/SEM</span></div>
        <div class="sc" style="max-height:280px;overflow-y:auto">
          <table>
            <thead><tr><th style="text-align:left">Sem</th><th style="text-align:left">Concepto</th><th>Monto</th></tr></thead>
            <tbody>
              ${M.financeLog.length ? M.financeLog.map(f => `<tr>
                <td style="text-align:left" class="mono mut">T${f.s}-S${f.w}</td>
                <td style="text-align:left">${mEsc(f.concept)}</td>
                <td class="mono ${f.amount >= 0 ? 'kd-pos' : 'kd-neg'}"><b>${fmtMoney(f.amount)}</b></td>
              </tr>`).join("") : `<tr><td colspan="3" class="mut mono">Sin movimientos aún.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>

      <div class="t-group-card">
        <div class="t-group-head"><b class="mono">HISTORIAL DE FICHAJES &amp; PALMARÉS</b></div>
        <div style="margin-bottom:8px;font-size:12px" class="mono">
          ${M.trophies.length ? M.trophies.map(t => `<span class="duel-badge" style="margin-right:6px">${t.season} · ${mEsc(t.title)}</span>`).join("") : `<span class="mut">Sin trofeos todavía.</span>`}
        </div>
        <div class="sc" style="max-height:230px;overflow-y:auto">
          <table>
            <thead><tr><th style="text-align:left">Op</th><th style="text-align:left">Jugador</th><th style="text-align:left">Club</th><th>Monto</th></tr></thead>
            <tbody>
              ${M.transferLog.length ? M.transferLog.map(tr => `<tr>
                <td style="text-align:left" class="mono ${tr.type === 'VENTA' ? 'kd-pos' : 'kd-neg'}">${tr.type}</td>
                <td style="text-align:left"><b>${mEsc(tr.player)}</b></td>
                <td style="text-align:left" class="mut">${mEsc(tr.from)} → ${mEsc(tr.to)}</td>
                <td class="mono">${fmtMoney(tr.fee)}</td>
              </tr>`).join("") : `<tr><td colspan="4" class="mut mono">Sin fichajes realizados.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
  }

  function renderManager() {
    const root = document.getElementById("manager");
    if (!root) return;

    if (!M) {
      root.innerHTML = renderClubSelectScreen();
      return;
    }

    const club = M.clubs[M.userTeam];
    const ovr = calcRosterOvr(club.players, club.coach);
    let body = "";
    if (activeTab === "hub") body = renderHubTab();
    else if (activeTab === "squad") body = renderSquadTab();
    else if (activeTab === "market") body = renderMarketTab();
    else if (activeTab === "calendar") body = renderCalendarTab();
    else body = renderFinanceTab();

    root.innerHTML = `
      <div class="mgr-header-bar">
        <div class="mgr-brand-left">
          ${renderTeamLogo(M.userTeam, "score-logo-sm")}
          <div>
            <div class="mono mut" style="font-size:10px">MODO MANAGER · TEMPORADA ${M.season} · SEMANA ${M.week}/12 · ${getWeekPhaseName(M.week)}</div>
            <h2 style="font-size:22px;margin-top:2px;color:${mEsc(club.color)}">${mEsc(M.userTeam)}</h2>
          </div>
        </div>
        <div class="mgr-header-kpis mono">
          <div class="mgr-kpi-box"><small>OVR ACTIVO</small><b>${ovr}</b></div>
          <div class="mgr-kpi-box"><small>PRESUPUESTO</small><b class="${club.budget >= 0 ? 'kd-pos' : 'kd-neg'}">${fmtMoney(club.budget)}</b></div>
          <div class="mgr-kpi-box"><small>PLANTEL</small><b>${club.players.length} PROS</b></div>
          <button type="button" class="t-btn-sm mono" onclick="mgrResetCareer()">Cambiar Club</button>
        </div>
      </div>

      <div class="series-tabs" style="margin-bottom:12px">
        <button type="button" class="series-tab ${activeTab === 'hub' ? 'active' : ''}" onclick="mgrSwitchTab('hub')">RESUMEN &amp; SEMANA</button>
        <button type="button" class="series-tab ${activeTab === 'squad' ? 'active' : ''}" onclick="mgrSwitchTab('squad')">PLANTILLA &amp; POT (${club.players.length})</button>
        <button type="button" class="series-tab ${activeTab === 'market' ? 'active' : ''}" onclick="mgrSwitchTab('market')">FICHAJES &amp; STAFF</button>
        <button type="button" class="series-tab ${activeTab === 'calendar' ? 'active' : ''}" onclick="mgrSwitchTab('calendar')">LIGA &amp; MASTERS</button>
        <button type="button" class="series-tab ${activeTab === 'finance' ? 'active' : ''}" onclick="mgrSwitchTab('finance')">FINANZAS &amp; PALMARÉS</button>
      </div>

      ${body}
    `;
  }

  loadCareer();
  renderManager();
})();