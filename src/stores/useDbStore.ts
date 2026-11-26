import { create } from "zustand";
import {
  DEFAULT_ACTIVE_MAPS,
  PLAYER_AGENTS,
  STORAGE_KEYS,
  normalizeActiveMapPool
} from "../core/index.ts";
import type {
  AcademiesJson,
  Coach,
  MapName,
  Player,
  Region,
  TeamInput,
  TeamMeta
} from "../core/index.ts";
import {
  OFFICIAL_SNAPSHOT,
  applyCorePackRegistries,
  buildCurrentPackObject,
  deepClone,
  downloadDataPackJson,
  normalizeDataPack,
  restoreOfficialCoreRegistries,
  validateDataPack
} from "../lib/datapacks.ts";
import type { ActivePackMeta } from "../lib/datapacks.ts";

export type EditableStatKey =
  | "aim"
  | "fd"
  | "clutch"
  | "entry"
  | "util"
  | "igl"
  | "conf"
  | "cons"
  | "pot";

export interface PackDraftMeta {
  name: string;
  season: string;
  author: string;
}

export interface CustomTeamRecord {
  reg: Region;
  color: string;
  code: string;
  coach: Coach;
  players: Player[];
  agentPools?: Record<string, string[]>;
}

function readStoredCustomTeams(): Record<string, CustomTeamRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOM_TEAMS);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, CustomTeamRecord>;
  } catch {
    return {};
  }
}

function persistCustomTeams(customTeams: Record<string, CustomTeamRecord>): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CUSTOM_TEAMS, JSON.stringify(customTeams));
  } catch {
    // noop
  }
}

function applySingleCustomTeam(
  name: string,
  rec: CustomTeamRecord,
  teams: Record<string, Player[]>,
  defaultTeams: Record<string, Player[]>,
  teamMeta: Record<string, TeamMeta>,
  coaches: Record<string, Coach>
): void {
  if (!rec || !Array.isArray(rec.players) || rec.players.length < 5) return;
  const code = (rec.code || name.slice(0, 3)).toUpperCase();
  teams[name] = deepClone(rec.players);
  defaultTeams[name] = deepClone(rec.players);
  teamMeta[name] = {
    reg: rec.reg || "AMERICAS",
    color: rec.color || "#10B981",
    logo: `__custom__${code}`,
    code,
    logoCls: ""
  };
  coaches[name] = rec.coach
    ? deepClone(rec.coach)
    : { n: "HeadCoach", macro: 84, micro: 84, adapt: 84, dev: 84, disc: 85 };

  if (rec.agentPools) {
    for (const pName of Object.keys(rec.agentPools)) {
      const pool = rec.agentPools[pName];
      if (Array.isArray(pool) && pool.length) {
        PLAYER_AGENTS[pName] = [...pool];
      }
    }
  }
}

function mergeCustomTeamsInto(
  customTeams: Record<string, CustomTeamRecord>,
  teams: Record<string, Player[]>,
  defaultTeams: Record<string, Player[]>,
  teamMeta: Record<string, TeamMeta>,
  coaches: Record<string, Coach>
): void {
  for (const name of Object.keys(customTeams)) {
    applySingleCustomTeam(name, customTeams[name], teams, defaultTeams, teamMeta, coaches);
  }
}

function persistRosters(teams: Record<string, Player[]>): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ROSTERS, JSON.stringify(teams));
  } catch {
    // noop
  }
}

interface InitialDbState {
  teams: Record<string, Player[]>;
  defaultTeams: Record<string, Player[]>;
  teamMeta: Record<string, TeamMeta>;
  coaches: Record<string, Coach>;
  academies: AcademiesJson;
  activeMapPool: MapName[];
  activePackMeta: ActivePackMeta | null;
  customTeams: Record<string, CustomTeamRecord>;
}

