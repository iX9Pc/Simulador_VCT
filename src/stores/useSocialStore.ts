import { create } from "zustand";
import { STORAGE_KEYS } from "../core/index.ts";
import type { SeriesResult } from "../core/index.ts";
import { computeSeriesStats } from "../features/broadcast/stats.ts";
import {
  buildCompactSnapshot,
  decodeSharePayload
} from "../features/social/shareUtils.ts";
import type { CompactSeriesSnapshot } from "../features/social/shareUtils.ts";
import { useDbStore } from "./useDbStore.ts";

export interface PlayerFormRecord {
  team: string;
  bonus: number;
  matches: number;
  lastRating: number;
  avgRating: number;
}

export interface TeamFormRecord {
  w: number;
  l: number;
  streak: Array<"W" | "L">;
}

export interface FormDataState {
  players: Record<string, PlayerFormRecord>;
  teams: Record<string, TeamFormRecord>;
}

function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLS(key: string, val: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // noop
  }
}

function readInitialHashSnapshot(): CompactSeriesSnapshot | null {
  if (typeof window === "undefined") return null;
  const h = window.location.hash;
  if (!h || !h.startsWith("#res=")) return null;
  return decodeSharePayload(h.slice(5));
}

const recordedSeriesRefs = new WeakSet<SeriesResult>();

interface SocialState {
  history: CompactSeriesSnapshot[];
  formData: FormDataState;
  formEnabled: boolean;
  sharedSnap: CompactSeriesSnapshot | null;

  getPersistentFormBonus: (playerName: string) => number;
  recordCompletedSeries: (series: SeriesResult) => void;
  toggleFormEnabled: () => void;
  resetForm: () => void;
  clearHistory: () => void;
  syncSharedHash: () => void;
  closeSharedSnap: () => void;
}

export const useSocialStore = create<SocialState>((set, get) => ({
  history: readLS<CompactSeriesSnapshot[]>(STORAGE_KEYS.HISTORY, []),
  formData: readLS<FormDataState>(STORAGE_KEYS.FORM, { players: {}, teams: {} }),
  formEnabled: readLS<boolean>(STORAGE_KEYS.FORM_ENABLED, true),
  sharedSnap: readInitialHashSnapshot(),

  getPersistentFormBonus: (playerName) => {
    const { formEnabled, formData } = get();
    if (!formEnabled) return 0;
    const rec = formData.players[playerName];
    if (!rec) return 0;
    return Math.max(-0.04, Math.min(0.04, rec.bonus || 0));
  },

  recordCompletedSeries: (series) => {
    if (!series || !series.maps.length || recordedSeriesRefs.has(series)) return;
    recordedSeriesRefs.add(series);

    const { teamMeta } = useDbStore.getState();
    const snap = buildCompactSnapshot(series, teamMeta);
    const nextHistory = [snap, ...get().history].slice(0, 40);
    writeLS(STORAGE_KEYS.HISTORY, nextHistory);

    // Actualizar forma persistente (equipos + jugadores)
    const S = computeSeriesStats(series, series.maps.length, true);
    const t0Name = series.maps[0].teams[0].name;
    const t1Name = series.maps[0].teams[1].name;
    const winIdx = series.seriesScore[0] > series.seriesScore[1] ? 0 : 1;

    const prevForm = get().formData;
    const nextTeams: Record<string, TeamFormRecord> = { ...prevForm.teams };
    const nextPlayers: Record<string, PlayerFormRecord> = { ...prevForm.players };

    [t0Name, t1Name].forEach((tName, idx) => {
      const prev = nextTeams[tName] || { w: 0, l: 0, streak: [] };
      const won = idx === winIdx;
      const outcome: "W" | "L" = won ? "W" : "L";
      const streak: Array<"W" | "L"> = [...prev.streak, outcome].slice(-5);
      nextTeams[tName] = {
        w: prev.w + (won ? 1 : 0),
        l: prev.l + (won ? 0 : 1),
        streak
      };
    });

    for (const id of Object.keys(S)) {
      const s = S[id];
      const pName = s.u.p.n;
      const tName = series.maps[0].teams[s.ti].name;
      const rating = parseFloat(s.rating) || 1.0;
      const prev = nextPlayers[pName] || {
        team: tName,
        bonus: 0,
        matches: 0,
        lastRating: 1.0,
        avgRating: 1.0
      };
      const delta = (rating - 1.04) * 0.055;
      const nextBonus = Math.max(-0.04, Math.min(0.04, prev.bonus * 0.65 + delta));
      const newMatches = prev.matches + 1;
      const avgRating = (prev.avgRating * prev.matches + rating) / newMatches;

      nextPlayers[pName] = {
        team: tName,
        bonus: Number(nextBonus.toFixed(4)),
        matches: newMatches,
        lastRating: rating,
        avgRating: Number(avgRating.toFixed(2))
      };
    }

    const nextFormData: FormDataState = { players: nextPlayers, teams: nextTeams };
    writeLS(STORAGE_KEYS.FORM, nextFormData);

    set({ history: nextHistory, formData: nextFormData });
  },

  toggleFormEnabled: () => {
    const next = !get().formEnabled;
    writeLS(STORAGE_KEYS.FORM_ENABLED, next);
    set({ formEnabled: next });
  },

  resetForm: () => {
    const empty: FormDataState = { players: {}, teams: {} };
    writeLS(STORAGE_KEYS.FORM, empty);
    set({ formData: empty });
  },

  clearHistory: () => {
    writeLS(STORAGE_KEYS.HISTORY, []);
    set({ history: [] });
  },

  syncSharedHash: () => {
    set({ sharedSnap: readInitialHashSnapshot() });
  },

  closeSharedSnap: () => {
    set({ sharedSnap: null });
    try {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    } catch {
      // noop
    }
  }
}));