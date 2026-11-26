import type {
  Coach,
  CustomCompMap,
  MapName,
  MapPrepMap,
  Player,
  Region,
  SeriesFormat,
  SeriesResult
} from "../../core/index.ts";

export type DifficultyId = "easy" | "normal" | "hard";
export type MarketPaceId = "calm" | "normal" | "active";
export type PromisedRole = "starter" | "rotation" | "prospect";
export type PlayerPlanId = "balanced" | "aim" | "iq" | "mental" | "hush";
export type TrainingModeId =
  | "balanced"
  | "role_drill"
  | "agent_lab"
  | "map_prep"
  | "aimlab"
  | "comms_team"
  | "vod_review"
  | "scrims_pro"
  | "bootcamp"
  | "rest_mental";

export type ManagerTabId =
  | "hub"
  | "squad"
  | "tactics"
  | "academy"
  | "market"
  | "calendar"
  | "clubs"
  | "news"
  | "finance";

export type NewsCategory = "RUMOR" | "UPSET" | "DRAMA" | "OFICIAL";

export type DeltaStatKey = "aim" | "fd" | "clutch" | "entry" | "util" | "igl" | "conf" | "cons";

export interface PlayerLearningTask {
  type: "agent" | "role";
  target: string;
  done: number;
  total: number;
}

export interface SellOnClause {
  club: string;
  pct: number;
}

export interface ManagerPlayer extends Player {
  age: number;
  isAcademy: boolean;
  matchesPlayed: number;
  morale: number;
  fatigue: number;
  injuredWeeks: number;
  injuryType: string;
  plan: PlayerPlanId;
  learning: PlayerLearningTask | null;
  learnedAgents: string[];
  learnedRoles: string[];
  xp: number;
  _hushMastery: number;
  hushProgress: number;
  deltas: Record<DeltaStatKey, number>;
  seasonMaps: number;
  seasonRatingSum: number;
  contractYears: number;
  promisedRole: PromisedRole;
  winBonus: number;
  forSale: boolean;
  askingPrice: number;
  weeksOnMarket: number;
  unhappyWeeks: number;
  transferRequested: boolean;
  sellOn: SellOnClause | null;
  salary: number;
  releaseClause: number;
  hireCost?: number;
}

export interface ManagerCoach extends Coach {
  pot: number;
  exp: number;
  tier: "established" | "prospect";
  fee?: number;
}

export interface ActiveSponsor {
  name: string;
  weekly: number;
  season: number;
}

export interface ManagerClub {
  name: string;
  reg: Region;
  color: string;
  code: string;
  players: ManagerPlayer[];
  coach: ManagerCoach;
  budget: number;
  sponsorWeekly: number;
  activeSponsors: ActiveSponsor[];
}

export interface CoachCourse {
  id: string;
  name: string;
  cost: number;
  weeks: number;
  stats: Array<"macro" | "micro" | "adapt" | "dev" | "disc">;
  desc: string;
}

export interface ActiveCoachCourse extends CoachCourse {
  done: number;
}

export interface ManagerMatch {
  id: string;
  week: number;
  stage: string;
  roundKey?: "R16" | "QF" | "SF" | "GF";
  label: string;
  teamA: string | null;
  teamB: string | null;
  fmt: SeriesFormat;
  played: boolean;
  scoreA: number;
  scoreB: number;
  winner: string | null;
  mapsLine: string;
  nextId?: string | null;
  nextSlot?: 0 | 1 | null;
}

export interface StageSchedule {
  leagueName: string;
  leagueTeams: string[];
  matches: ManagerMatch[];
  playoffs: ManagerMatch[];
  masters: ManagerMatch[];
  poSeeded: boolean;
  mastersSeeded: boolean;
  regChamp: string | null;
  mastersChamp: string | null;
}

export interface SeasonSchedule {
  vctPoints: Record<string, number>;
  stage1: StageSchedule;
  stage2: StageSchedule;
  champions: ManagerMatch[];
  championsSeeded: boolean;
  championsChamp: string | null;
  objective: { id: "title" | "champions" | "playoffs"; label: string };
  seasonClosed: boolean;
}

export interface InboxMessage {
  id: string;
  season: number;
  week: number;
  tag: string;
  title: string;
  text: string;
}

export interface ManagerNewsItem {
  id: string;
  s: number;
  w: number;
  cat: NewsCategory;
  headline: string;
  body: string;
  teams: string[];
  hot: boolean;
}