function buildInitialDbState(): InitialDbState {
  let teamMeta = deepClone(OFFICIAL_SNAPSHOT.teamMeta);
  let defaultTeams = deepClone(OFFICIAL_SNAPSHOT.teams);
  let teams = deepClone(OFFICIAL_SNAPSHOT.teams);
  let coaches = deepClone(OFFICIAL_SNAPSHOT.coaches);
  let academies = deepClone(OFFICIAL_SNAPSHOT.academies);
  let activeMapPool: MapName[] = [...DEFAULT_ACTIVE_MAPS];
  let activePackMeta: ActivePackMeta | null = null;
  const customTeams = readStoredCustomTeams();

  try {
    const rawPack = localStorage.getItem(STORAGE_KEYS.ACTIVE_DATAPACK);
    if (rawPack) {
      const res = validateDataPack(JSON.parse(rawPack));
      if (res.ok) {
        const norm = normalizeDataPack(res.pack);
        teamMeta = norm.teamMeta;
        defaultTeams = deepClone(norm.teams);
        teams = norm.teams;
        coaches = norm.coaches;
        if (norm.academies) academies = norm.academies;
        if (norm.activeMapPool) activeMapPool = norm.activeMapPool;
        applyCorePackRegistries(norm.agents, norm.playerAgents, norm.hushMastery);
        activePackMeta = norm.activeMeta;
      }
    }
  } catch {
    // noop
  }

  try {
    const rawRosters = localStorage.getItem(STORAGE_KEYS.ROSTERS);
    if (rawRosters) {
      const parsed = JSON.parse(rawRosters) as Record<string, Player[]>;
      const merged: Record<string, Player[]> = {};
      for (const k of Object.keys(defaultTeams)) {
        merged[k] =
          Array.isArray(parsed[k]) && parsed[k].length >= 5
            ? parsed[k]
            : deepClone(defaultTeams[k]);
      }
      teams = merged;
    }
  } catch {
    // noop
  }

  mergeCustomTeamsInto(customTeams, teams, defaultTeams, teamMeta, coaches);

  return {
    teams,
    defaultTeams,
    teamMeta,
    coaches,
    academies,
    activeMapPool,
    activePackMeta,
    customTeams
  };
}

interface DbState extends InitialDbState {
  packDraftMeta: PackDraftMeta;
  dataVersion: number;

  updatePlayerStat: (teamName: string, idx: number, key: EditableStatKey, val: number) => void;
  toggleSubStatus: (teamName: string, idx: number) => void;
  resetRosters: () => void;
  setActiveMapPool: (maps: readonly string[]) => void;
  setPackDraftField: (field: keyof PackDraftMeta, value: string) => void;
  importDataPack: (
    rawJson: unknown
  ) => { ok: true; meta: ActivePackMeta } | { ok: false; err: string };
  exportDataPack: () => void;
  restoreOfficialData: () => void;
  upsertCustomTeam: (name: string, record: CustomTeamRecord) => void;
  deleteCustomTeam: (name: string) => void;
  getTeamInput: (teamName: string) => TeamInput | null;
}

const bootDb = buildInitialDbState();

