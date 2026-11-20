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
const STORAGE_KEY = "vct_sim_2027_rosters_v7";
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

// ===== POOL DE 7 MAPAS COMPETITIVOS (INCLUYE BREEZE DE LARGA DISTANCIA) =====
const MAP_POOL = {
  "Ascent": { desc: "Ascent · Control de medio y Operator (+AIM/FD, Defensor)", aim: 1.05, fd: 1.07, util: 0.99, entry: 1.00, clu: 1.00, igl: 1.03, atkBias: 0.97, defBias: 1.03, longRange: true,  preferWall: false },
  "Bind":   { desc: "Bind · Teleporters y utilidad pesada (+ENT/UTI, Raze/Viper/Brim)", aim: 0.99, fd: 1.02, util: 1.10, entry: 1.09, clu: 1.01, igl: 1.02, atkBias: 1.01, defBias: 0.99, longRange: false, preferWall: true  },
  "Breeze": { desc: "Breeze · Duelos de larga distancia y Operator (+AIM/FD, Chamber/Jett/Viper)", aim: 1.09, fd: 1.10, util: 0.96, entry: 1.00, clu: 1.01, igl: 1.00, atkBias: 1.02, defBias: 0.98, longRange: true,  preferWall: true  },
  "Haven":  { desc: "Haven · 3 sitios, rotaciones rápidas y OP (+IGL/CLU/FD)", aim: 1.02, fd: 1.03, util: 1.04, entry: 1.01, clu: 1.08, igl: 1.09, atkBias: 1.03, defBias: 0.97, longRange: true,  preferWall: false },
  "Lotus":  { desc: "Lotus · 3 sitios, ejecuciones y utilidad pesada (+UTI/IGL/ENT)", aim: 0.98, fd: 0.99, util: 1.12, entry: 1.05, clu: 1.02, igl: 1.11, atkBias: 1.04, defBias: 0.96, longRange: false, preferWall: true  },
  "Split":  { desc: "Split · Combate cerrado y choke points (+ENT/UTI, Defensor)", aim: 1.03, fd: 1.03, util: 1.06, entry: 1.07, clu: 1.03, igl: 1.01, atkBias: 0.96, defBias: 1.04, longRange: false, preferWall: false },
  "Sunset": { desc: "Sunset · Pelea constante de medio y retakes (+ENT/CLU/Cypher)", aim: 1.02, fd: 1.03, util: 1.04, entry: 1.07, clu: 1.07, igl: 1.01, atkBias: 1.02, defBias: 0.98, longRange: false, preferWall: false }
};

