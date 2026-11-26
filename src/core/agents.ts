import type { AgentConfig, MapName, Player, RoleName } from "./types.ts";

type BaseSevenMaps = Pick<
  Record<MapName, number>,
  "Ascent" | "Bind" | "Breeze" | "Haven" | "Lotus" | "Split" | "Sunset"
>;

type ExtraSixMaps = Pick<
  Record<MapName, number>,
  "Abyss" | "Corrode" | "Fracture" | "Icebox" | "Pearl" | "Summit"
>;

type RawAgentConfig = Omit<AgentConfig, "maps"> & { maps: BaseSevenMaps };

const BASE_AGENTS: Record<string, RawAgentConfig> = {
  // Duelistas (9)
  Jett:    { role: "Duelista", secondaryRole: null,        entryType: "dive",    cannotSoloRole: false, op: true,  ecoBoost: 1.0,  maps: { Ascent: 96, Bind: 76, Breeze: 97, Haven: 93, Lotus: 82, Split: 85, Sunset: 82 } },
  Raze:    { role: "Duelista", secondaryRole: null,        entryType: "dive",    cannotSoloRole: false, op: false, ecoBoost: 1.0,  maps: { Ascent: 79, Bind: 98, Breeze: 71, Haven: 80, Lotus: 96, Split: 98, Sunset: 92 } },
  Neon:    { role: "Duelista", secondaryRole: null,        entryType: "dive",    cannotSoloRole: false, op: false, ecoBoost: 1.02, maps: { Ascent: 83, Bind: 84, Breeze: 86, Haven: 96, Lotus: 94, Split: 89, Sunset: 96 } },
  Waylay:  { role: "Duelista", secondaryRole: null,        entryType: "dive",    cannotSoloRole: false, op: true,  ecoBoost: 1.0,  maps: { Ascent: 90, Bind: 84, Breeze: 89, Haven: 90, Lotus: 88, Split: 88, Sunset: 89 } },
  Hush:    { role: "Duelista", secondaryRole: null,        entryType: "dive",    cannotSoloRole: false, op: false, ecoBoost: 1.03, hush: true, maps: { Ascent: 90, Bind: 92, Breeze: 84, Haven: 93, Lotus: 95, Split: 96, Sunset: 95 } },
  Yoru:    { role: "Duelista", secondaryRole: "Iniciador", entryType: "hybrid",  cannotSoloRole: false, op: true,  ecoBoost: 1.02, maps: { Ascent: 86, Bind: 94, Breeze: 95, Haven: 91, Lotus: 87, Split: 90, Sunset: 85 } },
  Phoenix: { role: "Duelista", secondaryRole: "Iniciador", entryType: "contact", cannotSoloRole: true,  op: false, ecoBoost: 1.02, maps: { Ascent: 82, Bind: 84, Breeze: 72, Haven: 85, Lotus: 80, Split: 84, Sunset: 86 } },
  Iso:     { role: "Duelista", secondaryRole: null,        entryType: "contact", cannotSoloRole: true,  op: false, ecoBoost: 1.04, maps: { Ascent: 85, Bind: 80, Breeze: 85, Haven: 92, Lotus: 86, Split: 82, Sunset: 84 } },
  Reyna:   { role: "Duelista", secondaryRole: null,        entryType: "contact", cannotSoloRole: true,  op: false, ecoBoost: 1.03, maps: { Ascent: 78, Bind: 76, Breeze: 82, Haven: 80, Lotus: 78, Split: 80, Sunset: 81 } },

  // Iniciadores (7)
  Sova:    { role: "Iniciador", secondaryRole: null,       initType: "recon",    cannotSoloRole: false, op: false, ecoBoost: 1.0,  maps: { Ascent: 98, Bind: 78, Breeze: 98, Haven: 96, Lotus: 83, Split: 74, Sunset: 89 } },
  Fade:    { role: "Iniciador", secondaryRole: null,       initType: "recon",    cannotSoloRole: false, op: false, ecoBoost: 1.0,  maps: { Ascent: 84, Bind: 93, Breeze: 76, Haven: 83, Lotus: 96, Split: 91, Sunset: 89 } },
  Skye:    { role: "Iniciador", secondaryRole: null,       initType: "hybrid",   cannotSoloRole: false, op: false, ecoBoost: 1.0,  maps: { Ascent: 80, Bind: 95, Breeze: 87, Haven: 85, Lotus: 83, Split: 93, Sunset: 82 } },
  Gekko:   { role: "Iniciador", secondaryRole: null,       initType: "hybrid",   cannotSoloRole: false, op: false, ecoBoost: 1.01, maps: { Ascent: 83, Bind: 92, Breeze: 79, Haven: 83, Lotus: 88, Split: 86, Sunset: 93 } },
  Tejo:    { role: "Iniciador", secondaryRole: null,       initType: "hybrid",   cannotSoloRole: false, op: false, ecoBoost: 1.02, maps: { Ascent: 86, Bind: 94, Breeze: 83, Haven: 92, Lotus: 94, Split: 91, Sunset: 90 } },
  "KAY/O": { role: "Iniciador", secondaryRole: "Duelista", initType: "flash",    cannotSoloRole: true,  op: false, ecoBoost: 1.0,  maps: { Ascent: 95, Bind: 78, Breeze: 89, Haven: 87, Lotus: 81, Split: 85, Sunset: 85 } },
  Breach:  { role: "Iniciador", secondaryRole: null,       initType: "flash",    cannotSoloRole: true,  op: false, ecoBoost: 1.0,  maps: { Ascent: 80, Bind: 83, Breeze: 70, Haven: 94, Lotus: 90, Split: 93, Sunset: 93 } },

  // Controladores (7)
  Omen:      { role: "Controlador", secondaryRole: null,        smokeType: "pure",        cannotSoloRole: false, op: false, ecoBoost: 1.01, maps: { Ascent: 98, Bind: 82, Breeze: 80, Haven: 97, Lotus: 97, Split: 96, Sunset: 95 } },
  Brimstone: { role: "Controlador", secondaryRole: null,        smokeType: "pure",        cannotSoloRole: false, op: false, ecoBoost: 1.0,  maps: { Ascent: 78, Bind: 97, Breeze: 70, Haven: 78, Lotus: 76, Split: 82, Sunset: 78 } },
  Astra:     { role: "Controlador", secondaryRole: null,        smokeType: "pure",        cannotSoloRole: false, op: false, ecoBoost: 1.0,  maps: { Ascent: 85, Bind: 86, Breeze: 79, Haven: 89, Lotus: 88, Split: 94, Sunset: 85 } },
  Miks:      { role: "Controlador", secondaryRole: null,        smokeType: "pure",        cannotSoloRole: false, op: false, ecoBoost: 1.02, maps: { Ascent: 86, Bind: 92, Breeze: 77, Haven: 88, Lotus: 91, Split: 93, Sunset: 92 } },
  Clove:     { role: "Controlador", secondaryRole: "Duelista",  smokeType: "hybrid_dome", cannotSoloRole: false, op: false, ecoBoost: 1.03, maps: { Ascent: 84, Bind: 82, Breeze: 74, Haven: 85, Lotus: 86, Split: 87, Sunset: 89 } },
  Viper:     { role: "Controlador", secondaryRole: "Centinela", smokeType: "hybrid_wall", cannotSoloRole: true,  op: false, ecoBoost: 1.0,  wall: true, maps: { Ascent: 79, Bind: 97, Breeze: 99, Haven: 83, Lotus: 95, Split: 90, Sunset: 85 } },
  Harbor:    { role: "Controlador", secondaryRole: "Iniciador", smokeType: "hybrid_wall", cannotSoloRole: true,  op: false, ecoBoost: 1.0,  wall: true, maps: { Ascent: 78, Bind: 84, Breeze: 90, Haven: 80, Lotus: 83, Split: 81, Sunset: 82 } },

  // Centinelas (7)
  Cypher:   { role: "Centinela", secondaryRole: null,          sentinelType: "pure",   cannotSoloRole: false, op: false, ecoBoost: 1.0,  maps: { Ascent: 89, Bind: 90, Breeze: 95, Haven: 94, Lotus: 88, Split: 96, Sunset: 98 } },
  Killjoy:  { role: "Centinela", secondaryRole: null,          sentinelType: "pure",   cannotSoloRole: false, op: false, ecoBoost: 1.0,  maps: { Ascent: 97, Bind: 83, Breeze: 79, Haven: 92, Lotus: 95, Split: 84, Sunset: 81 } },
  Vyse:     { role: "Centinela", secondaryRole: null,          sentinelType: "pure",   cannotSoloRole: false, op: false, ecoBoost: 1.0,  maps: { Ascent: 90, Bind: 92, Breeze: 80, Haven: 91, Lotus: 90, Split: 94, Sunset: 89 } },
  Veto:     { role: "Centinela", secondaryRole: null,          sentinelType: "pure",   cannotSoloRole: false, op: false, ecoBoost: 1.02, maps: { Ascent: 90, Bind: 93, Breeze: 84, Haven: 91, Lotus: 94, Split: 93, Sunset: 91 } },
  Chamber:  { role: "Centinela", secondaryRole: "Duelista",    sentinelType: "hybrid", cannotSoloRole: true,  op: true,  ecoBoost: 1.13, maps: { Ascent: 82, Bind: 85, Breeze: 98, Haven: 88, Lotus: 90, Split: 79, Sunset: 86 } },
  Deadlock: { role: "Centinela", secondaryRole: "Iniciador",   sentinelType: "hybrid", cannotSoloRole: true,  op: false, ecoBoost: 1.0,  maps: { Ascent: 87, Bind: 91, Breeze: 76, Haven: 83, Lotus: 85, Split: 90, Sunset: 85 } },
  Sage:     { role: "Centinela", secondaryRole: "Controlador", sentinelType: "hybrid", cannotSoloRole: true,  op: false, ecoBoost: 1.0,  maps: { Ascent: 80, Bind: 83, Breeze: 74, Haven: 82, Lotus: 79, Split: 89, Sunset: 84 } }
};

