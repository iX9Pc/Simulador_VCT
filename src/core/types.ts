export type Region = "AMERICAS" | "EMEA" | "PACIFIC" | "CHINA";

export type CoreRole = "Duelista" | "Iniciador" | "Controlador" | "Centinela";
export type RoleName = CoreRole | "Flex";
export type AxisName = "macro" | "util" | "entrada" | "defensa" | "flex";

export type MapName =
  | "Ascent"
  | "Bind"
  | "Breeze"
  | "Haven"
  | "Lotus"
  | "Split"
  | "Sunset"
  | "Abyss"
  | "Corrode"
  | "Fracture"
  | "Icebox"
  | "Pearl"
  | "Summit";

export type SeriesFormat = 1 | 3 | 5;
export type StartingSide = "ATK" | "DEF";
export type EconType = "Pistol" | "Eco" | "Force" | "Full";

export interface Player {
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
  sub: number;
  /** Modificador inyectado por el Modo Manager (moral/fatiga/entrenamiento) */
  _mgrMod?: number;
  /** Maestría aprendida de Hush en Modo Manager (0 a 1) */
  _hushMastery?: number;
}

export interface Coach {
  n: string;
  macro: number;
  micro: number;
  adapt: number;
  dev: number;
  disc: number;
}

export interface TeamMeta {
  reg: Region;
  color: string;
  logo: string;
  code: string;
  logoCls: string;
}

export interface TeamEntryJson extends TeamMeta {
  players: Player[];
}

export interface TeamsJson {
  updated: string;
  source: string;
  teams: Record<string, TeamEntryJson>;
}

export type CoachesJson = Record<string, Coach>;

export interface AcademyClubInfo {
  rank: number | null;
  quality: number | null;
  hasOwnAcademy: boolean;
}

export interface AcademiesJson {
  scale: { min: number; max: number };
  regionalTier2: Record<Region, number>;
  clubs: Record<string, AcademyClubInfo>;
}

/** Mapa de composiciones manuales por mapa (o "DEFAULT") -> { [playerName]: agentName } */
export type CustomCompMap = Partial<Record<MapName | "DEFAULT", Record<string, string>>>;

/** Bonos de preparación táctica por mapa (ej. +0.025 en Ascent desde Modo Manager) */
export type MapPrepMap = Partial<Record<MapName, number>>;

export interface TeamInput {
  name: string;
  players: Player[];
  coach: Coach;
  customComp?: CustomCompMap;
  mapPrep?: MapPrepMap;
}

export type AxisRecord = Record<AxisName, number>;

export interface CompConfig {
  rol_puntos: Record<RoleName, AxisRecord>;
  ideal: AxisRecord;
  decrecimiento: readonly [number, number, number];
  rol_secundario: number;
  factor_eje: number;
  tope_eje: number;
  bonus_equilibrio: number;
  mapa_mult: number;
}

export interface MapConfig {
  desc: string;
  aim: number;
  fd: number;
  util: number;
  entry: number;
  clu: number;
  igl: number;
  atkBias: number;
  defBias: number;
  longRange: boolean;
  preferWall: boolean;
  axisMult: AxisRecord;
}

export type EntryType = "dive" | "hybrid" | "contact";
export type InitType = "recon" | "flash" | "hybrid";
export type SmokeType = "pure" | "hybrid_dome" | "hybrid_wall";
export type SentinelType = "pure" | "hybrid";

export interface AgentConfig {
  role: CoreRole;
  secondaryRole: CoreRole | null;
  entryType?: EntryType;
  initType?: InitType;
  smokeType?: SmokeType;
  sentinelType?: SentinelType;
  cannotSoloRole: boolean;
  op: boolean;
  ecoBoost: number;
  hush?: boolean;
  wall?: boolean;
  maps: Record<MapName, number>;
}

export interface AgentAssignment {
  playerName: string;
  agent: string;
  role: CoreRole;
  mapFit: number;
  comfort: boolean;
  isOpBoost: boolean;
  hushMastery: number;
  ecoBoost: number;
  manual?: boolean;
}