// ===== CATÁLOGO DE AGENTES Y META POR MAPA (0-99) =====
const AGENTS = {
  // Duelistas
  "Jett":      { role: "Duelista",    op: true,  ecoBoost: 1.00, maps: { Ascent: 96, Bind: 76, Breeze: 97, Haven: 93, Lotus: 82, Split: 85, Sunset: 82 } },
  "Raze":      { role: "Duelista",    op: false, ecoBoost: 1.00, maps: { Ascent: 79, Bind: 98, Breeze: 71, Haven: 80, Lotus: 96, Split: 98, Sunset: 92 } },
  "Neon":      { role: "Duelista",    op: false, ecoBoost: 1.02, maps: { Ascent: 83, Bind: 84, Breeze: 86, Haven: 96, Lotus: 94, Split: 89, Sunset: 96 } },
  "Yoru":      { role: "Duelista",    op: true,  ecoBoost: 1.02, maps: { Ascent: 86, Bind: 94, Breeze: 95, Haven: 91, Lotus: 87, Split: 90, Sunset: 85 } },
  "Waylay":    { role: "Duelista",    op: true,  ecoBoost: 1.00, maps: { Ascent: 90, Bind: 84, Breeze: 89, Haven: 90, Lotus: 88, Split: 88, Sunset: 89 } },
  "Iso":       { role: "Duelista",    op: false, ecoBoost: 1.04, maps: { Ascent: 85, Bind: 80, Breeze: 85, Haven: 92, Lotus: 86, Split: 82, Sunset: 84 } },
  // Iniciadores
  "Sova":      { role: "Iniciador",   op: false, ecoBoost: 1.00, maps: { Ascent: 98, Bind: 78, Breeze: 98, Haven: 96, Lotus: 83, Split: 74, Sunset: 89 } },
  "Fade":      { role: "Iniciador",   op: false, ecoBoost: 1.00, maps: { Ascent: 84, Bind: 93, Breeze: 76, Haven: 83, Lotus: 96, Split: 91, Sunset: 89 } },
  "Tejo":      { role: "Iniciador",   op: false, ecoBoost: 1.02, maps: { Ascent: 86, Bind: 94, Breeze: 83, Haven: 92, Lotus: 94, Split: 91, Sunset: 90 } },
  "Breach":    { role: "Iniciador",   op: false, ecoBoost: 1.00, maps: { Ascent: 80, Bind: 83, Breeze: 70, Haven: 94, Lotus: 90, Split: 93, Sunset: 93 } },
  "KAY/O":     { role: "Iniciador",   op: false, ecoBoost: 1.00, maps: { Ascent: 95, Bind: 78, Breeze: 89, Haven: 87, Lotus: 81, Split: 85, Sunset: 85 } },
  "Skye":      { role: "Iniciador",   op: false, ecoBoost: 1.00, maps: { Ascent: 80, Bind: 95, Breeze: 87, Haven: 85, Lotus: 83, Split: 93, Sunset: 82 } },
  "Gekko":     { role: "Iniciador",   op: false, ecoBoost: 1.01, maps: { Ascent: 83, Bind: 92, Breeze: 79, Haven: 83, Lotus: 88, Split: 86, Sunset: 93 } },
  // Controladores
  "Omen":      { role: "Controlador", op: false, ecoBoost: 1.01, maps: { Ascent: 98, Bind: 82, Breeze: 80, Haven: 97, Lotus: 97, Split: 96, Sunset: 95 } },
  "Viper":     { role: "Controlador", op: false, ecoBoost: 1.00, maps: { Ascent: 79, Bind: 97, Breeze: 99, Haven: 83, Lotus: 95, Split: 90, Sunset: 85 }, wall: true },
  "Brimstone": { role: "Controlador", op: false, ecoBoost: 1.00, maps: { Ascent: 78, Bind: 97, Breeze: 70, Haven: 78, Lotus: 76, Split: 82, Sunset: 78 } },
  "Astra":     { role: "Controlador", op: false, ecoBoost: 1.00, maps: { Ascent: 85, Bind: 86, Breeze: 79, Haven: 89, Lotus: 88, Split: 94, Sunset: 85 } },
  "Clove":     { role: "Controlador", op: false, ecoBoost: 1.03, maps: { Ascent: 84, Bind: 82, Breeze: 78, Haven: 85, Lotus: 86, Split: 87, Sunset: 89 } },
  "Harbor":    { role: "Controlador", op: false, ecoBoost: 1.00, maps: { Ascent: 78, Bind: 84, Breeze: 90, Haven: 80, Lotus: 83, Split: 81, Sunset: 82 }, wall: true },
  // Centinelas
  "Chamber":   { role: "Centinela",   op: true,  ecoBoost: 1.13, maps: { Ascent: 82, Bind: 85, Breeze: 98, Haven: 88, Lotus: 90, Split: 79, Sunset: 86 } },
  "Cypher":    { role: "Centinela",   op: false, ecoBoost: 1.00, maps: { Ascent: 89, Bind: 90, Breeze: 95, Haven: 94, Lotus: 88, Split: 96, Sunset: 98 } },
  "Killjoy":   { role: "Centinela",   op: false, ecoBoost: 1.00, maps: { Ascent: 97, Bind: 83, Breeze: 79, Haven: 92, Lotus: 95, Split: 84, Sunset: 81 } },
  "Vyse":      { role: "Centinela",   op: false, ecoBoost: 1.00, maps: { Ascent: 90, Bind: 92, Breeze: 80, Haven: 91, Lotus: 90, Split: 94, Sunset: 89 } },
  "Deadlock":  { role: "Centinela",   op: false, ecoBoost: 1.00, maps: { Ascent: 87, Bind: 91, Breeze: 76, Haven: 83, Lotus: 85, Split: 90, Sunset: 85 } }
};

