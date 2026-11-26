import type { AcademiesJson, RoleName } from "../../core/index.ts";
import type {
  CoachCourse,
  DeltaStatKey,
  DifficultyId,
  ManagerCoach,
  MarketPaceId,
  PlayerPlanId,
  PromisedRole,
  TrainingModeId
} from "./types.ts";

export interface DifficultyConfig {
  id: DifficultyId;
  label: string;
  desc: string;
  rivalMod: number;
  budgetMult: number;
  prizeMult: number;
  costMult: number;
  startConf: number;
  graceWeeks: number;
  fireThreshold: number;
  lossPenMult: number;
  gainMult: number;
}

export const DIFFICULTY_CFG: Record<DifficultyId, DifficultyConfig> = {
  easy: {
    id: "easy",
    label: "Fácil",
    desc: "Presupuesto +25%, rivales más accesibles, directiva paciente y negociaciones favorables.",
    rivalMod: -0.022,
    budgetMult: 1.25,
    prizeMult: 1.15,
    costMult: 0.88,
    startConf: 60,
    graceWeeks: 6,
    fireThreshold: -35,
    lossPenMult: 0.75,
    gainMult: 1.15
  },
  normal: {
    id: "normal",
    label: "Normal",
    desc: "Balance estándar VCT: economía realista, directiva exigente y rivales calibrados.",
    rivalMod: 0.0,
    budgetMult: 1.0,
    prizeMult: 1.0,
    costMult: 1.0,
    startConf: 45,
    graceWeeks: 4,
    fireThreshold: -20,
    lossPenMult: 1.0,
    gainMult: 1.0
  },
  hard: {
    id: "hard",
    label: "Difícil",
    desc: "Presupuesto -20%, rivales +2.4%, directiva impaciente (despido en -10) y cláusulas caras.",
    rivalMod: 0.024,
    budgetMult: 0.8,
    prizeMult: 0.85,
    costMult: 1.15,
    startConf: 30,
    graceWeeks: 2,
    fireThreshold: -10,
    lossPenMult: 1.35,
    gainMult: 0.85
  }
};

export interface MarketPaceConfig {
  id: MarketPaceId;
  label: string;
  desc: string;
  offerChance: number;
  aiMovesPerWindow: number;
}

export const MARKET_PACE_CFG: Record<MarketPaceId, MarketPaceConfig> = {
  calm: {
    id: "calm",
    label: "Tranquilo",
    desc: "Pocos traspasos por ventana, plantillas muy estables.",
    offerChance: 0.08,
    aiMovesPerWindow: 2
  },
  normal: {
    id: "normal",
    label: "Normal",
    desc: "Actividad estándar entre Stages y post-Champions.",
    offerChance: 0.16,
    aiMovesPerWindow: 5
  },
  active: {
    id: "active",
    label: "Movido",
    desc: "Mercado agresivo: constantes ofertas, bombazos y rotaciones.",
    offerChance: 0.28,
    aiMovesPerWindow: 9
  }
};

export const ROLE_PROMISE_LABELS: Record<PromisedRole, string> = {
  starter: "Titular garantizado",
  rotation: "Rotación / 6th",
  prospect: "Promesa / Desarrollo"
};

export const ACADEMY_NICKS = [
  "kurox", "zexy", "vandalz", "m1ko", "kael", "draven", "soryn", "luxen", "nexo", "ryze",
  "fayz", "tako", "valk", "shiro", "zenith", "kairo", "milo", "dax", "soren", "renji",
  "vexo", "lukaz", "cruz", "noahz", "yur1", "sant1", "tomasz", "elias", "kento", "haru",
  "minho", "jinho", "chenx", "feilong", "kauan", "matheusz", "patoz", "gabo", "nicox", "aizen",
  "kyro", "zayd", "breno", "tito", "mori", "saku", "linx", "roxx", "flint", "haze",
  "kobe", "nyx", "jota", "enzo", "krisz", "vini", "troy", "seba", "kuro", "zoro",
  "dante", "ryu", "mako2", "finn", "axel", "noel", "lars", "yato", "kaizen", "echo"
] as const;

export const ACADEMY_ROLES = [
  "Duelista",
  "Duelista/Flex",
  "Flex",
  "Iniciador",
  "Iniciador/IGL",
  "Controlador",
  "Controlador/Flex",
  "Controlador/IGL",
  "Centinela",
  "IGL/Centinela"
] as const;