export const useDbStore = create<DbState>((set, get) => ({
  ...bootDb,
  packDraftMeta: {
    name: "VCT 2027 Custom Pack",
    season: "2027",
    author: "Comunidad"
  },
  dataVersion: 0,

  updatePlayerStat: (teamName, idx, key, val) => {
    const clamped = Math.max(40, Math.min(99, Math.round(val) || 75));
    const current = get().teams;
    const roster = current[teamName];
    if (!roster || !roster[idx]) return;

    const nextRoster = roster.map((p, i) => (i === idx ? { ...p, [key]: clamped } : p));
    const nextTeams = { ...current, [teamName]: nextRoster };
    persistRosters(nextTeams);
    set((s) => ({ teams: nextTeams, dataVersion: s.dataVersion + 1 }));
  },

  toggleSubStatus: (teamName, idx) => {
    const current = get().teams;
    const roster = current[teamName];
    if (!roster || !roster[idx]) return;

    const nextRoster = roster.map((p) => ({ ...p }));
    const target = nextRoster[idx];
    if (target.sub) {
      const currentStarters = nextRoster.filter((p) => !p.sub);
      if (currentStarters.length >= 5) {
        currentStarters[currentStarters.length - 1].sub = 1;
      }
      target.sub = 0;
    } else {
      const waitingSub = nextRoster.find((p, i) => p.sub && i !== idx);
      if (waitingSub) {
        waitingSub.sub = 0;
        target.sub = 1;
      }
    }

    const nextTeams = { ...current, [teamName]: nextRoster };
    persistRosters(nextTeams);
    set((s) => ({ teams: nextTeams, dataVersion: s.dataVersion + 1 }));
  },

  resetRosters: () => {
    const { defaultTeams, teamMeta, coaches, customTeams } = get();
    const nextTeams = deepClone(defaultTeams);
    const nextDefault = deepClone(defaultTeams);
    const nextMeta = deepClone(teamMeta);
    const nextCoaches = deepClone(coaches);
    mergeCustomTeamsInto(customTeams, nextTeams, nextDefault, nextMeta, nextCoaches);
    persistRosters(nextTeams);
    set((s) => ({
      teams: nextTeams,
      defaultTeams: nextDefault,
      teamMeta: nextMeta,
      coaches: nextCoaches,
      dataVersion: s.dataVersion + 1
    }));
  },

  setActiveMapPool: (maps) => {
    const activeMapPool = normalizeActiveMapPool(maps);
    set((s) => ({ activeMapPool, dataVersion: s.dataVersion + 1 }));
  },

  setPackDraftField: (field, value) => {
    set((s) => ({
      packDraftMeta: { ...s.packDraftMeta, [field]: value }
    }));
  },

  importDataPack: (rawJson) => {
    const res = validateDataPack(rawJson);
    if (!res.ok) return { ok: false, err: res.err };

    const norm = normalizeDataPack(res.pack);
    applyCorePackRegistries(norm.agents, norm.playerAgents, norm.hushMastery);

    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_DATAPACK, JSON.stringify(res.pack));
    } catch {
      // noop
    }
    persistRosters(norm.teams);

    set((s) => ({
      teamMeta: norm.teamMeta,
      defaultTeams: deepClone(norm.teams),
      teams: norm.teams,
      coaches: norm.coaches,
      academies: norm.academies ?? s.academies,
      activeMapPool: norm.activeMapPool ?? s.activeMapPool,
      activePackMeta: norm.activeMeta,
      dataVersion: s.dataVersion + 1
    }));

    return { ok: true, meta: norm.activeMeta };
  },

  exportDataPack: () => {
    const { teams, teamMeta, coaches, activeMapPool, academies, packDraftMeta } = get();
    const pack = buildCurrentPackObject({
      teams,
      teamMeta,
      coaches,
      activeMapPool,
      academies,
      draftMeta: packDraftMeta
    });
    downloadDataPackJson(pack);
  },

  restoreOfficialData: () => {
    try {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_DATAPACK);
    } catch {
      // noop
    }
    restoreOfficialCoreRegistries();

    const customTeams = get().customTeams;
    const teams = deepClone(OFFICIAL_SNAPSHOT.teams);
    const defaultTeams = deepClone(OFFICIAL_SNAPSHOT.teams);
    const teamMeta = deepClone(OFFICIAL_SNAPSHOT.teamMeta);
    const coaches = deepClone(OFFICIAL_SNAPSHOT.coaches);
    mergeCustomTeamsInto(customTeams, teams, defaultTeams, teamMeta, coaches);
    persistRosters(teams);

    set((s) => ({
      teamMeta,
      defaultTeams,
      teams,
      coaches,
      academies: deepClone(OFFICIAL_SNAPSHOT.academies),
      activeMapPool: [...OFFICIAL_SNAPSHOT.activeMapPool],
      activePackMeta: null,
      dataVersion: s.dataVersion + 1
    }));
  },

  upsertCustomTeam: (name, record) => {
    const st = get();
    const nextCustom = { ...st.customTeams, [name]: deepClone(record) };
    const nextTeams = { ...st.teams };
    const nextDefault = { ...st.defaultTeams };
    const nextMeta = { ...st.teamMeta };
    const nextCoaches = { ...st.coaches };

    applySingleCustomTeam(name, record, nextTeams, nextDefault, nextMeta, nextCoaches);
    persistCustomTeams(nextCustom);

    set((s) => ({
      customTeams: nextCustom,
      teams: nextTeams,
      defaultTeams: nextDefault,
      teamMeta: nextMeta,
      coaches: nextCoaches,
      dataVersion: s.dataVersion + 1
    }));
  },

  deleteCustomTeam: (name) => {
    const st = get();
    if (!st.customTeams[name]) return;

    const nextCustom = { ...st.customTeams };
    delete nextCustom[name];
    persistCustomTeams(nextCustom);

    const nextTeams = { ...st.teams };
    const nextDefault = { ...st.defaultTeams };
    const nextMeta = { ...st.teamMeta };
    const nextCoaches = { ...st.coaches };

    if (OFFICIAL_SNAPSHOT.teams[name]) {
      nextTeams[name] = deepClone(OFFICIAL_SNAPSHOT.teams[name]);
      nextDefault[name] = deepClone(OFFICIAL_SNAPSHOT.teams[name]);
      nextMeta[name] = deepClone(OFFICIAL_SNAPSHOT.teamMeta[name]);
      nextCoaches[name] = deepClone(OFFICIAL_SNAPSHOT.coaches[name]);
    } else {
      delete nextTeams[name];
      delete nextDefault[name];
      delete nextMeta[name];
      delete nextCoaches[name];
    }

    set((s) => ({
      customTeams: nextCustom,
      teams: nextTeams,
      defaultTeams: nextDefault,
      teamMeta: nextMeta,
      coaches: nextCoaches,
      dataVersion: s.dataVersion + 1
    }));
  },

  getTeamInput: (teamName) => {
    const { teams, coaches } = get();
    const players = teams[teamName];
    const coach = coaches[teamName];
    if (!players || !coach) return null;
    return { name: teamName, players, coach };
  }
}));