// ===== POOLS DE AGENTES CARACTERÍSTICOS POR JUGADOR (VCT 2026-2027) =====
const PLAYER_AGENTS = {
  // Sentinels
  "OXY": ["Jett", "Neon", "Raze", "Chamber", "Yoru"],
  "canezerra": ["Yoru", "Raze", "KAY/O", "Gekko", "Neon"],
  "brawk": ["Sova", "Fade", "Tejo", "Breach", "Skye"],
  "keiko": ["Omen", "Viper", "Brimstone", "Clove", "Astra"],
  "johnqt": ["Cypher", "Vyse", "Killjoy", "Viper", "Fade"],
  "Zellsis": ["KAY/O", "Breach", "Killjoy", "Viper", "Deadlock"],
  // NRG
  "zekken": ["Raze", "Neon", "Jett", "Yoru", "Waylay"],
  "mada": ["Jett", "Chamber", "Omen", "Yoru", "Raze"],
  "skuba": ["Viper", "Cypher", "Omen", "Brimstone", "Killjoy"],
  "eeiu": ["Sova", "Fade", "Tejo", "Skye", "Gekko"],
  "Ethan": ["KAY/O", "Breach", "Omen", "Yoru", "Skye"],
  // G2 Esports
  "HYUNMIN": ["Jett", "Neon", "Raze", "Waylay", "Yoru"],
  "Sato": ["Raze", "Yoru", "KAY/O", "Gekko", "Breach"],
  "trent": ["Sova", "Tejo", "Fade", "Viper", "Breach"],
  "kiNgg": ["Omen", "Viper", "Astra", "Brimstone", "Harbor"],
  "leaf": ["Chamber", "Viper", "Cypher", "Killjoy", "Vyse"],
  // 100 Thieves
  "Cryocells": ["Chamber", "Jett", "Brimstone", "Yoru", "Astra"],
  "Asuna": ["Raze", "Neon", "KAY/O", "Gekko", "Skye"],
  "Timotino": ["Yoru", "Neon", "Raze", "Waylay", "Iso"],
  "bang": ["Omen", "Viper", "Astra", "Brimstone", "Clove"],
  "vora": ["Sova", "Fade", "Tejo", "Breach", "KAY/O"],
  // Leviatán
  "Neon": ["Neon", "Jett", "Raze", "Yoru"],
  "spike": ["Raze", "Yoru", "KAY/O", "Gekko"],
  "blowz": ["Sova", "Fade", "Tejo", "Breach"],
  "erde": ["Omen", "Viper", "Brimstone", "Astra"],
  "lukxo": ["Cypher", "Killjoy", "Chamber", "Vyse"],
  // LOUD
  "DaviH": ["Jett", "Raze", "Neon", "Chamber"],
  "tkzin": ["Raze", "Yoru", "Gekko", "KAY/O"],
  "artzin": ["Fade", "Sova", "Breach", "Tejo"],
  "basic": ["Omen", "Viper", "Brimstone", "Astra"],
  "cortezia": ["Cypher", "Killjoy", "Viper", "Vyse"],
  // Fnatic
  "kaajak": ["Jett", "Neon", "Raze", "Chamber", "Waylay"],
  "marteen": ["Yoru", "Raze", "Jett", "Iso", "Neon"],
  "Cloud": ["Sova", "Fade", "Tejo", "Skye", "Breach"],
  "valyn": ["Omen", "Astra", "Brimstone", "Viper", "Clove"],
  "Minny": ["Cypher", "Killjoy", "Vyse", "Viper"],
  // FUT Esports
  "aspas": ["Jett", "Raze", "Neon", "Waylay", "Chamber"],
  "Wo0t": ["Yoru", "Raze", "KAY/O", "Iso", "Breach"],
  "batujnax": ["Sova", "Fade", "Tejo", "Skye"],
  "hezacoil": ["Omen", "Viper", "Brimstone", "Astra"],
  "yetujey": ["Cypher", "Killjoy", "Vyse", "Chamber"],
  // Gentle Mates
  "kozzy": ["Neon", "Raze", "Jett", "Yoru"],
  "Alfajer": ["Killjoy", "Cypher", "Chamber", "Iso", "Vyse"],
  "Boaster": ["Omen", "Astra", "Brimstone", "Viper"],
  "Ruxic": ["Viper", "Omen", "Clove", "KAY/O", "Fade"],
  "MAGNUM": ["Sova", "Fade", "Tejo", "Cypher", "Breach"],
  // Karmine Corp
  "LewN": ["Jett", "Neon", "Raze", "Chamber"],
  "N4RRATE": ["Fade", "Sova", "Gekko", "Raze", "Tejo"],
  "avez": ["Omen", "Viper", "Brimstone", "Astra"],
  "dos9": ["Viper", "Omen", "Clove", "Harbor"],
  "SUYGETSU": ["Cypher", "Viper", "Killjoy", "Vyse"],
  "sheydos": ["Fade", "Sova", "Cypher", "Viper"],
  // Team Vitality
  "jawgemo": ["Raze", "Yoru", "Neon", "Jett", "Omen"],
  "Jamppi": ["Sova", "Breach", "KAY/O", "Chamber", "Tejo"],
  "Sayonara": ["Yoru", "Neon", "Iso", "Fade", "Gekko"],
  "PROFEK": ["Omen", "Viper", "Brimstone", "Astra"],
  "Chronicle": ["Viper", "Cypher", "Breach", "Tejo", "Killjoy"],
  // Team Heretics
  "Jamelinho213": ["Jett", "Neon", "Raze", "Yoru"],
  "hiro": ["Cypher", "Viper", "Fade", "Killjoy"],
  "RieNs": ["Sova", "Fade", "Tejo", "Skye"],
  "chloric": ["Omen", "Viper", "Brimstone", "Astra"],
  "benjyfishy": ["Cypher", "Killjoy", "Vyse", "Chamber"],
  // T1
  "BuZz": ["Jett", "Raze", "Neon", "Chamber"],
  "iZu": ["Yoru", "Iso", "Chamber", "Raze", "Cypher"],
  "TenZ": ["Omen", "Gekko", "KAY/O", "Jett", "Clove"],
  "crashies": ["Sova", "Fade", "Tejo", "Skye"],
  "stax": ["Breach", "Omen", "Viper", "Brimstone", "KAY/O"],
  // Paper Rex
  "something": ["Jett", "Yoru", "Chamber", "Gekko", "Reyna"],
  "primmie": ["Iso", "Chamber", "Jett", "Clove", "Neon"],
  "f0rsakeN": ["Omen", "Yoru", "Harbor", "Breach", "Cypher"],
  "invy": ["Sova", "Fade", "KAY/O", "Breach", "Tejo"],
  "PatMen": ["Viper", "Fade", "Cypher", "Brimstone", "Omen"],
  // Gen.G
  "t3xture": ["Jett", "Raze", "Neon", "Chamber"],
  "Dambi": ["Neon", "Raze", "Yoru", "Breach"],
  "Ray": ["Sova", "Fade", "Tejo", "Skye"],
  "Karon": ["Omen", "Viper", "Brimstone", "Astra"],
  "MaKo": ["Viper", "Omen", "Astra", "Brimstone"],
  "Xiesta": ["Yoru", "Raze", "KAY/O", "Fade"],
  // Xi Lai Gaming
  "ZmjjKK": ["Jett", "Neon", "Raze", "Chamber", "Waylay"],
  "Zeus": ["Raze", "Yoru", "Neon", "KAY/O"],
  "d4v41": ["Skye", "Fade", "Viper", "Vyse", "Sova"],
  "happywei": ["Omen", "Viper", "Brimstone", "Astra"],
  "WsLeo": ["Cypher", "Killjoy", "Chamber", "Vyse"],
  // EDward Gaming
  "stew": ["Jett", "Neon", "Raze", "Chamber"],
  "Jieni7": ["Yoru", "Raze", "Neon", "Iso"],
  "Rossy": ["Sova", "Fade", "Breach", "Tejo"],
  "iamgrq": ["Omen", "Viper", "Brimstone", "Astra"],
  "zjc": ["Cypher", "Killjoy", "Vyse", "Viper"],
  // Bilibili Gaming
  "whzy": ["Jett", "Raze", "Neon", "Chamber"],
  "alvinboy": ["Yoru", "KAY/O", "Gekko", "Fade"],
  "nephh": ["Breach", "Sova", "Tejo", "KAY/O"],
  "Smoggy": ["Omen", "Viper", "Clove", "Brimstone"],
  "Knight": ["Cypher", "Killjoy", "Viper", "Vyse"],
  // Weibo Gaming
  "babybay": ["Jett", "Neon", "Raze", "Chamber"],
  "Yoyo": ["Raze", "Yoru", "Gekko", "KAY/O"],
  "heybay": ["Sova", "Fade", "Breach", "Tejo"],
  "Satoshi": ["Omen", "Viper", "Brimstone", "Astra"],
  "Erv": ["Cypher", "Killjoy", "Vyse", "Deadlock"],
  "Razziss": ["Jett", "Raze", "Neon", "Yoru"],
  // TYLOO
  "splash": ["Jett", "Neon", "Raze", "Chamber"],
  "slowly": ["Yoru", "Raze", "KAY/O", "Fade"],
  "SiuFatBB": ["Sova", "Breach", "Tejo", "Fade"],
  "xihe": ["Omen", "Viper", "Brimstone", "Astra"],
  "hfmi0dzjc9z7": ["Cypher", "Killjoy", "Vyse", "Chamber"],
  // Trace Esports
  "Kai": ["Jett", "Chamber", "Neon", "Raze"],
  "nobody": ["Sova", "Fade", "Tejo", "Gekko"],
  "Nicc": ["Omen", "Viper", "Brimstone", "Astra"],
  "CHICHOO": ["Viper", "Cypher", "Killjoy", "Omen"],
  "FengF": ["Raze", "Yoru", "KAY/O", "Breach"],
  "Abo": ["Yoru", "Raze", "Fade", "Cypher"]
};

