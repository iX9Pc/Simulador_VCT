import type { CompConfig } from "./types.ts";

export const DEFAULT_EXP = 1.5;

export const STORAGE_KEYS = {
  THEME: "vct_sim_theme",
  SFX: "vct_sim_sfx",
  ROSTERS: "vct_sim_2027_rosters_v8",
  HISTORY: "vct_sim_history_v1",
  FORM: "vct_sim_form_v1",
  FORM_ENABLED: "vct_sim_form_enabled_v1",
  CUSTOM_TEAMS: "vct_sim_custom_teams_v1",
  MANAGER_CAREER: "vct_sim_manager_career_v3",
  ACTIVE_DATAPACK: "vct_sim_active_datapack_v1"
} as const;

export const COMP_CONFIG: CompConfig = {
  rol_puntos: {
    Duelista: { macro: 0, util: 0, entrada: 3, defensa: -1, flex: 0 },
    Iniciador: { macro: 1, util: 3, entrada: 1, defensa: 0, flex: 1 },
    Controlador: { macro: 3, util: 2, entrada: 0, defensa: 1, flex: 0 },
    Centinela: { macro: 0, util: 1, entrada: -1, defensa: 3, flex: 0 },
    Flex: { macro: 1, util: 1, entrada: 1, defensa: 1, flex: 2 }
  },
  ideal: { macro: 5, util: 7, entrada: 4, defensa: 4, flex: 3 },
  decrecimiento: [1.0, 0.6, 0.25],
  rol_secundario: 0.5,
  factor_eje: 0.013,
  tope_eje: 0.08,
  bonus_equilibrio: 0.02,
  mapa_mult: 0.1
};