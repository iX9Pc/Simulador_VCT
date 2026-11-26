import teamsRaw from "../../data/teams.json";
import coachesRaw from "../../data/coaches.json";
import academiesRaw from "../../data/academies.json";
import type { AcademiesJson, CoachesJson, Player, TeamMeta, TeamsJson } from "../core/index.ts";

export const OFFICIAL_TEAMS_JSON = teamsRaw as unknown as TeamsJson;
export const OFFICIAL_COACHES: CoachesJson = coachesRaw as unknown as CoachesJson;
export const OFFICIAL_ACADEMIES: AcademiesJson = academiesRaw as unknown as AcademiesJson;

export const DATA_UPDATED: string = OFFICIAL_TEAMS_JSON.updated;

export const TEAM_META: Record<string, TeamMeta> = {};
export const DEFAULT_TEAMS: Record<string, Player[]> = {};

for (const teamName of Object.keys(OFFICIAL_TEAMS_JSON.teams)) {
  const { players, ...meta } = OFFICIAL_TEAMS_JSON.teams[teamName];
  TEAM_META[teamName] = meta;
  DEFAULT_TEAMS[teamName] = players;
}

export const TEAM_NAMES: string[] = Object.keys(DEFAULT_TEAMS);