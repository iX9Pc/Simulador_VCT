import type { MapConfig, MapName } from "./types.ts";

export const ALL_MAPS: Record<MapName, MapConfig> = {
  Ascent: {
    desc: "Ascent · Control de medio y Operator (+AIM/FD, Defensor)",
    aim: 1.05, fd: 1.07, util: 0.99, entry: 1.0, clu: 1.0, igl: 1.03,
    atkBias: 0.97, defBias: 1.03, longRange: true, preferWall: false,
    axisMult: { macro: 1.08, util: 1.0, entrada: 0.96, defensa: 1.08, flex: 1.0 }
  },
  Bind: {
    desc: "Bind · Teleporters y utilidad pesada (+Macro/Entrada, Raze/Viper/Brim)",
    aim: 0.99, fd: 1.02, util: 1.1, entry: 1.09, clu: 1.01, igl: 1.02,
    atkBias: 1.01, defBias: 0.99, longRange: false, preferWall: true,
    axisMult: { macro: 1.1, util: 1.05, entrada: 1.1, defensa: 0.94, flex: 0.98 }
  },
  Breeze: {
    desc: "Breeze · Larga distancia y Operator (+AIM/FD, Chamber/Jett/Viper)",
    aim: 1.09, fd: 1.1, util: 0.96, entry: 1.0, clu: 1.01, igl: 1.0,
    atkBias: 1.02, defBias: 0.98, longRange: true, preferWall: true,
    axisMult: { macro: 1.08, util: 0.92, entrada: 1.06, defensa: 0.95, flex: 1.04 }
  },
  Haven: {
    desc: "Haven · 3 sitios, rotaciones rápidas y OP (+Macro/Defensa/Flex)",
    aim: 1.02, fd: 1.03, util: 1.04, entry: 1.01, clu: 1.08, igl: 1.09,
    atkBias: 1.03, defBias: 0.97, longRange: true, preferWall: false,
    axisMult: { macro: 1.08, util: 1.04, entrada: 1.0, defensa: 1.04, flex: 1.08 }
  },
  Lotus: {
    desc: "Lotus · 3 sitios, ejecuciones y utilidad pesada (+Utilidad/Macro/Entrada)",
    aim: 0.98, fd: 0.99, util: 1.12, entry: 1.05, clu: 1.02, igl: 1.11,
    atkBias: 1.04, defBias: 0.96, longRange: false, preferWall: true,
    axisMult: { macro: 1.08, util: 1.1, entrada: 1.06, defensa: 0.94, flex: 1.02 }
  },
  Split: {
    desc: "Split · Combate cerrado y choke points (+Macro/Entrada/Defensa)",
    aim: 1.03, fd: 1.03, util: 1.06, entry: 1.07, clu: 1.03, igl: 1.01,
    atkBias: 0.96, defBias: 1.04, longRange: false, preferWall: false,
    axisMult: { macro: 1.08, util: 1.02, entrada: 1.1, defensa: 1.06, flex: 0.96 }
  },
  Sunset: {
    desc: "Sunset · Pelea constante de medio y retakes (+Defensa/Utilidad)",
    aim: 1.02, fd: 1.03, util: 1.04, entry: 1.07, clu: 1.07, igl: 1.01,
    atkBias: 1.02, defBias: 0.98, longRange: false, preferWall: false,
    axisMult: { macro: 0.98, util: 1.1, entrada: 1.02, defensa: 1.1, flex: 1.02 }
  },
  Abyss: {
    desc: "Abyss · Largas líneas, caídas al vacío y post-plants (+AIM/Macro/Flex)",
    aim: 1.06, fd: 1.06, util: 1.02, entry: 1.02, clu: 1.05, igl: 1.04,
    atkBias: 1.03, defBias: 0.97, longRange: true, preferWall: false,
    axisMult: { macro: 1.08, util: 1.02, entrada: 1.0, defensa: 0.98, flex: 1.08 }
  },
  Corrode: {
    desc: "Corrode · Pasillos industriales y pelea de medio (+Utilidad/Defensa)",
    aim: 1.01, fd: 1.02, util: 1.08, entry: 1.05, clu: 1.04, igl: 1.04,
    atkBias: 0.98, defBias: 1.02, longRange: false, preferWall: true,
    axisMult: { macro: 1.04, util: 1.08, entrada: 1.04, defensa: 1.06, flex: 0.98 }
  },
  Fracture: {
    desc: "Fracture · Pinches desde 2 frentes y utilidad explosiva (+Entrada/Utilidad)",
    aim: 1.01, fd: 1.04, util: 1.1, entry: 1.11, clu: 1.0, igl: 1.05,
    atkBias: 1.05, defBias: 0.95, longRange: false, preferWall: false,
    axisMult: { macro: 1.04, util: 1.08, entrada: 1.1, defensa: 0.94, flex: 1.04 }
  },
  Icebox: {
    desc: "Icebox · Muro obligatorio, verticalidad y retakes duros (+AIM/Macro/Clutch)",
    aim: 1.06, fd: 1.05, util: 1.02, entry: 1.03, clu: 1.06, igl: 1.02,
    atkBias: 1.02, defBias: 0.98, longRange: true, preferWall: true,
    axisMult: { macro: 1.08, util: 0.98, entrada: 1.02, defensa: 1.04, flex: 1.04 }
  },
  Pearl: {
    desc: "Pearl · B Long, Plaza y post-plants tácticos (+Macro/Utilidad/Clutch)",
    aim: 1.03, fd: 1.03, util: 1.06, entry: 1.01, clu: 1.07, igl: 1.06,
    atkBias: 1.02, defBias: 0.98, longRange: true, preferWall: true,
    axisMult: { macro: 1.08, util: 1.06, entrada: 0.98, defensa: 1.02, flex: 1.04 }
  },
  Summit: {
    desc: "Summit · Rotaciones rápidas y duelos de media distancia (+Flex/Entrada/IGL)",
    aim: 1.03, fd: 1.04, util: 1.05, entry: 1.06, clu: 1.03, igl: 1.05,
    atkBias: 1.0, defBias: 1.0, longRange: false, preferWall: false,
    axisMult: { macro: 1.04, util: 1.04, entrada: 1.06, defensa: 1.02, flex: 1.08 }
  }
};