export const SPONSORS_CATALOG: ReadonlyArray<{
  name: string;
  tier: "regional" | "masters" | "champions";
  upfront: number;
  weekly: number;
}> = [
  { name: "HyperPulse Peripherals", tier: "regional", upfront: 65000, weekly: 6500 },
  { name: "KuroGear 540Hz Monitors", tier: "regional", upfront: 75000, weekly: 7500 },
  { name: "Vortex Zero Energy", tier: "masters", upfront: 140000, weekly: 12000 },
  { name: "ApexCloud Compute", tier: "masters", upfront: 160000, weekly: 13500 },
  { name: "Quantum Fiber Global", tier: "champions", upfront: 280000, weekly: 20000 },
  { name: "Aether Luxury Hardware", tier: "champions", upfront: 320000, weekly: 22000 }
];

export interface FreeAgentSeed {
  n: string;
  r: string;
  aim: number;
  fd: number;
  clutch: number;
  entry: number;
  util: number;
  igl: number;
  conf: number;
  cons: number;
  pot: number;
  age: number;
  agents: string[];
}

export const FREE_AGENTS_SEED: readonly FreeAgentSeed[] = [
  { n: "Derke", r: "Duelista", aim: 93, fd: 92, clutch: 85, entry: 94, util: 75, igl: 63, conf: 88, cons: 84, pot: 93, age: 23, agents: ["Jett", "Raze", "Yoru", "Waylay"] },
  { n: "Less", r: "Centinela", aim: 92, fd: 82, clutch: 93, entry: 77, util: 88, igl: 70, conf: 88, cons: 91, pot: 94, age: 21, agents: ["Viper", "Cypher", "Killjoy", "Veto"] },
  { n: "Leo", r: "Iniciador", aim: 91, fd: 77, clutch: 94, entry: 73, util: 96, igl: 74, conf: 90, cons: 93, pot: 94, age: 22, agents: ["Sova", "Fade", "Tejo", "Skye"] },
  { n: "Demon1", r: "Duelista/Controlador", aim: 93, fd: 88, clutch: 86, entry: 86, util: 78, igl: 62, conf: 79, cons: 79, pot: 93, age: 24, agents: ["Jett", "Brimstone", "Astra", "Chamber"] },
  { n: "nAts", r: "Centinela/IGL", aim: 90, fd: 79, clutch: 93, entry: 74, util: 89, igl: 87, conf: 89, cons: 90, pot: 91, age: 24, agents: ["Cypher", "Viper", "Veto", "Chamber"] },
  { n: "Meteor", r: "Centinela/Duelista", aim: 92, fd: 88, clutch: 89, entry: 87, util: 78, igl: 65, conf: 86, cons: 85, pot: 92, age: 26, agents: ["Cypher", "Killjoy", "Jett", "Neon"] },
  { n: "cauanzin", r: "Iniciador", aim: 88, fd: 79, clutch: 87, entry: 78, util: 91, igl: 70, conf: 84, cons: 86, pot: 92, age: 21, agents: ["Sova", "Fade", "Skye", "Tejo"] },
  { n: "Jinggg", r: "Duelista", aim: 90, fd: 89, clutch: 82, entry: 95, util: 78, igl: 62, conf: 86, cons: 81, pot: 91, age: 23, agents: ["Raze", "Phoenix", "Sage", "Neon"] },
  { n: "Munchkin", r: "Flex/IGL", aim: 85, fd: 78, clutch: 86, entry: 78, util: 91, igl: 91, conf: 88, cons: 88, pot: 87, age: 28, agents: ["Viper", "KAY/O", "Omen", "Harbor"] },
  { n: "saadhak", r: "Flex/IGL", aim: 81, fd: 77, clutch: 84, entry: 78, util: 92, igl: 94, conf: 90, cons: 84, pot: 84, age: 29, agents: ["KAY/O", "Breach", "Viper", "Veto"] },
  { n: "s0m", r: "Controlador", aim: 88, fd: 79, clutch: 88, entry: 78, util: 91, igl: 72, conf: 85, cons: 87, pot: 90, age: 24, agents: ["Omen", "Harbor", "Miks", "Viper"] },
  { n: "trexx", r: "Iniciador", aim: 89, fd: 81, clutch: 86, entry: 81, util: 91, igl: 69, conf: 83, cons: 86, pot: 91, age: 22, agents: ["Sova", "Fade", "Tejo", "Breach"] },
  { n: "MiniBoo", r: "Duelista", aim: 89, fd: 90, clutch: 81, entry: 93, util: 74, igl: 61, conf: 80, cons: 79, pot: 93, age: 21, agents: ["Neon", "Yoru", "Raze", "Jett"] },
  { n: "verno", r: "Iniciador", aim: 89, fd: 78, clutch: 86, entry: 76, util: 90, igl: 70, conf: 74, cons: 84, pot: 94, age: 20, agents: ["Sova", "Fade", "Tejo", "Gekko"] }
];