const ROLE_DEFAULT_AGENTS = {
  "Duelista": ["Jett", "Raze", "Neon", "Yoru", "Waylay", "Iso"],
  "Iniciador": ["Sova", "Fade", "Tejo", "Breach", "KAY/O", "Skye", "Gekko"],
  "Controlador": ["Omen", "Viper", "Brimstone", "Astra", "Clove", "Harbor"],
  "Centinela": ["Cypher", "Killjoy", "Chamber", "Vyse", "Deadlock"],
  "Flex": ["Yoru", "KAY/O", "Viper", "Fade", "Breach", "Gekko", "Raze"]
};

function getPrimaryRoleFromStr(roleStr) {
  const r = (roleStr || "").toLowerCase();
  if (r.startsWith("duelista")) return "Duelista";
  if (r.startsWith("iniciador")) return "Iniciador";
  if (r.startsWith("controlador")) return "Controlador";
  if (r.startsWith("centinela")) return "Centinela";
  if (r.includes("duelista")) return "Duelista";
  if (r.includes("iniciador")) return "Iniciador";
  if (r.includes("controlador")) return "Controlador";
  if (r.includes("centinela")) return "Centinela";
  return "Flex";
}

function getPlayerAgents(player) {
  const sig = (PLAYER_AGENTS[player.n] || []).filter(a => AGENTS[a]);
  const primary = getPrimaryRoleFromStr(player.r);
  const base = ROLE_DEFAULT_AGENTS[primary] || ROLE_DEFAULT_AGENTS["Flex"];
  const merged = [...sig];
  base.forEach(a => { if (!merged.includes(a)) merged.push(a); });
  return merged;
}