export const ALL_MAP_NAMES = Object.keys(ALL_MAPS) as MapName[];

export const DEFAULT_ACTIVE_MAPS: readonly MapName[] = [
  "Ascent",
  "Bind",
  "Breeze",
  "Haven",
  "Lotus",
  "Split",
  "Sunset"
];

export function isMapName(value: string): value is MapName {
  return Object.prototype.hasOwnProperty.call(ALL_MAPS, value);
}

export function getMapConfig(mapName: string): MapConfig {
  return isMapName(mapName) ? ALL_MAPS[mapName] : ALL_MAPS.Ascent;
}

export function normalizeActiveMapPool(mapList?: readonly string[]): MapName[] {
  const valid = Array.isArray(mapList)
    ? Array.from(new Set(mapList.filter(isMapName)))
    : [];
  const final7 = valid.slice(0, 7);
  for (const m of ALL_MAP_NAMES) {
    if (final7.length >= 7) break;
    if (!final7.includes(m)) final7.push(m);
  }
  return final7;
}

export function rotateActiveMapPool(
  currentPool: readonly MapName[] = DEFAULT_ACTIVE_MAPS,
  outCount = 2
): { outMaps: MapName[]; inMaps: MapName[]; activePool: MapName[] } {
  const current = normalizeActiveMapPool(currentPool);
  const bench = ALL_MAP_NAMES.filter((m) => !current.includes(m));
  const swapN = Math.min(outCount, current.length, bench.length);
  const shuffledCur = current.slice().sort(() => Math.random() - 0.5);
  const shuffledBench = bench.slice().sort(() => Math.random() - 0.5);
  const outMaps = shuffledCur.slice(0, swapN);
  const inMaps = shuffledBench.slice(0, swapN);
  const activePool = normalizeActiveMapPool([
    ...current.filter((m) => !outMaps.includes(m)),
    ...inMaps
  ]);
  return { outMaps, inMaps, activePool };
}