const EXTRA_MAP_FITS: Record<string, ExtraSixMaps> = {
  Jett:      { Abyss: 96, Corrode: 84, Fracture: 80, Icebox: 94, Pearl: 93, Summit: 89 },
  Raze:      { Abyss: 78, Corrode: 94, Fracture: 97, Icebox: 79, Pearl: 82, Summit: 93 },
  Neon:      { Abyss: 88, Corrode: 92, Fracture: 96, Icebox: 83, Pearl: 90, Summit: 94 },
  Waylay:    { Abyss: 91, Corrode: 88, Fracture: 89, Icebox: 88, Pearl: 88, Summit: 90 },
  Hush:      { Abyss: 89, Corrode: 94, Fracture: 95, Icebox: 87, Pearl: 91, Summit: 95 },
  Yoru:      { Abyss: 94, Corrode: 88, Fracture: 86, Icebox: 86, Pearl: 93, Summit: 90 },
  Phoenix:   { Abyss: 76, Corrode: 84, Fracture: 84, Icebox: 77, Pearl: 85, Summit: 84 },
  Iso:       { Abyss: 84, Corrode: 85, Fracture: 83, Icebox: 84, Pearl: 86, Summit: 86 },
  Reyna:     { Abyss: 82, Corrode: 79, Fracture: 78, Icebox: 82, Pearl: 81, Summit: 80 },
  Sova:      { Abyss: 97, Corrode: 84, Fracture: 74, Icebox: 96, Pearl: 92, Summit: 91 },
  Fade:      { Abyss: 83, Corrode: 94, Fracture: 85, Icebox: 79, Pearl: 94, Summit: 92 },
  Skye:      { Abyss: 82, Corrode: 87, Fracture: 86, Icebox: 80, Pearl: 87, Summit: 86 },
  Gekko:     { Abyss: 85, Corrode: 88, Fracture: 88, Icebox: 94, Pearl: 87, Summit: 88 },
  Tejo:      { Abyss: 87, Corrode: 93, Fracture: 96, Icebox: 88, Pearl: 92, Summit: 91 },
  "KAY/O":   { Abyss: 88, Corrode: 85, Fracture: 87, Icebox: 89, Pearl: 88, Summit: 87 },
  Breach:    { Abyss: 80, Corrode: 91, Fracture: 98, Icebox: 72, Pearl: 82, Summit: 90 },
  Omen:      { Abyss: 95, Corrode: 96, Fracture: 82, Icebox: 83, Pearl: 86, Summit: 96 },
  Brimstone: { Abyss: 74, Corrode: 85, Fracture: 98, Icebox: 71, Pearl: 80, Summit: 84 },
  Astra:     { Abyss: 95, Corrode: 88, Fracture: 84, Icebox: 76, Pearl: 97, Summit: 88 },
  Miks:      { Abyss: 87, Corrode: 93, Fracture: 88, Icebox: 84, Pearl: 90, Summit: 94 },
  Clove:     { Abyss: 80, Corrode: 87, Fracture: 84, Icebox: 79, Pearl: 84, Summit: 88 },
  Viper:     { Abyss: 85, Corrode: 94, Fracture: 86, Icebox: 99, Pearl: 95, Summit: 88 },
  Harbor:    { Abyss: 83, Corrode: 86, Fracture: 79, Icebox: 91, Pearl: 93, Summit: 83 },
  Cypher:    { Abyss: 95, Corrode: 95, Fracture: 94, Icebox: 82, Pearl: 93, Summit: 94 },
  Killjoy:   { Abyss: 84, Corrode: 89, Fracture: 93, Icebox: 97, Pearl: 94, Summit: 89 },
  Vyse:      { Abyss: 92, Corrode: 92, Fracture: 90, Icebox: 86, Pearl: 94, Summit: 91 },
  Veto:      { Abyss: 91, Corrode: 94, Fracture: 91, Icebox: 93, Pearl: 92, Summit: 93 },
  Chamber:   { Abyss: 89, Corrode: 84, Fracture: 89, Icebox: 87, Pearl: 87, Summit: 86 },
  Deadlock:  { Abyss: 85, Corrode: 89, Fracture: 88, Icebox: 84, Pearl: 85, Summit: 87 },
  Sage:      { Abyss: 81, Corrode: 84, Fracture: 82, Icebox: 91, Pearl: 83, Summit: 84 }
};

