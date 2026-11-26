import {
  AGENTS,
  DEFAULT_ACTIVE_MAPS,
  HUSH_MASTERY,
  PLAYER_AGENTS,
  normalizeActiveMapPool
} from "../core/index.ts";
import type {
  AcademiesJson,
  AgentConfig,
  Coach,
  MapName,
  Player,
  Region,
  TeamMeta
} from "../core/index.ts";
import {
  DEFAULT_TEAMS,
  OFFICIAL_ACADEMIES,
  OFFICIAL_COACHES,
  TEAM_META
} from "../data/officialData.ts";

export interface DataPackMeta {
  name: string;
  season: string;
  author: string;
  exportedAt?: string;
}

export interface ActivePackMeta {
  name: string;
  season: string;
  author: string;
  teamsCount: number;
  playersCount: number;
  agentsCount: number;
}

export interface DataPackTeamEntry {
  reg?: string;
  color?: string;
  logo?: string;
  code?: string;
  logoCls?: string;
  players: Partial<Player>[];
}

export interface DataPackV1 {
  format?: string;
  version?: number;
  meta?: Partial<DataPackMeta>;
  activeMapPool?: string[];
  teams: Record<string, DataPackTeamEntry | Partial<Player>[]>;
  coaches?: Record<string, Partial<Coach>>;
  agents?: Record<string, AgentConfig>;
  playerAgents?: Record<string, string[]>;
  hushMastery?: Record<string, number>;
  academies?: AcademiesJson | null;
}

export interface NormalizedPackRuntime {
  teamMeta: Record<string, TeamMeta>;
  teams: Record<string, Player[]>;
  coaches: Record<string, Coach>;
  agents: Record<string, AgentConfig> | null;
  playerAgents: Record<string, string[]> | null;
  hushMastery: Record<string, number> | null;
  activeMapPool: MapName[] | null;
  academies: AcademiesJson | null;
  activeMeta: ActivePackMeta;
}

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

function replaceRecordInPlace<T extends Record<string, unknown>>(
  target: T,
  source: Record<string, unknown>
): void {
  for (const key of Object.keys(target)) {
    delete target[key];
  }
  Object.assign(target, deepClone(source));
}

export const OFFICIAL_SNAPSHOT = {
  teamMeta: deepClone(TEAM_META),
  teams: deepClone(DEFAULT_TEAMS),
  coaches: deepClone(OFFICIAL_COACHES),
  agents: deepClone(AGENTS),
  playerAgents: deepClone(PLAYER_AGENTS),
  hushMastery: deepClone(HUSH_MASTERY),
  activeMapPool: [...DEFAULT_ACTIVE_MAPS] as MapName[],
  academies: deepClone(OFFICIAL_ACADEMIES)
};

function toRegion(val?: string): Region {
  if (val === "AMERICAS" || val === "EMEA" || val === "PACIFIC" || val === "CHINA") {
    return val;
  }
  return "AMERICAS";
}

export function validateDataPack(
  raw: unknown
): { ok: true; pack: DataPackV1 } | { ok: false; err: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, err: "El archivo JSON está vacío o mal formado." };
  }
  const container = raw as Record<string, unknown>;
  const pack = (
    container.pack && typeof container.pack === "object" ? container.pack : container
  ) as Partial<DataPackV1>;

  if (!pack.teams || typeof pack.teams !== "object") {
    return { ok: false, err: "Falta el bloque 'teams' en el pack de datos." };
  }
  const teamNames = Object.keys(pack.teams);
  if (teamNames.length < 2) {
    return { ok: false, err: "El pack debe contener al menos 2 equipos." };
  }
  for (const name of teamNames) {
    const entry = pack.teams[name];
    const players = Array.isArray(entry) ? entry : entry?.players;
    if (!Array.isArray(players) || players.length < 5) {
      return { ok: false, err: `El equipo "${name}" necesita al menos 5 jugadores.` };
    }
  }
  return { ok: true, pack: pack as DataPackV1 };
}