export const FREE_COACHES_SEED: readonly ManagerCoach[] = [
  { n: "Potter", macro: 91, micro: 87, adapt: 92, dev: 91, disc: 90, pot: 94, exp: 7, tier: "established", fee: 85000 },
  { n: "mini", macro: 92, micro: 84, adapt: 90, dev: 86, disc: 88, pot: 93, exp: 7, tier: "established", fee: 80000 },
  { n: "d00mbr0s", macro: 88, micro: 85, adapt: 88, dev: 86, disc: 87, pot: 90, exp: 6, tier: "established", fee: 65000 },
  { n: "Chet", macro: 86, micro: 86, adapt: 85, dev: 82, disc: 82, pot: 88, exp: 6, tier: "established", fee: 55000 },
  { n: "Termi", macro: 89, micro: 84, adapt: 86, dev: 85, disc: 92, pot: 91, exp: 7, tier: "established", fee: 70000 },
  { n: "bzkA", macro: 85, micro: 83, adapt: 84, dev: 88, disc: 86, pot: 90, exp: 5, tier: "established", fee: 50000 },
  { n: "FrosT", macro: 82, micro: 85, adapt: 84, dev: 84, disc: 79, pot: 87, exp: 6, tier: "established", fee: 45000 },
  { n: "Valkyrie", macro: 76, micro: 75, adapt: 77, dev: 80, disc: 76, pot: 94, exp: 1, tier: "prospect", fee: 22000 },
  { n: "Kaelen", macro: 78, micro: 77, adapt: 75, dev: 78, disc: 74, pot: 93, exp: 2, tier: "prospect", fee: 25000 },
  { n: "Soraia", macro: 74, micro: 76, adapt: 79, dev: 81, disc: 77, pot: 95, exp: 1, tier: "prospect", fee: 24000 },
  { n: "Mendez", macro: 77, micro: 74, adapt: 78, dev: 77, disc: 80, pot: 91, exp: 2, tier: "prospect", fee: 20000 },
  { n: "Haneul", macro: 75, micro: 78, adapt: 76, dev: 79, disc: 78, pot: 94, exp: 1, tier: "prospect", fee: 23000 }
];

export const COACH_COURSES: readonly CoachCourse[] = [
  { id: "macro", name: "Seminario de Macro & Táctica", cost: 24000, weeks: 3, stats: ["macro"], desc: "Mejora lectura de mapas, rotaciones y economía." },
  { id: "adapt", name: "Analítica Anti-Strat & Rival", cost: 22000, weeks: 2, stats: ["adapt", "micro"], desc: "Potencia timeouts, lectura rival y micro-ajustes." },
  { id: "dev", name: "Certificación Desarrollo Juvenil", cost: 20000, weeks: 3, stats: ["dev"], desc: "Acelera el crecimiento de promesas y cantera." },
  { id: "disc", name: "Gestión de Vestuario & Motivación", cost: 18000, weeks: 2, stats: ["disc"], desc: "Reduce fatiga, riesgo de lesiones y sube disciplina." },
  { id: "pro", name: "Licencia Master VCT Integral", cost: 42000, weeks: 4, stats: ["macro", "micro", "adapt", "dev", "disc"], desc: "Mejora global en las 5 habilidades del Head Coach." }
];

export interface TrainingModeConfig {
  id: TrainingModeId;
  name: string;
  category: string;
  duration: string;
  desc: string;
  fatigueDelta: number;
  moraleDelta: number;
  cost: number;
  injuryMult: number;
  riskLabel: "NULO" | "BAJO" | "MEDIO" | "ALTO";
  xpBase: number;
  focus: DeltaStatKey[];
  roleAdaptive?: boolean;
  hushMult?: number;
  extraLearnTick?: boolean;
  trainsMap?: boolean;
  matchPrepBonus?: number;
}