// ===== DRAFT INTELIGENTE DE COMPOSICIÓN (5 AGENTES ÚNICOS + SINERGIA DE MAPA) =====
function draftTeamComp(teamObj, mapName) {
  const m = MAP_POOL[mapName] || MAP_POOL["Ascent"];
  const starters = teamObj.players.filter(p => !p.sub).slice(0, 5);
  const used = new Set();
  const roleCount = { Duelista: 0, Iniciador: 0, Controlador: 0, Centinela: 0 };

  // Orden de prioridad en el draft: Controladores y Centinelas/Iniciadores clave primero, luego Duelistas y Flex
  const priorityOrder = starters
    .map((p, origIdx) => {
      const pr = getPrimaryRoleFromStr(p.r);
      const prio = pr === "Controlador" ? 1 : pr === "Duelista" ? 2 : pr === "Iniciador" ? 3 : pr === "Centinela" ? 4 : 5;
      return { p, origIdx, pr, prio };
    })
    .sort((a, b) => a.prio - b.prio);

  const assigned = new Array(starters.length);

  priorityOrder.forEach(({ p, origIdx, pr }) => {
    const sigList = (PLAYER_AGENTS[p.n] || []).filter(a => AGENTS[a]);
    const candidates = getPlayerAgents(p);
    let bestAg = candidates[0] || "Omen";
    let bestScore = -Infinity;

    // Evaluar todos los agentes disponibles en el pool del jugador (y fallback global si hay colisión)
    const pool = candidates.filter(a => !used.has(a));
    const evalList = pool.length ? pool : Object.keys(AGENTS).filter(a => !used.has(a));

    evalList.forEach(agName => {
      const ag = AGENTS[agName];
      const mapFit = ag.maps[mapName] || 82;
      const sigIdx = sigList.indexOf(agName);
      const comfortBonus = sigIdx === 0 ? 7.5 : sigIdx === 1 ? 5.5 : sigIdx === 2 ? 3.5 : sigIdx >= 3 ? 1.5 : -4.0;
      const roleMatchBonus = ag.role === pr ? 4.0 : 0;

      // Bono táctico de cobertura de roles en la composición
      let teamNeedBonus = 0;
      if (ag.role === "Controlador" && roleCount.Controlador === 0) teamNeedBonus += 9;
      if (ag.role === "Controlador" && m.preferWall && ag.wall && roleCount.Controlador <= 1) teamNeedBonus += 7;
      if (ag.role === "Iniciador" && roleCount.Iniciador === 0) teamNeedBonus += 6;
      if (ag.role === "Duelista" && roleCount.Duelista === 0) teamNeedBonus += 7;
      if (ag.role === "Centinela" && roleCount.Centinela === 0) teamNeedBonus += 5;
      if (roleCount[ag.role] >= 2) teamNeedBonus -= 9;

      // Sinergia de Operator en mapas largos (ej. Chamber / Jett en Breeze, Ascent, Haven)
      let opSynergy = 0;
      if (ag.op && m.longRange && p.aim >= 89 && p.fd >= 84) {
        opSynergy = mapName === "Breeze" ? 8.5 : 5.5;
      }
      // Sinergia de movilidad explosiva en mapas cerrados (Raze/Neon en Split/Bind/Lotus/Sunset)
      if (!m.longRange && (agName === "Raze" || agName === "Neon") && p.entry >= 88) {
        opSynergy += 4.0;
      }

      const total = mapFit + comfortBonus + roleMatchBonus + teamNeedBonus + opSynergy;
      if (total > bestScore) {
        bestScore = total;
        bestAg = agName;
      }
    });

    used.add(bestAg);
    const agObj = AGENTS[bestAg];
    roleCount[agObj.role] = (roleCount[agObj.role] || 0) + 1;
    const isComfort = sigList.includes(bestAg);
    const isOpBoost = !!(agObj.op && m.longRange && p.aim >= 88 && p.fd >= 82);

    assigned[origIdx] = {
      playerName: p.n,
      agent: bestAg,
      role: agObj.role,
      mapFit: agObj.maps[mapName] || 82,
      comfort: isComfort,
      isOpBoost,
      ecoBoost: agObj.ecoBoost || 1.0
    };
  });

  // Cálculo de puntaje de composición y etiquetas tácticas
  const avgFit = assigned.reduce((s, a) => s + a.mapFit, 0) / assigned.length;
  const comfortHits = assigned.filter(a => a.comfort).length;
  const hasWall = assigned.some(a => AGENTS[a.agent] && AGENTS[a.agent].wall);
  const opCarrier = assigned.find(a => a.isOpBoost);

  let balanceAdj = 0;
  const tags = [];
  if (roleCount.Controlador === 0) {
    balanceAdj -= 6;
    tags.push("Sin humos (-sinergia)");
  }
  if (m.preferWall && hasWall) {
    balanceAdj += 2.6;
    tags.push("Muro Viper/Harbor");
  } else if (mapName === "Breeze" && !hasWall) {
    balanceAdj -= 3.5;
  }
  if (opCarrier) {
    balanceAdj += mapName === "Breeze" ? 3.2 : 1.8;
    tags.push(`${opCarrier.agent} OP (${opCarrier.playerName})`);
  }
  if (roleCount.Controlador >= 2 && (mapName === "Lotus" || mapName === "Bind" || mapName === "Breeze")) {
    balanceAdj += 1.6;
    tags.push("Doble Controlador");
  }
  if (roleCount.Duelista >= 2 && (mapName === "Split" || mapName === "Sunset" || mapName === "Bind")) {
    balanceAdj += 1.2;
    tags.push("Doble Duelista");
  }
  if (comfortHits === 5) {
    balanceAdj += 1.8;
    tags.push("5/5 Confort");
  }

  const compScore = Math.max(70, Math.min(99, avgFit + balanceAdj + (comfortHits - 3) * 0.7));
  // Modificador suave para mantener calibración realista (+/- 3.5% máx en fuerza de equipo)
  const synergyMod = 1 + (compScore - 88.5) / 380;

  return {
    mapName,
    assignments: assigned,
    compScore: Number(compScore.toFixed(1)),
    synergyMod,
    tags: tags.slice(0, 3)
  };
}

