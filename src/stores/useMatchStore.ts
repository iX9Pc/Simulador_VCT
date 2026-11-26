import { create } from "zustand";
import { buildSeries } from "../core/index.ts";
import type { MapName, SeriesFormat, SeriesResult } from "../core/index.ts";
import { applyTeamColorsForPair } from "../features/broadcast/stats.ts";
import { VCTSound } from "../lib/sound.ts";
import { useDbStore } from "./useDbStore.ts";

export interface MonteCarloSummary {
  n: number;
  format: SeriesFormat;
  teamA: string;
  teamB: string;
  pctA: string;
  pctB: string;
  avgMaps: string;
  avgRounds: string;
  otRate: string;
}

interface MatchState {
  teamA: string;
  teamB: string;
  format: SeriesFormat;
  mapChoice: MapName | "AUTO";
  series: SeriesResult | null;
  isExternalSeries: boolean;
  contextLabel: string | null;
  liveFinished: boolean;
  liveMapIdx: number;
  liveShown: number;
  revealedMaps: number;
  activeTab: number | "SERIES";
  isAutoPlaying: boolean;
  errorMsg: string | null;
  monteCarlo: MonteCarloSummary | null;

  // Hooks enchufables en M4 (Forma persistente e Historial)
  getPersistentFormBonus?: (playerName: string) => number;
  onSeriesCompleted?: (series: SeriesResult) => void;

  setHooks: (hooks: {
    getPersistentFormBonus?: (playerName: string) => number;
    onSeriesCompleted?: (series: SeriesResult) => void;
  }) => void;
  ensureValidSelection: () => void;
  setTeamA: (name: string) => void;
  setTeamB: (name: string) => void;
  swapTeams: () => void;
  setFormat: (fmt: SeriesFormat) => void;
  setMapChoice: (choice: MapName | "AUTO") => void;
  simulateFull: (recordHistory?: boolean) => void;
  stepRound: () => void;
  toggleAutoPlay: () => void;
  stopLive: () => void;
  selectTab: (tab: number | "SERIES") => void;
  runMonteCarlo: (n?: number) => void;
  loadExternalSeries: (
    teamAName: string,
    teamBName: string,
    seriesObj: SeriesResult,
    autoPlay?: boolean,
    contextLabel?: string
  ) => void;
}

let liveTimer: number | null = null;

function clearLiveInterval() {
  if (liveTimer !== null) {
    window.clearInterval(liveTimer);
    liveTimer = null;
  }
}

function getInitialTeamPair(): [string, string] {
  const names = Object.keys(useDbStore.getState().teams);
  const a = names[0] || "";
  const b = names[6] || names[1] || a;
  return [a, b];
}

const [initA, initB] = getInitialTeamPair();