export interface TransferLogEntry {
  s: number;
  w: number;
  type: "FICHAJE" | "VENTA" | "ACADEMIA";
  player: string;
  from: string;
  to: string;
  fee: number;
}

export interface FinanceLogEntry {
  s: number;
  w: number;
  concept: string;
  amount: number;
}

export interface TrophyEntry {
  season: number;
  title: string;
  club: string;
}

export interface SeasonHistoryEntry {
  season: number;
  club: string;
  m1: string;
  m2: string;
  champions: string;
  ovrEnd: number;
}

export interface BoardHistoryPoint {
  s: number;
  w: number;
  val: number;
}

export interface CareerPlayerStat {
  name: string;
  role: string;
  club: string;
  maps: number;
  ratingSum: number;
  acsSum: number;
  bestOvr: number;
}

export interface LastPlayedMatchSummary {
  label: string;
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
  mapsLine: string;
  fmt: SeriesFormat;
}

export interface PendingTransferOffer {
  buyer: string;
  player: string;
  amount: number;
  sellOnPct: number;
  isListedBid: boolean;
  swapPlayer?: string;
}

export interface PendingSponsorOffer {
  name: string;
  tier: "regional" | "masters" | "champions";
  upfront: number;
  weekly: number;
  reason: string;
}

export interface PendingJobOffer {
  club: string;
  reg: Region;
  ovr: number;
  budget: number;
  reason: string;
}

export interface ManagerCareerState {
  userTeam: string;
  season: number;
  week: number;
  settings: {
    difficulty: DifficultyId;
    marketPace: MarketPaceId;
  };
  boardConfidence: number;
  graceWeeks: number;
  boardHistory: BoardHistoryPoint[];
  fired: boolean;
  ended: boolean;
  winStreak: number;
  lossStreak: number;
  bestStreak: number;
  startBudget: number;
  training: TrainingModeId;
  prepMapTarget?: MapName;
  nextMatchPrepBonus: number;
  mapPrep: MapPrepMap;
  customComps: CustomCompMap;
  activeMapPool: MapName[];
  news: ManagerNewsItem[];
  coachCourse: ActiveCoachCourse | null;
  careerPlayerStats: Record<string, CareerPlayerStat>;
  negCooldown: Record<string, number>;
  career: {
    wins: number;
    losses: number;
    regionalTitles: number;
    mastersTitles: number;
    championsTitles: number;
    clubsManaged: string[];
    applyCooldown: Record<string, number>;
  };
  clubs: Record<string, ManagerClub>;
  freeAgents: ManagerPlayer[];
  freeCoaches: ManagerCoach[];
  academy: ManagerPlayer[];
  inbox: InboxMessage[];
  transferLog: TransferLogEntry[];
  financeLog: FinanceLogEntry[];
  trophies: TrophyEntry[];
  seasonHistory: SeasonHistoryEntry[];
  schedule: SeasonSchedule;
  lastPlayedMatch: LastPlayedMatchSummary | null;
  pendingOffer: PendingTransferOffer | null;
  pendingSponsorOffer: PendingSponsorOffer | null;
  pendingJobOffers: PendingJobOffer[];
  lastSavedAt?: string;
}

export interface ActiveNegotiation {
  dir: "buy" | "sell";
  clubName: string;
  playerName: string;
  round: number;
  cash: number;
  swapPlayer: string;
  sellOnPct: number;
  years: number;
  salary: number;
  promisedRole: PromisedRole;
  releaseClause: number;
  winBonus: number;
  counter: {
    cash: number;
    swapPlayer: string;
    sellOnPct: number;
    salary?: number;
    promisedRole?: PromisedRole;
  } | null;
  status: "open" | "rejected";
  log: string[];
}

export interface ActiveRenewal {
  idx: number;
  playerName: string;
  years: number;
  salary: number;
  promisedRole: PromisedRole;
  releaseClause: number;
  winBonus: number;
  feedback: string;
}

export interface ManagerViewerPayload {
  teamA: string;
  teamB: string;
  series: SeriesResult;
  label: string;
}

export interface ManagerSaveV3Payload {
  format: "vct-sim-manager-save";
  version: 3;
  exportedAt: string;
  academyAgentPools: Record<string, string[]>;
  career: ManagerCareerState;
}   