// ===== MOTOR MATEMÁTICO + VETO DE COACHES + DUELO 1V1 =====
const EXP = 1.5;
const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
const rnd = a => a[Math.random() * a.length | 0];

function wpick(a, mapMod) {
  const w = a.map(u => {
    const opW = u.isOpBoost ? 1.12 : 1.0;
    return Math.pow(((u.p.entry * (mapMod ? mapMod.entry : 1) * opW) / 100), 3);
  });
  const t = w.reduce((x, y) => x + y);
  let r = Math.random() * t;
  for (let i = 0; i < a.length; i++) {
    r -= w[i];
    if (r <= 0) return a[i];
  }
  return a[0];
}

function str(u, open, clu, econ, igm, mapMod, roundType) {
  const p = u.p;
  const m = mapMod || { aim: 1, fd: 1, util: 1, entry: 1, clu: 1 };
  let effEcon = econ;
  if (u.ecoBoost && u.ecoBoost > 1 && (roundType === "Eco" || roundType === "Force")) {
    effEcon = Math.min(1.0, econ * u.ecoBoost);
  }
  const agentMult = 1 + (((u.agentFit || 86) - 86) / 360) + (u.comfort ? 0.01 : -0.012);
  const opMult = (u.isOpBoost && roundType === "Full") ? (open ? 1.05 : 1.025) : 1.0;

  const aim = p.aim * m.aim, fd = p.fd * m.fd, ent = p.entry * m.entry, util = p.util * m.util;
  let s = open ? aim * .5 + fd * .3 + ent * .2 : aim * .6 + util * .15 + ent * .1 + fd * .15;
  s = s * u.form * effEcon * igm * agentMult * opMult;
  if (clu) s += (p.clutch * m.clu - 80) * .4;
  return Math.pow(Math.max(s, 1) / 100, EXP);
}

