// ===== MÓDULO P5: MODO MANAGER VCT (33 SEMANAS, SAVE .JSON, POSTULACIÓN, ACADEMIA Y MAESTRÍA DE ROLES/AGENTES) =====
(function () {
  const SAVE_KEY = "vct_sim_manager_career_v3";
  const mEsc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const fmtMoney = n => (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString("en-US");
  const calcPlayerOvr = p => Math.round(p.aim * 0.35 + p.fd * 0.18 + p.clutch * 0.15 + p.entry * 0.15 + p.util * 0.17);

  function logoFramed(teamName) {
    return `<span class="mgr-logo-frame">${renderTeamLogo(teamName, "score-logo-sm")}</span>`;
  }

  function calcRosterOvr(players, coach) {
    const starters = players.filter(p => !p.sub && !(p.injuredWeeks > 0)).slice(0, 5);
    const active = starters.length === 5 ? starters : players.slice(0, 5);
    if (!active.length) return 70;
    const avg = active.reduce((a, p) => a + (p.aim * 0.35 + p.fd * 0.18 + p.clutch * 0.15 + p.entry * 0.15 + p.util * 0.17), 0) / active.length;
    const cb = coach ? ((coach.macro + coach.micro + coach.disc) / 3 - 80) * 0.18 : 0;
    return Number((avg + cb).toFixed(1));
  }

  // ===== NOMBRES Y ROLES DE ACADEMIA =====
  const ACADEMY_NICKS = [
    "kurox", "zexy", "vandalz", "m1ko", "kael", "draven", "soryn", "luxen", "nexo", "ryze",
    "fayz", "tako", "valk", "shiro", "zenith", "kairo", "milo", "dax", "soren", "renji",
    "vexo", "lukaz", "cruz", "noahz", "yur1", "sant1", "tomasz", "elias", "kento", "haru",
    "minho", "jinho", "chenx", "feilong", "kauan", "matheusz", "patoz", "gabo", "nicox", "aizen",
    "kyro", "zayd", "breno", "tito", "mori", "saku", "linx", "roxx", "flint", "haze",
    "kobe", "nyx", "jota", "enzo", "krisz", "vini", "troy", "seba", "kuro", "zoro",
    "dante", "ryu", "mako2", "finn", "axel", "noel", "lars", "yato", "kaizen", "echo"
  ];

  const ACADEMY_ROLES = [
    "Duelista", "Duelista/Flex", "Flex", "Iniciador", "Iniciador/IGL",
    "Controlador", "Controlador/Flex", "Controlador/IGL", "Centinela", "IGL/Centinela"
  ];

  const SPONSORS_CATALOG = [
    { name: "HyperPulse Peripherals",  tier: "regional",  upfront: 65000,  weekly: 6500 },
    { name: "KuroGear 540Hz Monitors", tier: "regional",  upfront: 75000,  weekly: 7500 },
    { name: "Vortex Zero Energy",      tier: "masters",   upfront: 140000, weekly: 12000 },
    { name: "ApexCloud Compute",       tier: "masters",   upfront: 160000, weekly: 13500 },
    { name: "Quantum Fiber Global",    tier: "champions", upfront: 280000, weekly: 20000 },
    { name: "Aether Luxury Hardware",  tier: "champions", upfront: 320000, weekly: 22000 }
  ];

  // ===== AGENTES LIBRES REALES =====
  const FREE_AGENTS_SEED = [
    { n: "Derke",    r: "Duelista",             aim: 93, fd: 92, clutch: 85, entry: 94, util: 75, igl: 63, conf: 88, cons: 84, pot: 93, age: 23, agents: ["Jett", "Raze", "Yoru", "Waylay"] },
    { n: "Less",     r: "Centinela",            aim: 92, fd: 82, clutch: 93, entry: 77, util: 88, igl: 70, conf: 88, cons: 91, pot: 94, age: 21, agents: ["Viper", "Cypher", "Killjoy", "Veto"] },
    { n: "Leo",      r: "Iniciador",            aim: 91, fd: 77, clutch: 94, entry: 73, util: 96, igl: 74, conf: 90, cons: 93, pot: 94, age: 22, agents: ["Sova", "Fade", "Tejo", "Skye"] },
    { n: "Demon1",   r: "Duelista/Controlador", aim: 93, fd: 88, clutch: 86, entry: 86, util: 78, igl: 62, conf: 79, cons: 79, pot: 93, age: 24, agents: ["Jett", "Brimstone", "Astra", "Chamber"] },
    { n: "nAts",     r: "Centinela/IGL",        aim: 90, fd: 79, clutch: 93, entry: 74, util: 89, igl: 87, conf: 89, cons: 90, pot: 91, age: 24, agents: ["Cypher", "Viper", "Veto", "Chamber"] },
    { n: "Meteor",   r: "Centinela/Duelista",   aim: 92, fd: 88, clutch: 89, entry: 87, util: 78, igl: 65, conf: 86, cons: 85, pot: 92, age: 26, agents: ["Cypher", "Killjoy", "Jett", "Neon"] },
    { n: "cauanzin", r: "Iniciador",            aim: 88, fd: 79, clutch: 87, entry: 78, util: 91, igl: 70, conf: 84, cons: 86, pot: 92, age: 21, agents: ["Sova", "Fade", "Skye", "Tejo"] },
    { n: "Jinggg",   r: "Duelista",             aim: 90, fd: 89, clutch: 82, entry: 95, util: 78, igl: 62, conf: 86, cons: 81, pot: 91, age: 23, agents: ["Raze", "Phoenix", "Sage", "Neon"] },
    { n: "Munchkin", r: "Flex/IGL",             aim: 85, fd: 78, clutch: 86, entry: 78, util: 91, igl: 91, conf: 88, cons: 88, pot: 87, age: 28, agents: ["Viper", "KAY/O", "Omen", "Harbor"] },
    { n: "saadhak",  r: "Flex/IGL",             aim: 81, fd: 77, clutch: 84, entry: 78, util: 92, igl: 94, conf: 90, cons: 84, pot: 84, age: 29, agents: ["KAY/O", "Breach", "Viper", "Veto"] },
    { n: "s0m",      r: "Controlador",          aim: 88, fd: 79, clutch: 88, entry: 78, util: 91, igl: 72, conf: 85, cons: 87, pot: 90, age: 24, agents: ["Omen", "Harbor", "Miks", "Viper"] },
    { n: "trexx",    r: "Iniciador",            aim: 89, fd: 81, clutch: 86, entry: 81, util: 91, igl: 69, conf: 83, cons: 86, pot: 91, age: 22, agents: ["Sova", "Fade", "Tejo", "Breach"] },
    { n: "MiniBoo",  r: "Duelista",             aim: 89, fd: 90, clutch: 81, entry: 93, util: 74, igl: 61, conf: 80, cons: 79, pot: 93, age: 21, agents: ["Neon", "Yoru", "Raze", "Jett"] },
    { n: "verno",    r: "Iniciador",            aim: 89, fd: 78, clutch: 86, entry: 76, util: 90, igl: 70, conf: 74, cons: 84, pot: 94, age: 20, agents: ["Sova", "Fade", "Tejo", "Gekko"] }
  ];

  const FREE_COACHES_SEED = [
    { n: "Potter",   macro: 91, micro: 87, adapt: 92, dev: 91, disc: 90, fee: 85000 },
    { n: "mini",     macro: 92, micro: 84, adapt: 90, dev: 86, disc: 88, fee: 80000 },
    { n: "d00mbr0s", macro: 88, micro: 85, adapt: 88, dev: 86, disc: 87, fee: 65000 },
    { n: "Chet",     macro: 86, micro: 86, adapt: 85, dev: 82, disc: 82, fee: 55000 },
    { n: "Termi",    macro: 89, micro: 84, adapt: 86, dev: 85, disc: 92, fee: 70000 },
    { n: "bzkA",     macro: 85, micro: 83, adapt: 84, dev: 88, disc: 86, fee: 50000 },
    { n: "FrosT",    macro: 82, micro: 85, adapt: 84, dev: 84, disc: 79, fee: 45000 }
  ];

  // ===== 10 MODOS DE ENTRENAMIENTO SEMANAL =====
  const TRAINING_MODES = {
    balanced: {
      id: "balanced",
      name: "Rutina Equilibrada",
      desc: "Progreso estable hacia POT con fatiga baja (+3 Fat · +1 Moral)",
      fatigueDelta: 3, moraleDelta: 1, cost: 0, injuryMult: 0.6, xpBase: 17,
      focus: ["aim", "util", "clutch", "cons"]
    },
    scrims: {
      id: "scrims",
      name: "Scrims Intensivos",
      desc: "Alto crecimiento en AIM / FD / ENT (+12 Fat · -1 Moral · Riesgo leve)",
      fatigueDelta: 12, moraleDelta: -1, cost: 0, injuryMult: 1.35, xpBase: 25,
      focus: ["aim", "fd", "entry"]
    },
    aimlab: {
      id: "aimlab",
      name: "Aimlabs & Deathmatch",
      desc: "Pulido mecánico puro en AIM y Primer Duelo (+7 Fat · Bajo riesgo)",
      fatigueDelta: 7, moraleDelta: 0, cost: 0, injuryMult: 0.85, xpBase: 22,
      focus: ["aim", "fd"]
    },
    tactics: {
      id: "tactics",
      name: "Táctica & VOD Review",
      desc: "Crecimiento en UTI / IGL / CONS (+5 Fat · +2 Moral)",
      fatigueDelta: 5, moraleDelta: 2, cost: 0, injuryMult: 0.5, xpBase: 20,
      focus: ["util", "igl", "cons"]
    },
    clutch_lab: {
      id: "clutch_lab",
      name: "Lab Retakes & Clutch",
      desc: "Simulaciones 1vX y post-plant: sube CLU / CONF / CONS (+6 Fat · +2 Moral)",
      fatigueDelta: 6, moraleDelta: 2, cost: 0, injuryMult: 0.6, xpBase: 22,
      focus: ["clutch", "conf", "cons"]
    },
    agent_lab: {
      id: "agent_lab",
      name: "Lab de Agentes & Hush",
      desc: "Acelera x1.7 la Maestría Hush y mejora UTI / ENT (+6 Fat · +1 Moral)",
      fatigueDelta: 6, moraleDelta: 1, cost: 0, injuryMult: 0.65, xpBase: 20, hushMult: 1.7,
      focus: ["util", "entry", "fd"]
    },
    anti_strat: {
      id: "anti_strat",
      name: "Anti-Strat Próximo Rival",
      desc: "Otorga +2.2% bono táctico en el partido de esta semana (+7 Fat · Menos XP)",
      fatigueDelta: 7, moraleDelta: 1, cost: 0, injuryMult: 0.6, xpBase: 12, matchPrepBonus: 0.022,
      focus: ["igl", "util"]
    },
    team_building: {
      id: "team_building",
      name: "Team Building ($8k)",
      desc: "Cohesión grupal: fuerte subida de Moral (+12) y recuperación (-16 Fat)",
      fatigueDelta: -16, moraleDelta: 12, cost: 8000, injuryMult: 0.0, xpBase: 10,
      focus: ["conf", "cons"]
    },
    rest: {
      id: "rest",
      name: "Descanso & Psicología",
      desc: "Recuperación física máxima (-28 Fat · +8 Moral · Cero lesiones)",
      fatigueDelta: -28, moraleDelta: 8, cost: 0, injuryMult: 0.0, xpBase: 6,
      focus: ["conf"]
    },
    bootcamp: {
      id: "bootcamp",
      name: "Bootcamp Privado ($15k)",
      desc: "Doble XP hacia POT + bono Maestría Hush (+9 Fat · +4 Moral)",
      fatigueDelta: 9, moraleDelta: 4, cost: 15000, injuryMult: 0.85, xpBase: 36, hushMult: 1.4,
      focus: ["aim", "fd", "clutch", "util", "cons"]
    }
  };

  const PLAYER_PLANS = {
    balanced: { label: "Equilibrado",     keys: ["aim", "util", "cons", "clutch"] },
    aim:      { label: "Duelos (AIM/FD)", keys: ["aim", "fd", "entry"] },
    iq:       { label: "Utilidad / IGL",  keys: ["util", "igl", "cons"] },
    mental:   { label: "Clutch / Mental", keys: ["clutch", "conf", "cons"] },
    hush:     { label: "Maestría Hush",   keys: ["entry", "fd", "aim"], trainsHush: true }
  };

  // ===== SISTEMA DE APRENDIZAJE DE ROLES Y AGENTES (1 A 4 SEMANAS) =====
  const AGENT_COMPLEXITY = {
    "Brimstone": 1, "Clove": 1, "Phoenix": 1, "Reyna": 1, "Sage": 1, "Gekko": 1,
    "Jett": 2, "Iso": 2, "Omen": 2, "Fade": 2, "Breach": 2, "Skye": 2, "KAY/O": 2,
    "Tejo": 2, "Killjoy": 2, "Chamber": 2, "Deadlock": 2, "Vyse": 2, "Harbor": 2,
    "Raze": 3, "Yoru": 3, "Neon": 3, "Waylay": 3, "Hush": 3, "Sova": 3,
    "Viper": 3, "Astra": 3, "Miks": 3, "Cypher": 3, "Veto": 3
  };

  const ROLE_DISTANCE = {
    "Duelista":    { Duelista: 0, Iniciador: 1, Controlador: 2, Centinela: 2, Flex: 1 },
    "Iniciador":   { Duelista: 1, Iniciador: 0, Controlador: 1, Centinela: 1, Flex: 1 },
    "Controlador": { Duelista: 2, Iniciador: 1, Controlador: 0, Centinela: 1, Flex: 1 },
    "Centinela":   { Duelista: 2, Iniciador: 1, Controlador: 1, Centinela: 0, Flex: 1 },
    "Flex":        { Duelista: 1, Iniciador: 1, Controlador: 1, Centinela: 1, Flex: 0 }
  };

  const LEARNABLE_ROLES = ["Duelista", "Iniciador", "Controlador", "Centinela", "Flex", "IGL"];

  function getPlayerRoleDistance(player, targetRole) {
    const parsed = (typeof parsePlayerRoles === "function") ? parsePlayerRoles(player.r) : { primary: "Flex", secondary: null };
    if (parsed.primary === targetRole || parsed.secondary === targetRole) return 0;
    const d1 = (ROLE_DISTANCE[parsed.primary] && ROLE_DISTANCE[parsed.primary][targetRole] !== undefined)
      ? ROLE_DISTANCE[parsed.primary][targetRole] : 1;
    const d2 = (parsed.secondary && ROLE_DISTANCE[parsed.secondary] && ROLE_DISTANCE[parsed.secondary][targetRole] !== undefined)
      ? ROLE_DISTANCE[parsed.secondary][targetRole] : 9;
    return Math.min(d1, d2);
  }

  function getKnownAgentsForPlayer(p) {
    const base = (typeof PLAYER_AGENTS === "object" && PLAYER_AGENTS[p.n]) ? PLAYER_AGENTS[p.n] : [];
    const learned = Array.isArray(p.learnedAgents) ? p.learnedAgents : [];
    return [...new Set([...learned, ...base])].filter(a => typeof AGENTS === "object" && AGENTS[a]);
  }

  function calcLearningWeeks(p, type, target) {
    if (type === "agent") {
      const ag = (typeof AGENTS === "object" && AGENTS[target]) ? AGENTS[target] : null;
      if (!ag) return 2;
      if (target === "Hush") {
        const curHush = Math.max((typeof HUSH_MASTERY === "object" && HUSH_MASTERY[p.n]) || 0, p._hushMastery || 0);
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
    const dist = getPlayerRoleDistance(p, target);
    if (target === "Flex") return 3;
    return clamp(dist === 0 ? 1 : dist === 1 ? 2 : 4, 2, 4);
  }

  function syncLearnedPoolsFromCareer(career) {
    if (!career || !career.clubs || typeof PLAYER_AGENTS !== "object") return;
    for (const cName in career.clubs) {
      (career.clubs[cName].players || []).forEach(p => {
        if (Array.isArray(p.learnedAgents) && p.learnedAgents.length) {
          const cur = PLAYER_AGENTS[p.n] ? PLAYER_AGENTS[p.n].slice() : [];
          p.learnedAgents.forEach(a => { if (!cur.includes(a)) cur.unshift(a); });
          PLAYER_AGENTS[p.n] = cur;
        }
      });
    }
  }

  function advancePlayerLearning(p, club) {
    if (!p.learning || p.injuredWeeks > 0) return;
    p.learning.done = Math.min(p.learning.total, (p.learning.done || 0) + 1);
    if (p.learning.done < p.learning.total) return;

    const { type, target } = p.learning;
    p.learning = null;

    if (type === "agent") {
      p.learnedAgents = Array.isArray(p.learnedAgents) ? p.learnedAgents : [];
      if (!p.learnedAgents.includes(target)) p.learnedAgents.unshift(target);
      if (typeof PLAYER_AGENTS === "object") {
        const cur = PLAYER_AGENTS[p.n] ? PLAYER_AGENTS[p.n].slice() : [];
        if (!cur.includes(target)) PLAYER_AGENTS[p.n] = [target, ...cur];
      }
      if (target === "Hush") {
        p._hushMastery = 1.0;
        p.hushProgress = 100;
      }
      p.morale = clamp((p.morale || 75) + 4, 15, 100);
      addInbox("MAESTRÍA", `${p.n} domina a ${target}`, `${p.n} completó su entrenamiento y añadió a ${target} a su pool competitivo de confort.`);
    } else if (type === "role") {
      p.learnedRoles = Array.isArray(p.learnedRoles) ? p.learnedRoles : [];
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
        if (primary.toLowerCase() !== target.toLowerCase()) {
          p.r = `${primary}/${target}`;
        }
        if (typeof PLAYER_AGENTS === "object" && typeof ROLE_DEFAULT_AGENTS === "object") {
          const cur = PLAYER_AGENTS[p.n] ? PLAYER_AGENTS[p.n].slice() : [];
          const starterAgents = (ROLE_DEFAULT_AGENTS[target] || []).slice(0, 2);
          starterAgents.forEach(a => {
            if (!cur.includes(a)) cur.push(a);
            p.learnedAgents = Array.isArray(p.learnedAgents) ? p.learnedAgents : [];
            if (!p.learnedAgents.includes(a)) p.learnedAgents.push(a);
          });
          PLAYER_AGENTS[p.n] = cur;
        }
        const roleStatKey = target === "Duelista" ? "entry" : target === "Centinela" ? "clutch" : target === "Flex" ? "cons" : "util";
        if (typeof p[roleStatKey] === "number" && p[roleStatKey] < 95) {
          p[roleStatKey] = Math.min(95, p[roleStatKey] + 2);
          p.deltas[roleStatKey] = (p.deltas[roleStatKey] || 0) + 2;
        }
      }
      p.morale = clamp((p.morale || 75) + 5, 15, 100);
      addInbox("MAESTRÍA", `${p.n} aprendió el rol ${target}`, `${p.n} amplió su versatilidad táctica (nuevo perfil: ${p.r}) gracias al trabajo con DT ${club.coach.n}.`);
    }
  }

  window.mgrStartLearning = function (idx, encodedVal) {
    if (!M || !encodedVal) return;
    const p = M.clubs[M.userTeam].players[idx];
    if (!p) return;
    const [type, target] = encodedVal.split("::");
    if (!type || !target) return;

    if (p.learning && p.learning.done > 0) {
      if (!confirm(`${p.n} ya lleva ${p.learning.done}/${p.learning.total} semanas aprendiendo ${p.learning.target}. ¿Reemplazar por ${target}?`)) {
        renderManager();
        return;
      }
    }

    const total = calcLearningWeeks(p, type, target);
    p.learning = { type, target, done: 0, total };
    saveCareer();
    renderManager();
  };

  window.mgrCancelLearning = function (idx) {
    if (!M) return;
    const p = M.clubs[M.userTeam].players[idx];
    if (!p || !p.learning) return;
    p.learning = null;
    saveCareer();
    renderManager();
  };

  function renderLearningTableHTML(club) {
    if (typeof AGENTS !== "object") return "";
    const agentsByRole = { Duelista: [], Iniciador: [], Controlador: [], Centinela: [] };
    for (const agName in AGENTS) {
      const r = AGENTS[agName].role;
      if (agentsByRole[r]) agentsByRole[r].push(agName);
    }

    const buildOptions = p => {
      const known = getKnownAgentsForPlayer(p);
      const hasFullHush = Math.max((typeof HUSH_MASTERY === "object" && HUSH_MASTERY[p.n]) || 0, p._hushMastery || 0) >= 0.9;
      const curRoles = (p.r || "").toLowerCase();

      let opts = `<option value="">-- Elegir Rol o Agente --</option>`;

      const roleOpts = LEARNABLE_ROLES.filter(r => {
        if (r === "IGL") return !curRoles.includes("igl");
        return getPlayerRoleDistance(p, r) > 0;
      }).map(r => {
        const w = calcLearningWeeks(p, "role", r);
        const sel = (p.learning && p.learning.type === "role" && p.learning.target === r) ? "selected" : "";
        return `<option value="role::${mEsc(r)}" ${sel}>Rol: ${mEsc(r)} (${w} sem)</option>`;
      }).join("");
      if (roleOpts) opts += `<optgroup label="ROLES NUEVOS (2–4 SEM)">${roleOpts}</optgroup>`;

      for (const rKey of ["Duelista", "Iniciador", "Controlador", "Centinela"]) {
        const agOpts = agentsByRole[rKey]
          .filter(ag => ag === "Hush" ? !hasFullHush : !known.includes(ag))
          .map(ag => {
            const w = calcLearningWeeks(p, "agent", ag);
            const sel = (p.learning && p.learning.type === "agent" && p.learning.target === ag) ? "selected" : "";
            return `<option value="agent::${mEsc(ag)}" ${sel}>${mEsc(ag)} (${w} sem)</option>`;
          }).join("");
        if (agOpts) opts += `<optgroup label="AGENTES · ${rKey.toUpperCase()}">${agOpts}</optgroup>`;
      }
      return opts;
    };

    return `
      <div class="mgr-panel mgr-learn-box">
        <div class="t-group-head">
          <b class="mono">APRENDIZAJE DE ROLES &amp; MAESTRÍA DE AGENTES (MÁX. 4 SEMANAS)</b>
          <span class="mono mut" style="font-size:10.5px">Duración según distancia de rol y complejidad del agente · Avanza 1 sem/turno</span>
        </div>
        <div class="sc">
          <table>
            <thead>
              <tr>
                <th style="text-align:left">Jugador</th>
                <th style="text-align:left">Pool de Agentes Actual</th>
                <th style="text-align:left">Asignar Rol / Agente</th>
                <th style="text-align:left">Progreso de Maestría</th>
              </tr>
            </thead>
            <tbody>
              ${club.players.map((p, idx) => {
                const known = getKnownAgentsForPlayer(p);
                const l = p.learning;
                const isInj = p.injuredWeeks > 0;
                let progHTML = `<span class="mono mut" style="font-size:11px">Sin aprendizaje asignado</span>`;

                if (l) {
                  const pct = Math.round((l.done / l.total) * 100);
                  const rem = Math.max(0, l.total - l.done);
                  const typeTag = l.type === "role" ? "ROL" : "AGENTE";
                  const fillCol = isInj ? "var(--vct-red)" : (l.target === "Hush" ? "var(--purple)" : "var(--ok)");
                  progHTML = `<div class="mgr-learn-prog">
                    <div class="mgr-learn-meta mono">
                      <span><span class="igl-tag" style="margin:0 5px 0 0">${typeTag}</span><b>${mEsc(l.target)}</b></span>
                      <span class="${isInj ? 'kd-neg' : 'mut'}">${isInj ? "PAUSADO (LESIÓN)" : `${l.done}/${l.total} SEM · ${rem === 1 ? "Falta 1 sem" : `Faltan ${rem} sem`} (${pct}%)`}</span>
                    </div>
                    <div class="mgr-learn-row">
                      <div class="mgr-learn-track"><i style="width:${pct}%;background:${fillCol}"></i></div>
                      <button type="button" class="t-btn-sm mono" onclick="mgrCancelLearning(${idx})" title="Cancelar aprendizaje">Cancelar</button>
                    </div>
                  </div>`;
                }

                return `<tr>
                  <td style="text-align:left">
                    <b>${mEsc(p.n)}</b>
                    <small class="mut" style="display:block">${getRoleIcon(p.r)} ${mEsc(p.r)}</small>
                  </td>
                  <td style="text-align:left">
                    <div class="mgr-agent-pills mono">
                      ${known.slice(0, 6).map(a => `<span class="mgr-ag-chip ${a === 'Hush' ? 'is-hush' : ''}">${mEsc(a)}</span>`).join("")}
                      ${known.length > 6 ? `<span class="mut" style="font-size:10px">+${known.length - 6}</span>` : ""}
                    </div>
                  </td>
                  <td style="text-align:left">
                    <select class="cb-mini-sel mono mgr-learn-select" onchange="mgrStartLearning(${idx}, this.value)">
                      ${buildOptions(p)}
                    </select>
                  </td>
                  <td style="text-align:left">${progHTML}</td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  const INJURIES_CATALOG = [
    { name: "Tendinitis de muñeca",    minW: 2, maxW: 3 },
    { name: "Sobrecarga cervical",     minW: 1, maxW: 2 },
    { name: "Fatiga visual / Migraña", minW: 1, maxW: 1 },
    { name: "Distensión dedo índice",  minW: 1, maxW: 2 },
    { name: "Túnel carpiano leve",     minW: 2, maxW: 4 },
    { name: "Burnout competitivo",     minW: 2, maxW: 3 }
  ];

  if (typeof PLAYER_AGENTS === "object") {
    FREE_AGENTS_SEED.forEach(fa => {
      if (!PLAYER_AGENTS[fa.n] && fa.agents) PLAYER_AGENTS[fa.n] = fa.agents.slice();
    });
  }

  // ===== ECONOMÍA Y VALORACIÓN =====
  function calcPlayerSalary(p) {
    const ovr = calcPlayerOvr(p);
    if (p.isAcademy && ovr <= 80) {
      return Math.round((900 + Math.max(0, ovr - 70) * 110) / 100) * 100;
    }
    return Math.round((1000 + Math.pow(Math.max(1, ovr - 72), 1.44) * 68) / 100) * 100;
  }

  function calcPlayerValue(p) {
    const ovr = calcPlayerOvr(p);
    const potGap = Math.max(0, (p.pot || ovr) - ovr);
    const age = p.age || 21;
    const ageMult = age <= 20 ? 1.2 : age <= 23 ? 1.08 : age >= 27 ? 0.78 : 1.0;
    const base = Math.pow(Math.max(1, ovr - 68), 2.05) * 240;
    const potBonus = potGap * 9500;
    const hushBonus = ((typeof HUSH_MASTERY === "object" && HUSH_MASTERY[p.n] >= 0.9) || (p._hushMastery || 0) >= 0.9) ? 22000 : 0;
    return Math.round(((base + potBonus + hushBonus) * ageMult) / 1000) * 1000;
  }

  function calcAcademyPriceByPot(pot) {
    return Math.round((12000 + Math.pow(Math.max(1, pot - 76), 2.05) * 320) / 1000) * 1000;
  }

  function isRookiePlayer(p) {
    return !!(p.isAcademy || (p.age || 21) <= 20 || (p.conf || 80) < 74);
  }

  function enrichPlayer(raw, isFreeAgent = false) {
    const ovr = calcPlayerOvr(raw);
    const gap = Math.max(0, (raw.pot || ovr) - ovr);
    const estAge = raw.age || clamp(24 - Math.round(gap * 0.55) + (raw.conf < 72 ? -2 : 0), 18, 28);
    const hushInit = (typeof HUSH_MASTERY === "object" && HUSH_MASTERY[raw.n]) ? HUSH_MASTERY[raw.n] : (raw._hushMastery || 0);
    const obj = {
      n: raw.n, r: raw.r,
      aim: raw.aim, fd: raw.fd, clutch: raw.clutch, entry: raw.entry, util: raw.util, igl: raw.igl,
      conf: raw.conf, cons: raw.cons, pot: raw.pot,
      sub: raw.sub ? 1 : 0,
      age: estAge,
      isAcademy: !!raw.isAcademy,
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
      seasonRatingSum: 0
    };
    obj.salary = calcPlayerSalary(obj);
    return obj;
  }

  // ===== ACADEMIA (12 CHICOS CON NOMBRES ÚNICOS) =====
  function getAllUsedNames() {
    const used = new Set();
    if (M) {
      for (const c in M.clubs) M.clubs[c].players.forEach(p => used.add(p.n.toLowerCase()));
      (M.freeAgents || []).forEach(p => used.add(p.n.toLowerCase()));
      (M.academy || []).forEach(p => used.add(p.n.toLowerCase()));
    }
    for (const t in TEAMS) TEAMS[t].forEach(p => used.add(p.n.toLowerCase()));
    return used;
  }

  function pickUniqueNick(usedSet) {
    const avail = ACADEMY_NICKS.filter(n => !usedSet.has(n.toLowerCase()));
    if (avail.length) {
      const chosen = avail[Math.floor(Math.random() * avail.length)];
      usedSet.add(chosen.toLowerCase());
      return chosen;
    }
    const base = ACADEMY_NICKS[Math.floor(Math.random() * ACADEMY_NICKS.length)];
    let num = 2;
    while (usedSet.has((base + num).toLowerCase())) num++;
    const full = base + num;
    usedSet.add(full.toLowerCase());
    return full;
  }

  function generateAcademyProspect(usedSet, forcedRole = null) {
    const nick = pickUniqueNick(usedSet);
    const role = forcedRole || ACADEMY_ROLES[Math.floor(Math.random() * ACADEMY_ROLES.length)];
    const rLow = role.toLowerCase();

    const roll = Math.random();
    const pot = roll < 0.35 ? 80 + Math.floor(Math.random() * 6)
              : roll < 0.72 ? 86 + Math.floor(Math.random() * 5)
              : roll < 0.92 ? 91 + Math.floor(Math.random() * 3)
              : 94 + Math.floor(Math.random() * 3);

    const age = 16 + Math.floor(Math.random() * 4);
    const base = 71 + Math.floor(Math.random() * 6) + (pot >= 92 ? 2 : 0);

    const isDuel = rLow.includes("duelista");
    const isInit = rLow.includes("iniciador");
    const isCtrl = rLow.includes("controlador");
    const isSent = rLow.includes("centinela");
    const isIgl  = rLow.includes("igl");
    const jitter = () => Math.floor(Math.random() * 5) - 2;

    const raw = {
      n: nick, r: role,
      aim:    clamp(base + (isDuel ? 6 : isSent ? 3 : 1) + jitter(), 68, 86),
      fd:     clamp(base + (isDuel ? 7 : -1) + jitter(), 65, 85),
      clutch: clamp(base + (isSent ? 6 : isCtrl ? 4 : 0) + jitter(), 66, 84),
      entry:  clamp(base + (isDuel ? 8 : -2) + jitter(), 64, 86),
      util:   clamp(base + (isInit || isCtrl ? 8 : isDuel ? -4 : 2) + jitter(), 64, 86),
      igl:    clamp(isIgl ? 76 + Math.floor(Math.random() * 7) : 58 + Math.floor(Math.random() * 10), 56, 84),
      conf:   clamp(58 + Math.floor(Math.random() * 15), 55, 73),
      cons:   clamp(base - 2 + Math.floor(Math.random() * 6), 65, 82),
      pot, age, isAcademy: true, sub: 0
    };

    if (typeof PLAYER_AGENTS === "object" && typeof ROLE_DEFAULT_AGENTS === "object") {
      const prim = isDuel ? "Duelista" : isInit ? "Iniciador" : isCtrl ? "Controlador" : isSent ? "Centinela" : "Flex";
      PLAYER_AGENTS[nick] = (ROLE_DEFAULT_AGENTS[prim] || ROLE_DEFAULT_AGENTS.Flex).slice().sort(() => Math.random() - 0.5).slice(0, 4);
    }

    const prospect = enrichPlayer(raw, true);
    prospect.hireCost = calcAcademyPriceByPot(pot);
    return prospect;
  }

  function generateAcademyBatch(count = 12) {
    const used = getAllUsedNames();
    const guaranteed = ["Duelista", "Iniciador", "Controlador", "Centinela", "Flex", "Iniciador/IGL", "Duelista/Flex", "Controlador/IGL"];
    const batch = [];
    for (let i = 0; i < count; i++) {
      batch.push(generateAcademyProspect(used, i < guaranteed.length ? guaranteed[i] : null));
    }
    return batch.sort((a, b) => b.pot - a.pot || calcPlayerOvr(b) - calcPlayerOvr(a));
  }

  // ===== REPUTACIÓN DEL MANAGER Y REQUISITOS DE POSTULACIÓN =====
  function calcManagerReputation() {
    if (!M) return 50;
    const c = M.career || { wins: 0, losses: 0, regionalTitles: 0, mastersTitles: 0, championsTitles: 0 };
    const total = c.wins + c.losses;
    const wr = total >= 3 ? (c.wins / total) : 0.5;
    const wrBonus = total >= 3 ? (wr - 0.5) * 38 : 0;
    const trophyBonus = (c.regionalTitles * 7) + (c.mastersTitles * 14) + (c.championsTitles * 24);
    const streakBonus = Math.min(8, Math.max(0, (M.bestStreak || 0) - 2) * 1.5);
    const boardFactor = (M.boardConfidence - 50) * 0.14;
    return clamp(Math.round(50 + wrBonus + trophyBonus + streakBonus + boardFactor), 12, 99);
  }

  function getClubRequiredRep(clubName) {
    const cl = M.clubs[clubName];
    const ovr = calcRosterOvr(cl.players, cl.coach);
    return clamp(Math.round(40 + (ovr - 79) * 3.4), 38, 86);
  }

  // ===== ESTADO DE LA CARRERA Y PERSISTENCIA (AUTOGUARDADO + .JSON) =====
  let M = null;
  let activeTab = "hub";
  let marketFilter = { source: "ALL", role: "ALL", query: "", view: "players" };
  let clubsFilter = { reg: "ALL", selectedClub: null };

  function saveCareer() {
    try {
      if (M) {
        const now = new Date();
        M.lastSavedAt = now.toTimeString().slice(0, 5);
        localStorage.setItem(SAVE_KEY, JSON.stringify(M));
      } else {
        localStorage.removeItem(SAVE_KEY);
      }
    } catch (e) {}
  }

  window.mgrExportSave = function () {
    if (!M) return;
    const academyAgentPools = {};
    if (typeof PLAYER_AGENTS === "object") {
      for (const c in M.clubs) {
        M.clubs[c].players.forEach(p => { if (p.isAcademy && PLAYER_AGENTS[p.n]) academyAgentPools[p.n] = PLAYER_AGENTS[p.n]; });
      }
      (M.academy || []).forEach(p => { if (PLAYER_AGENTS[p.n]) academyAgentPools[p.n] = PLAYER_AGENTS[p.n]; });
    }
    const payload = {
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
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  window.mgrImportSave = function () {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = ".json,application/json";
    inp.onchange = e => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          const careerData = parsed && parsed.career ? parsed.career : parsed;
          if (!careerData || !careerData.userTeam || !careerData.clubs || !careerData.clubs[careerData.userTeam]) {
            alert("El archivo no corresponde a una partida válida de VCT Manager.");
            return;
          }
          if (parsed.academyAgentPools && typeof PLAYER_AGENTS === "object") {
            Object.assign(PLAYER_AGENTS, parsed.academyAgentPools);
          }
          M = careerData;
          syncLearnedPoolsFromCareer(M);
          activeTab = "hub";
          saveCareer();
          renderManager();
          alert(`Partida cargada: ${M.userTeam} (Temporada ${M.season}, Semana ${M.week}).`);
        } catch (err) {
          alert("Error leyendo el archivo .json: " + err.message);
        }
      };
      reader.readAsText(file);
    };
    inp.click();
  };

  function loadCareer() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.userTeam && parsed.clubs && parsed.clubs[parsed.userTeam]) {
          M = parsed;
          if (typeof PLAYER_AGENTS === "object") {
            const ensureAg = p => {
              if (!PLAYER_AGENTS[p.n]) {
                const prim = getPrimaryRoleFromStr(p.r);
                PLAYER_AGENTS[p.n] = (ROLE_DEFAULT_AGENTS[prim] || ROLE_DEFAULT_AGENTS.Flex).slice(0, 4);
              }
            };
            for (const c in M.clubs) M.clubs[c].players.forEach(ensureAg);
            (M.academy || []).forEach(ensureAg);
          }
          syncLearnedPoolsFromCareer(M);
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
    if (M.inbox.length > 50) M.inbox = M.inbox.slice(0, 50);
  }

  // ===== CALENDARIO ANUAL DE 33 SEMANAS (2 SEMANAS DE VIAJE ANTES DE CADA MASTERS Y CHAMPIONS) =====
  function isTravelWeek(w) {
    return w === 9 || w === 10 || w === 22 || w === 23 || w === 27 || w === 28;
  }

  function generateRoundRobinPairs(teams6) {
    const list = teams6.slice();
    const fixed = list[0];
    const rot = list.slice(1);
    const weeks = [];
    for (let w = 0; w < 5; w++) {
      weeks.push([[fixed, rot[0]], [rot[1], rot[4]], [rot[2], rot[3]]]);
      rot.unshift(rot.pop());
    }
    return weeks;
  }

  function buildRegionalLeagueForStage(stageNum, startWeek) {
    const userClub = M.clubs[M.userTeam];
    const userReg = userClub.reg;
    const allNames = Object.keys(M.clubs).sort((a, b) => calcRosterOvr(M.clubs[b].players, M.clubs[b].coach) - calcRosterOvr(M.clubs[a].players, M.clubs[a].coach));

    let leagueTeams = [M.userTeam];
    allNames.filter(t => t !== M.userTeam && M.clubs[t].reg === userReg).forEach(t => { if (leagueTeams.length < 6) leagueTeams.push(t); });

    let leagueName = `Stage ${stageNum} · VCT ${userReg}`;
    if (leagueTeams.length < 6) {
      leagueName = `Stage ${stageNum} · VCT Pacific-Asia`;
      allNames.filter(t => !leagueTeams.includes(t) && (M.clubs[t].reg === "CHINA" || M.clubs[t].reg === "PACIFIC")).forEach(t => { if (leagueTeams.length < 6) leagueTeams.push(t); });
    }
    if (leagueTeams.length < 6) {
      allNames.filter(t => !leagueTeams.includes(t)).forEach(t => { if (leagueTeams.length < 6) leagueTeams.push(t); });
    }

    const rrWeeks = generateRoundRobinPairs(leagueTeams.slice().sort(() => Math.random() - 0.5));
    const matches = [];
    rrWeeks.forEach((pairs, idx) => {
      pairs.forEach(([a, b], mIdx) => {
        matches.push({
          id: `S${M.season}-ST${stageNum}-W${startWeek + idx}-M${mIdx + 1}`,
          week: startWeek + idx,
          stage: stageNum === 1 ? "stage1_league" : "stage2_league",
          label: `${leagueName} · J${idx + 1}`,
          teamA: a, teamB: b, fmt: 3, played: false, scoreA: 0, scoreB: 0, winner: null, mapsLine: ""
        });
      });
    });

    const poWeek = startWeek + 5;
    const msWeek = poWeek + 4;

    const playoffs = [
      { id: `S${M.season}-ST${stageNum}-SF1`, week: poWeek,     stage: `stage${stageNum}_po`, roundKey: "SF", label: `Stage ${stageNum} Playoffs · Semifinal 1 (1° vs 4°)`, teamA: null, teamB: null, fmt: 3, played: false, scoreA: 0, scoreB: 0, winner: null, mapsLine: "", nextId: `S${M.season}-ST${stageNum}-GF`, nextSlot: 0 },
      { id: `S${M.season}-ST${stageNum}-SF2`, week: poWeek,     stage: `stage${stageNum}_po`, roundKey: "SF", label: `Stage ${stageNum} Playoffs · Semifinal 2 (2° vs 3°)`, teamA: null, teamB: null, fmt: 3, played: false, scoreA: 0, scoreB: 0, winner: null, mapsLine: "", nextId: `S${M.season}-ST${stageNum}-GF`, nextSlot: 1 },
      { id: `S${M.season}-ST${stageNum}-GF`,  week: poWeek + 1, stage: `stage${stageNum}_po`, roundKey: "GF", label: `Stage ${stageNum} · Gran Final Regional (Bo5)`,       teamA: null, teamB: null, fmt: 5, played: false, scoreA: 0, scoreB: 0, winner: null, mapsLine: "", nextId: null, nextSlot: null }
    ];

    const masters = [
      { id: `S${M.season}-M${stageNum}-QF1`, week: msWeek,     stage: `masters${stageNum}`, roundKey: "QF", label: `VCT Masters ${stageNum} · Cuartos 1`,        teamA: null, teamB: null, fmt: 3, played: false, scoreA: 0, scoreB: 0, winner: null, mapsLine: "", nextId: `S${M.season}-M${stageNum}-SF1`, nextSlot: 0 },
      { id: `S${M.season}-M${stageNum}-QF2`, week: msWeek,     stage: `masters${stageNum}`, roundKey: "QF", label: `VCT Masters ${stageNum} · Cuartos 2`,        teamA: null, teamB: null, fmt: 3, played: false, scoreA: 0, scoreB: 0, winner: null, mapsLine: "", nextId: `S${M.season}-M${stageNum}-SF1`, nextSlot: 1 },
      { id: `S${M.season}-M${stageNum}-QF3`, week: msWeek,     stage: `masters${stageNum}`, roundKey: "QF", label: `VCT Masters ${stageNum} · Cuartos 3`,        teamA: null, teamB: null, fmt: 3, played: false, scoreA: 0, scoreB: 0, winner: null, mapsLine: "", nextId: `S${M.season}-M${stageNum}-SF2`, nextSlot: 0 },
      { id: `S${M.season}-M${stageNum}-QF4`, week: msWeek,     stage: `masters${stageNum}`, roundKey: "QF", label: `VCT Masters ${stageNum} · Cuartos 4`,        teamA: null, teamB: null, fmt: 3, played: false, scoreA: 0, scoreB: 0, winner: null, mapsLine: "", nextId: `S${M.season}-M${stageNum}-SF2`, nextSlot: 1 },
      { id: `S${M.season}-M${stageNum}-SF1`, week: msWeek + 1, stage: `masters${stageNum}`, roundKey: "SF", label: `VCT Masters ${stageNum} · Semifinal 1`,      teamA: null, teamB: null, fmt: 3, played: false, scoreA: 0, scoreB: 0, winner: null, mapsLine: "", nextId: `S${M.season}-M${stageNum}-GF`,  nextSlot: 0 },
      { id: `S${M.season}-M${stageNum}-SF2`, week: msWeek + 1, stage: `masters${stageNum}`, roundKey: "SF", label: `VCT Masters ${stageNum} · Semifinal 2`,      teamA: null, teamB: null, fmt: 3, played: false, scoreA: 0, scoreB: 0, winner: null, mapsLine: "", nextId: `S${M.season}-M${stageNum}-GF`,  nextSlot: 1 },
      { id: `S${M.season}-M${stageNum}-GF`,  week: msWeek + 2, stage: `masters${stageNum}`, roundKey: "GF", label: `VCT Masters ${stageNum} · Gran Final (Bo5)`, teamA: null, teamB: null, fmt: 5, played: false, scoreA: 0, scoreB: 0, winner: null, mapsLine: "", nextId: null, nextSlot: null }
    ];

    return { leagueName, leagueTeams, matches, playoffs, masters, poSeeded: false, mastersSeeded: false, regChamp: null, mastersChamp: null };
  }

  function buildChampionsBracket(seasonYear) {
    const ch = [];
    for (let i = 1; i <= 8; i++) {
      const qfNum = Math.ceil(i / 2);
      ch.push({ id: `S${seasonYear}-CH-R16-${i}`, week: 29, stage: "champions", roundKey: "R16", label: `Champions · Octavos ${i}`, teamA: null, teamB: null, fmt: 3, played: false, scoreA: 0, scoreB: 0, winner: null, mapsLine: "", nextId: `S${seasonYear}-CH-QF-${qfNum}`, nextSlot: (i - 1) % 2 });
    }
    for (let i = 1; i <= 4; i++) {
      const sfNum = Math.ceil(i / 2);
      ch.push({ id: `S${seasonYear}-CH-QF-${i}`, week: 30, stage: "champions", roundKey: "QF", label: `Champions · Cuartos ${i}`, teamA: null, teamB: null, fmt: 3, played: false, scoreA: 0, scoreB: 0, winner: null, mapsLine: "", nextId: `S${seasonYear}-CH-SF-${sfNum}`, nextSlot: (i - 1) % 2 });
    }
    ch.push(
      { id: `S${seasonYear}-CH-SF-1`, week: 31, stage: "champions", roundKey: "SF", label: "Champions · Semifinal 1", teamA: null, teamB: null, fmt: 3, played: false, scoreA: 0, scoreB: 0, winner: null, mapsLine: "", nextId: `S${seasonYear}-CH-GF`, nextSlot: 0 },
      { id: `S${seasonYear}-CH-SF-2`, week: 31, stage: "champions", roundKey: "SF", label: "Champions · Semifinal 2", teamA: null, teamB: null, fmt: 3, played: false, scoreA: 0, scoreB: 0, winner: null, mapsLine: "", nextId: `S${seasonYear}-CH-GF`, nextSlot: 1 },
      { id: `S${seasonYear}-CH-GF`,   week: 32, stage: "champions", roundKey: "GF", label: "VALORANT CHAMPIONS · GRAN FINAL (Bo5)", teamA: null, teamB: null, fmt: 5, played: false, scoreA: 0, scoreB: 0, winner: null, mapsLine: "", nextId: null, nextSlot: null }
    );
    return ch;
  }

  function buildFullYearSchedule(seasonYear) {
    const vctPoints = {};
    for (const c in M.clubs) vctPoints[c] = 0;

    const st1 = buildRegionalLeagueForStage(1, 2);
    const st2 = buildRegionalLeagueForStage(2, 15);
    const champions = buildChampionsBracket(seasonYear);

    const myOvr = calcRosterOvr(M.clubs[M.userTeam].players, M.clubs[M.userTeam].coach);
    const objective = myOvr >= 88.5
      ? { id: "title", label: "Ganar al menos 1 título (Regional, Masters o Champions)" }
      : myOvr >= 85.5
        ? { id: "champions", label: "Clasificar a VALORANT Champions (Top 16 VCT)" }
        : { id: "playoffs", label: "Entrar a Playoffs Regionales en Stage 1 o Stage 2" };

    M.schedule = {
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

  function startNewCareer(teamName) {
    const clubs = {};
    for (const t in TEAMS) {
      const meta = TEAM_META[t] || { reg: "AMERICAS", color: "#E5484D", code: t.slice(0, 3).toUpperCase() };
      const players = TEAMS[t].map(p => enrichPlayer(p, false));
      const coach = { ...COACH[t] };
      const ovr = calcRosterOvr(players, coach);
      const startBudget = Math.round((360000 + Math.max(0, ovr - 80) * 40000) / 5000) * 5000;
      const sponsorWeekly = Math.round((24000 + Math.max(0, ovr - 78) * 1500) / 500) * 500;
      clubs[t] = {
        name: t, reg: meta.reg, color: meta.color, code: meta.code,
        players, coach, budget: startBudget, sponsorWeekly, activeSponsors: []
      };
    }

    M = {
      userTeam: teamName,
      season: 2027,
      week: 1,
      boardConfidence: 65,
      graceWeeks: 8,
      fired: false,
      winStreak: 0,
      bestStreak: 0,
      training: "balanced",
      nextMatchPrepBonus: 0,
      career: {
        wins: 0, losses: 0,
        regionalTitles: 0, mastersTitles: 0, championsTitles: 0,
        clubsManaged: [teamName],
        applyCooldown: {}
      },
      clubs,
      freeAgents: FREE_AGENTS_SEED.map(p => enrichPlayer(p, true)),
      freeCoaches: FREE_COACHES_SEED.map(c => ({ ...c })),
      academy: [],
      inbox: [],
      transferLog: [],
      financeLog: [],
      trophies: [],
      seasonHistory: [],
      lastPlayedMatch: null,
      pendingOffer: null,
      pendingSponsorOffer: null,
      pendingJobOffers: []
    };

    M.academy = generateAcademyBatch(12);
    buildFullYearSchedule(2027);

    const club = M.clubs[teamName];
    addInbox("DIRECTIVA", `Contrato firmado con ${teamName}`, `La directiva confía en tu proyecto: arrancas con +65 de confianza y 8 semanas de período de gracia. Presupuesto: ${fmtMoney(club.budget)}. Calendario anual de 33 semanas con 2 semanas de viaje antes de cada Masters y Champions.`);
    activeTab = "hub";
    saveCareer();
    renderManager();
  }

  // ===== SIMULACIÓN DE SERIES =====
  function getPlayerMgrMod(p, extraPrep = 0) {
    const moraleMod = ((p.morale - 75) / 100) * 0.10;
    const fatiguePen = p.fatigue > 55 ? -((p.fatigue - 55) / 45) * 0.06 : 0;
    return clamp(moraleMod + fatiguePen + extraPrep, -0.085, 0.065);
  }

  function ensureHealthyLineupForAI(club) {
    const healthy = club.players.filter(p => !(p.injuredWeeks > 0));
    if (healthy.length < 5) {
      const used = getAllUsedNames();
      const need = 5 - healthy.length;
      for (let i = 0; i < need; i++) {
        const kid = generateAcademyProspect(used);
        kid.sub = 0;
        club.players.push(kid);
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
    const prep = clubName === M.userTeam ? (M.nextMatchPrepBonus || 0) : 0;
    const activePlayers = club.players
      .filter(p => !p.sub && !(p.injuredWeeks > 0))
      .slice(0, 5)
      .map(p => ({ ...p, _mgrMod: getPlayerMgrMod(p, prep) }));
    return { name: clubName, players: activePlayers, coach: { ...club.coach } };
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

    return { format: fmt, vetoData, maps, seriesScore, revealedMaps: maps.length, activeTab: fmt > 1 ? "SERIES" : 0 };
  }

  // ===== LESIONES =====
  function checkPlayerInjury(club, p, extraMult, isUser) {
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
        const healthySub = club.players.find(x => x.sub && !(x.injuredWeeks > 0) && x.n !== p.n);
        let extra = "Sin suplentes sanos: ve a Plantilla o Academia antes del próximo partido.";
        if (healthySub) {
          healthySub.sub = 0;
          extra = `${healthySub.n} tomó su lugar automáticamente en el quinteto titular.`;
        }
        addInbox("MÉDICO", `LESIÓN: ${p.n} (${weeks} sem.)`, `${p.n} (${isRookiePlayer(p) ? "Rookie" : "Consolidado"}) sufrió ${inj.name} con Fatiga ${p.fatigue}%. ${extra}`);
      }
    }
  }

  // ===== PROGRESIÓN HACIA POT =====
  function grantPlayerProgression(p, coach, rawXp, preferredKeys, isUser, fromMatch = false, hushMult = 1.0) {
    const ovr = calcPlayerOvr(p);
    const potGap = (p.pot || ovr) - ovr;
    const planObj = PLAYER_PLANS[p.plan || "balanced"] || PLAYER_PLANS.balanced;

    if ((planObj.trainsHush || hushMult > 1.2) && p._hushMastery < 1.0) {
      const baseHush = planObj.trainsHush ? rawXp * 0.72 : rawXp * 0.35;
      const gain = Math.round(baseHush * hushMult * (1 + (coach.dev - 75) / 100));
      p.hushProgress = clamp((p.hushProgress || 0) + gain, 0, 100);
      if (p.hushProgress >= 100 && p._hushMastery < 1.0) {
        p._hushMastery = 1.0;
        if (typeof PLAYER_AGENTS === "object") {
          const curPool = PLAYER_AGENTS[p.n] || [];
          if (!curPool.includes("Hush")) PLAYER_AGENTS[p.n] = ["Hush", ...curPool];
        }
        if (isUser) addInbox("PROGRESO", `${p.n} domina a Hush`, `${p.n} completó el 100% de Maestría Hush y ahora recibe bono completo al jugarlo.`);
      } else if (p.hushProgress >= 55 && p._hushMastery < 0.55) {
        p._hushMastery = 0.55;
      }
    }

    if (potGap <= 0 && p.age >= 25) return;

    const devMult = 0.76 + (coach.dev - 70) * 0.022;
    const ageMult = p.age <= 19 ? 1.65 : p.age <= 21 ? 1.35 : p.age <= 24 ? 1.0 : 0.5;
    const gapMult = potGap > 0 ? (0.8 + Math.min(1.8, potGap * 0.16)) : 0.15;
    const moraleMult = p.morale >= 80 ? 1.15 : p.morale <= 45 ? 0.7 : 1.0;
    const academyMatchMult = (p.isAcademy && fromMatch) ? 2.4 : (p.isAcademy ? 1.25 : 1.0);

    p.xp = (p.xp || 0) + (rawXp * devMult * ageMult * gapMult * moraleMult * academyMatchMult);

    while (p.xp >= 100) {
      p.xp -= 100;
      const curOvr = calcPlayerOvr(p);
      if (curOvr >= (p.pot || 95)) break;

      const candidateKeys = [...new Set([...planObj.keys, ...preferredKeys])];
      const valid = candidateKeys.filter(k => typeof p[k] === "number" && p[k] < Math.min(97, (p.pot || 94) + 2));
      if (!valid.length) break;
      const chosen = valid[Math.floor(Math.random() * valid.length)];
      p[chosen] = Math.min(97, p[chosen] + 1);
      p.deltas[chosen] = (p.deltas[chosen] || 0) + 1;
      p.salary = calcPlayerSalary(p);

      if (isUser) {
        addInbox("PROGRESO", `${p.n} sube +1 ${chosen.toUpperCase()}`, `OVR ${calcPlayerOvr(p)} / POT ${p.pot}${p.isAcademy ? ` (Academia · ${p.matchesPlayed} partidos)` : ""}.`);
      }
    }
  }

  // ===== IMPACTO POST-PARTIDO =====
  function applyMatchImpactToClub(clubName, series, teamIdx, matchStage) {
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
        p.matchesPlayed = (p.matchesPlayed || 0) + 1;
        p.seasonMaps = (p.seasonMaps || 0) + mapsPlayed;
        p.seasonRatingSum = (p.seasonRatingSum || 0) + (rat * mapsPlayed);

        const fatGain = Math.round(mapsPlayed * 5.2 * (1 - (club.coach.disc - 75) / 180));
        p.fatigue = clamp(p.fatigue + fatGain, 0, 100);

        const moraleDelta = (won ? 5 : -4) + Math.round((rat - 1.0) * 14);
        p.morale = clamp(p.morale + moraleDelta, 15, 100);

        if (p.conf < 86 && Math.random() < (p.isAcademy ? 0.65 : (won ? 0.45 : 0.2))) {
          p.conf = Math.min(95, p.conf + 1);
          p.deltas.conf = (p.deltas.conf || 0) + 1;
        }

        const matchXp = (won ? 18 : 12) + Math.max(0, (rat - 0.92) * 28);
        grantPlayerProgression(p, club.coach, matchXp, ["aim", "clutch", "cons", "fd"], isUser, true, 1.0);

        if (p.isAcademy && p.matchesPlayed % 2 === 0 && calcPlayerOvr(p) < p.pot) {
          grantPlayerProgression(p, club.coach, 55, ["aim", "util", "cons"], isUser, true, 1.0);
        }

        checkPlayerInjury(club, p, 1.0, isUser);
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
      if (won) {
        M.career.wins++;
        const matchPrize = matchStage === "champions" ? 60000
                         : matchStage.startsWith("masters") ? 40000
                         : matchStage.endsWith("_po") ? 28000
                         : 18000;
        club.budget += matchPrize;
        M.financeLog.unshift({ s: M.season, w: M.week, concept: `Victoria vs ${oppName} (${matchStage.toUpperCase()})`, amount: matchPrize });

        M.winStreak = (M.winStreak || 0) + 1;
        M.bestStreak = Math.max(M.bestStreak || 0, M.winStreak);

        const confGain = matchStage === "champions" ? 10 : matchStage.startsWith("masters") ? 8 : 5;
        M.boardConfidence = clamp(M.boardConfidence + confGain, -100, 100);

        if (M.winStreak >= 5) {
          const streakBonus = 20000 + (M.winStreak - 5) * 10000;
          club.budget += streakBonus;
          M.boardConfidence = clamp(M.boardConfidence + 4, -100, 100);
          M.financeLog.unshift({ s: M.season, w: M.week, concept: `Bono Racha Ganadora (${M.winStreak} victorias seguidas)`, amount: streakBonus });
          addInbox("RACHA", `BONO DE RACHA: ${M.winStreak} VICTORIAS SEGUIDAS`, `La directiva premia tu racha con ${fmtMoney(streakBonus)} (+4 Confianza).`);
        }
      } else {
        M.career.losses++;
        M.winStreak = 0;
        const baseLoss = matchStage === "champions" ? 3 : 4;
        const actualLoss = M.graceWeeks > 0 ? 1 : baseLoss;
        M.boardConfidence = clamp(M.boardConfidence - actualLoss, -100, 100);
      }
    }
  }

  // ===== PREMIOS POR TÍTULO, SPONSORS Y OFERTAS =====
  function rewardUserTitle(tier, titleLabel, prizeMoney, confBoost) {
    const club = M.clubs[M.userTeam];
    club.budget += prizeMoney;
    M.trophies.push({ season: M.season, title: titleLabel, club: M.userTeam });
    if (tier === "regional") M.career.regionalTitles++;
    else if (tier === "masters") M.career.mastersTitles++;
    else if (tier === "champions") M.career.championsTitles++;

    M.boardConfidence = clamp(M.boardConfidence + confBoost, -100, 100);
    M.financeLog.unshift({ s: M.season, w: M.week, concept: `Premio Título: ${titleLabel}`, amount: prizeMoney });
    addInbox("TÍTULO", `CAMPEONES: ${titleLabel}`, `Premio de ${fmtMoney(prizeMoney)} acreditado (+${confBoost} Confianza).`);

    const candidates = SPONSORS_CATALOG.filter(sp => sp.tier === tier);
    const sp = candidates[Math.floor(Math.random() * candidates.length)] || SPONSORS_CATALOG[0];
    M.pendingSponsorOffer = { ...sp, reason: titleLabel };
    addInbox("SPONSOR", `Oferta de patrocinio: ${sp.name}`, `Tras ganar ${titleLabel}, ${sp.name} ofrece ${fmtMoney(sp.upfront)} al contado + ${fmtMoney(sp.weekly)}/sem.`);

    const otherClubs = Object.keys(M.clubs)
      .filter(c => c !== M.userTeam)
      .sort((a, b) => calcRosterOvr(M.clubs[b].players, M.clubs[b].coach) - calcRosterOvr(M.clubs[a].players, M.clubs[a].coach));
    const topPicks = otherClubs.slice(0, 8).sort(() => Math.random() - 0.5).slice(0, 2);
    M.pendingJobOffers = topPicks.map(cName => ({
      club: cName,
      reg: M.clubs[cName].reg,
      ovr: calcRosterOvr(M.clubs[cName].players, M.clubs[cName].coach),
      budget: M.clubs[cName].budget,
      reason: `Campeón de ${titleLabel}`
    }));
    addInbox("OFERTA DT", `Clubes top te ofrecen el banquillo`, `${topPicks.join(" y ")} quieren ficharte como Manager tras levantar ${titleLabel}.`);
  }

  function runWeeklyTrainingAndHealth() {
    const travel = isTravelWeek(M.week);

    for (const clubName in M.clubs) {
      const club = M.clubs[clubName];
      const isUser = clubName === M.userTeam;
      const mode = isUser ? (TRAINING_MODES[M.training] || TRAINING_MODES.balanced) : TRAINING_MODES.balanced;

      if (isUser) {
        M.nextMatchPrepBonus = mode.matchPrepBonus || 0;
        if (mode.cost > 0 && club.budget >= mode.cost) {
          club.budget -= mode.cost;
          M.financeLog.unshift({ s: M.season, w: M.week, concept: mode.name, amount: -mode.cost });
        }
      }

      const payroll = club.players.reduce((s, p) => s + (p.salary || 2500), 0);
      const net = club.sponsorWeekly - payroll;
      club.budget += net;
      if (isUser) {
        M.financeLog.unshift({ s: M.season, w: M.week, concept: `Semanal (Sponsors ${fmtMoney(club.sponsorWeekly)} - Nómina ${fmtMoney(payroll)})`, amount: net });
        if (M.financeLog.length > 50) M.financeLog = M.financeLog.slice(0, 50);
        if (club.budget < -50000) {
          const finPen = M.graceWeeks > 0 ? 1 : 3;
          M.boardConfidence = clamp(M.boardConfidence - finPen, -100, 100);
          addInbox("FINANZAS", "Alerta de Déficit", `Tu caja está en ${fmtMoney(club.budget)}. Ajusta sueldos o vende jugadores.`);
        }
      }

      club.players.forEach(p => {
        if (p.injuredWeeks > 0) {
          p.injuredWeeks--;
          p.fatigue = clamp(p.fatigue - (travel ? 30 : 24), 0, 100);
          if (p.injuredWeeks === 0) {
            const prevInj = p.injuryType;
            p.injuryType = "";
            p.morale = clamp(p.morale + 6, 20, 100);
            if (isUser) addInbox("MÉDICO", `ALTA MÉDICA: ${p.n}`, `${p.n} superó su ${prevInj} y vuelve a estar disponible.`);
          }
          return;
        }

        const discFactor = 1 - Math.max(0, club.coach.disc - 75) / 160;
        let fDelta = mode.fatigueDelta > 0 ? Math.round(mode.fatigueDelta * discFactor) : mode.fatigueDelta;
        if (travel) fDelta -= 15;
        p.fatigue = clamp(p.fatigue + fDelta, 0, 100);
        p.morale = clamp(p.morale + mode.moraleDelta + (travel ? 2 : 0), 15, 100);

        const baseXp = mode.xpBase || 17;
        grantPlayerProgression(p, club.coach, baseXp * (p.sub ? 0.65 : 1.0), mode.focus, isUser, false, mode.hushMult || 1.0);

        checkPlayerInjury(club, p, travel ? mode.injuryMult * 0.35 : mode.injuryMult * 0.75, isUser);
        if (isUser) advancePlayerLearning(p, club);
      });
    }
  }

  // ===== TRANSICIONES DE TORNEOS (PREMIOS OFICIALES: $350K MASTERS / $1M CHAMPIONS) =====
  function computeStageStandings(stageObj) {
    const tbl = {};
    stageObj.leagueTeams.forEach(t => { tbl[t] = { team: t, pj: 0, g: 0, p: 0, mw: 0, ml: 0, pts: 0 }; });
    stageObj.matches.filter(m => m.played).forEach(m => {
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

  function processStageTransitions(stageObj, stageNum) {
    if (!stageObj.poSeeded && stageObj.matches.every(m => m.played)) {
      const st = computeStageStandings(stageObj);
      stageObj.playoffs[0].teamA = st[0].team; stageObj.playoffs[0].teamB = st[3].team;
      stageObj.playoffs[1].teamA = st[1].team; stageObj.playoffs[1].teamB = st[2].team;
      stageObj.poSeeded = true;

      const myPos = st.findIndex(x => x.team === M.userTeam) + 1;
      if (myPos > 0 && myPos <= 4) {
        M.boardConfidence = clamp(M.boardConfidence + 6, -100, 100);
        addInbox("LIGA", `Stage ${stageNum}: Clasificados a Playoffs (#${myPos})`, `${M.userTeam} aseguró su lugar en Semifinales Bo3.`);
      } else if (myPos > 4) {
        const pen = M.graceWeeks > 0 ? 3 : 8;
        M.boardConfidence = clamp(M.boardConfidence - pen, -100, 100);
        addInbox("LIGA", `Stage ${stageNum}: Fuera de Playoffs (#${myPos})`, `No se alcanzó el Top 4 regional. Usa las semanas libres para entrenar o fichar.`);
      }
    }

    const gfReg = stageObj.playoffs[2];
    if (!stageObj.mastersSeeded && gfReg.played) {
      stageObj.regChamp = gfReg.winner;
      const runnerUp = gfReg.winner === gfReg.teamA ? gfReg.teamB : gfReg.teamA;
      M.schedule.vctPoints[stageObj.regChamp] = (M.schedule.vctPoints[stageObj.regChamp] || 0) + 5;
      M.schedule.vctPoints[runnerUp] = (M.schedule.vctPoints[runnerUp] || 0) + 3;

      if (stageObj.regChamp === M.userTeam) {
        rewardUserTitle("regional", `${stageObj.leagueName} ${M.season}`, 100000, 25);
      } else if (runnerUp === M.userTeam) {
        M.clubs[M.userTeam].budget += 55000;
        M.boardConfidence = clamp(M.boardConfidence + 10, -100, 100);
        M.financeLog.unshift({ s: M.season, w: M.week, concept: `Subcampeón ${stageObj.leagueName}`, amount: 55000 });
        addInbox("MASTERS", `Clasificados al VCT Masters ${stageNum}`, `Premio de $55,000 (+10 Confianza). Tienes 2 semanas de viaje y descanso antes de Cuartos de Final.`);
      }

      const pool = [stageObj.regChamp, runnerUp];
      const others = Object.keys(M.clubs)
        .filter(t => !pool.includes(t) && !stageObj.leagueTeams.includes(t))
        .sort((a, b) => (calcRosterOvr(M.clubs[b].players, M.clubs[b].coach) + Math.random() * 2) - (calcRosterOvr(M.clubs[a].players, M.clubs[a].coach) + Math.random() * 2));
      others.forEach(t => { if (pool.length < 8) pool.push(t); });
      Object.keys(M.clubs).filter(t => !pool.includes(t)).forEach(t => { if (pool.length < 8) pool.push(t); });

      const ms = stageObj.masters;
      ms[0].teamA = pool[0]; ms[0].teamB = pool[7];
      ms[1].teamA = pool[3]; ms[1].teamB = pool[4];
      ms[2].teamA = pool[1]; ms[2].teamB = pool[6];
      ms[3].teamA = pool[2]; ms[3].teamB = pool[5];
      stageObj.mastersSeeded = true;
    }

    const gfMs = stageObj.masters[6];
    if (!stageObj.mastersChamp && gfMs.played) {
      stageObj.mastersChamp = gfMs.winner;
      const runnerUp = gfMs.winner === gfMs.teamA ? gfMs.teamB : gfMs.teamA;
      M.schedule.vctPoints[stageObj.mastersChamp] = (M.schedule.vctPoints[stageObj.mastersChamp] || 0) + 7;
      M.schedule.vctPoints[runnerUp] = (M.schedule.vctPoints[runnerUp] || 0) + 4;

      Object.keys(M.clubs).forEach(c => {
        if (!stageObj.leagueTeams.includes(c)) {
          const ovr = calcRosterOvr(M.clubs[c].players, M.clubs[c].coach);
          M.schedule.vctPoints[c] = (M.schedule.vctPoints[c] || 0) + Math.max(1, Math.round((ovr - 80) * 0.55 + Math.random() * 3));
        }
      });

      if (stageObj.mastersChamp === M.userTeam) {
        rewardUserTitle("masters", `VCT Masters ${stageNum} (${M.season})`, 350000, 35);
      } else if (runnerUp === M.userTeam) {
        M.clubs[M.userTeam].budget += 150000;
        M.boardConfidence = clamp(M.boardConfidence + 16, -100, 100);
        M.financeLog.unshift({ s: M.season, w: M.week, concept: `Subcampeón VCT Masters ${stageNum}`, amount: 150000 });
        addInbox("MASTERS", `Subcampeones de VCT Masters ${stageNum}`, `Gran campaña internacional: +$150,000 (+16 Confianza).`);
      }
    }
  }

  function seedChampionsIfReady() {
    const sc = M.schedule;
    if (sc.championsSeeded || !sc.stage2.mastersChamp) return;

    const guaranteed = [...new Set([
      sc.stage1.regChamp, sc.stage1.mastersChamp,
      sc.stage2.regChamp, sc.stage2.mastersChamp
    ].filter(Boolean))];

    const ranked = Object.keys(M.clubs).sort((a, b) => {
      const ptsDiff = (sc.vctPoints[b] || 0) - (sc.vctPoints[a] || 0);
      if (ptsDiff !== 0) return ptsDiff;
      return calcRosterOvr(M.clubs[b].players, M.clubs[b].coach) - calcRosterOvr(M.clubs[a].players, M.clubs[a].coach);
    });

    const top16 = [...guaranteed];
    ranked.forEach(c => { if (top16.length < 16 && !top16.includes(c)) top16.push(c); });

    const pairIdx = [[0, 15], [7, 8], [3, 12], [4, 11], [1, 14], [6, 9], [2, 13], [5, 10]];
    pairIdx.forEach(([a, b], i) => {
      sc.champions[i].teamA = top16[a];
      sc.champions[i].teamB = top16[b];
    });
    sc.championsSeeded = true;

    if (top16.includes(M.userTeam)) {
      M.boardConfidence = clamp(M.boardConfidence + 10, -100, 100);
      addInbox("CHAMPIONS", `CLASIFICADOS A VALORANT CHAMPIONS ${M.season}`, `${M.userTeam} entra al Top 16 mundial. Tienes 2 semanas de viaje y preparación antes de Octavos (Semana 29).`);
    } else {
      const pen = M.graceWeeks > 0 ? 3 : 8;
      M.boardConfidence = clamp(M.boardConfidence - pen, -100, 100);
      addInbox("CHAMPIONS", `Fuera de VALORANT Champions ${M.season}`, `${M.userTeam} no alcanzó los Puntos VCT para el Top 16 global.`);
    }
  }

  function getMatchesForWeek(w) {
    const sc = M.schedule;
    return [
      ...sc.stage1.matches.filter(m => m.week === w),
      ...sc.stage1.playoffs.filter(m => m.week === w && m.teamA && m.teamB),
      ...sc.stage1.masters.filter(m => m.week === w && m.teamA && m.teamB),
      ...sc.stage2.matches.filter(m => m.week === w),
      ...sc.stage2.playoffs.filter(m => m.week === w && m.teamA && m.teamB),
      ...sc.stage2.masters.filter(m => m.week === w && m.teamA && m.teamB),
      ...sc.champions.filter(m => m.week === w && m.teamA && m.teamB)
    ];
  }

  function findBracketListForMatch(m) {
    if (m.stage === "stage1_po") return M.schedule.stage1.playoffs;
    if (m.stage === "masters1") return M.schedule.stage1.masters;
    if (m.stage === "stage2_po") return M.schedule.stage2.playoffs;
    if (m.stage === "masters2") return M.schedule.stage2.masters;
    if (m.stage === "champions") return M.schedule.champions;
    return null;
  }

  function checkBoardFiring() {
    if (M.graceWeeks > 0) return;
    if (M.boardConfidence <= -30 && !M.fired) {
      M.fired = true;
      const rescueClubs = Object.keys(M.clubs)
        .filter(c => c !== M.userTeam)
        .sort((a, b) => calcRosterOvr(M.clubs[a].players, M.clubs[a].coach) - calcRosterOvr(M.clubs[b].players, M.clubs[b].coach))
        .slice(0, 6)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
      M.pendingJobOffers = rescueClubs.map(c => ({
        club: c, reg: M.clubs[c].reg,
        ovr: calcRosterOvr(M.clubs[c].players, M.clubs[c].coach),
        budget: M.clubs[c].budget,
        reason: "Proyecto de reconstrucción"
      }));
      addInbox("DESPIDO", `CESADO DE ${M.userTeam.toUpperCase()}`, `Tu confianza directiva cayó a ${M.boardConfidence}. La junta decidió rescindir tu contrato.`);
    }
  }

  function closeCurrentSeason() {
    const sc = M.schedule;
    if (sc.seasonClosed) return;
    sc.seasonClosed = true;

    const gfCh = sc.champions[sc.champions.length - 1];
    if (gfCh && gfCh.played) {
      sc.championsChamp = gfCh.winner;
      const runnerUp = gfCh.winner === gfCh.teamA ? gfCh.teamB : gfCh.teamA;
      if (sc.championsChamp === M.userTeam) {
        rewardUserTitle("champions", `VALORANT Champions ${M.season}`, 1000000, 50);
      } else if (runnerUp === M.userTeam) {
        M.clubs[M.userTeam].budget += 400000;
        M.boardConfidence = clamp(M.boardConfidence + 25, -100, 100);
        M.financeLog.unshift({ s: M.season, w: 33, concept: `Subcampeón VALORANT Champions ${M.season}`, amount: 400000 });
        addInbox("CHAMPIONS", `Subcampeones del Mundo (${M.season})`, `Premio de $400,000 ingresado (+25 Confianza).`);
      }
    }

    M.seasonHistory.unshift({
      season: M.season, club: M.userTeam,
      m1: sc.stage1.mastersChamp || "-",
      m2: sc.stage2.mastersChamp || "-",
      champions: sc.championsChamp || "-",
      ovrEnd: calcRosterOvr(M.clubs[M.userTeam].players, M.clubs[M.userTeam].coach)
    });

    for (const cName in M.clubs) {
      M.clubs[cName].players.forEach(p => {
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
      });
    }
    M.freeAgents.forEach(p => { p.age = (p.age || 22) + 1; });
    M.academy = generateAcademyBatch(12);

    addInbox("CIERRE", `Fin de Temporada ${M.season}`, `Masters 1: ${sc.stage1.mastersChamp} · Masters 2: ${sc.stage2.mastersChamp} · Champions: ${sc.championsChamp}. Nueva camada de 12 juveniles lista en Academia.`);
  }

  function maybeGenerateIncomingOffer() {
    if (M.pendingOffer || Math.random() > 0.18) return;
    const myClub = M.clubs[M.userTeam];
    if (myClub.players.length <= 5) return;
    const candidates = myClub.players.filter(p => !(p.injuredWeeks > 0));
    if (!candidates.length) return;
    const target = candidates[Math.floor(Math.random() * candidates.length)];
    const otherClubs = Object.keys(M.clubs).filter(c => c !== M.userTeam && M.clubs[c].budget >= calcPlayerValue(target) * 0.9);
    if (!otherClubs.length) return;
    const buyer = otherClubs[Math.floor(Math.random() * otherClubs.length)];
    const amount = Math.round((calcPlayerValue(target) * (1.08 + Math.random() * 0.22)) / 1000) * 1000;

    M.pendingOffer = { buyer, player: target.n, amount };
    addInbox("OFERTA", `Oferta de ${buyer} por ${target.n}`, `${buyer} ofrece ${fmtMoney(amount)} por el traspaso inmediato de ${target.n}.`);
  }

  function advanceWeekInternal(watchUserMatchLive) {
    if (!M || M.fired) return;

    if (M.week >= 33) {
      M.season++;
      M.week = 1;
      M.pendingOffer = null;
      M.pendingSponsorOffer = null;
      buildFullYearSchedule(M.season);
      addInbox("TEMPORADA", `Comienza la Temporada ${M.season}`, `Nuevo año competitivo de 33 semanas: Stage 1, Masters 1, Stage 2, Masters 2 y VALORANT Champions ${M.season}.`);
      saveCareer();
      renderManager();
      return;
    }

    const myClub = M.clubs[M.userTeam];
    const weekMatches = getMatchesForWeek(M.week);
    const userMatch = weekMatches.find(m => !m.played && (m.teamA === M.userTeam || m.teamB === M.userTeam));

    if (userMatch) {
      const healthyStarters = myClub.players.filter(p => !p.sub && !(p.injuredWeeks > 0));
      if (healthyStarters.length < 5) {
        alert(`Necesitas 5 titulares sanos para disputar ${userMatch.label} (tienes ${healthyStarters.length}). Rota suplentes o ficha un chico de la Academia.`);
        activeTab = "squad";
        renderManager();
        return;
      }
    }

    runWeeklyTrainingAndHealth();

    let userSeriesPlayed = null;
    weekMatches.forEach(m => {
      if (m.played || !m.teamA || !m.teamB) return;
      const s = simManagerSeries(m.teamA, m.teamB, m.fmt);
      m.scoreA = s.seriesScore[0];
      m.scoreB = s.seriesScore[1];
      m.winner = m.scoreA > m.scoreB ? m.teamA : m.teamB;
      m.played = true;
      m.mapsLine = s.maps.map(mp => `${mp.mapName.slice(0, 3).toUpperCase()} ${mp.sc[0]}-${mp.sc[1]}`).join(" · ");

      applyMatchImpactToClub(m.teamA, s, 0, m.stage);
      applyMatchImpactToClub(m.teamB, s, 1, m.stage);

      if (m.nextId) {
        const list = findBracketListForMatch(m);
        const nextM = list ? list.find(x => x.id === m.nextId) : null;
        if (nextM) {
          if (m.nextSlot === 0) nextM.teamA = m.winner;
          else nextM.teamB = m.winner;
        }
      }

      if (m.teamA === M.userTeam || m.teamB === M.userTeam) {
        userSeriesPlayed = { match: m, series: s };
        M.lastPlayedMatch = {
          label: m.label, teamA: m.teamA, teamB: m.teamB,
          scoreA: m.scoreA, scoreB: m.scoreB, mapsLine: m.mapsLine, fmt: m.fmt
        };
        window._mgrLastSeries = { teamA: m.teamA, teamB: m.teamB, series: s, label: `T${M.season} · ${m.label}` };
      }
    });

    M.nextMatchPrepBonus = 0;

    processStageTransitions(M.schedule.stage1, 1);
    processStageTransitions(M.schedule.stage2, 2);
    seedChampionsIfReady();
    maybeGenerateIncomingOffer();

    if (M.graceWeeks > 0) M.graceWeeks--;
    M.week++;

    if (M.week === 14) {
      M.academy = generateAcademyBatch(12);
      if (!M.schedule.stage2.leagueTeams.includes(M.userTeam)) {
        M.schedule.stage2 = buildRegionalLeagueForStage(2, 15);
      }
      addInbox("MERCADO", "Ventana de Mitad de Temporada (Semana 14)", "Se abrió el mercado intermedio y llegaron 12 nuevos prospectos a la Academia antes del Stage 2.");
    }
    if (M.week === 33) {
      closeCurrentSeason();
    }

    checkBoardFiring();
    saveCareer();
    renderManager();

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

  // ===== TRANSICIÓN A UN NUEVO CLUB =====
  function switchManagerToClub(targetClubName, sourceLabel) {
    const oldTeam = M.userTeam;
    M.userTeam = targetClubName;
    M.fired = false;
    M.boardConfidence = 68;
    M.graceWeeks = 8;
    M.winStreak = 0;
    M.pendingJobOffers = [];
    M.pendingOffer = null;
    M.pendingSponsorOffer = null;
    if (!M.career.clubsManaged.includes(targetClubName)) M.career.clubsManaged.push(targetClubName);

    if (M.week <= 1) buildFullYearSchedule(M.season);
    else if (M.week <= 14) M.schedule.stage2 = buildRegionalLeagueForStage(2, 15);

    addInbox("OFERTA DT", `Nuevo Manager de ${targetClubName}`, `Llegaste desde ${oldTeam} (${sourceLabel}). La directiva te recibe con +68 de confianza y 8 semanas de período de gracia.`);
    activeTab = "hub";
    saveCareer();
    renderManager();
  }

  // ===== ACCIONES DE INTERFAZ =====
  window.mgrStartCareer = function (teamName) {
    if (!TEAMS[teamName]) return;
    startNewCareer(teamName);
  };

  window.mgrEndCareer = function () {
    if (!confirm("¿Terminar el Modo Carrera actual? Se cerrará esta partida y volverás a la pantalla de selección para elegir el club que quieras desde cero.")) return;
    M = null;
    window._mgrLastSeries = null;
    saveCareer();
    renderManager();
  };

  window.mgrApplyForClub = function (targetClub) {
    if (!M || targetClub === M.userTeam || !M.clubs[targetClub]) return;
    const nowTick = M.season * 100 + M.week;
    const cdMap = M.career.applyCooldown || (M.career.applyCooldown = {});
    if (cdMap[targetClub] && nowTick < cdMap[targetClub]) {
      const wait = cdMap[targetClub] - nowTick;
      alert(`Ya te postulaste recientemente a ${targetClub}. Espera ${wait} semana(s) antes de volver a aplicar.`);
      return;
    }

    const rep = calcManagerReputation();
    const req = getClubRequiredRep(targetClub);
    const diff = rep - req;

    let accepted = false;
    if (diff >= 2) accepted = true;
    else if (diff >= -5) accepted = Math.random() < (0.55 + diff * 0.08);
    else if (diff >= -10) accepted = Math.random() < 0.12;

    if (accepted) {
      if (!confirm(`¡${targetClub} ACEPTÓ tu postulación! (Tu Rep: ${rep} vs Req: ${req}).\n¿Quieres dejar ${M.userTeam} y asumir ahora con +68 de confianza y 8 semanas de gracia?`)) return;
      switchManagerToClub(targetClub, `Postulación aceptada · Rep ${rep}`);
    } else {
      cdMap[targetClub] = nowTick + 4;
      addInbox("POSTULACIÓN", `${targetClub} rechazó tu candidatura`, `Tu reputación actual (${rep}) no convenció a la junta de ${targetClub} (exigen ~${req}). Mejora tu win rate o gana títulos y vuelve a intentarlo en 4 semanas.`);
      saveCareer();
      renderManager();
      alert(`${targetClub} rechazó tu postulación (Tu Rep: ${rep} / Exigencia del club: ~${req}). Sube tu reputación ganando series o títulos.`);
    }
  };

  window.mgrSwitchTab = function (tab) { activeTab = tab; renderManager(); };
  window.mgrSetTraining = function (modeId) { if (!M || !TRAINING_MODES[modeId]) return; M.training = modeId; saveCareer(); renderManager(); };
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
    if (target.injuredWeeks > 0) { alert(`${target.n} está lesionado (${target.injuryType}) por ${target.injuredWeeks} semana(s).`); return; }
    if (target.sub) {
      const activeStarters = roster.filter(p => !p.sub && !(p.injuredWeeks > 0));
      if (activeStarters.length >= 5) activeStarters[activeStarters.length - 1].sub = 1;
      target.sub = 0;
      target.morale = clamp(target.morale + 5, 15, 100);
    } else {
      const healthySub = roster.find((p, i) => p.sub && !(p.injuredWeeks > 0) && i !== idx);
      if (healthySub) { healthySub.sub = 0; target.sub = 1; }
      else { alert("No tienes otro suplente sano disponible para intercambiar."); return; }
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
    if (club.budget < cost) { alert("Presupuesto insuficiente ($15,000)."); return; }
    club.budget -= cost;
    p.injuredWeeks = Math.max(0, p.injuredWeeks - 1);
    p.fatigue = clamp(p.fatigue - 16, 0, 100);
    M.financeLog.unshift({ s: M.season, w: M.week, concept: `Fisioterapia privada (${p.n})`, amount: -cost });
    if (p.injuredWeeks === 0) {
      p.injuryType = "";
      addInbox("MÉDICO", `Alta acelerada: ${p.n}`, `Fisioterapia exitosa: ${p.n} está listo para volver.`);
    }
    saveCareer();
    renderManager();
  };

  window.mgrHireAcademy = function (idx) {
    if (!M || !M.academy[idx]) return;
    const club = M.clubs[M.userTeam];
    const kid = M.academy[idx];
    const cost = kid.hireCost || calcAcademyPriceByPot(kid.pot);
    if (club.budget < cost) { alert(`Necesitas ${fmtMoney(cost)} para contratar a ${kid.n} (POT ${kid.pot}).`); return; }
    club.budget -= cost;
    M.academy.splice(idx, 1);
    const activeCount = club.players.filter(p => !p.sub && !(p.injuredWeeks > 0)).length;
    kid.sub = activeCount >= 5 ? 1 : 0;
    kid.morale = 86;
    club.players.push(kid);
    M.transferLog.unshift({ s: M.season, w: M.week, type: "ACADEMIA", player: kid.n, from: "Cantera", to: M.userTeam, fee: cost });
    M.financeLog.unshift({ s: M.season, w: M.week, concept: `Contrato Academia: ${kid.n} (POT ${kid.pot})`, amount: -cost });
    addInbox("ACADEMIA", `Fichaje juvenil: ${kid.n}`, `${kid.n} (${kid.r}, ${kid.age} años, OVR ${calcPlayerOvr(kid)} / POT ${kid.pot}) se incorpora al club.`);
    saveCareer();
    renderManager();
  };

  window.mgrScoutMoreAcademy = function () {
    if (!M) return;
    const club = M.clubs[M.userTeam];
    const cost = 10000;
    if (club.budget < cost) { alert("Necesitas $10,000 para enviar ojeadores."); return; }
    club.budget -= cost;
    M.academy = generateAcademyBatch(12);
    M.financeLog.unshift({ s: M.season, w: M.week, concept: "Campaña de Ojeo Juvenil (12 prospectos)", amount: -cost });
    saveCareer();
    renderManager();
  };

  window.mgrSellPlayer = function (idx) {
    if (!M) return;
    const club = M.clubs[M.userTeam];
    if (club.players.length <= 5) { alert("Debes mantener al menos 5 jugadores en plantilla."); return; }
    const p = club.players[idx];
    if (!p) return;
    const sellPrice = Math.round((calcPlayerValue(p) * 0.85) / 1000) * 1000;
    if (!confirm(`¿Vender a ${p.n} por ${fmtMoney(sellPrice)}?`)) return;

    club.players.splice(idx, 1);
    p.sub = 0;
    M.freeAgents.unshift(p);
    club.budget += sellPrice;
    M.transferLog.unshift({ s: M.season, w: M.week, type: "VENTA", player: p.n, from: M.userTeam, to: "Mercado Libre", fee: sellPrice });
    M.financeLog.unshift({ s: M.season, w: M.week, concept: `Venta de ${p.n}`, amount: sellPrice });
    saveCareer();
    renderManager();
  };

  window.mgrRespondOffer = function (accept) {
    if (!M || !M.pendingOffer) return;
    const off = M.pendingOffer;
    const club = M.clubs[M.userTeam];
    M.pendingOffer = null;
    if (accept) {
      if (club.players.length <= 5) { alert("No puedes quedar con menos de 5 jugadores."); saveCareer(); renderManager(); return; }
      const idx = club.players.findIndex(p => p.n === off.player);
      if (idx >= 0) {
        const [sold] = club.players.splice(idx, 1);
        sold.sub = 1;
        M.clubs[off.buyer].players.push(sold);
        M.clubs[off.buyer].budget = Math.max(0, M.clubs[off.buyer].budget - off.amount);
        club.budget += off.amount;
        M.transferLog.unshift({ s: M.season, w: M.week, type: "VENTA", player: sold.n, from: M.userTeam, to: off.buyer, fee: off.amount });
        M.financeLog.unshift({ s: M.season, w: M.week, concept: `Traspaso ${sold.n} → ${off.buyer}`, amount: off.amount });
      }
    }
    saveCareer();
    renderManager();
  };

  window.mgrRespondSponsor = function (accept) {
    if (!M || !M.pendingSponsorOffer) return;
    const sp = M.pendingSponsorOffer;
    M.pendingSponsorOffer = null;
    if (accept) {
      const club = M.clubs[M.userTeam];
      club.budget += sp.upfront;
      club.sponsorWeekly += sp.weekly;
      club.activeSponsors = club.activeSponsors || [];
      club.activeSponsors.push({ name: sp.name, weekly: sp.weekly, season: M.season });
      M.boardConfidence = clamp(M.boardConfidence + 6, -100, 100);
      M.financeLog.unshift({ s: M.season, w: M.week, concept: `Contrato Sponsor: ${sp.name} (+${fmtMoney(sp.weekly)}/sem)`, amount: sp.upfront });
      addInbox("SPONSOR", `Acuerdo firmado con ${sp.name}`, `Ingresaste ${fmtMoney(sp.upfront)} y tu ingreso semanal subió a ${fmtMoney(club.sponsorWeekly)}/sem.`);
    }
    saveCareer();
    renderManager();
  };

  window.mgrAcceptJobOffer = function (offerIdx) {
    if (!M || !M.pendingJobOffers || !M.pendingJobOffers[offerIdx]) return;
    const offer = M.pendingJobOffers[offerIdx];
    switchManagerToClub(offer.club, offer.reason);
  };

  window.mgrDismissJobOffers = function () { if (!M) return; M.pendingJobOffers = []; saveCareer(); renderManager(); };

  window.mgrSignFreeAgent = function (faIdx) {
    if (!M) return;
    const club = M.clubs[M.userTeam];
    const fa = M.freeAgents[faIdx];
    if (!fa) return;
    const signBonus = Math.round((calcPlayerValue(fa) * 0.35) / 1000) * 1000;
    if (club.budget < signBonus) { alert(`Necesitas ${fmtMoney(signBonus)} de prima para fichar a ${fa.n}.`); return; }
    club.budget -= signBonus;
    M.freeAgents.splice(faIdx, 1);
    const activeCount = club.players.filter(p => !p.sub && !(p.injuredWeeks > 0)).length;
    fa.sub = activeCount >= 5 ? 1 : 0;
    fa.morale = 85;
    club.players.push(fa);
    M.transferLog.unshift({ s: M.season, w: M.week, type: "FICHAJE", player: fa.n, from: "Agente Libre", to: M.userTeam, fee: signBonus });
    M.financeLog.unshift({ s: M.season, w: M.week, concept: `Fichaje libre: ${fa.n}`, amount: -signBonus });
    addInbox("FICHAJE", `Fichado: ${fa.n}`, `${fa.n} (OVR ${calcPlayerOvr(fa)} / POT ${fa.pot}) se une a ${M.userTeam}.`);
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

    if (buyer.budget < buyout) { alert(`La cláusula es ${fmtMoney(buyout)} y tienes ${fmtMoney(buyer.budget)}.`); return; }
    if (!confirm(`¿Pagar ${fmtMoney(buyout)} a ${sellerName} por ${target.n}?`)) return;

    buyer.budget -= buyout;
    seller.budget += buyout;
    seller.players.splice(idx, 1);

    if (seller.players.length < 5) {
      if (M.freeAgents.length) {
        const rep = M.freeAgents.shift();
        rep.sub = 0;
        seller.players.push(rep);
      } else ensureHealthyLineupForAI(seller);
    }

    const activeCount = buyer.players.filter(p => !p.sub && !(p.injuredWeeks > 0)).length;
    target.sub = activeCount >= 5 ? 1 : 0;
    target.morale = 86;
    buyer.players.push(target);

    M.transferLog.unshift({ s: M.season, w: M.week, type: "FICHAJE", player: target.n, from: sellerName, to: M.userTeam, fee: buyout });
    M.financeLog.unshift({ s: M.season, w: M.week, concept: `Cláusula ${target.n} (${sellerName})`, amount: -buyout });
    addInbox("FICHAJE", `BOMBAZO: ${target.n} ficha por ${M.userTeam}`, `Cerrado con ${sellerName} por ${fmtMoney(buyout)}.`);
    saveCareer();
    renderManager();
  };

  window.mgrHireCoach = function (coachIdx) {
    if (!M) return;
    const club = M.clubs[M.userTeam];
    const c = M.freeCoaches[coachIdx];
    if (!c) return;
    if (club.budget < c.fee) { alert(`Necesitas ${fmtMoney(c.fee)} para contratar a ${c.n}.`); return; }
    club.budget -= c.fee;
    const oldCoach = { ...club.coach, fee: 40000 };
    M.freeCoaches.splice(coachIdx, 1);
    M.freeCoaches.push(oldCoach);
    club.coach = { n: c.n, macro: c.macro, micro: c.micro, adapt: c.adapt, dev: c.dev, disc: c.disc };
    M.financeLog.unshift({ s: M.season, w: M.week, concept: `Contratación DT ${c.n}`, amount: -c.fee });
    addInbox("STAFF", `Nuevo Head Coach: ${c.n}`, `${c.n} asume la pizarra (MAC ${c.macro} · ADP ${c.adapt} · DEV ${c.dev}).`);
    saveCareer();
    renderManager();
  };

  window.mgrAdvanceWeek = function (liveMode) { advanceWeekInternal(!!liveMode); };

  window.mgrSkipToNextMatch = function () {
    if (!M || M.fired) return;
    let safety = 0;
    while (safety++ < 22 && M.week < 33 && !M.fired) {
      const wm = getMatchesForWeek(M.week);
      const hasUser = wm.some(m => !m.played && (m.teamA === M.userTeam || m.teamB === M.userTeam));
      if (hasUser) break;
      advanceWeekInternal(false);
    }
  };

  window.mgrOpenLastBoxscore = function (autoPlay) {
    if (!window._mgrLastSeries || typeof window.loadExternalSeriesIntoViewer !== "function") return;
    const ref = window._mgrLastSeries;
    window.loadExternalSeriesIntoViewer(ref.teamA, ref.teamB, ref.series, !!autoPlay, ref.label);
  };

  window.mgrSetMarketFilter = function (key, val) { marketFilter[key] = val; renderManager(); };
  window.mgrSetClubsFilter = function (key, val) { clubsFilter[key] = val; renderManager(); };

  // ===== RENDER DE VISTAS =====
  function getWeekPhaseName(w) {
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

  function renderClubSelectScreen() {
    const allClubs = Object.keys(TEAMS).sort((a, b) => parseFloat(getTeamOvr(b)) - parseFloat(getTeamOvr(a)));
    return `
      <div class="box-head">
        <div>
          <h2>Modo Manager VCT 2027 · Elige tu Franquicia</h2>
          <small class="mut">Temporadas de 33 semanas (Stage 1 + Viaje + Masters 1 + Stage 2 + Viaje + Masters 2 + Viaje + VALORANT Champions), postulación a clubes, academia, sponsors y 10 planes de entrenamiento.</small>
        </div>
        <div class="btn-group">
          <button type="button" class="t-btn-sm mono t-btn-live" onclick="mgrImportSave()">Cargar Partida (.json)</button>
        </div>
      </div>
      <div class="mgr-club-grid">
        ${allClubs.map(name => {
          const meta = TEAM_META[name] || { reg: "VCT", color: "#E5484D" };
          const ovr = parseFloat(getTeamOvr(name));
          const avgPot = (TEAMS[name].reduce((s, p) => s + p.pot, 0) / TEAMS[name].length).toFixed(1);
          const budget = Math.round((360000 + Math.max(0, ovr - 80) * 40000) / 5000) * 5000;
          return `<div class="mgr-club-card" style="border-top:2px solid ${mEsc(meta.color)}">
            <div class="mgr-club-top">
              ${renderTeamLogo(name, "mini-team-logo")}
              <div><b>${mEsc(name)}</b><small class="mono mut">${meta.reg} · DT ${mEsc(COACH[name].n)}</small></div>
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

  function renderFiredScreen() {
    return `<div class="mgr-panel" style="border-color:var(--vct-red)">
      <div class="t-group-head">
        <b class="mono kd-neg">DESPEDIDO POR LA DIRECTIVA DE ${mEsc(M.userTeam.toUpperCase())}</b>
        <span class="mono kd-neg">CONFIANZA FINAL: ${M.boardConfidence}</span>
      </div>
      <p style="font-size:13px;margin:8px 0 12px">Tu puntaje directivo cayó por debajo de -30 tras expirar tu período de gracia. Puedes reconstruir tu carrera aceptando una de estas ofertas o terminar la carrera:</p>
      <div class="mgr-club-grid" style="margin-bottom:12px">
        ${(M.pendingJobOffers || []).map((off, idx) => `<div class="mgr-club-card">
          <div class="mgr-club-top">${renderTeamLogo(off.club, "mini-team-logo")}<div><b>${mEsc(off.club)}</b><small class="mono mut">${off.reg} · ${mEsc(off.reason)}</small></div></div>
          <div class="mgr-club-stats mono"><span>OVR <b>${off.ovr}</b></span><span>CAJA <b class="kd-pos">${fmtMoney(off.budget)}</b></span></div>
          <button type="button" class="p mono" style="width:100%;justify-content:center" onclick="mgrAcceptJobOffer(${idx})">Firmar Contrato</button>
        </div>`).join("")}
      </div>
      <button type="button" class="mono" onclick="mgrEndCareer()">Terminar Modo Carrera</button>
    </div>`;
  }

  function renderHubTab() {
    const club = M.clubs[M.userTeam];
    const weekMatches = getMatchesForWeek(M.week);
    const nextMatch = weekMatches.find(m => !m.played && (m.teamA === M.userTeam || m.teamB === M.userTeam));
    const injured = club.players.filter(p => p.injuredWeeks > 0);
    const healthyStarters = club.players.filter(p => !p.sub && !(p.injuredWeeks > 0));
    const payroll = club.players.reduce((s, p) => s + (p.salary || 2500), 0);
    const travel = isTravelWeek(M.week);

    let matchCard = "";
    if (M.week === 33) {
      matchCard = `<div class="mgr-panel">
        <div class="t-group-head"><b class="mono">GALA DE CIERRE · TEMPORADA ${M.season}</b><span class="duel-badge">FIN DE AÑO</span></div>
        <p style="margin:6px 0 10px;font-size:13px">
          Masters 1: <b>${mEsc(M.schedule.stage1.mastersChamp || "-")}</b> ·
          Masters 2: <b>${mEsc(M.schedule.stage2.mastersChamp || "-")}</b> ·
          VALORANT Champions: <b style="color:var(--gold)">${mEsc(M.schedule.championsChamp || "-")}</b>.
        </p>
        <button type="button" class="p mono" onclick="mgrAdvanceWeek(false)">Iniciar Temporada ${M.season + 1}</button>
      </div>`;
    } else if (nextMatch) {
      const oppName = nextMatch.teamA === M.userTeam ? nextMatch.teamB : nextMatch.teamA;
      const oppClub = M.clubs[oppName];
      matchCard = `<div class="mgr-panel mgr-matchday">
        <div class="t-group-head">
          <b class="mono">PRÓXIMO PARTIDO · SEMANA ${M.week}/33</b>
          <span class="t-fmt-tag mono">BO${nextMatch.fmt}</span>
        </div>
        <div class="mgr-versus">
          <div class="t-team-cell">${logoFramed(M.userTeam)}<div><b>${mEsc(M.userTeam)}</b><small class="mono mut" style="display:block">OVR ${calcRosterOvr(club.players, club.coach)}</small></div></div>
          <span class="mono mut" style="font-size:14px;font-weight:700">VS</span>
          <div class="t-team-cell" style="flex-direction:row-reverse;text-align:right">${logoFramed(oppName)}<div><b>${mEsc(oppName)}</b><small class="mono mut" style="display:block">OVR ${calcRosterOvr(oppClub.players, oppClub.coach)}</small></div></div>
        </div>
        <div class="mono mut" style="font-size:11px;margin-bottom:10px">${mEsc(nextMatch.label)} · Titulares sanos: <b class="${healthyStarters.length === 5 ? 'kd-pos' : 'kd-neg'}">${healthyStarters.length}/5</b></div>
        <div class="btn-group">
          <button type="button" class="p mono" onclick="mgrAdvanceWeek(false)">Simular Semana</button>
          <button type="button" class="mono t-btn-live" style="border-color:var(--ok);color:var(--ok)" onclick="mgrAdvanceWeek(true)">Jugar Partido En Vivo</button>
        </div>
      </div>`;
    } else if (travel) {
      matchCard = `<div class="mgr-panel" style="border-color:var(--vct-cyan)">
        <div class="t-group-head"><b class="mono" style="color:var(--vct-cyan)">${getWeekPhaseName(M.week)}</b><span class="t-fmt-tag mono">RECUPERACIÓN -15 FAT</span></div>
        <p class="mut" style="margin:6px 0 10px;font-size:12.5px">El plantel viaja a la sede internacional y descansa antes del gran torneo (-15% Fatiga automática extra y +2 Moral). Revisa el bracket en Calendario o ajusta tu plan semanal.</p>
        <div class="btn-group">
          <button type="button" class="p mono" onclick="mgrAdvanceWeek(false)">Avanzar Semana de Viaje (${M.week} → ${M.week + 1})</button>
          <button type="button" class="mono" onclick="mgrSkipToNextMatch()">Saltar al Torneo</button>
        </div>
      </div>`;
    } else {
      matchCard = `<div class="mgr-panel">
        <div class="t-group-head"><b class="mono">SEMANA ${M.week}/33 · SIN PARTIDO OFICIAL</b><span class="mono mut">${getWeekPhaseName(M.week)}</span></div>
        <p class="mut" style="margin:6px 0 10px;font-size:12.5px">Semana libre o fase donde compiten otros clubes. Puedes entrenar, explorar la Academia, postularte a otro club o saltar al próximo partido.</p>
        <div class="btn-group">
          <button type="button" class="p mono" onclick="mgrAdvanceWeek(false)">Avanzar 1 Semana (${M.week} → ${M.week + 1})</button>
          <button type="button" class="mono" onclick="mgrSkipToNextMatch()">Saltar al Próximo Partido</button>
        </div>
      </div>`;
    }

    const alerts = [];
    if (M.pendingSponsorOffer) {
      const sp = M.pendingSponsorOffer;
      alerts.push(`<div class="mgr-alert-bar" style="border-color:var(--ok)">
        <span class="mono"><b>OFERTA PATROCINADOR (${mEsc(sp.reason)}):</b> ${mEsc(sp.name)} ofrece <b class="kd-pos">${fmtMoney(sp.upfront)}</b> + <b class="kd-pos">${fmtMoney(sp.weekly)}/sem</b></span>
        <div class="btn-group">
          <button type="button" class="t-btn-sm mono t-btn-live" onclick="mgrRespondSponsor(true)">Firmar Sponsor</button>
          <button type="button" class="t-btn-sm mono" onclick="mgrRespondSponsor(false)">Rechazar</button>
        </div>
      </div>`);
    }
    if (M.pendingJobOffers && M.pendingJobOffers.length) {
      alerts.push(`<div class="mgr-alert-bar" style="border-color:var(--purple)">
        <span class="mono"><b>OFERTAS DE OTROS CLUBES:</b> ${M.pendingJobOffers.map((o, i) => `${mEsc(o.club)} (OVR ${o.ovr}, ${fmtMoney(o.budget)}) <button type="button" class="t-btn-sm mono" style="margin:0 4px" onclick="mgrAcceptJobOffer(${i})">Dirigir ${mEsc(o.club)}</button>`).join(" · ")}</span>
        <button type="button" class="t-btn-sm mono" onclick="mgrDismissJobOffers()">Quedarme</button>
      </div>`);
    }
    if (M.pendingOffer) {
      alerts.push(`<div class="mgr-alert-bar" style="border-color:var(--gold)">
        <span class="mono"><b>OFERTA DE TRASPASO:</b> ${mEsc(M.pendingOffer.buyer)} ofrece <b class="kd-pos">${fmtMoney(M.pendingOffer.amount)}</b> por <b>${mEsc(M.pendingOffer.player)}</b></span>
        <div class="btn-group">
          <button type="button" class="t-btn-sm mono t-btn-live" onclick="mgrRespondOffer(true)">Vender</button>
          <button type="button" class="t-btn-sm mono" onclick="mgrRespondOffer(false)">Rechazar</button>
        </div>
      </div>`);
    }

    const lastMatchBar = M.lastPlayedMatch
      ? `<div class="mgr-last-bar mono">
          <span>ÚLTIMO PARTIDO: <b>${mEsc(M.lastPlayedMatch.teamA)} ${M.lastPlayedMatch.scoreA}-${M.lastPlayedMatch.scoreB} ${mEsc(M.lastPlayedMatch.teamB)}</b> (${mEsc(M.lastPlayedMatch.mapsLine)})</span>
          ${window._mgrLastSeries ? `<div class="btn-group"><button type="button" class="t-btn-sm mono" onclick="mgrOpenLastBoxscore(false)">Ver Boxscore</button><button type="button" class="t-btn-sm mono" onclick="mgrOpenLastBoxscore(true)">Replay Vivo</button></div>` : ""}
        </div>`
      : "";

    const confCls = M.boardConfidence >= 35 ? "kd-pos" : M.boardConfidence <= 0 ? "kd-neg" : "";
    const rep = calcManagerReputation();

    return `
      ${alerts.join("")}
      ${lastMatchBar}
      <div class="mgr-hub-grid">
        <div style="display:flex;flex-direction:column;gap:10px">
          ${matchCard}
          <div class="mgr-panel">
            <div class="t-group-head"><b class="mono">PLAN DE ENTRENAMIENTO SEMANAL (10 MODOS)</b><span class="mono mut">DT ${mEsc(club.coach.n)} · DEV ${club.coach.dev}</span></div>
            <div class="mgr-train-list mgr-train-compact">
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
            <div class="t-group-head">
              <b class="mono">ESTADO DEL CLUB &amp; MANAGER</b>
              <span class="mono ${M.graceWeeks > 0 ? 'kd-pos' : 'mut'}">${M.graceWeeks > 0 ? `GRACIA: ${M.graceWeeks} SEM` : "DESPIDO EN -30"}</span>
            </div>
            <div class="mgr-kpi-row mono">
              <div><small class="mut">DIRECTIVA</small><b class="${confCls}">${M.boardConfidence > 0 ? "+" : ""}${M.boardConfidence}</b></div>
              <div><small class="mut">REP MANAGER</small><b style="color:var(--vct-cyan)">${rep}/99</b></div>
              <div><small class="mut">FLUJO/SEM</small><b class="${club.sponsorWeekly - payroll >= 0 ? 'kd-pos' : 'kd-neg'}">${fmtMoney(club.sponsorWeekly - payroll)}</b></div>
              <div><small class="mut">RACHA W</small><b class="${M.winStreak >= 5 ? 'stat-elite' : ''}">${M.winStreak}${M.winStreak >= 5 ? " ($)" : ""}</b></div>
            </div>
            <div class="mono mut" style="font-size:11px;margin-top:8px;padding-top:8px;border-top:1px solid var(--bd)">
              Récord Carrera: <b style="color:var(--fg)">${M.career.wins}W-${M.career.losses}L</b> · PTS VCT: <b style="color:var(--fg)">${M.schedule.vctPoints[M.userTeam] || 0}</b> · Lesionados: <b class="${injured.length ? 'kd-neg' : 'kd-pos'}">${injured.length}</b> · Títulos: <b style="color:var(--gold)">${M.trophies.length}</b>
            </div>
          </div>

          <div class="mgr-panel">
            <div class="t-group-head"><b class="mono">BUZÓN DEL MANAGER</b><span class="mono mut">${M.inbox.length} MENSAJES</span></div>
            <div class="mgr-inbox-scroll">
              ${M.inbox.map(msg => `<div class="mgr-msg">
                <div class="mgr-msg-top mono"><span class="mgr-tag tag-${msg.tag.toLowerCase().replace(/\s+/g, '')}">${mEsc(msg.tag)}</span><span class="mut">T${msg.season} · S${msg.week}</span></div>
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
        <span class="mono"><b>ALERTA DE QUINTETO:</b> Solo tienes ${healthyStarters}/5 titulares sanos. Activa un suplente o contrata un talento en Academia.</span>
        <button type="button" class="t-btn-sm mono" onclick="mgrSwitchTab('academy')">Ir a Academia</button>
      </div>` : ""}

      <div class="sc">
        <table>
          <thead>
            <tr>
              <th style="text-align:left">Jugador</th>
              <th style="text-align:left">Estado</th>
              <th>EDAD</th>
              <th>PJ</th>
              <th>OVR / POT</th>
              <th>MORAL</th>
              <th>FATIGA</th>
              <th>SUELDO</th>
              <th>AIM</th><th>FD</th><th>CLU</th><th>ENT</th><th>UTI</th><th>IGL</th>
              <th style="text-align:left">Plan Individual</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${club.players.map((p, idx) => {
              const ovr = calcPlayerOvr(p);
              const isInj = p.injuredWeeks > 0;
              const statusEl = isInj
                ? `<span class="sub-swap-btn" style="border-color:var(--vct-red);color:var(--vct-red);cursor:default">LESIÓN ${p.injuredWeeks}S</span>`
                : `<button type="button" class="sub-swap-btn ${p.sub ? 'is-sub' : 'is-starter'}" onclick="mgrToggleStarter(${idx})">${p.sub ? "6TH SUB ⇄" : "TITULAR ⇄"}</button>`;
              const fatCol = p.fatigue >= 76 ? "var(--vct-red)" : p.fatigue >= 55 ? "var(--gold)" : "var(--ok)";
              const morCol = p.morale >= 75 ? "var(--ok)" : p.morale <= 45 ? "var(--vct-red)" : "var(--gold)";
              const acadBadge = p.isAcademy ? `<span class="igl-tag" style="color:var(--ok);border-color:var(--ok)">ACAD</span>` : "";
              const hushBadge = p._hushMastery >= 0.9 ? `<span class="igl-tag" style="color:var(--purple);border-color:var(--purple)">HUSH</span>`
                              : p.hushProgress > 0 ? `<span class="igl-tag">HUSH ${p.hushProgress}%</span>` : "";

              return `<tr>
                <td style="text-align:left">
                  <div><b>${mEsc(p.n)}</b>${acadBadge}${hushBadge}</div>
                  <small class="mut">${getRoleIcon(p.r)} ${mEsc(p.r)}${isInj ? ` · <span class="kd-neg">${mEsc(p.injuryType)}</span>` : ""}</small>
                </td>
                <td style="text-align:left">${statusEl}</td>
                <td class="mono mut">${p.age}</td>
                <td class="mono">${p.matchesPlayed || 0}</td>
                <td class="mono"><b>${ovr}</b> <span class="mut">/ ${p.pot}</span></td>
                <td class="mono"><div class="mgr-meter"><span>${p.morale}</span><div class="mgr-bar"><i style="width:${p.morale}%;background:${morCol}"></i></div></div></td>
                <td class="mono"><div class="mgr-meter"><span>${p.fatigue}%</span><div class="mgr-bar"><i style="width:${p.fatigue}%;background:${fatCol}"></i></div></div></td>
                <td class="mono mut">${fmtMoney(p.salary)}</td>
                <td class="mono">${p.aim}${fmtDelta(p.deltas.aim)}</td>
                <td class="mono">${p.fd}${fmtDelta(p.deltas.fd)}</td>
                <td class="mono">${p.clutch}${fmtDelta(p.deltas.clutch)}</td>
                <td class="mono">${p.entry}${fmtDelta(p.deltas.entry)}</td>
                <td class="mono">${p.util}${fmtDelta(p.deltas.util)}</td>
                <td class="mono">${p.igl}${fmtDelta(p.deltas.igl)}</td>
                <td style="text-align:left">
                  <select class="cb-mini-sel mono" style="width:124px" onchange="mgrSetPlayerPlan(${idx}, this.value)">
                    ${Object.entries(PLAYER_PLANS).map(([k, obj]) => `<option value="${k}" ${p.plan === k ? "selected" : ""}>${obj.label}</option>`).join("")}
                  </select>
                </td>
                <td>
                  <div class="btn-group" style="justify-content:flex-end">
                    ${isInj ? `<button type="button" class="t-btn-sm mono t-btn-live" onclick="mgrPhysio(${idx})">Fisio $15k</button>` : ""}
                    <button type="button" class="t-btn-sm mono" onclick="mgrSellPlayer(${idx})">Vender</button>
                  </div>
                </td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
      ${renderLearningTableHTML(club)}`;
  }

  function renderAcademyTab() {
    const club = M.clubs[M.userTeam];
    return `
      <div class="db-controls">
        <span class="mono mut" style="font-size:11.5px">PROSPECTOS DE ACADEMIA (${M.academy.length}) · Precio escalado por POT · Sueldos bajos · Mejoran 2.4x más rápido jugando partidos oficiales</span>
        <button type="button" class="t-btn-sm mono" onclick="mgrScoutMoreAcademy()">Nuevo Ojeo Juvenil ($10k)</button>
      </div>
      <div class="sc">
        <table>
          <thead>
            <tr>
              <th style="text-align:left">Prospecto</th>
              <th style="text-align:left">Rol</th>
              <th>EDAD</th>
              <th>OVR</th>
              <th>POT</th>
              <th>AIM</th><th>FD</th><th>CLU</th><th>UTI</th><th>IGL</th>
              <th>Salario/Sem</th>
              <th>Coste Contrato</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            ${M.academy.map((k, idx) => {
              const ovr = calcPlayerOvr(k);
              const cost = k.hireCost || calcAcademyPriceByPot(k.pot);
              const canAfford = club.budget >= cost;
              const potCls = k.pot >= 93 ? "stat-elite" : k.pot >= 89 ? "stat-high" : "mut";
              return `<tr>
                <td style="text-align:left"><b>${mEsc(k.n)}</b> <span class="igl-tag">${k.pot >= 93 ? "JOYA" : "CANTERA"}</span></td>
                <td style="text-align:left">${getRoleIcon(k.r)} ${mEsc(k.r)}</td>
                <td class="mono mut">${k.age}</td>
                <td class="mono"><b>${ovr}</b></td>
                <td class="mono ${potCls}"><b>${k.pot}</b></td>
                <td class="mono">${k.aim}</td>
                <td class="mono">${k.fd}</td>
                <td class="mono">${k.clutch}</td>
                <td class="mono">${k.util}</td>
                <td class="mono">${k.igl}</td>
                <td class="mono kd-pos">${fmtMoney(k.salary)}</td>
                <td class="mono ${canAfford ? '' : 'kd-neg'}"><b>${fmtMoney(cost)}</b></td>
                <td><button type="button" class="t-btn-sm mono t-btn-live" ${canAfford ? "" : "disabled"} onclick="mgrHireAcademy(${idx})">Contratar</button></td>
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
          <span class="mono mut" style="font-size:11px">DT ACTUAL: <b style="color:var(--fg)">${mEsc(club.coach.n)}</b> (MAC ${club.coach.macro} · ADP ${club.coach.adapt} · DEV ${club.coach.dev})</span>
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
      M.freeAgents.forEach((p, idx) => list.push({ p, source: "Agente Libre", isFree: true, faIdx: idx, fee: Math.round((calcPlayerValue(p) * 0.35) / 1000) * 1000 }));
    }
    if (marketFilter.source === "ALL" || marketFilter.source === "CLUBS") {
      for (const cName in M.clubs) {
        if (cName === M.userTeam) continue;
        M.clubs[cName].players.forEach(p => list.push({ p, source: cName, isFree: false, fee: Math.round((calcPlayerValue(p) * 1.15) / 1000) * 1000 }));
      }
    }

    const filtered = list.filter(item => {
      if (marketFilter.role !== "ALL" && !item.p.r.toLowerCase().includes(marketFilter.role.toLowerCase())) return false;
      if (q && !item.p.n.toLowerCase().includes(q) && !item.source.toLowerCase().includes(q) && !item.p.r.toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => (a.isFree !== b.isFree && marketFilter.source === "ALL") ? (a.isFree ? -1 : 1) : calcPlayerOvr(b.p) - calcPlayerOvr(a.p)).slice(0, 45);

    return `
      <div class="db-controls">
        <div class="region-tabs">
          <button type="button" class="tab-btn mono active" onclick="mgrSetMarketFilter('view','players')">JUGADORES</button>
          <button type="button" class="tab-btn mono" onclick="mgrSetMarketFilter('view','coaches')">HEAD COACHES (${M.freeCoaches.length})</button>
          <select class="cb-mini-sel mono" onchange="mgrSetMarketFilter('source', this.value)">
            <option value="ALL" ${marketFilter.source === "ALL" ? "selected" : ""}>Origen: Todos</option>
            <option value="FREE" ${marketFilter.source === "FREE" ? "selected" : ""}>Agentes Libres (${M.freeAgents.length})</option>
            <option value="CLUBS" ${marketFilter.source === "CLUBS" ? "selected" : ""}>Clubes Rivales</option>
          </select>
          <select class="cb-mini-sel mono" onchange="mgrSetMarketFilter('role', this.value)">
            <option value="ALL" ${marketFilter.role === "ALL" ? "selected" : ""}>Rol: Todos</option>
            ${["Duelista", "Iniciador", "Controlador", "Centinela", "Flex"].map(r => `<option value="${r}" ${marketFilter.role === r ? "selected" : ""}>${r}</option>`).join("")}
          </select>
        </div>
        <input type="search" class="search-input" value="${mEsc(marketFilter.query)}" placeholder="Buscar jugador o club..." oninput="mgrSetMarketFilter('query', this.value)">
      </div>
      <div class="sc">
        <table>
          <thead><tr><th style="text-align:left">Jugador</th><th style="text-align:left">Club Actual</th><th>EDAD</th><th>OVR</th><th>POT</th><th>AIM</th><th>CLU</th><th>UTI</th><th>IGL</th><th>Sueldo/Sem</th><th>Coste</th><th>Acción</th></tr></thead>
          <tbody>
            ${filtered.map(item => {
              const p = item.p, ovr = calcPlayerOvr(p), canAfford = club.budget >= item.fee;
              return `<tr>
                <td style="text-align:left"><b>${mEsc(p.n)}</b> <small class="mut">${getRoleIcon(p.r)} ${mEsc(p.r)}</small></td>
                <td style="text-align:left" class="mono ${item.isFree ? 'kd-pos' : 'mut'}" style="font-size:11px">${mEsc(item.source)}</td>
                <td class="mono mut">${p.age}</td><td class="mono"><b>${ovr}</b></td>
                <td class="mono ${p.pot >= 92 ? 'stat-elite' : ''}">${p.pot}</td>
                <td class="mono">${p.aim}</td><td class="mono">${p.clutch}</td><td class="mono">${p.util}</td><td class="mono">${p.igl}</td>
                <td class="mono mut">${fmtMoney(p.salary)}</td>
                <td class="mono ${canAfford ? '' : 'kd-neg'}"><b>${fmtMoney(item.fee)}</b></td>
                <td>${item.isFree
                  ? `<button type="button" class="t-btn-sm mono t-btn-live" ${canAfford ? "" : "disabled"} onclick="mgrSignFreeAgent(${item.faIdx})">Fichar</button>`
                  : `<button type="button" class="t-btn-sm mono" ${canAfford ? "" : "disabled"} onclick="mgrBuyFromClub('${mEsc(item.source)}','${mEsc(p.n)}')">Cláusula</button>`
                }</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>`;
  }

  function renderCalendarTab() {
    const sc = M.schedule;
    const renderStageTable = (stageObj, title) => {
      const st = computeStageStandings(stageObj);
      return `<div class="t-group-card">
        <div class="t-group-head"><b class="mono">${mEsc(title)}</b><span class="mono mut">TOP 4 PLAYOFFS</span></div>
        <div class="sc"><table>
          <thead><tr><th>#</th><th style="text-align:left">Club</th><th>PJ</th><th>G-P</th><th>MAP</th><th>PTS</th></tr></thead>
          <tbody>${st.map((r, i) => `<tr class="${r.team === M.userTeam ? 't-friend-row' : ''}">
            <td class="mono ${i < 4 ? 'kd-pos' : 'mut'}"><b>${i + 1}</b></td>
            <td style="text-align:left"><span class="t-team-cell">${renderTeamLogo(r.team, "mini-team-logo")}<b>${mEsc(r.team)}</b></span></td>
            <td class="mono">${r.pj}</td><td class="mono"><b>${r.g}-${r.p}</b></td><td class="mono mut">${r.mw}-${r.ml}</td><td class="mono"><b>${r.pts}</b></td>
          </tr>`).join("")}</tbody>
        </table></div>
      </div>`;
    };

    const renderListCard = (title, list) => `<div class="t-group-card">
      <div class="t-group-head"><b class="mono">${title}</b></div>
      <div class="mgr-bracket-list" style="max-height:260px;overflow-y:auto">
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

    const vctRanking = Object.keys(M.clubs)
      .map(c => ({ team: c, pts: sc.vctPoints[c] || 0, reg: M.clubs[c].reg, ovr: calcRosterOvr(M.clubs[c].players, M.clubs[c].coach) }))
      .sort((a, b) => b.pts - a.pts || b.ovr - a.ovr);

    return `
      <div class="t-groups-grid">
        ${renderStageTable(sc.stage1, sc.stage1.leagueName.toUpperCase() + " (SEM 2-6)")}
        ${renderListCard("STAGE 1 PO (S7-8) · VIAJE (S9-10) · MASTERS 1 (S11-13)", [...sc.stage1.playoffs, ...sc.stage1.masters])}
      </div>
      <div class="t-groups-grid" style="margin-top:10px">
        ${renderStageTable(sc.stage2, sc.stage2.leagueName.toUpperCase() + " (SEM 15-19)")}
        ${renderListCard("STAGE 2 PO (S20-21) · VIAJE (S22-23) · MASTERS 2 (S24-26)", [...sc.stage2.playoffs, ...sc.stage2.masters])}
      </div>
      <div class="t-groups-grid" style="margin-top:10px">
        ${renderListCard(`VIAJE (S27-28) · VALORANT CHAMPIONS ${M.season} (S29-32)`, sc.champions)}
        <div class="t-group-card">
          <div class="t-group-head"><b class="mono">TABLA GLOBAL PUNTOS VCT (TOP 16 A CHAMPIONS)</b></div>
          <div class="sc" style="max-height:260px;overflow-y:auto">
            <table>
              <thead><tr><th>#</th><th style="text-align:left">Equipo</th><th>REG</th><th>OVR</th><th>PTS VCT</th></tr></thead>
              <tbody>
                ${vctRanking.map((r, i) => `<tr class="${r.team === M.userTeam ? 't-friend-row' : ''}">
                  <td class="mono ${i < 16 ? 'kd-pos' : 'mut'}"><b>${i + 1}</b></td>
                  <td style="text-align:left"><span class="t-team-cell">${renderTeamLogo(r.team, "mini-team-logo")}<b>${mEsc(r.team)}</b></span></td>
                  <td class="mono mut">${r.reg}</td>
                  <td class="mono">${r.ovr}</td>
                  <td class="mono"><b>${r.pts}</b></td>
                </tr>`).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;
  }

  function renderClubsTab() {
    const clubList = Object.keys(M.clubs)
      .filter(c => clubsFilter.reg === "ALL" || M.clubs[c].reg === clubsFilter.reg)
      .sort((a, b) => calcRosterOvr(M.clubs[b].players, M.clubs[b].coach) - calcRosterOvr(M.clubs[a].players, M.clubs[a].coach));

    if (!clubsFilter.selectedClub || !M.clubs[clubsFilter.selectedClub]) {
      clubsFilter.selectedClub = clubList.find(c => c !== M.userTeam) || clubList[0];
    }
    const selClub = M.clubs[clubsFilter.selectedClub];
    const myBudget = M.clubs[M.userTeam].budget;
    const myRep = calcManagerReputation();
    const reqRep = getClubRequiredRep(selClub.name);
    const nowTick = M.season * 100 + M.week;
    const cd = (M.career.applyCooldown || {})[selClub.name] || 0;
    const onCooldown = nowTick < cd;

    const repDiff = myRep - reqRep;
    const chanceLabel = repDiff >= 2 ? "ALTA" : repDiff >= -5 ? "MEDIA" : "BAJA";
    const chanceCls = repDiff >= 2 ? "kd-pos" : repDiff >= -5 ? "stat-elite" : "kd-neg";

    return `
      <div class="db-controls">
        <div class="region-tabs">
          ${["ALL", "AMERICAS", "EMEA", "PACIFIC", "CHINA"].map(r =>
            `<button type="button" class="tab-btn mono ${clubsFilter.reg === r ? 'active' : ''}" onclick="mgrSetClubsFilter('reg','${r}')">${r === "ALL" ? "TODOS (21)" : r}</button>`
          ).join("")}
        </div>
        <span class="mono mut" style="font-size:11px">TU REPUTACIÓN: <b style="color:var(--vct-cyan)">${myRep}/99</b> · Haz clic en un club para ver su roster o postularte como Manager</span>
      </div>

      <div class="mgr-clubs-layout">
        <div class="t-group-card">
          <div class="t-group-head"><b class="mono">FRANQUICIAS VCT (${clubList.length})</b></div>
          <div class="sc" style="max-height:430px;overflow-y:auto">
            <table>
              <thead><tr><th style="text-align:left">Club</th><th>REG</th><th>OVR</th><th>REQ REP</th><th>PTS</th></tr></thead>
              <tbody>
                ${clubList.map(cName => {
                  const cl = M.clubs[cName];
                  const isSel = cName === clubsFilter.selectedClub;
                  const rReq = getClubRequiredRep(cName);
                  return `<tr style="cursor:pointer;${isSel ? 'background:var(--bg3)' : ''}" onclick="mgrSetClubsFilter('selectedClub','${mEsc(cName)}')">
                    <td style="text-align:left"><span class="t-team-cell">${renderTeamLogo(cName, "mini-team-logo")}<b>${mEsc(cName)}</b>${cName === M.userTeam ? '<span class="igl-tag">TÚ</span>' : ""}</span></td>
                    <td class="mono mut">${cl.reg.slice(0, 3)}</td>
                    <td class="mono"><b>${calcRosterOvr(cl.players, cl.coach)}</b></td>
                    <td class="mono ${myRep >= rReq ? 'kd-pos' : 'mut'}">${cName === M.userTeam ? "-" : rReq}</td>
                    <td class="mono">${M.schedule.vctPoints[cName] || 0}</td>
                  </tr>`;
                }).join("")}
              </tbody>
            </table>
          </div>
        </div>

        <div class="t-group-card">
          <div class="t-group-head" style="flex-wrap:wrap;gap:8px">
            <span class="t-team-cell">${renderTeamLogo(selClub.name, "mini-team-logo")}<b style="color:${mEsc(selClub.color)};font-size:15px">${mEsc(selClub.name)}</b><span class="mono mut">DT ${mEsc(selClub.coach.n)} · CAJA ${fmtMoney(selClub.budget)}</span></span>
            <div class="btn-group">
              ${selClub.name !== M.userTeam
                ? `<span class="mono mut" style="font-size:10.5px;align-self:center">REQ REP ${reqRep} (<b class="${chanceCls}">${chanceLabel}</b>)</span>
                   <button type="button" class="t-btn-sm mono t-btn-live" ${onCooldown ? "disabled" : ""} onclick="mgrApplyForClub('${mEsc(selClub.name)}')">
                     ${onCooldown ? `Espera ${cd - nowTick}S` : "Postular como Manager"}
                   </button>`
                : `<span class="igl-tag">TU CLUB ACTUAL</span>`}
            </div>
          </div>
          <div class="sc">
            <table>
              <thead>
                <tr>
                  <th style="text-align:left">Jugador</th>
                  <th>ESTADO</th>
                  <th>EDAD</th>
                  <th>OVR / POT</th>
                  <th>AIM</th><th>FD</th><th>CLU</th><th>UTI</th><th>IGL</th>
                  <th>Cláusula</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                ${selClub.players.map(p => {
                  const ovr = calcPlayerOvr(p);
                  const buyout = Math.round((calcPlayerValue(p) * 1.15) / 1000) * 1000;
                  const canBuy = selClub.name !== M.userTeam && myBudget >= buyout;
                  const stTxt = p.injuredWeeks > 0 ? `LES ${p.injuredWeeks}S` : (p.sub ? "SUB" : "TIT");
                  return `<tr>
                    <td style="text-align:left"><b>${mEsc(p.n)}</b> <small class="mut">${getRoleIcon(p.r)} ${mEsc(p.r)}</small></td>
                    <td class="mono ${p.injuredWeeks > 0 ? 'kd-neg' : p.sub ? 'mut' : 'kd-pos'}">${stTxt}</td>
                    <td class="mono mut">${p.age}</td>
                    <td class="mono"><b>${ovr}</b> <span class="mut">/ ${p.pot}</span></td>
                    <td class="mono">${p.aim}</td>
                    <td class="mono">${p.fd}</td>
                    <td class="mono">${p.clutch}</td>
                    <td class="mono">${p.util}</td>
                    <td class="mono">${p.igl}</td>
                    <td class="mono mut">${selClub.name === M.userTeam ? "-" : fmtMoney(buyout)}</td>
                    <td>${selClub.name === M.userTeam
                      ? `<span class="mono mut" style="font-size:10px">TU CLUB</span>`
                      : `<button type="button" class="t-btn-sm mono" ${canBuy ? "" : "disabled"} onclick="mgrBuyFromClub('${mEsc(selClub.name)}','${mEsc(p.n)}')">Fichar</button>`
                    }</td>
                  </tr>`;
                }).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;
  }

  function renderFinanceTab() {
    const club = M.clubs[M.userTeam];
    const payroll = club.players.reduce((s, p) => s + (p.salary || 2500), 0);
    return `<div class="t-groups-grid">
      <div class="t-group-card">
        <div class="t-group-head"><b class="mono">MOVIMIENTOS FINANCIEROS</b><span class="mono mut">SPONSORS ${fmtMoney(club.sponsorWeekly)} · NÓMINA ${fmtMoney(payroll)}/SEM</span></div>
        ${(club.activeSponsors && club.activeSponsors.length) ? `<div class="mono" style="font-size:11px;margin-bottom:8px;color:var(--ok)">Sponsors extra activos: ${club.activeSponsors.map(s => `${mEsc(s.name)} (+${fmtMoney(s.weekly)}/sem)`).join(" · ")}</div>` : ""}
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
        <div class="t-group-head"><b class="mono">PALMARÉS DEL MANAGER &amp; FICHAJES</b><span class="mono mut">RÉCORD: ${M.career.wins}W-${M.career.losses}L · RACHA: ${M.bestStreak || 0}W</span></div>
        <div style="margin-bottom:8px;font-size:12px" class="mono">
          ${M.trophies.length ? M.trophies.map(t => `<span class="duel-badge" style="margin:0 5px 5px 0;display:inline-block">${t.season} · ${mEsc(t.title)} (${mEsc(t.club)})</span>`).join("") : `<span class="mut">Sin trofeos todavía.</span>`}
        </div>
        <div class="sc" style="max-height:230px;overflow-y:auto">
          <table>
            <thead><tr><th style="text-align:left">Op</th><th style="text-align:left">Jugador</th><th style="text-align:left">Movimiento</th><th>Monto</th></tr></thead>
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

    if (!M) { root.innerHTML = renderClubSelectScreen(); return; }

    const club = M.clubs[M.userTeam];
    const ovr = calcRosterOvr(club.players, club.coach);
    const rep = calcManagerReputation();
    let body = "";
    if (M.fired) body = renderFiredScreen();
    else if (activeTab === "hub") body = renderHubTab();
    else if (activeTab === "squad") body = renderSquadTab();
    else if (activeTab === "academy") body = renderAcademyTab();
    else if (activeTab === "market") body = renderMarketTab();
    else if (activeTab === "calendar") body = renderCalendarTab();
    else if (activeTab === "clubs") body = renderClubsTab();
    else body = renderFinanceTab();

    root.innerHTML = `
      <div class="mgr-header-bar">
        <div class="mgr-brand-left">
          ${logoFramed(M.userTeam)}
          <div>
            <div class="mono mut" style="font-size:10px">MODO MANAGER · TEMPORADA ${M.season} · SEMANA ${M.week}/33 · ${getWeekPhaseName(M.week)}</div>
            <h2 style="font-size:22px;margin-top:2px;color:${mEsc(club.color)}">${mEsc(M.userTeam)}</h2>
          </div>
        </div>
        <div class="mgr-header-kpis mono">
          <div class="mgr-kpi-box"><small>OVR</small><b>${ovr}</b></div>
          <div class="mgr-kpi-box"><small>PRESUPUESTO</small><b class="${club.budget >= 0 ? 'kd-pos' : 'kd-neg'}">${fmtMoney(club.budget)}</b></div>
          <div class="mgr-kpi-box"><small>DIRECTIVA${M.graceWeeks > 0 ? ` (G:${M.graceWeeks}S)` : ""}</small><b class="${M.boardConfidence >= 35 ? 'kd-pos' : M.boardConfidence <= 0 ? 'kd-neg' : ''}">${M.boardConfidence > 0 ? "+" : ""}${M.boardConfidence}</b></div>
          <div class="mgr-kpi-box"><small>REP</small><b style="color:var(--vct-cyan)">${rep}</b></div>
          <div class="mgr-kpi-box"><small>GUARDADO</small><b class="kd-pos">${M.lastSavedAt || "AUTO"}</b></div>
          <button type="button" class="t-btn-sm mono t-btn-live" onclick="mgrExportSave()" title="Descarga tu partida en .json para respaldo o pasarla a amigos">Exportar .json</button>
          <button type="button" class="t-btn-sm mono" onclick="mgrImportSave()" title="Carga una partida .json tuya o de un amigo">Importar .json</button>
          <button type="button" class="t-btn-sm mono mgr-end-btn" onclick="mgrEndCareer()" title="Termina esta carrera y vuelve a elegir club desde cero">Terminar Carrera</button>
        </div>
      </div>

      ${M.fired ? "" : `<div class="series-tabs" style="margin-bottom:12px">
        <button type="button" class="series-tab ${activeTab === 'hub' ? 'active' : ''}" onclick="mgrSwitchTab('hub')">RESUMEN &amp; SEMANA</button>
        <button type="button" class="series-tab ${activeTab === 'squad' ? 'active' : ''}" onclick="mgrSwitchTab('squad')">PLANTILLA (${club.players.length})</button>
        <button type="button" class="series-tab ${activeTab === 'academy' ? 'active' : ''}" onclick="mgrSwitchTab('academy')">ACADEMIA (${M.academy.length})</button>
        <button type="button" class="series-tab ${activeTab === 'market' ? 'active' : ''}" onclick="mgrSwitchTab('market')">FICHAJES &amp; STAFF</button>
        <button type="button" class="series-tab ${activeTab === 'calendar' ? 'active' : ''}" onclick="mgrSwitchTab('calendar')">CALENDARIO (33S)</button>
        <button type="button" class="series-tab ${activeTab === 'clubs' ? 'active' : ''}" onclick="mgrSwitchTab('clubs')">POSTULAR &amp; CLUBES</button>
        <button type="button" class="series-tab ${activeTab === 'finance' ? 'active' : ''}" onclick="mgrSwitchTab('finance')">FINANZAS &amp; LEGADO</button>
      </div>`}

      ${body}
    `;
  }

  loadCareer();
  renderManager();
})();