export const AGENTS: Record<string, AgentConfig> = Object.fromEntries(
  Object.entries(BASE_AGENTS).map(([name, cfg]) => [
    name,
    {
      ...cfg,
      maps: { ...cfg.maps, ...EXTRA_MAP_FITS[name] }
    }
  ])
);

export const HUSH_MASTERY: Record<string, number> = {
  spike: 1.0,
  spikezin: 1.0,
  OXY: 1.0,
  zekken: 1.0,
  Timotino: 1.0,
  tkzin: 1.0,
  primmie: 1.0,
  BuZz: 1.0,
  aspas: 0.55
};

export const PLAYER_AGENTS: Record<string, string[]> = {
  // Sentinels
  OXY: ["Hush", "Jett", "Neon", "Raze", "Chamber", "Yoru"],
  canezerra: ["Yoru", "Raze", "KAY/O", "Gekko", "Neon", "Phoenix"],
  brawk: ["Sova", "Fade", "Tejo", "Breach", "Skye"],
  keiko: ["Omen", "Viper", "Miks", "Brimstone", "Clove", "Astra"],
  johnqt: ["Cypher", "Veto", "Vyse", "Killjoy", "Viper", "Fade"],
  Zellsis: ["KAY/O", "Breach", "Killjoy", "Viper", "Deadlock", "Sage"],
  // NRG
  zekken: ["Hush", "Raze", "Neon", "Jett", "Yoru", "Waylay"],
  mada: ["Jett", "Chamber", "Omen", "Yoru", "Raze"],
  skuba: ["Viper", "Cypher", "Omen", "Brimstone", "Killjoy", "Veto"],
  eeiu: ["Sova", "Fade", "Tejo", "Skye", "Gekko"],
  Ethan: ["KAY/O", "Breach", "Omen", "Yoru", "Skye"],
  // G2 Esports
  HYUNMIN: ["Jett", "Neon", "Raze", "Waylay", "Yoru"],
  Sato: ["Raze", "Yoru", "KAY/O", "Gekko", "Breach"],
  trent: ["Sova", "Tejo", "Fade", "Viper", "Breach"],
  kiNgg: ["Omen", "Viper", "Miks", "Astra", "Brimstone", "Harbor"],
  leaf: ["Chamber", "Viper", "Veto", "Cypher", "Killjoy", "Vyse"],
  // 100 Thieves
  Cryocells: ["Chamber", "Jett", "Brimstone", "Yoru", "Astra"],
  Asuna: ["Raze", "Neon", "KAY/O", "Gekko", "Skye", "Phoenix"],
  Timotino: ["Hush", "Yoru", "Neon", "Raze", "Waylay", "Iso"],
  bang: ["Omen", "Viper", "Miks", "Astra", "Brimstone", "Clove"],
  vora: ["Sova", "Fade", "Tejo", "Breach", "KAY/O"],
  // Leviatán
  Neon: ["Neon", "Jett", "Raze", "Yoru"],
  spike: ["Hush", "Raze", "Yoru", "KAY/O", "Gekko"],
  blowz: ["Sova", "Fade", "Tejo", "Breach"],
  erde: ["Omen", "Viper", "Miks", "Brimstone", "Astra"],
  lukxo: ["Cypher", "Veto", "Killjoy", "Chamber", "Vyse"],
  // LOUD
  DaviH: ["Jett", "Raze", "Neon", "Chamber"],
  tkzin: ["Hush", "Raze", "Yoru", "Gekko", "KAY/O"],
  artzin: ["Fade", "Sova", "Breach", "Tejo"],
  basic: ["Omen", "Viper", "Miks", "Brimstone", "Astra"],
  cortezia: ["Cypher", "Veto", "Killjoy", "Viper", "Vyse"],
  // Fnatic
  kaajak: ["Jett", "Neon", "Raze", "Chamber", "Waylay"],
  marteen: ["Yoru", "Raze", "Jett", "Iso", "Neon"],
  Cloud: ["Sova", "Fade", "Tejo", "Skye", "Breach"],
  valyn: ["Omen", "Astra", "Miks", "Brimstone", "Viper", "Clove"],
  Minny: ["Cypher", "Killjoy", "Veto", "Vyse", "Viper"],
  // FUT Esports
  aspas: ["Jett", "Raze", "Neon", "Waylay", "Hush", "Chamber"],
  Wo0t: ["Yoru", "Raze", "KAY/O", "Iso", "Breach", "Phoenix"],
  batujnax: ["Sova", "Fade", "Tejo", "Skye"],
  hezacoil: ["Omen", "Viper", "Miks", "Brimstone", "Astra"],
  yetujey: ["Cypher", "Veto", "Killjoy", "Vyse", "Chamber"],
  // Gentle Mates
  kozzy: ["Neon", "Raze", "Jett", "Yoru"],
  Alfajer: ["Killjoy", "Cypher", "Chamber", "Veto", "Iso", "Vyse"],
  Boaster: ["Omen", "Astra", "Brimstone", "Viper", "Miks"],
  Ruxic: ["Viper", "Omen", "Miks", "Clove", "KAY/O", "Fade"],
  MAGNUM: ["Sova", "Fade", "Tejo", "Cypher", "Breach"],
  // Karmine Corp
  LewN: ["Jett", "Neon", "Raze", "Chamber"],
  N4RRATE: ["Fade", "Sova", "Gekko", "Raze", "Tejo"],
  avez: ["Omen", "Viper", "Miks", "Brimstone", "Astra"],
  dos9: ["Viper", "Omen", "Clove", "Harbor"],
  SUYGETSU: ["Cypher", "Viper", "Veto", "Killjoy", "Vyse"],
  sheydos: ["Fade", "Sova", "Cypher", "Viper", "Sage"],
  // Team Vitality
  jawgemo: ["Raze", "Yoru", "Neon", "Jett", "Omen"],
  Jamppi: ["Sova", "Breach", "KAY/O", "Chamber", "Tejo"],
  Sayonara: ["Yoru", "Neon", "Iso", "Fade", "Gekko"],
  PROFEK: ["Omen", "Viper", "Miks", "Brimstone", "Astra"],
  Chronicle: ["Viper", "Cypher", "Veto", "Breach", "Tejo", "Killjoy", "Sage"],
  // Team Heretics
  Jamelinho213: ["Jett", "Neon", "Raze", "Yoru"],
  hiro: ["Cypher", "Viper", "Fade", "Killjoy", "Veto"],
  RieNs: ["Sova", "Fade", "Tejo", "Skye"],
  chloric: ["Omen", "Viper", "Miks", "Brimstone", "Astra"],
  benjyfishy: ["Cypher", "Killjoy", "Veto", "Vyse", "Chamber"],
  // T1
  BuZz: ["Hush", "Jett", "Raze", "Neon", "Chamber"],
  iZu: ["Yoru", "Iso", "Chamber", "Raze", "Cypher"],
  TenZ: ["Omen", "Gekko", "KAY/O", "Jett", "Clove", "Miks"],
  crashies: ["Sova", "Fade", "Tejo", "Skye"],
  stax: ["Breach", "Omen", "Viper", "Brimstone", "KAY/O"],
  // Paper Rex
  something: ["Jett", "Yoru", "Chamber", "Gekko", "Reyna"],
  primmie: ["Hush", "Iso", "Chamber", "Jett", "Clove", "Neon"],
  f0rsakeN: ["Omen", "Miks", "Yoru", "Harbor", "Breach", "Cypher"],
  invy: ["Sova", "Fade", "KAY/O", "Breach", "Tejo"],
  PatMen: ["Viper", "Fade", "Cypher", "Brimstone", "Omen", "Sage"],
  // Gen.G
  t3xture: ["Jett", "Raze", "Neon", "Chamber"],
  Dambi: ["Neon", "Raze", "Yoru", "Breach", "Phoenix"],
  Ray: ["Sova", "Fade", "Tejo", "Skye"],
  Karon: ["Omen", "Viper", "Miks", "Brimstone", "Astra"],
  MaKo: ["Viper", "Omen", "Astra", "Brimstone"],
  Xiesta: ["Yoru", "Raze", "KAY/O", "Fade"],
  // Xi Lai Gaming
  ZmjjKK: ["Jett", "Neon", "Raze", "Chamber", "Waylay"],
  Zeus: ["Raze", "Yoru", "Neon", "KAY/O"],
  d4v41: ["Skye", "Fade", "Viper", "Vyse", "Sova", "Sage"],
  happywei: ["Omen", "Viper", "Miks", "Brimstone", "Astra"],
  WsLeo: ["Cypher", "Veto", "Killjoy", "Chamber", "Vyse"],
  // EDward Gaming
  stew: ["Jett", "Neon", "Raze", "Chamber"],
  Jieni7: ["Yoru", "Raze", "Neon", "Iso"],
  Rossy: ["Sova", "Fade", "Breach", "Tejo"],
  iamgrq: ["Omen", "Viper", "Miks", "Brimstone", "Astra"],
  zjc: ["Cypher", "Veto", "Killjoy", "Vyse", "Viper"],
  // Bilibili Gaming
  whzy: ["Jett", "Raze", "Neon", "Chamber"],
  alvinboy: ["Yoru", "KAY/O", "Gekko", "Fade"],
  nephh: ["Breach", "Sova", "Tejo", "KAY/O"],
  Smoggy: ["Omen", "Viper", "Miks", "Clove", "Brimstone"],
  Knight: ["Cypher", "Veto", "Killjoy", "Viper", "Vyse"],
  // Weibo Gaming
  babybay: ["Jett", "Neon", "Raze", "Chamber", "Phoenix"],
  Yoyo: ["Raze", "Yoru", "Gekko", "KAY/O"],
  heybay: ["Sova", "Fade", "Breach", "Tejo"],
  Satoshi: ["Omen", "Viper", "Brimstone", "Astra"],
  Erv: ["Cypher", "Killjoy", "Veto", "Vyse", "Deadlock"],
  Razziss: ["Jett", "Raze", "Neon", "Yoru"],
  // TYLOO
  splash: ["Jett", "Neon", "Raze", "Chamber"],
  slowly: ["Yoru", "Raze", "KAY/O", "Fade"],
  SiuFatBB: ["Sova", "Breach", "Tejo", "Fade"],
  xihe: ["Omen", "Viper", "Miks", "Brimstone", "Astra"],
  hfmi0dzjc9z7: ["Cypher", "Killjoy", "Veto", "Vyse", "Chamber"],
  // Trace Esports
  Kai: ["Jett", "Chamber", "Neon", "Raze"],
  nobody: ["Sova", "Fade", "Tejo", "Gekko"],
  Nicc: ["Omen", "Viper", "Miks", "Brimstone", "Astra"],
  CHICHOO: ["Viper", "Cypher", "Veto", "Killjoy", "Omen"],
  FengF: ["Raze", "Yoru", "KAY/O", "Breach"],
  Abo: ["Yoru", "Raze", "Fade", "Cypher"]
};