// EVALÚA QUÉ TAN FUERTE ES UN EQUIPO EN UN MAPA (PLANTILLA + AGENTES + COACH)
function scoreTeamOnMap(teamObj, mapName) {
  const m = MAP_POOL[mapName];
  const starters = teamObj.players.filter(p => !p.sub).slice(0, 5);
  const c = teamObj.coach;
  const comp = draftTeamComp(teamObj, mapName);

  let total = 0;
  starters.forEach((p, idx) => {
    const aInfo = comp.assignments[idx];
    const opBonus = aInfo && aInfo.isOpBoost ? (mapName === "Breeze" ? 2.4 : 1.2) : 0;
    total += (p.aim * 0.34 * m.aim) +
             (p.fd * 0.18 * m.fd) +
             (p.entry * 0.15 * m.entry) +
             (p.util * 0.18 * m.util) +
             (p.clutch * 0.15 * m.clu) +
             opBonus;
  });
  const avgP = total / starters.length;
  const iglMax = Math.max(...starters.map(p => p.igl));
  const tacScore = ((iglMax * 0.5 + c.macro * 0.5) - 80) * 0.25 * m.igl;
  const compBonus = (comp.compScore - 87) * 0.32;
  return avgP + tacScore + compBonus;
}

// PERFIL COMPLETO DE MAPAS DE UN EQUIPO (MEJORES, PEORES Y COMPOSICIÓN POR MAPA)
function getTeamMapProfile(teamName) {
  const teamObj = { name: teamName, players: TEAMS[teamName], coach: COACH[teamName] };
  const list = Object.keys(MAP_POOL).map(mapName => {
    const comp = draftTeamComp(teamObj, mapName);
    const score = Number(scoreTeamOnMap(teamObj, mapName).toFixed(1));
    return { mapName, score, comp };
  });
  const sorted = list.slice().sort((a, b) => b.score - a.score);
  return {
    byMap: Object.fromEntries(list.map(x => [x.mapName, x])),
    sorted,
    best: sorted.slice(0, 2),
    worst: sorted[sorted.length - 1]
  };
}

function coachPickStartingSide(choosingTeam, otherTeam, mapName) {
  const m = MAP_POOL[mapName];
  const starters = choosingTeam.players.filter(p => !p.sub).slice(0, 5);
  const aggr = starters.reduce((a, p) => a + p.entry * 0.55 + p.fd * 0.45, 0) / starters.length;
  const ctrl = starters.reduce((a, p) => a + p.util * 0.55 + p.clutch * 0.45, 0) / starters.length;
  const atkPref = (aggr * m.atkBias) - (ctrl * m.defBias);
  return atkPref >= 0 ? "ATK" : "DEF";
}

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