export function normalizeDataPack(pack: DataPackV1): NormalizedPackRuntime {
  const newMeta: Record<string, TeamMeta> = {};
  const newTeams: Record<string, Player[]> = {};
  const newCoaches: Record<string, Coach> = {};

  for (const tName of Object.keys(pack.teams)) {
    const entry = pack.teams[tName];
    const players = Array.isArray(entry) ? entry : entry.players;
    const metaObj = Array.isArray(entry) ? null : entry;

    newMeta[tName] = {
      reg: toRegion(metaObj?.reg),
      color: metaObj?.color || "#E5484D",
      logo: metaObj?.logo || `${tName.toLowerCase().replace(/\s+/g, "")}.png`,
      code: metaObj?.code || tName.slice(0, 3).toUpperCase(),
      logoCls: metaObj?.logoCls || ""
    };

    newTeams[tName] = players.map((p) => ({
      n: String(p.n || "Player"),
      r: String(p.r || "Flex"),
      aim: Number(p.aim) || 80,
      fd: Number(p.fd) || 80,
      clutch: Number(p.clutch) || 80,
      entry: Number(p.entry) || 80,
      util: Number(p.util) || 80,
      igl: Number(p.igl) || 70,
      conf: Number(p.conf) || 78,
      cons: Number(p.cons) || 80,
      pot: Number(p.pot) || 85,
      sub: p.sub ? 1 : 0
    }));

    const c = pack.coaches?.[tName];
    newCoaches[tName] = c
      ? {
          n: String(c.n || "Coach"),
          macro: Number(c.macro) || 82,
          micro: Number(c.micro) || 82,
          adapt: Number(c.adapt) || 82,
          dev: Number(c.dev) || 82,
          disc: Number(c.disc) || 82
        }
      : { n: "HeadCoach", macro: 82, micro: 82, adapt: 82, dev: 82, disc: 82 };
  }

  const agents =
    pack.agents && typeof pack.agents === "object" && Object.keys(pack.agents).length >= 5
      ? deepClone(pack.agents)
      : null;
  const playerAgents =
    pack.playerAgents && typeof pack.playerAgents === "object"
      ? deepClone(pack.playerAgents)
      : null;
  const hushMastery =
    pack.hushMastery && typeof pack.hushMastery === "object"
      ? deepClone(pack.hushMastery)
      : null;
  const activeMapPool =
    Array.isArray(pack.activeMapPool) && pack.activeMapPool.length === 7
      ? normalizeActiveMapPool(pack.activeMapPool)
      : null;
  const academies = pack.academies ? deepClone(pack.academies) : null;

  const agentsCount = agents ? Object.keys(agents).length : Object.keys(AGENTS).length;

  return {
    teamMeta: newMeta,
    teams: newTeams,
    coaches: newCoaches,
    agents,
    playerAgents,
    hushMastery,
    activeMapPool,
    academies,
    activeMeta: {
      name: pack.meta?.name || "Pack Personalizado",
      season: pack.meta?.season || "Custom",
      author: pack.meta?.author || "Usuario",
      teamsCount: Object.keys(newTeams).length,
      playersCount: Object.values(newTeams).reduce((s, arr) => s + arr.length, 0),
      agentsCount
    }
  };
}

export function applyCorePackRegistries(
  agents: Record<string, AgentConfig> | null,
  playerAgents: Record<string, string[]> | null,
  hushMastery: Record<string, number> | null
): void {
  if (agents) replaceRecordInPlace(AGENTS as unknown as Record<string, unknown>, agents);
  if (playerAgents) {
    replaceRecordInPlace(PLAYER_AGENTS as unknown as Record<string, unknown>, playerAgents);
  }
  if (hushMastery) {
    replaceRecordInPlace(HUSH_MASTERY as unknown as Record<string, unknown>, hushMastery);
  }
}

export function restoreOfficialCoreRegistries(): void {
  replaceRecordInPlace(AGENTS as unknown as Record<string, unknown>, OFFICIAL_SNAPSHOT.agents);
  replaceRecordInPlace(
    PLAYER_AGENTS as unknown as Record<string, unknown>,
    OFFICIAL_SNAPSHOT.playerAgents
  );
  replaceRecordInPlace(
    HUSH_MASTERY as unknown as Record<string, unknown>,
    OFFICIAL_SNAPSHOT.hushMastery
  );
}

export function buildCurrentPackObject(params: {
  teams: Record<string, Player[]>;
  teamMeta: Record<string, TeamMeta>;
  coaches: Record<string, Coach>;
  activeMapPool: MapName[];
  academies: AcademiesJson;
  draftMeta: { name: string; season: string; author: string };
}): DataPackV1 {
  const teamsOut: Record<string, DataPackTeamEntry> = {};
  for (const tName of Object.keys(params.teams)) {
    const m = params.teamMeta[tName] || {
      reg: "AMERICAS" as Region,
      color: "#E5484D",
      logo: "vct.png",
      code: tName.slice(0, 3).toUpperCase(),
      logoCls: ""
    };
    teamsOut[tName] = {
      reg: m.reg,
      color: m.color,
      logo: m.logo,
      code: m.code,
      logoCls: m.logoCls || "",
      players: deepClone(params.teams[tName])
    };
  }

  return {
    format: "vct-sim-datapack",
    version: 1,
    meta: {
      name: (params.draftMeta.name || "VCT Custom Pack").trim(),
      season: (params.draftMeta.season || "2027").trim(),
      author: (params.draftMeta.author || "Comunidad").trim(),
      exportedAt: new Date().toISOString()
    },
    activeMapPool: [...params.activeMapPool],
    teams: teamsOut,
    coaches: deepClone(params.coaches),
    agents: deepClone(AGENTS),
    playerAgents: deepClone(PLAYER_AGENTS),
    hushMastery: deepClone(HUSH_MASTERY),
    academies: deepClone(params.academies)
  };
}

export function downloadDataPackJson(pack: DataPackV1): void {
  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const slug = (pack.meta?.name || "vct-pack")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const a = document.createElement("a");
  a.href = url;
  a.download = `vct-pack-${slug || "custom"}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}