export const TRAINING_MODES: Record<TrainingModeId, TrainingModeConfig> = {
  balanced: {
    id: "balanced", name: "Equilibrada", category: "GENERAL", duration: "1 sem",
    desc: "Progreso estable hacia POT (+3 Fat · +1 Moral)",
    fatigueDelta: 3, moraleDelta: 1, cost: 0, injuryMult: 0.55, riskLabel: "BAJO",
    xpBase: 17, focus: ["aim", "util", "clutch", "cons"]
  },
  role_drill: {
    id: "role_drill", name: "Entreno por Rol", category: "ROL", duration: "1 sem",
    desc: "Sube atributos específicos según el rol de cada jugador (+7 Fat)",
    fatigueDelta: 7, moraleDelta: 1, cost: 3000, injuryMult: 0.75, riskLabel: "MEDIO",
    xpBase: 24, roleAdaptive: true, focus: ["entry", "util", "clutch", "igl"]
  },
  agent_lab: {
    id: "agent_lab", name: "Maestría de Agentes", category: "AGENTE", duration: "1 sem",
    desc: "Acelera Maestría Hush x1.7 + progreso extra de agente (+6 Fat)",
    fatigueDelta: 6, moraleDelta: 1, cost: 4000, injuryMult: 0.65, riskLabel: "MEDIO",
    xpBase: 20, hushMult: 1.7, extraLearnTick: true, focus: ["util", "entry", "fd"]
  },
  map_prep: {
    id: "map_prep", name: "Preparación de Mapa", category: "MAPA", duration: "1 sem",
    desc: "+1.5% dominio permanente en el mapa elegido (máx +4.5%)",
    fatigueDelta: 6, moraleDelta: 1, cost: 5000, injuryMult: 0.6, riskLabel: "MEDIO",
    xpBase: 16, trainsMap: true, focus: ["igl", "util", "cons"]
  },
  aimlab: {
    id: "aimlab", name: "Puntería & Aimlabs", category: "MECÁNICA", duration: "1 sem",
    desc: "Pulido mecánico puro: AIM y Primer Duelo (+8 Fat)",
    fatigueDelta: 8, moraleDelta: 0, cost: 2000, injuryMult: 0.9, riskLabel: "MEDIO",
    xpBase: 24, focus: ["aim", "fd"]
  },
  comms_team: {
    id: "comms_team", name: "Comunicación & Equipo", category: "EQUIPO", duration: "1 sem",
    desc: "Sube IGL, UTI, CONS y cohesión grupal (+6 Moral · +2 Fat)",
    fatigueDelta: 2, moraleDelta: 6, cost: 5000, injuryMult: 0.3, riskLabel: "BAJO",
    xpBase: 20, focus: ["igl", "util", "cons"]
  },
  vod_review: {
    id: "vod_review", name: "Análisis de VODs", category: "TÁCTICA", duration: "1 sem",
    desc: "Sube IGL, CLU y CONS + bono +1.5% Anti-Strat (+3 Fat)",
    fatigueDelta: 3, moraleDelta: 2, cost: 3000, injuryMult: 0.25, riskLabel: "BAJO",
    xpBase: 21, matchPrepBonus: 0.015, focus: ["igl", "clutch", "cons"]
  },
  scrims_pro: {
    id: "scrims_pro", name: "Scrims vs Franquicia", category: "SCRIMS", duration: "1 sem",
    desc: "Alto crecimiento AIM/FD/ENT/CLU (+13 Fat · Riesgo alto)",
    fatigueDelta: 13, moraleDelta: -1, cost: 6000, injuryMult: 1.4, riskLabel: "ALTO",
    xpBase: 30, focus: ["aim", "fd", "entry", "clutch"]
  },
  bootcamp: {
    id: "bootcamp", name: "Bootcamp Intensivo", category: "ELITE", duration: "1 sem",
    desc: "Máxima evolución hacia POT + bono Hush (+11 Fat · +3 Moral)",
    fatigueDelta: 11, moraleDelta: 3, cost: 18000, injuryMult: 1.05, riskLabel: "ALTO",
    xpBase: 38, hushMult: 1.4, focus: ["aim", "fd", "clutch", "util", "cons"]
  },
  rest_mental: {
    id: "rest_mental", name: "Descanso & Mentalidad", category: "MENTAL", duration: "1 sem",
    desc: "Psicología: -28 Fat, +10 Moral, sube CONF y cero lesiones",
    fatigueDelta: -28, moraleDelta: 10, cost: 4000, injuryMult: 0.0, riskLabel: "NULO",
    xpBase: 10, focus: ["conf", "clutch"]
  }
};

export const PLAYER_PLANS: Record<
  PlayerPlanId,
  { label: string; keys: DeltaStatKey[]; trainsHush?: boolean }