function runCoachVeto(tLeft, tRight, fmt, forcedFirstMap = "AUTO") {
  const duel = runPreMatch1v1(tLeft, tRight);
  const A = duel.teamA;
  const B = duel.teamB;
  let remaining = Object.keys(MAP_POOL);

  const removeMap = m => { remaining = remaining.filter(x => x !== m); };

  const coachBan = (myTeam, oppTeam) => {
    let worstMap = remaining[0], worstNet = Infinity;
    remaining.forEach(m => {
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

  const coachPick = (myTeam, oppTeam, forceMap = null) => {
    if (forceMap && remaining.includes(forceMap)) {
      removeMap(forceMap);
      return forceMap;
    }
    let bestMap = remaining[0], bestNet = -Infinity;
    remaining.forEach(m => {
      const net = (scoreTeamOnMap(myTeam, m) * 1.15 - scoreTeamOnMap(oppTeam, m) * 0.85) + gauss() * 0.4;
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
    registerPlayableMap(decider, "DECIDER", A, 7, `7. M3 (Decider)`);
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
    registerPlayableMap(decider, "DECIDER", A, 7, `7. M5 (Decider)`);
  } else {
    for (let s = 1; s <= 6; s++) {
      const turnTeam = s % 2 === 1 ? A : B;
      const oppTeam = s % 2 === 1 ? B : A;
      const bMap = coachBan(turnTeam, oppTeam);
      steps.push({ step: s, type: "ban", actor: `${s}. Veto ${s % 2 === 1 ? 'A' : 'B'} (${turnTeam.name})`, mapName: bMap, detail: `DT ${turnTeam.coach.n} descarta ${bMap}` });
    }
    const decider = remaining[0];
    registerPlayableMap(decider, "DECIDER", A, 7, `7. Mapa Único`);
  }

  return { duel, steps, scheduledMaps };
}

function simMatch(tLeft, tRight, mapSpec) {
  const mapName = typeof mapSpec === "string" ? mapSpec : mapSpec.mapName;
  const mapMod = MAP_POOL[mapName] || MAP_POOL["Ascent"];
  const leftStartsAtk = typeof mapSpec === "object" && mapSpec.atkTeamName
    ? mapSpec.atkTeamName === tLeft.name
    : true;

  const comps = [draftTeamComp(tLeft, mapName), draftTeamComp(tRight, mapName)];

  const teams = [tLeft, tRight].map((t, ti) => ({
    name: t.name,
    coach: t.coach,
    comp: comps[ti],
    units: t.players.filter(p => !p.sub).slice(0, 5).map((p, idx) => {
      const ag = comps[ti].assignments[idx];
      return {
        p,
        agent: ag.agent,
        agentRole: ag.role,
        agentFit: ag.mapFit,
        comfort: ag.comfort,
        isOpBoost: ag.isOpBoost,
        ecoBoost: ag.ecoBoost,
        form: 1 + gauss() * ((.015 + (100 - p.cons) / 1250 + (100 - p.conf) / 1250 * (1 - (t.coach.dev - 70) / 150)) * (1 - (t.coach.disc - 70) / 250))
      };
    })
  }));

  const igm = teams.map(t => (1 + ((Math.max(...t.units.map(u => u.p.igl)) * mapMod.igl - 80) / 800) + ((t.coach.macro * mapMod.igl - 80) / 1000)) * t.comp.synergyMod);
  let sc = [0, 0], cr = [800, 800], ls = [0, 0], timeoutsLeft = [2, 2], timeoutActive = [0, 0], rounds = [], n = 0;

  while (true) {
    n++;
    if (n == 13) { cr = [800, 800]; ls = [0, 0]; }
    const ot = n > 24, pist = n == 1 || n == 13;

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
      const s0 = str(a, first, al[0].length == 1 && al[1].length >= 2, tp[0][1], igm[0] * adp[0] * sideBias0 * (first ? 1 + (teams[0].coach.micro - 80) / 800 : 1), mapMod, tp[0][0]);
      const s1 = str(b, first, al[1].length == 1 && al[0].length >= 2, tp[1][1], igm[1] * adp[1] * sideBias1 * (first ? 1 + (teams[1].coach.micro - 80) / 800 : 1), mapMod, tp[1][0]);
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
    const agOf = id => { const [t, i] = id.split("-"); return teams[t].units[i].agent; };
    const cnt = {};
    ev.forEach(e => cnt[e.k] = (cnt[e.k] || 0) + 1);
    const ctx = `[${before[0]}-${before[1]}]`, tn = teams[win].name, hl = [];
    const end = before[win] == 12 ? " Con esa ronda cierra el mapa." : before[1 - win] == 12 ? " Evita el match point rival." : "";

    calledTimeouts.forEach(to => {
      hl.push({
        r: n,
        t: "to",
        x: `TIMEOUT TÁCTICO: DT ${to.coach} (${to.team}) pide pausa en ${to.scoreCtx} para ajustar lecturas (+Adaptación ${teams[to.ti].coach.adapt}).`
      });
    });

    const isDecisiveRound = n === 12 || n >= 22 || (tp[win][0] === "Eco" && tp[1 - win][0] === "Full");
    for (const id in cnt) {
      const c = cnt[id], name = nm(id), ag = agOf(id);
      if (c == 5) {
        hl.push({ r: n, t: "ace", x: rnd([`ACE de ${name} (${ag}): limpia a los cinco rivales en R${n} ${ctx}.`, `R${n} ${ctx}: ${name} con ${ag} borra al equipo rival completo (ACE).`, `${name} (${ag}) firma un ACE monumental en R${n} ${ctx}.`]) + end });
      } else if (c == 4) {
        hl.push({ r: n, t: "mk", x: `${name} (${ag}) conecta un 4K decisivo en R${n} ${ctx}.` + end });
      } else if (c == 3 && isDecisiveRound) {
        hl.push({ r: n, t: "mk", x: `Triple kill clave de ${name} (${ag}) en ronda crítica (R${n} ${ctx}).` + end });
      }
    }
    if (cl && cl.x >= 2) {
      hl.unshift({ r: n, t: cl.x >= 3 ? "ace" : "cl", x: rnd([`R${n} ${ctx}: CLUTCH 1v${cl.x} de ${nm(cl.id)} (${agOf(cl.id)}) para ${tn}.`, `${nm(cl.id)} (${agOf(cl.id)}) resuelve un 1v${cl.x} en R${n} ${ctx}.`, `1v${cl.x} imposible: ${nm(cl.id)} (${agOf(cl.id)}) salva R${n} ${ctx} para ${tn}.`]) + end });
    }
    if (tp[win][0] == "Eco" && tp[1 - win][0] == "Full") {
      hl.push({ r: n, t: "up", x: `Batacazo eco (Thrifty): ${tn} gana R${n} ${ctx} contra un full buy.` });
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