export const ROLE_DEFAULT_AGENTS: Record<RoleName, string[]> = {
  Duelista: ["Jett", "Raze", "Neon", "Yoru", "Waylay", "Iso", "Phoenix", "Reyna"],
  Iniciador: ["Sova", "Fade", "Tejo", "Breach", "KAY/O", "Skye", "Gekko"],
  Controlador: ["Omen", "Viper", "Miks", "Brimstone", "Astra", "Clove", "Harbor"],
  Centinela: ["Cypher", "Killjoy", "Veto", "Chamber", "Vyse", "Deadlock", "Sage"],
  Flex: ["Yoru", "KAY/O", "Viper", "Fade", "Breach", "Gekko", "Raze", "Miks"]
};

export function parsePlayerRoles(roleStr?: string): {
  primary: RoleName;
  secondary: RoleName | null;
} {
  const parts = (roleStr || "").split("/").map((s) => s.trim().toLowerCase());
  const mapToken = (t: string): RoleName | null => {
    if (t.includes("duelista")) return "Duelista";
    if (t.includes("iniciador")) return "Iniciador";
    if (t.includes("controlador")) return "Controlador";
    if (t.includes("centinela")) return "Centinela";
    if (t.includes("flex")) return "Flex";
    return null;
  };
  const parsed = parts.map(mapToken).filter((r): r is RoleName => r !== null);
  const primary: RoleName = parsed[0] || "Flex";
  const secondary: RoleName | null = parsed.find((x) => x !== primary) || null;
  return { primary, secondary };
}

export function getPrimaryRoleFromStr(roleStr?: string): RoleName {
  return parsePlayerRoles(roleStr).primary;
}

export function getPlayerAgents(player: Pick<Player, "n" | "r">): string[] {
  const sig = (PLAYER_AGENTS[player.n] || []).filter((a) => Boolean(AGENTS[a]));
  const primary = getPrimaryRoleFromStr(player.r);
  const base = ROLE_DEFAULT_AGENTS[primary] || ROLE_DEFAULT_AGENTS.Flex;
  const merged = [...sig];
  for (const a of base) {
    if (!merged.includes(a)) merged.push(a);
  }
  return merged;
}