> = {
  balanced: { label: "Equilibrado", keys: ["aim", "util", "cons", "clutch"] },
  aim: { label: "Duelos (AIM/FD)", keys: ["aim", "fd", "entry"] },
  iq: { label: "Utilidad / IGL", keys: ["util", "igl", "cons"] },
  mental: { label: "Clutch / Mental", keys: ["clutch", "conf", "cons"] },
  hush: { label: "Maestría Hush", keys: ["entry", "fd", "aim"], trainsHush: true }
};

export const AGENT_COMPLEXITY: Record<string, number> = {
  Brimstone: 1, Clove: 1, Phoenix: 1, Reyna: 1, Sage: 1, Gekko: 1,
  Jett: 2, Iso: 2, Omen: 2, Fade: 2, Breach: 2, Skye: 2, "KAY/O": 2,
  Tejo: 2, Killjoy: 2, Chamber: 2, Deadlock: 2, Vyse: 2, Harbor: 2,
  Raze: 3, Yoru: 3, Neon: 3, Waylay: 3, Hush: 3, Sova: 3,
  Viper: 3, Astra: 3, Miks: 3, Cypher: 3, Veto: 3
};

export const ROLE_DISTANCE: Record<RoleName, Record<RoleName, number>> = {
  Duelista: { Duelista: 0, Iniciador: 1, Controlador: 2, Centinela: 2, Flex: 1 },
  Iniciador: { Duelista: 1, Iniciador: 0, Controlador: 1, Centinela: 1, Flex: 1 },
  Controlador: { Duelista: 2, Iniciador: 1, Controlador: 0, Centinela: 1, Flex: 1 },
  Centinela: { Duelista: 2, Iniciador: 1, Controlador: 1, Centinela: 0, Flex: 1 },
  Flex: { Duelista: 1, Iniciador: 1, Controlador: 1, Centinela: 1, Flex: 0 }
};

export const LEARNABLE_ROLES = [
  "Duelista",
  "Iniciador",
  "Controlador",
  "Centinela",
  "Flex",
  "IGL"
] as const;

export const INJURIES_CATALOG = [
  { name: "Tendinitis de muñeca", minW: 2, maxW: 3 },
  { name: "Sobrecarga cervical", minW: 1, maxW: 2 },
  { name: "Fatiga visual / Migraña", minW: 1, maxW: 1 },
  { name: "Distensión dedo índice", minW: 1, maxW: 2 },
  { name: "Túnel carpiano leve", minW: 2, maxW: 4 },
  { name: "Burnout competitivo", minW: 2, maxW: 3 }
] as const;

export const FALLBACK_ACADEMIES: AcademiesJson = {
  scale: { min: 1, max: 10 },
  regionalTier2: { AMERICAS: 6.2, EMEA: 6.8, PACIFIC: 6.0, CHINA: 4.2 },
  clubs: {
    "Leviatán": { rank: 1, quality: 10.0, hasOwnAcademy: true },
    LOUD: { rank: 2, quality: 9.6, hasOwnAcademy: true },
    "FUT Esports": { rank: 3, quality: 9.2, hasOwnAcademy: true },
    Fnatic: { rank: 4, quality: 8.8, hasOwnAcademy: true },
    "Team Heretics": { rank: 5, quality: 8.4, hasOwnAcademy: true },
    "Karmine Corp": { rank: 6, quality: 8.0, hasOwnAcademy: true },
    "Team Vitality": { rank: 7, quality: 7.6, hasOwnAcademy: true },
    "Gentle Mates": { rank: 8, quality: 7.2, hasOwnAcademy: true },
    "G2 Esports": { rank: 9, quality: 6.8, hasOwnAcademy: true },
    "Gen.G": { rank: 10, quality: 6.4, hasOwnAcademy: true },
    T1: { rank: 11, quality: 6.0, hasOwnAcademy: true },
    "Paper Rex": { rank: 12, quality: 5.6, hasOwnAcademy: true },
    Sentinels: { rank: 13, quality: 5.2, hasOwnAcademy: true },
    "100 Thieves": { rank: 14, quality: 4.8, hasOwnAcademy: true },
    "EDward Gaming": { rank: 15, quality: 4.4, hasOwnAcademy: true },
    TYLOO: { rank: 16, quality: 4.0, hasOwnAcademy: true },
    "Bilibili Gaming": { rank: 17, quality: 3.6, hasOwnAcademy: true },
    "Weibo Gaming": { rank: 18, quality: 3.2, hasOwnAcademy: true },
    "Xi Lai Gaming": { rank: 19, quality: 2.8, hasOwnAcademy: true },
    "Trace Esports": { rank: 20, quality: 2.4, hasOwnAcademy: true },
    NRG: { rank: null, quality: null, hasOwnAcademy: false }
  }
};