export interface CompositionEval {
  roleCounts: Record<RoleName, number>;
  pts: AxisRecord;
  bonuses: AxisRecord;
  eqBonus: number;
  varianceBoost: number;
  isBalanced: boolean;
  archetype: string;
  warnings: string[];
  synergies: string[];
}

export interface TeamCompDraft {
  mapName: MapName;
  assignments: AgentAssignment[];
  compScore: number;
  bonuses: AxisRecord;
  eqBonus: number;
  varianceBoost: number;
  archetype: string;
  synergies: string[];
  warnings: string[];
  tags: string[];
}

export interface MapProfileEntry {
  mapName: MapName;
  score: number;
  comp: TeamCompDraft;
}

export interface TeamMapProfile {
  byMap: Partial<Record<MapName, MapProfileEntry>>;
  sorted: MapProfileEntry[];
  best: MapProfileEntry[];
  worst: MapProfileEntry;
}

export interface Duel1v1Result {
  repLeft: Player;
  reasonLeft: string;
  repRight: Player;
  reasonRight: string;
  score1v1: [number, number];
  winnerPlayer: Player;
  winnerTeamName: string;
  winnerCoachName: string;
  chosenRole: "Equipo A" | "Equipo B";
  teamA: TeamInput;
  teamB: TeamInput;
}

export interface VetoStep {
  step: number;
  type: "ban" | "pick" | "decider";
  actor: string;
  mapName: MapName;
  detail: string;
}

export interface ScheduledMap {
  mapName: MapName;
  pickedBy: string;
  sideChooser: string;
  sideChosen: StartingSide;
  atkTeamName: string;
  defTeamName: string;
}

export interface VetoResult {
  duel: Duel1v1Result;
  steps: VetoStep[];
  scheduledMaps: ScheduledMap[];
}

export interface MatchUnit {
  p: Player;
  agent: string;
  agentRole: CoreRole;
  agentFit: number;
  comfort: boolean;
  isOpBoost: boolean;
  hushMastery: number;
  ecoBoost: number;
  form: number;
}

export interface MatchTeamState {
  name: string;
  coach: Coach;
  comp: TeamCompDraft;
  units: MatchUnit[];
}

export interface KillEvent {
  k: string;
  v: string;
  fb: boolean;
  tr: boolean;
  as: string | null;
}

export interface ClutchInfo {
  id: string;
  x: number;
  won: boolean;
}

export interface TimeoutEvent {
  ti: 0 | 1;
  coach: string;
  team: string;
  scoreCtx: string;
}

export interface HighlightEvent {
  r: number;
  t: "ace" | "cl" | "mk" | "up" | "to";
  x: string;
}

export interface RoundResult {
  n: number;
  before: [number, number];
  win: 0 | 1;
  econ: [EconType, EconType];
  ev: KillEvent[];
  cl: ClutchInfo | null;
  hl: HighlightEvent[];
  timeouts: TimeoutEvent[];
  survivors: string[];
  score: [number, number];
}

export interface MatchResult {
  teams: [MatchTeamState, MatchTeamState];
  comps: [TeamCompDraft, TeamCompDraft];
  rounds: RoundResult[];
  sc: [number, number];
  mapName: MapName;
  leftStartsAtk: boolean;
  pickedBy: string;
  sideChooser: string;
  sideChosen: StartingSide;
}

export interface SeriesResult {
  format: SeriesFormat;
  vetoData: VetoResult;
  maps: MatchResult[];
  seriesScore: [number, number];
  revealedMaps: number;
  activeTab: number | "SERIES";
}

export interface SimOptions {
  /** Exponente de sensibilidad de fuerza (por defecto 1.5) */
  exp?: number;
  /** Inyección pura del bono de forma persistente (sin acoplar window) */
  getPersistentFormBonus?: (playerName: string) => number;
}

export interface VetoOptions {
  forcedFirstMap?: MapName | "AUTO";
  activeMaps?: readonly MapName[];
}

export interface SeriesOptions extends SimOptions, VetoOptions {
  startProgressive?: boolean;
}