export const useMatchStore = create<MatchState>((set, get) => {
  const buildPairOrError = () => {
    const { teamA, teamB } = get();
    if (!teamA || !teamB || teamA === teamB) {
      set({
        errorMsg: "Selecciona dos equipos distintos para ejecutar la simulación.",
        monteCarlo: null
      });
      return null;
    }
    const db = useDbStore.getState();
    const pA = db.getTeamInput(teamA);
    const pB = db.getTeamInput(teamB);
    if (!pA || !pB) return null;
    applyTeamColorsForPair(db.teamMeta, teamA, teamB);
    set({ errorMsg: null });
    return [pA, pB] as const;
  };

  const advanceLiveRound = (): boolean => {
    const st = get();
    if (!st.series || st.liveFinished) {
      st.stopLive();
      return false;
    }

    const activeM = st.series.maps[st.liveMapIdx];
    if (!activeM) {
      st.stopLive();
      return false;
    }

    if (st.liveShown < activeM.rounds.length) {
      const nextShown = st.liveShown + 1;
      const justPlayed = activeM.rounds[nextShown - 1];
      const mapDoneNow = nextShown >= activeM.rounds.length;
      const seriesDoneNow = mapDoneNow && st.liveMapIdx === st.series.maps.length - 1;

      if (justPlayed) {
        if (mapDoneNow) VCTSound.mapEnd();
        else if (justPlayed.hl.some((h) => h.t === "ace")) VCTSound.ace();
        else if (justPlayed.cl && justPlayed.cl.won && justPlayed.cl.x >= 2) VCTSound.clutch();
        else if (justPlayed.timeouts.length) VCTSound.timeout();
        else VCTSound.roundEnd();
      }

      if (seriesDoneNow) {
        clearLiveInterval();
        set({
          activeTab: st.liveMapIdx,
          liveShown: nextShown,
          liveFinished: true,
          revealedMaps: st.series.maps.length,
          isAutoPlaying: false
        });
        if (!st.isExternalSeries && st.onSeriesCompleted) {
          st.onSeriesCompleted(st.series);
        }
        return false;
      }

      set({ activeTab: st.liveMapIdx, liveShown: nextShown });
      return true;
    }

    if (st.liveMapIdx + 1 < st.series.maps.length) {
      const nextMapIdx = st.liveMapIdx + 1;
      const nextM = st.series.maps[nextMapIdx];
      const doneImmediately = 1 >= nextM.rounds.length && nextMapIdx === st.series.maps.length - 1;

      if (doneImmediately) {
        clearLiveInterval();
        set({
          liveMapIdx: nextMapIdx,
          revealedMaps: st.series.maps.length,
          activeTab: nextMapIdx,
          liveShown: 1,
          liveFinished: true,
          isAutoPlaying: false
        });
        if (!st.isExternalSeries && st.onSeriesCompleted) {
          st.onSeriesCompleted(st.series);
        }
        return false;
      }

      set({
        liveMapIdx: nextMapIdx,
        revealedMaps: Math.max(st.revealedMaps, nextMapIdx + 1),
        activeTab: nextMapIdx,
        liveShown: 1
      });
      return true;
    }

    clearLiveInterval();
    set({
      liveFinished: true,
      revealedMaps: st.series.maps.length,
      isAutoPlaying: false
    });
    if (!st.isExternalSeries && st.onSeriesCompleted) {
      st.onSeriesCompleted(st.series);
    }
    return false;
  };

  return {
    teamA: initA,
    teamB: initB,
    format: 3,
    mapChoice: "AUTO",
    series: null,
    isExternalSeries: false,
    contextLabel: null,
    liveFinished: true,
    liveMapIdx: 0,
    liveShown: 0,
    revealedMaps: 0,
    activeTab: 0,
    isAutoPlaying: false,
    errorMsg: null,
    monteCarlo: null,

    setHooks: (hooks) => set((s) => ({ ...s, ...hooks })),

    ensureValidSelection: () => {
      const db = useDbStore.getState();
      const names = Object.keys(db.teams);
      if (names.length < 2) return;
      let { teamA, teamB, mapChoice } = get();
      let changed = false;
      if (!db.teams[teamA]) {
        teamA = names[0];
        changed = true;
      }
      if (!db.teams[teamB] || teamB === teamA) {
        teamB = names.find((n) => n !== teamA) || names[0];
        changed = true;
      }
      if (mapChoice !== "AUTO" && !db.activeMapPool.includes(mapChoice)) {
        mapChoice = "AUTO";
        changed = true;
      }
      if (changed) set({ teamA, teamB, mapChoice });
      applyTeamColorsForPair(db.teamMeta, teamA, teamB);
    },

    setTeamA: (name) => {
      set({ teamA: name });
      get().simulateFull(true);
    },

    setTeamB: (name) => {
      set({ teamB: name });
      get().simulateFull(true);
    },

    swapTeams: () => {
      const { teamA, teamB } = get();
      set({ teamA: teamB, teamB: teamA });
      get().simulateFull(true);
    },

    setFormat: (fmt) => {
      set({ format: fmt });
      get().simulateFull(true);
    },

    setMapChoice: (choice) => {
      set({ mapChoice: choice });
      get().simulateFull(true);
    },

    stopLive: () => {
      clearLiveInterval();
      if (get().isAutoPlaying) set({ isAutoPlaying: false });
    },

    simulateFull: (recordHistory = true) => {
      get().stopLive();
      const pair = buildPairOrError();
      if (!pair) return;

      const { format, mapChoice, getPersistentFormBonus, onSeriesCompleted } = get();
      const { activeMapPool } = useDbStore.getState();
      const built = buildSeries(pair[0], pair[1], format, {
        forcedFirstMap: mapChoice,
        activeMaps: activeMapPool,
        startProgressive: false,
        getPersistentFormBonus
      });

      const lastIdx = Math.max(0, built.maps.length - 1);
      set({
        series: built,
        isExternalSeries: false,
        contextLabel: null,
        monteCarlo: null,
        liveFinished: true,
        liveMapIdx: lastIdx,
        liveShown: built.maps[lastIdx]?.rounds.length ?? 0,
        revealedMaps: built.maps.length,
        activeTab: built.format > 1 ? "SERIES" : 0
      });

      if (recordHistory && onSeriesCompleted) {
        onSeriesCompleted(built);
      }
    },

    stepRound: () => {
      get().stopLive();
      const pair = buildPairOrError();
      if (!pair) return;

      const st = get();
      if (!st.series || st.liveFinished) {
        const { activeMapPool } = useDbStore.getState();
        const built = buildSeries(pair[0], pair[1], st.format, {
          forcedFirstMap: st.mapChoice,
          activeMaps: activeMapPool,
          startProgressive: true,
          getPersistentFormBonus: st.getPersistentFormBonus
        });
        set({
          series: built,
          isExternalSeries: false,
          contextLabel: null,
          monteCarlo: null,
          liveFinished: false,
          liveMapIdx: 0,
          liveShown: 0,
          revealedMaps: 1,
          activeTab: 0
        });
      }

      advanceLiveRound();
    },

    toggleAutoPlay: () => {
      if (liveTimer !== null) {
        get().stopLive();
        return;
      }

      const pair = buildPairOrError();
      if (!pair) return;

      const st = get();
      if (!st.series || st.liveFinished) {
        const { activeMapPool } = useDbStore.getState();
        const built = buildSeries(pair[0], pair[1], st.format, {
          forcedFirstMap: st.mapChoice,
          activeMaps: activeMapPool,
          startProgressive: true,
          getPersistentFormBonus: st.getPersistentFormBonus
        });
        set({
          series: built,
          isExternalSeries: false,
          contextLabel: null,
          monteCarlo: null,
          liveFinished: false,
          liveMapIdx: 0,
          liveShown: 0,
          revealedMaps: 1,
          activeTab: 0,
          isAutoPlaying: true
        });
      } else {
        set({ activeTab: st.liveMapIdx, isAutoPlaying: true });
      }

      if (!advanceLiveRound()) return;
      liveTimer = window.setInterval(() => {
        if (!advanceLiveRound()) get().stopLive();
      }, 340);
    },

    selectTab: (tab) => {
      get().stopLive();
      const st = get();
      if (!st.series) return;
      if (tab === "SERIES") {
        if (!st.liveFinished) return;
        set({ activeTab: "SERIES" });
        return;
      }
      if (tab < 0 || tab >= st.series.maps.length) return;
      if (!st.liveFinished && tab > st.liveMapIdx) return;
      set({ activeTab: tab });
    },

    runMonteCarlo: (n = 500) => {
      get().stopLive();
      const pair = buildPairOrError();
      if (!pair) return;

      const { format, mapChoice, getPersistentFormBonus } = get();
      const { activeMapPool } = useDbStore.getState();
      let wins = 0;
      let ot = 0;
      let rd = 0;
      let totalMaps = 0;

      for (let i = 0; i < n; i++) {
        const s = buildSeries(pair[0], pair[1], format, {
          forcedFirstMap: mapChoice,
          activeMaps: activeMapPool,
          getPersistentFormBonus
        });
        if (s.seriesScore[0] > s.seriesScore[1]) wins++;
        totalMaps += s.maps.length;
        s.maps.forEach((m) => {
          if (m.rounds.length > 24) ot++;
          rd += m.rounds.length;
        });
      }

      set({
        monteCarlo: {
          n,
          format,
          teamA: pair[0].name,
          teamB: pair[1].name,
          pctA: ((wins / n) * 100).toFixed(1),
          pctB: (((n - wins) / n) * 100).toFixed(1),
          avgMaps: (totalMaps / n).toFixed(2),
          avgRounds: (rd / n).toFixed(1),
          otRate: ((ot / Math.max(1, totalMaps)) * 100).toFixed(1)
        }
      });
    },

    loadExternalSeries: (teamAName, teamBName, seriesObj, autoPlay = false, contextLabel = "") => {
      get().stopLive();
      const db = useDbStore.getState();
      applyTeamColorsForPair(db.teamMeta, teamAName, teamBName);
      const lastIdx = Math.max(0, seriesObj.maps.length - 1);

      set({
        teamA: db.teams[teamAName] ? teamAName : get().teamA,
        teamB: db.teams[teamBName] ? teamBName : get().teamB,
        format: seriesObj.format,
        series: seriesObj,
        isExternalSeries: true,
        contextLabel: contextLabel || null,
        monteCarlo: null,
        errorMsg: null,
        liveFinished: !autoPlay,
        liveMapIdx: autoPlay ? 0 : lastIdx,
        liveShown: autoPlay ? 0 : seriesObj.maps[lastIdx]?.rounds.length ?? 0,
        revealedMaps: autoPlay ? 1 : seriesObj.maps.length,
        activeTab: autoPlay ? 0 : seriesObj.format > 1 ? "SERIES" : 0,
        isAutoPlaying: autoPlay
      });

      if (autoPlay) {
        if (advanceLiveRound()) {
          liveTimer = window.setInterval(() => {
            if (!advanceLiveRound()) get().stopLive();
          }, 340);
        }
      }
    }
  };
});