// ===== MÓDULO P6.1: VISOR TÁCTICO 2D CON GRAFO DE NAVEGACIÓN (13 MAPAS VCT) =====
(function () {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function parseHexRgb(color) {
    const c = (color || "").trim();
    const m = /^#([0-9a-f]{6})$/i.exec(c);
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function colorDist(c1, c2) {
    const a = parseHexRgb(c1), b = parseHexRgb(c2);
    if (!a || !b) return 200;
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  }

  // ===== PLANOS Y GRAFOS CAMINABLES DE LOS 13 MAPAS (0..100, ATK ABAJO / DEF ARRIBA) =====
  const MAP_BLUEPRINTS = {
    Ascent: {
      floor: [
        [36, 76, 30, 14], [42, 6, 18, 12], // Spawns ATK / DEF
        [14, 22, 18, 22], [14, 44, 14, 24], [18, 66, 22, 10], // B Site + B Main + B Lobby
        [70, 26, 18, 18], [72, 44, 14, 22], [62, 64, 16, 12], // A Site + A Main + A Lobby
        [40, 34, 20, 36], // Mid Courtyard
        [30, 32, 12, 12], [58, 26, 14, 12], // Market / Tree-Catwalk
        [24, 16, 24, 10], [54, 16, 24, 10]  // DEF rotaciones a B / A
      ],
      voids: [
        [29, 46, 10, 18], [60, 40, 11, 22], [32, 26, 10, 6], [48, 44, 5, 6]
      ],
      sites: [
        { id: "B", x: 15, y: 23, w: 16, h: 19, plantNode: "bSite", chokeNode: "bMain", retakeNode: "bCt" },
        { id: "A", x: 71, y: 27, w: 16, h: 16, plantNode: "aSite", chokeNode: "aMain", retakeNode: "aCt" }
      ],
      atkNode: "atk", defNode: "def", midNode: "mid",
      nodes: {
        atk: [50, 84], def: [51, 12],
        bLobby: [30, 72], bMain: [21, 56], bSite: [22, 32], bCt: [32, 20], market: [36, 38],
        midBot: [50, 66], mid: [50, 50], midTop: [50, 36], cat: [63, 32],
        aLobby: [68, 70], aMain: [79, 55], aSite: [79, 35], aCt: [68, 20]
      },
      edges: [
        ["atk", "bLobby"], ["atk", "midBot"], ["atk", "aLobby"],
        ["bLobby", "bMain"], ["bMain", "bSite"], ["bSite", "market"], ["bSite", "bCt"],
        ["bCt", "def"], ["bCt", "market"], ["market", "midTop"],
        ["midBot", "mid"], ["mid", "midTop"], ["midTop", "cat"], ["cat", "aSite"],
        ["aLobby", "aMain"], ["aMain", "aSite"], ["aSite", "aCt"], ["aCt", "def"]
      ],
      callouts: [
        { t: "MID", x: 50, y: 52 }, { t: "MKT", x: 36, y: 38 }, { t: "TREE", x: 64, y: 32 },
        { t: "B MAIN", x: 21, y: 58 }, { t: "A MAIN", x: 79, y: 58 }
      ]
    },

    Bind: {
      floor: [
        [38, 78, 24, 14], [40, 8, 20, 14], // Spawns ATK / DEF
        [20, 24, 16, 16], [14, 42, 12, 26], [32, 42, 14, 24], [20, 66, 24, 12], // B Site, B Long, Hookah, B Lobby
        [64, 28, 16, 18], [80, 44, 10, 24], [56, 44, 16, 22], [58, 66, 24, 12], // A Site, Showers, A Short, A Lobby
        [28, 18, 44, 10], // DEF Spawn connector
        [44, 44, 12, 12]  // TP B-Short / A-Short zone
      ],
      voids: [
        [27, 42, 5, 22], [73, 46, 6, 18], [38, 29, 24, 14]
      ],
      special: [
        { type: "tp", from: [58, 52], to: [44, 52] },
        { type: "tp", from: [18, 52], to: [84, 56] }
      ],
      sites: [
        { id: "B", x: 21, y: 25, w: 14, h: 14, plantNode: "bSite", chokeNode: "hookah", retakeNode: "bCt" },
        { id: "A", x: 65, y: 29, w: 14, h: 16, plantNode: "aSite", chokeNode: "aShort", retakeNode: "aCt" }
      ],
      atkNode: "atk", defNode: "def", midNode: "aShort",
      nodes: {
        atk: [50, 84], def: [50, 14],
        bLobby: [32, 72], bLong: [20, 56], hookah: [39, 54], bSite: [28, 32], bCt: [36, 22],
        aLobby: [68, 72], aShort: [63, 54], showers: [85, 56], aSite: [72, 36], aCt: [64, 22]
      },
      edges: [
        ["atk", "bLobby"], ["atk", "aLobby"],
        ["bLobby", "bLong"], ["bLobby", "hookah"], ["bLong", "bSite"], ["hookah", "bSite"],
        ["bSite", "bCt"], ["bCt", "def"],
        ["aLobby", "aShort"], ["aLobby", "showers"], ["aShort", "aSite"], ["showers", "aSite"],
        ["aSite", "aCt"], ["aCt", "def"],
        ["aShort", "hookah"]
      ],
      callouts: [
        { t: "B LONG", x: 20, y: 58 }, { t: "HOOKAH", x: 39, y: 54 },
        { t: "LAMPS", x: 62, y: 48 }, { t: "SHOWERS", x: 85, y: 56 }, { t: "TP", x: 50, y: 50 }
      ]
    },

    Breeze: {
      floor: [
        [40, 80, 20, 14], [34, 8, 32, 12], // Spawns
        [18, 26, 18, 18], [16, 46, 14, 22], [22, 66, 20, 10], // B Site, B Main, Elbow
        [72, 40, 18, 18], [70, 58, 16, 16], [58, 70, 16, 10], // A Site, Cave, A Lobby
        [38, 28, 24, 44], // Mid
        [24, 18, 20, 10], [56, 18, 22, 18], // DEF rotaciones / Bridge
        [62, 34, 12, 10], [30, 38, 10, 10]  // Mid Doors / B Tunnel
      ],
      voids: [
        [31, 48, 7, 18], [62, 46, 8, 20], [45, 48, 8, 8]
      ],
      sites: [
        { id: "B", x: 19, y: 27, w: 16, h: 16, plantNode: "bSite", chokeNode: "bMain", retakeNode: "bCt" },
        { id: "A", x: 73, y: 41, w: 16, h: 16, plantNode: "aSite", chokeNode: "cave", retakeNode: "aCt" }
      ],
      atkNode: "atk", defNode: "def", midNode: "mid",
      nodes: {
        atk: [50, 86], def: [50, 14],
        bLobby: [32, 71], bMain: [22, 57], bSite: [27, 35], bCt: [34, 22], bTunnel: [35, 42],
        midBot: [50, 68], mid: [50, 52], midTop: [50, 34], doors: [66, 39],
        aLobby: [65, 75], cave: [78, 65], aSite: [81, 49], aCt: [68, 26]
      },
      edges: [
        ["atk", "bLobby"], ["atk", "midBot"], ["atk", "aLobby"],
        ["bLobby", "bMain"], ["bMain", "bSite"], ["bSite", "bCt"], ["bCt", "def"],
        ["bSite", "bTunnel"], ["bTunnel", "midTop"],
        ["midBot", "mid"], ["mid", "midTop"], ["midTop", "def"], ["midTop", "doors"], ["doors", "aSite"],
        ["aLobby", "cave"], ["cave", "aSite"], ["aSite", "aCt"], ["aCt", "def"]
      ],
      callouts: [
        { t: "MID", x: 50, y: 54 }, { t: "ELBOW", x: 22, y: 58 },
        { t: "CAVE", x: 78, y: 65 }, { t: "HALL", x: 66, y: 26 }
      ]
    },

    Haven: {
      floor: [
        [40, 80, 20, 14], [38, 8, 24, 14], // Spawns
        [10, 32, 16, 16], [12, 48, 12, 24], [20, 68, 22, 10], // C Site, C Long, C Lobby
        [42, 36, 16, 16], [42, 52, 16, 22], // B Site + Mid Window
        [74, 32, 16, 16], [74, 48, 14, 22], [58, 66, 20, 10], // A Site, A Long, A Lobby
        [26, 42, 16, 14], [58, 42, 16, 14], // Garage (C-B) / A Short (B-A)
        [18, 20, 64, 12] // DEF rotaciones C-B-A
      ],
      voids: [
        [25, 56, 16, 11], [59, 56, 14, 10], [28, 32, 12, 9], [60, 32, 12, 9]
      ],
      sites: [
        { id: "C", x: 11, y: 33, w: 14, h: 14, plantNode: "cSite", chokeNode: "cLong", retakeNode: "cCt" },
        { id: "B", x: 43, y: 37, w: 14, h: 14, plantNode: "bSite", chokeNode: "mid", retakeNode: "def" },
        { id: "A", x: 75, y: 33, w: 14, h: 14, plantNode: "aSite", chokeNode: "aLong", retakeNode: "aCt" }
      ],
      atkNode: "atk", defNode: "def", midNode: "mid",
      nodes: {
        atk: [50, 86], def: [50, 15],
        cLobby: [30, 73], cLong: [18, 60], cSite: [18, 40], cCt: [28, 26], garage: [34, 49],
        midBot: [50, 68], mid: [50, 56], bSite: [50, 44],
        aLobby: [68, 71], aLong: [81, 58], aShort: [66, 49], aSite: [82, 40], aCt: [72, 26]
      },
      edges: [
        ["atk", "cLobby"], ["atk", "midBot"], ["atk", "aLobby"],
        ["cLobby", "cLong"], ["cLong", "cSite"], ["cSite", "garage"], ["cSite", "cCt"], ["cCt", "def"],
        ["garage", "mid"], ["midBot", "mid"], ["mid", "bSite"], ["bSite", "def"],
        ["aLobby", "aLong"], ["aLobby", "aShort"], ["aLong", "aSite"], ["aShort", "aSite"],
        ["aShort", "mid"], ["aSite", "aCt"], ["aCt", "def"]
      ],
      callouts: [
        { t: "C LONG", x: 18, y: 62 }, { t: "GARAGE", x: 34, y: 49 },
        { t: "MID", x: 50, y: 58 }, { t: "A LONG", x: 81, y: 60 }
      ]
    },

    Lotus: {
      floor: [
        [40, 80, 22, 14], [38, 10, 24, 14], // Spawns
        [14, 40, 14, 18], [16, 58, 16, 16], [28, 70, 16, 10], // C Site, C Mound, C Lobby
        [43, 38, 14, 16], [42, 54, 16, 20], // B Site, B Main
        [72, 26, 16, 20], [72, 46, 16, 22], [60, 68, 16, 10], // A Site, Rubble, A Lobby
        [28, 44, 15, 12], [57, 36, 15, 12], // C Link / A Tree
        [22, 22, 56, 12] // DEF rotaciones
      ],
      voids: [
        [33, 57, 8, 12], [59, 50, 12, 16], [30, 34, 12, 9]
      ],
      sites: [
        { id: "C", x: 15, y: 41, w: 12, h: 16, plantNode: "cSite", chokeNode: "cMound", retakeNode: "cCt" },
        { id: "B", x: 44, y: 39, w: 12, h: 14, plantNode: "bSite", chokeNode: "bMain", retakeNode: "def" },
        { id: "A", x: 73, y: 27, w: 14, h: 18, plantNode: "aSite", chokeNode: "rubble", retakeNode: "aCt" }
      ],
      atkNode: "atk", defNode: "def", midNode: "bMain",
      nodes: {
        atk: [51, 86], def: [50, 17],
        cLobby: [34, 75], cMound: [22, 65], cSite: [21, 49], cCt: [28, 28], cLink: [35, 49],
        bMain: [50, 64], bSite: [50, 46],
        aLobby: [68, 73], rubble: [80, 57], tree: [64, 42], aSite: [80, 36], aCt: [70, 26]
      },
      edges: [
        ["atk", "cLobby"], ["atk", "bMain"], ["atk", "aLobby"],
        ["cLobby", "cMound"], ["cMound", "cSite"], ["cSite", "cLink"], ["cLink", "bSite"],
        ["cSite", "cCt"], ["cCt", "def"],
        ["bMain", "bSite"], ["bSite", "def"], ["bSite", "tree"], ["tree", "aSite"],
        ["aLobby", "rubble"], ["rubble", "aSite"], ["aSite", "aCt"], ["aCt", "def"]
      ],
      callouts: [
        { t: "MOUND", x: 22, y: 65 }, { t: "B MAIN", x: 50, y: 64 },
        { t: "TREE", x: 64, y: 42 }, { t: "RUBBLE", x: 80, y: 58 }
      ]
    },

    Split: {
      floor: [
        [40, 80, 20, 14], [40, 8, 20, 14], // Spawns
        [18, 26, 16, 16], [14, 42, 14, 24], [22, 66, 20, 12], // B Site, B Main, B Lobby
        [72, 26, 16, 18], [72, 44, 14, 22], [58, 66, 18, 12], // A Site, A Main, A Lobby
        [42, 36, 16, 36], // Mid
        [32, 32, 12, 12], [56, 30, 16, 12], // Mail (B Heaven) / Vents-Ramps (A)
        [26, 18, 48, 10] // DEF rotaciones
      ],
      voids: [
        [29, 44, 12, 20], [59, 44, 12, 20], [34, 26, 8, 6]
      ],
      sites: [
        { id: "B", x: 19, y: 27, w: 14, h: 14, plantNode: "bSite", chokeNode: "bMain", retakeNode: "bCt" },
        { id: "A", x: 73, y: 27, w: 14, h: 16, plantNode: "aSite", chokeNode: "aMain", retakeNode: "aCt" }
      ],
      atkNode: "atk", defNode: "def", midNode: "mid",
      nodes: {
        atk: [50, 86], def: [50, 14],
        bLobby: [32, 72], bMain: [21, 54], bSite: [26, 34], bCt: [34, 22], mail: [38, 38],
        midBot: [50, 68], mid: [50, 52], vents: [63, 36],
        aLobby: [68, 72], aMain: [79, 55], aSite: [80, 35], aCt: [66, 22]
      },
      edges: [
        ["atk", "bLobby"], ["atk", "midBot"], ["atk", "aLobby"],
        ["bLobby", "bMain"], ["bMain", "bSite"], ["bSite", "mail"], ["bSite", "bCt"], ["bCt", "def"],
        ["midBot", "mid"], ["mid", "mail"], ["mid", "vents"], ["vents", "aSite"],
        ["aLobby", "aMain"], ["aMain", "aSite"], ["aSite", "aCt"], ["aCt", "def"]
      ],
      callouts: [
        { t: "MID", x: 50, y: 54 }, { t: "MAIL", x: 38, y: 38 },
        { t: "RAMPS", x: 64, y: 36 }, { t: "B MAIN", x: 21, y: 56 }, { t: "A MAIN", x: 79, y: 56 }
      ]
    },

    Sunset: {
      floor: [
        [40, 80, 20, 14], [38, 10, 24, 14], // Spawns
        [14, 36, 16, 16], [14, 52, 14, 20], [22, 68, 20, 10], // B Site, B Main, B Lobby
        [70, 32, 16, 18], [72, 50, 14, 20], [58, 68, 18, 10], // A Site, Elbow/A Main, A Lobby
        [42, 34, 16, 38], // Mid
        [30, 38, 12, 12], [58, 34, 12, 12], // Market / Mid Top-A
        [24, 22, 52, 12] // DEF rotaciones
      ],
      voids: [
        [29, 52, 12, 15], [59, 48, 12, 18], [46, 46, 6, 8]
      ],
      sites: [
        { id: "B", x: 15, y: 37, w: 14, h: 14, plantNode: "bSite", chokeNode: "bMain", retakeNode: "bCt" },
        { id: "A", x: 71, y: 33, w: 14, h: 16, plantNode: "aSite", chokeNode: "aMain", retakeNode: "aCt" }
      ],
      atkNode: "atk", defNode: "def", midNode: "mid",
      nodes: {
        atk: [50, 86], def: [50, 17],
        bLobby: [32, 73], bMain: [21, 61], bSite: [22, 44], bCt: [30, 28], market: [36, 44],
        midBot: [50, 68], mid: [50, 52], midTop: [50, 38], aLink: [64, 40],
        aLobby: [67, 73], aMain: [79, 59], aSite: [78, 41], aCt: [68, 28]
      },
      edges: [
        ["atk", "bLobby"], ["atk", "midBot"], ["atk", "aLobby"],
        ["bLobby", "bMain"], ["bMain", "bSite"], ["bSite", "market"], ["bSite", "bCt"], ["bCt", "def"],
        ["midBot", "mid"], ["mid", "midTop"], ["midTop", "market"], ["midTop", "aLink"], ["aLink", "aSite"],
        ["aLobby", "aMain"], ["aMain", "aSite"], ["aSite", "aCt"], ["aCt", "def"]
      ],
      callouts: [
        { t: "MID", x: 50, y: 54 }, { t: "MKT", x: 36, y: 44 },
        { t: "B MAIN", x: 21, y: 61 }, { t: "ELBOW", x: 79, y: 59 }
      ]
    },

    Abyss: {
      floor: [
        [40, 80, 20, 14], [38, 8, 24, 14],
        [14, 34, 14, 20], [16, 54, 14, 18], [24, 68, 18, 10],
        [72, 36, 16, 18], [72, 54, 14, 18], [58, 68, 18, 10],
        [44, 32, 12, 40], [28, 36, 16, 12], [56, 36, 16, 12],
        [24, 20, 52, 12]
      ],
      voids: [
        [31, 50, 12, 17], [57, 50, 14, 17]
      ],
      sites: [
        { id: "B", x: 15, y: 35, w: 12, h: 18, plantNode: "bSite", chokeNode: "bMain", retakeNode: "bCt" },
        { id: "A", x: 73, y: 37, w: 14, h: 16, plantNode: "aSite", chokeNode: "aMain", retakeNode: "aCt" }
      ],
      atkNode: "atk", defNode: "def", midNode: "mid",
      nodes: {
        atk: [50, 86], def: [50, 15],
        bLobby: [32, 73], bMain: [22, 62], bSite: [21, 44], bCt: [30, 26], bLink: [36, 42],
        midBot: [50, 68], mid: [50, 50], midTop: [50, 38], aLink: [64, 42],
        aLobby: [67, 73], aMain: [79, 62], aSite: [80, 45], aCt: [70, 26]
      },
      edges: [
        ["atk", "bLobby"], ["atk", "midBot"], ["atk", "aLobby"],
        ["bLobby", "bMain"], ["bMain", "bSite"], ["bSite", "bLink"], ["bSite", "bCt"], ["bCt", "def"],
        ["midBot", "mid"], ["mid", "midTop"], ["midTop", "bLink"], ["midTop", "aLink"], ["aLink", "aSite"],
        ["aLobby", "aMain"], ["aMain", "aSite"], ["aSite", "aCt"], ["aCt", "def"]
      ],
      callouts: [{ t: "MID", x: 50, y: 50 }, { t: "B MAIN", x: 22, y: 62 }, { t: "A MAIN", x: 79, y: 62 }]
    },

    Corrode: {
      floor: [
        [40, 80, 20, 14], [40, 8, 20, 14],
        [20, 34, 16, 16], [18, 50, 14, 20], [26, 68, 16, 10],
        [70, 34, 16, 16], [70, 50, 14, 20], [58, 68, 16, 10],
        [44, 30, 12, 42], [36, 38, 10, 10], [56, 38, 14, 10],
        [26, 20, 48, 12]
      ],
      voids: [
        [33, 50, 10, 17], [57, 50, 12, 17]
      ],
      sites: [
        { id: "B", x: 21, y: 35, w: 14, h: 14, plantNode: "bSite", chokeNode: "bMain", retakeNode: "bCt" },
        { id: "A", x: 71, y: 35, w: 14, h: 14, plantNode: "aSite", chokeNode: "aMain", retakeNode: "aCt" }
      ],
      atkNode: "atk", defNode: "def", midNode: "mid",
      nodes: {
        atk: [50, 86], def: [50, 15],
        bLobby: [34, 73], bMain: [24, 59], bSite: [28, 42], bCt: [34, 26],
        midBot: [50, 68], mid: [50, 48], midTop: [50, 36],
        aLobby: [66, 73], aMain: [77, 59], aSite: [78, 42], aCt: [68, 26]
      },
      edges: [
        ["atk", "bLobby"], ["atk", "midBot"], ["atk", "aLobby"],
        ["bLobby", "bMain"], ["bMain", "bSite"], ["bSite", "bCt"], ["bCt", "def"], ["bSite", "midTop"],
        ["midBot", "mid"], ["mid", "midTop"], ["midTop", "aSite"],
        ["aLobby", "aMain"], ["aMain", "aSite"], ["aSite", "aCt"], ["aCt", "def"]
      ],
      callouts: [{ t: "MID", x: 50, y: 50 }, { t: "B MAIN", x: 24, y: 60 }, { t: "A MAIN", x: 77, y: 60 }]
    },

    Fracture: {
      floor: [
        [34, 80, 32, 12], [34, 8, 32, 12], // ATK Sur y Norte
        [42, 42, 16, 16], // DEF Spawn central
        [14, 42, 16, 18], [18, 20, 16, 22], [18, 60, 16, 20], // B Site + Arcade + B Main
        [72, 42, 16, 18], [68, 20, 16, 22], [68, 60, 16, 20], // A Site + Dish + A Main
        [30, 46, 12, 10], [58, 46, 14, 10] // DEF conectores a B y A
      ],
      voids: [
        [35, 22, 30, 18], [35, 60, 30, 18]
      ],
      special: [
        { type: "zip", from: [50, 18], to: [50, 82] }
      ],
      sites: [
        { id: "B", x: 15, y: 43, w: 14, h: 16, plantNode: "bSite", chokeNode: "bMain", retakeNode: "bCt" },
        { id: "A", x: 73, y: 43, w: 14, h: 16, plantNode: "aSite", chokeNode: "aMain", retakeNode: "aCt" }
      ],
      atkNode: "atk", defNode: "def", midNode: "atkNorth",
      nodes: {
        atk: [50, 86], atkNorth: [50, 14], def: [50, 50],
        bMain: [24, 70], arcade: [24, 30], bSite: [22, 51], bCt: [36, 51],
        aMain: [76, 70], dish: [76, 30], aSite: [80, 51], aCt: [64, 51]
      },
      edges: [
        ["atk", "bMain"], ["atk", "aMain"], ["atk", "atkNorth"],
        ["atkNorth", "arcade"], ["atkNorth", "dish"],
        ["bMain", "bSite"], ["arcade", "bSite"], ["bSite", "bCt"], ["bCt", "def"],
        ["aMain", "aSite"], ["dish", "aSite"], ["aSite", "aCt"], ["aCt", "def"]
      ],
      callouts: [
        { t: "ARCADE", x: 24, y: 30 }, { t: "DISH", x: 76, y: 30 },
        { t: "DEF", x: 50, y: 50 }, { t: "B MAIN", x: 24, y: 70 }, { t: "A MAIN", x: 76, y: 70 }
      ]
    },

    Icebox: {
      floor: [
        [40, 80, 20, 14], [40, 8, 20, 14],
        [20, 36, 16, 18], [16, 54, 16, 18], [24, 70, 18, 10], // B Site + B Green
        [70, 28, 18, 18], [72, 46, 16, 22], [58, 68, 18, 10], // A Site + A Belt
        [42, 34, 18, 36], [34, 34, 10, 12], [58, 32, 14, 10], // Mid + Kitchen + Boiler
        [26, 20, 48, 12]
      ],
      voids: [
        [33, 52, 8, 16], [60, 46, 11, 20]
      ],
      sites: [
        { id: "B", x: 21, y: 37, w: 14, h: 16, plantNode: "bSite", chokeNode: "bMain", retakeNode: "bCt" },
        { id: "A", x: 71, y: 29, w: 16, h: 16, plantNode: "aSite", chokeNode: "aMain", retakeNode: "aCt" }
      ],
      atkNode: "atk", defNode: "def", midNode: "mid",
      nodes: {
        atk: [50, 86], def: [50, 15],
        bLobby: [32, 74], bMain: [23, 62], bSite: [28, 45], bCt: [34, 26], kitchen: [39, 40],
        midBot: [50, 68], mid: [50, 50], boiler: [64, 37],
        aLobby: [67, 73], aMain: [79, 57], aSite: [79, 37], aCt: [68, 24]
      },
      edges: [
        ["atk", "bLobby"], ["atk", "midBot"], ["atk", "aLobby"],
        ["bLobby", "bMain"], ["bMain", "bSite"], ["bSite", "kitchen"], ["bSite", "bCt"], ["bCt", "def"],
        ["midBot", "mid"], ["mid", "kitchen"], ["mid", "boiler"], ["boiler", "aSite"],
        ["aLobby", "aMain"], ["aMain", "aSite"], ["aSite", "aCt"], ["aCt", "def"]
      ],
      callouts: [{ t: "KITCHEN", x: 39, y: 40 }, { t: "MID", x: 50, y: 54 }, { t: "BELT", x: 79, y: 58 }]
    },

    Pearl: {
      floor: [
        [40, 82, 20, 12], [44, 8, 18, 14],
        [22, 32, 14, 18], [14, 50, 14, 26], [22, 72, 20, 10], // B Site + B Long
        [74, 26, 16, 18], [74, 44, 16, 24], [60, 68, 18, 12], // A Site + A Main
        [42, 36, 22, 34], [34, 38, 10, 12], [62, 32, 14, 12], // Mid Plaza + B Link + Art
        [28, 20, 48, 12]
      ],
      voids: [
        [29, 52, 12, 18], [64, 46, 9, 20]
      ],
      sites: [
        { id: "B", x: 23, y: 33, w: 12, h: 16, plantNode: "bSite", chokeNode: "bLong", retakeNode: "bCt" },
        { id: "A", x: 75, y: 27, w: 14, h: 16, plantNode: "aSite", chokeNode: "aMain", retakeNode: "aCt" }
      ],
      atkNode: "atk", defNode: "def", midNode: "mid",
      nodes: {
        atk: [50, 87], def: [53, 15],
        bLobby: [30, 77], bLong: [20, 62], bSite: [29, 41], bCt: [34, 26], bLink: [39, 44],
        midBot: [51, 68], mid: [52, 52], art: [68, 38],
        aLobby: [68, 74], aMain: [82, 56], aSite: [82, 35], aCt: [70, 24]
      },
      edges: [
        ["atk", "bLobby"], ["atk", "midBot"], ["atk", "aLobby"],
        ["bLobby", "bLong"], ["bLong", "bSite"], ["bSite", "bLink"], ["bSite", "bCt"], ["bCt", "def"],
        ["midBot", "mid"], ["mid", "bLink"], ["mid", "art"], ["art", "aSite"],
        ["aLobby", "aMain"], ["aMain", "aSite"], ["aSite", "aCt"], ["aCt", "def"]
      ],
      callouts: [{ t: "B LONG", x: 20, y: 62 }, { t: "PLAZA", x: 52, y: 52 }, { t: "ART", x: 68, y: 38 }]
    },

    Summit: {
      floor: [
        [40, 80, 20, 14], [40, 8, 20, 14],
        [18, 30, 16, 16], [18, 46, 14, 22], [24, 68, 18, 10],
        [74, 38, 16, 18], [70, 56, 16, 16], [58, 70, 16, 10],
        [44, 32, 12, 40], [32, 36, 12, 12], [56, 38, 18, 12],
        [26, 20, 52, 12]
      ],
      voids: [
        [33, 50, 10, 17], [57, 52, 12, 17]
      ],
      sites: [
        { id: "B", x: 19, y: 31, w: 14, h: 14, plantNode: "bSite", chokeNode: "bMain", retakeNode: "bCt" },
        { id: "A", x: 75, y: 39, w: 14, h: 16, plantNode: "aSite", chokeNode: "aMain", retakeNode: "aCt" }
      ],
      atkNode: "atk", defNode: "def", midNode: "mid",
      nodes: {
        atk: [50, 86], def: [50, 15],
        bLobby: [33, 73], bMain: [24, 57], bSite: [26, 38], bCt: [34, 26],
        midBot: [50, 68], mid: [50, 50], midTop: [50, 38], aLink: [64, 44],
        aLobby: [66, 75], aMain: [78, 63], aSite: [82, 47], aCt: [70, 28]
      },
      edges: [
        ["atk", "bLobby"], ["atk", "midBot"], ["atk", "aLobby"],
        ["bLobby", "bMain"], ["bMain", "bSite"], ["bSite", "bCt"], ["bCt", "def"], ["bSite", "midTop"],
        ["midBot", "mid"], ["mid", "midTop"], ["midTop", "aLink"], ["aLink", "aSite"],
        ["aLobby", "aMain"], ["aMain", "aSite"], ["aSite", "aCt"], ["aCt", "def"]
      ],
      callouts: [{ t: "MID", x: 50, y: 50 }, { t: "B MAIN", x: 24, y: 58 }, { t: "A MAIN", x: 78, y: 63 }]
    }
  };

  // ===== PATHFINDING SOBRE EL GRAFO (RESPETA PAREDES Y VACÍOS) =====
  function buildAdj(bp) {
    const adj = {};
    for (const k in bp.nodes) adj[k] = [];
    bp.edges.forEach(([a, b]) => {
      if (adj[a] && adj[b]) {
        adj[a].push(b);
        adj[b].push(a);
      }
    });
    return adj;
  }

  function findPath(adj, start, goal) {
    if (start === goal) return [start];
    const q = [[start]];
    const seen = new Set([start]);
    while (q.length) {
      const path = q.shift();
      const cur = path[path.length - 1];
      for (const nxt of (adj[cur] || [])) {
        if (nxt === goal) return [...path, nxt];
        if (!seen.has(nxt)) {
          seen.add(nxt);
          q.push([...path, nxt]);
        }
      }
    }
    return [start, goal];
  }

  // Inserta keyframes intermedios siguiendo las aristas del grafo para no atravesar paredes
  function appendPathKeys(actor, bp, adj, toNode, endT, rng, jitterMag = 1.6) {
    const lastK = actor.keys[actor.keys.length - 1];
    const fromNode = lastK.node || toNode;
    const startT = lastK.t;
    const span = Math.max(0.25, endT - startT);
    const path = findPath(adj, fromNode, toNode);

    if (path.length <= 1) {
      const pt = bp.nodes[toNode];
      actor.keys.push({
        t: endT,
        x: pt[0] + (rng() - 0.5) * jitterMag * 2,
        y: pt[1] + (rng() - 0.5) * jitterMag * 2,
        node: toNode
      });
      return;
    }

    // Calcular longitud total de la ruta para velocidad constante
    const pts = path.map(n => bp.nodes[n]);
    const segLens = [];
    let totalLen = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const d = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
      segLens.push(d);
      totalLen += d;
    }
    totalLen = Math.max(0.01, totalLen);

    let acc = 0;
    for (let i = 1; i < path.length; i++) {
      acc += segLens[i - 1];
      const frac = acc / totalLen;
      const isLast = i === path.length - 1;
      const j = isLast ? jitterMag : 0.7;
      actor.keys.push({
        t: startT + span * frac,
        x: pts[i][0] + (rng() - 0.5) * j * 2,
        y: pts[i][1] + (rng() - 0.5) * j * 2,
        node: path[i]
      });
    }
  }

  // ===== ESTADO DEL VISOR =====
  let state = {
    matchRef: null,
    maxR: 0,
    roundNum: 1,
    plan: null,
    time: 0,
    playing: false,
    speed: 1,
    rafId: null,
    lastTs: 0,
    canvas: null,
    ctx: null
  };

  function getAtkTeamIdx(M, roundNum) {
    const leftStartsAtk = !!M.leftStartsAtk;
    const ot = roundNum > 24;
    const leftIsAtk = roundNum <= 12
      ? leftStartsAtk
      : !ot
        ? !leftStartsAtk
        : (roundNum % 2 === 1 ? leftStartsAtk : !leftStartsAtk);
    return leftIsAtk ? 0 : 1;
  }

  function buildRoundChoreography(M, R) {
    const bp = MAP_BLUEPRINTS[M.mapName] || MAP_BLUEPRINTS.Ascent;
    const adj = buildAdj(bp);
    const seed = hashString(`${M.mapName}-${R.n}-${R.before[0]}-${R.before[1]}-${R.ev.length}-${M.teams[0].name}`);
    const rng = makeRng(seed);

    const atkTi = getAtkTeamIdx(M, R.n);
    const defTi = 1 - atkTi;
    const targetSite = bp.sites[Math.floor(rng() * bp.sites.length)];
    const otherSites = bp.sites.filter(s => s.id !== targetSite.id);
    const altSite = otherSites[0] || targetSite;

    const actors = {};
    for (let ti = 0; ti < 2; ti++) {
      const isAtk = ti === atkTi;
      const spawnNode = isAtk ? bp.atkNode : bp.defNode;
      const spawnPt = bp.nodes[spawnNode];

      M.teams[ti].units.forEach((u, i) => {
        const id = `${ti}-${i}`;
        const sx = spawnPt[0] + (i - 2) * 2.4;
        const sy = spawnPt[1] + (rng() - 0.5) * 2.0;

        actors[id] = {
          id, ti, isAtk,
          name: u.p.n,
          short: u.p.n.slice(0, 2).toUpperCase(),
          agent: u.agent || "",
          role: u.agentRole || u.p.r || "",
          deadAt: Infinity,
          deathPos: null,
          keys: [{ t: 0, x: sx, y: sy, node: spawnNode }]
        };

        // Posición de apertura / default respetando corredores (t = 2.1s)
        let openNode;
        if (isAtk) {
          if (i <= 2) openNode = targetSite.chokeNode;
          else if (i === 3) openNode = bp.midNode;
          else openNode = altSite.chokeNode;
        } else {
          if (i <= 1) openNode = targetSite.plantNode;
          else if (i === 2) openNode = bp.midNode;
          else openNode = altSite.plantNode;
        }
        appendPathKeys(actors[id], bp, adj, openNode, 2.1, rng, 2.0);
      });
    }

    const evCount = R.ev.length;
    const events = [];
    let curT = 2.4;
    let lastCombatNode = targetSite.chokeNode;

    const atkActors = Object.values(actors).filter(a => a.isAtk);
    const planter = atkActors.find(a => a.role.toLowerCase().includes("controlador") || a.role.toLowerCase().includes("iniciador"))
      || atkActors[2] || atkActors[0];

    let plantTime = null;
    const plantAtEvIdx = evCount >= 3 ? Math.min(2, Math.floor(evCount * 0.4)) : 0;

    R.ev.forEach((e, idx) => {
      if (idx === 0) curT = 2.5 + rng() * 0.5;
      else if (e.tr) curT += 0.45 + rng() * 0.25;
      else curT += 0.95 + rng() * 0.7;

      const killer = actors[e.k];
      const victim = actors[e.v];
      if (!killer || !victim) return;

      // Elegir nodo caminable de combate
      let fightNode;
      if (e.tr) fightNode = lastCombatNode;
      else if (e.fb) fightNode = rng() < 0.65 ? targetSite.chokeNode : bp.midNode;
      else if (idx <= 2) fightNode = rng() < 0.55 ? targetSite.chokeNode : targetSite.plantNode;
      else fightNode = rng() < 0.75 ? targetSite.plantNode : targetSite.retakeNode;

      const neighbors = adj[fightNode] || [fightNode];
      const killerNode = rng() < 0.55 ? fightNode : neighbors[Math.floor(rng() * neighbors.length)];

      appendPathKeys(killer, bp, adj, killerNode, curT, rng, 1.8);
      appendPathKeys(victim, bp, adj, fightNode, curT, rng, 1.8);

      const kLast = killer.keys[killer.keys.length - 1];
      const vLast = victim.keys[victim.keys.length - 1];

      victim.deadAt = curT;
      victim.deathPos = { x: vLast.x, y: vLast.y };
      lastCombatNode = fightNode;

      if (plantTime === null && idx >= plantAtEvIdx) {
        const aliveAtkNow = Object.values(actors).filter(a => a.isAtk && a.deadAt > curT + 0.4);
        if (aliveAtkNow.length >= 1 && (R.win === atkTi || aliveAtkNow.length >= 2 || R.cl)) {
          const activePlanter = aliveAtkNow.includes(planter) ? planter : aliveAtkNow[0];
          plantTime = curT + 0.55;
          appendPathKeys(activePlanter, bp, adj, targetSite.plantNode, plantTime, rng, 0.8);
          curT = plantTime + 0.35;
        }
      }

      events.push({
        t: curT,
        k: e.k, v: e.v, as: e.as || null,
        fb: !!e.fb, tr: !!e.tr,
        kPos: [kLast.x, kLast.y],
        vPos: [vLast.x, vLast.y]
      });
    });

    const lastEvT = events.length ? events[events.length - 1].t : 3.6;
    let defuseTime = null;
    const endT = lastEvT + (plantTime !== null && R.win === defTi ? 2.1 : 1.3);

    const survivors = Object.values(actors).filter(a => a.deadAt === Infinity);
    survivors.forEach((a, idx) => {
      if (plantTime !== null && R.win === defTi && idx === 0) {
        defuseTime = endT - 0.3;
        appendPathKeys(a, bp, adj, targetSite.plantNode, lastEvT + 1.0, rng, 0.6);
        appendPathKeys(a, bp, adj, targetSite.plantNode, endT, rng, 0.4);
      } else {
        const destNode = plantTime !== null ? targetSite.plantNode : targetSite.retakeNode;
        appendPathKeys(a, bp, adj, destNode, endT, rng, 2.2);
      }
    });

    return {
      mapName: M.mapName,
      bp,
      round: R,
      atkTi,
      defTi,
      targetSite,
      actors,
      events,
      plantTime,
      defuseTime,
      duration: Math.max(5.5, endT)
    };
  }

  function sampleActorPos(actor, t) {
    const effT = Math.min(t, actor.deadAt);
    const ks = actor.keys;
    if (!ks.length) return { x: 50, y: 50 };
    if (effT <= ks[0].t) return { x: ks[0].x, y: ks[0].y };
    for (let i = 0; i < ks.length - 1; i++) {
      const a = ks[i], b = ks[i + 1];
      if (effT >= a.t && effT <= b.t) {
        const span = Math.max(0.001, b.t - a.t);
        const f = clamp((effT - a.t) / span, 0, 1);
        return { x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f) };
      }
    }
    const last = ks[ks.length - 1];
    return { x: last.x, y: last.y };
  }

  function getThemeColors() {
    const cs = getComputedStyle(document.documentElement);
    const v = name => cs.getPropertyValue(name).trim();
    const isLight = document.documentElement.getAttribute("data-theme") === "light";
    const colA = v("--a") || "#E5484D";
    let colB = v("--b") || "#38BDF8";
    // Garantizar contraste entre ambos equipos en el radar (evita rojo vs rojo)
    if (colorDist(colA, colB) < 95) {
      colB = isLight ? "#0284C7" : "#38BDF8";
    }
    return {
      bg: v("--bg") || (isLight ? "#F4F5F7" : "#0B0D11"),
      floor: isLight ? "#E2E6ED" : "#121B26",
      wall: isLight ? "#64748B" : "#1F6F7A",
      siteFill: isLight ? "rgba(2,132,199,0.12)" : "rgba(56,189,248,0.11)",
      fg: v("--fg") || "#ECEFF4",
      mut: v("--mut") || "#8A94A6",
      dim: v("--dim") || "#566073",
      a: colA,
      b: colB,
      gold: v("--gold") || "#EAB308",
      ok: v("--ok") || "#10B981",
      red: v("--vct-red") || "#E5484D",
      cyan: v("--vct-cyan") || "#38BDF8"
    };
  }

  function drawFrame() {
    const { canvas, ctx, plan, time } = state;
    if (!canvas || !ctx || !plan) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(280, Math.round(rect.width || 440));
    const cssH = Math.round(cssW * 0.94);
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.height = cssH + "px";
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    const C = getThemeColors();
    const W = cssW, H = cssH;
    const sx = x => (x / 100) * W;
    const sy = y => (y / 100) * H;

    // Fondo (espacio exterior inaccesible)
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    // 1. Zonas caminables (suelo táctico)
    ctx.fillStyle = C.floor;
    ctx.strokeStyle = C.wall;
    ctx.lineWidth = 1;
    plan.bp.floor.forEach(([x, y, w, h]) => {
      ctx.fillRect(sx(x), sy(y), sx(w), sy(h));
      ctx.strokeRect(Math.round(sx(x)) + 0.5, Math.round(sy(y)) + 0.5, Math.round(sx(w)), Math.round(sy(h)));
    });

    // 2. Vacíos y muros interiores inaccesibles
    (plan.bp.voids || []).forEach(([x, y, w, h]) => {
      ctx.fillStyle = C.bg;
      ctx.fillRect(sx(x), sy(y), sx(w), sy(h));
      ctx.strokeStyle = C.wall;
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(sx(x)) + 0.5, Math.round(sy(y)) + 0.5, Math.round(sx(w)), Math.round(sy(h)));
    });

    // 3. Elementos especiales (Teleports en Bind / Tirolina en Fracture)
    (plan.bp.special || []).forEach(sp => {
      ctx.save();
      ctx.strokeStyle = sp.type === "tp" ? C.ok : C.gold;
      ctx.lineWidth = 1.5;
      ctx.setLineDash(sp.type === "tp" ? [4, 3] : [2, 2]);
      ctx.beginPath();
      ctx.moveTo(sx(sp.from[0]), sy(sp.from[1]));
      ctx.lineTo(sx(sp.to[0]), sy(sp.to[1]));
      ctx.stroke();
      ctx.restore();
    });

    // 4. Sites (A / B / C)
    plan.bp.sites.forEach(s => {
      const isPlantedHere = s.id === plan.targetSite.id && plan.plantTime !== null && time >= plan.plantTime;
      ctx.fillStyle = isPlantedHere ? "rgba(229,72,77,0.16)" : C.siteFill;
      ctx.fillRect(sx(s.x), sy(s.y), sx(s.w), sy(s.h));
      ctx.save();
      ctx.strokeStyle = isPlantedHere ? C.red : C.wall;
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1;
      ctx.strokeRect(sx(s.x) + 0.5, sy(s.y) + 0.5, sx(s.w), sy(s.h));
      ctx.restore();

      ctx.fillStyle = C.fg;
      ctx.globalAlpha = 0.55;
      ctx.font = '700 16px "Barlow Condensed", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(s.id, sx(s.x + s.w / 2), sy(s.y + s.h / 2));
      ctx.globalAlpha = 1;
    });

    // 5. Callouts
    ctx.fillStyle = C.mut;
    ctx.globalAlpha = 0.65;
    ctx.font = '600 8.5px "JetBrains Mono", monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    (plan.bp.callouts || []).forEach(c => ctx.fillText(c.t, sx(c.x), sy(c.y)));
    ctx.globalAlpha = 1;

    // 6. Spike plantada
    if (plan.plantTime !== null && time >= plan.plantTime) {
      const pt = plan.bp.nodes[plan.targetSite.plantNode];
      const px = sx(pt[0]), py = sy(pt[1]);
      const defused = plan.defuseTime !== null && time >= plan.defuseTime;
      const pulse = ((time - plan.plantTime) * 1.4) % 1;

      if (!defused) {
        ctx.strokeStyle = C.red;
        ctx.globalAlpha = 1 - pulse;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(px, py, 5 + pulse * 13, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = defused ? C.ok : C.red;
      ctx.fillRect(-4, -4, 8, 8);
      ctx.strokeStyle = C.bg;
      ctx.lineWidth = 1;
      ctx.strokeRect(-4, -4, 8, 8);
      ctx.restore();
    }

    // 7. Trazadores de duelos y asistencias
    plan.events.forEach(ev => {
      const dt = time - ev.t;
      if (dt >= 0 && dt <= 0.45) {
        const alpha = 1 - (dt / 0.45);
        const killer = plan.actors[ev.k];
        const col = killer && killer.ti === 0 ? C.a : C.b;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = ev.fb ? C.gold : col;
        ctx.lineWidth = ev.fb ? 2 : 1.5;
        ctx.beginPath();
        ctx.moveTo(sx(ev.kPos[0]), sy(ev.kPos[1]));
        ctx.lineTo(sx(ev.vPos[0]), sy(ev.vPos[1]));
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(sx(ev.vPos[0]), sy(ev.vPos[1]), 4 + dt * 16, 0, Math.PI * 2);
        ctx.stroke();

        if (ev.as && plan.actors[ev.as]) {
          const asPos = sampleActorPos(plan.actors[ev.as], ev.t);
          ctx.strokeStyle = C.cyan;
          ctx.setLineDash([2, 3]);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(sx(asPos.x), sy(asPos.y));
          ctx.lineTo(sx(ev.vPos[0]), sy(ev.vPos[1]));
          ctx.stroke();
        }
        ctx.restore();
      }
    });

    // 8. Bajas (X fijas)
    Object.values(plan.actors).forEach(a => {
      if (time >= a.deadAt && a.deathPos) {
        const x = sx(a.deathPos.x), y = sy(a.deathPos.y);
        ctx.save();
        ctx.strokeStyle = a.ti === 0 ? C.a : C.b;
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x - 3.8, y - 3.8); ctx.lineTo(x + 3.8, y + 3.8);
        ctx.moveTo(x + 3.8, y - 3.8); ctx.lineTo(x - 3.8, y + 3.8);
        ctx.stroke();
        ctx.restore();
      }
    });

    // 9. Jugadores vivos
    Object.values(plan.actors).forEach(a => {
      if (time >= a.deadAt) return;
      const pos = sampleActorPos(a, time);
      const x = sx(pos.x), y = sy(pos.y);
      const col = a.ti === 0 ? C.a : C.b;

      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = C.bg;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = "#FFFFFF";
      ctx.font = '700 7px "JetBrains Mono", monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(a.short, x, y + 0.5);
    });

    ctx.restore();
    updateHudReadout(C);
  }

  function updateHudReadout(C) {
    const { plan, time } = state;
    if (!plan) return;

    const phaseEl = document.getElementById("r2dPhase");
    const clockEl = document.getElementById("r2dClock");
    const scrubEl = document.getElementById("r2dScrub");
    const aliveEl = document.getElementById("r2dAlive");
    const feedEl = document.getElementById("r2dFeed");

    let phaseTxt = "DEFAULT / APERTURA";
    let phaseCls = "mut";
    if (time >= plan.duration - 0.05) {
      const winTeam = state.matchRef.teams[plan.round.win].name;
      phaseTxt = `RONDA PARA ${winTeam.toUpperCase()}`;
      phaseCls = plan.round.win === 0 ? "ca" : "cb";
    } else if (plan.defuseTime !== null && time >= plan.defuseTime) {
      phaseTxt = "SPIKE DESACTIVADA";
      phaseCls = "kd-pos";
    } else if (plan.plantTime !== null && time >= plan.plantTime) {
      phaseTxt = `SPIKE PLANTADA · SITE ${plan.targetSite.id}`;
      phaseCls = "kd-neg";
    } else if (time >= 2.2) {
      phaseTxt = `EJECUCIÓN · SITE ${plan.targetSite.id}`;
      phaseCls = "stat-elite";
    }

    if (phaseEl) {
      phaseEl.textContent = phaseTxt;
      phaseEl.className = "mono r2d-phase " + phaseCls;
    }
    if (clockEl) clockEl.textContent = `${time.toFixed(1)}s / ${plan.duration.toFixed(1)}s`;
    if (scrubEl) scrubEl.value = String(Math.round((time / plan.duration) * 1000));

    if (aliveEl) {
      const alive0 = Object.values(plan.actors).filter(a => a.ti === 0 && time < a.deadAt).length;
      const alive1 = Object.values(plan.actors).filter(a => a.ti === 1 && time < a.deadAt).length;
      const side0 = plan.atkTi === 0 ? "ATK" : "DEF";
      const side1 = plan.atkTi === 1 ? "ATK" : "DEF";
      aliveEl.innerHTML = `<span style="color:${C.a}">${esc(state.matchRef.teams[0].name)} (${side0}): <b>${alive0}</b></span>
        <span class="mut">VS</span>
        <span style="color:${C.b}"><b>${alive1}</b> :(${side1}) ${esc(state.matchRef.teams[1].name)}</span>`;
    }

    if (feedEl) {
      const happened = plan.events.filter(e => e.t <= time);
      if (!happened.length) {
        feedEl.innerHTML = `<span class="mut">Sin duelos resueltos en este instante.</span>`;
      } else {
        feedEl.innerHTML = happened.slice(-3).map(e => {
          const ka = plan.actors[e.k], va = plan.actors[e.v];
          return `<div class="r2d-feed-row">
            <span class="mut">${e.t.toFixed(1)}s</span>
            <b style="color:${ka.ti ? C.b : C.a}">${esc(ka.name)}</b>
            <span>→</span>
            <span style="color:${va.ti ? C.b : C.a}">${esc(va.name)}</span>
            ${e.fb ? '<span class="k-tag k-fb">FB</span>' : ""}
            ${e.tr ? '<span class="k-tag k-tr">TR</span>' : ""}
          </div>`;
        }).join("");
      }
    }
  }

  function stopLoop() {
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
    state.playing = false;
    const btn = document.getElementById("r2dPlayBtn");
    if (btn) {
      btn.textContent = "PLAY";
      btn.classList.remove("live-active");
    }
  }

  function tick(ts) {
    if (!state.playing || !state.plan) return;
    if (!state.lastTs) state.lastTs = ts;
    const dt = Math.min(0.1, (ts - state.lastTs) / 1000) * state.speed;
    state.lastTs = ts;
    state.time = Math.min(state.plan.duration, state.time + dt);
    drawFrame();

    if (state.time >= state.plan.duration) {
      stopLoop();
      return;
    }
    state.rafId = requestAnimationFrame(tick);
  }

  function startLoop() {
    if (!state.plan) return;
    if (state.time >= state.plan.duration - 0.05) state.time = 0;
    state.playing = true;
    state.lastTs = 0;
    const btn = document.getElementById("r2dPlayBtn");
    if (btn) {
      btn.textContent = "PAUSA";
      btn.classList.add("live-active");
    }
    state.rafId = requestAnimationFrame(tick);
  }

  function renderShell() {
    const host = document.getElementById("radar2d-host");
    if (!host || !state.matchRef || !state.plan) return;
    const M = state.matchRef;
    const R = state.plan.round;

    host.innerHTML = `
      <div class="box r2d-box">
        <div class="box-head">
          <div class="box-title-wrap">
            <h2>Visor Táctico 2D · ${esc(M.mapName)}</h2>
            <span class="econ-pill">R${R.n} [${R.before[0]}-${R.before[1]}]</span>
          </div>
          <span id="r2dPhase" class="mono r2d-phase mut">DEFAULT</span>
        </div>

        <div class="r2d-subbar mono">
          <div id="r2dAlive" class="r2d-alive"></div>
          <span id="r2dClock" class="mut">0.0s</span>
        </div>

        <div class="r2d-canvas-wrap">
          <canvas id="r2dCanvas" class="r2d-canvas"></canvas>
        </div>

        <div class="r2d-controls">
          <div class="btn-group">
            <button type="button" class="t-btn-sm mono" onclick="Radar2D.stepRound(-1)" ${state.roundNum <= 1 ? "disabled" : ""} title="Ronda anterior">◄</button>
            <span class="mono r2d-rcount">R${state.roundNum}/${state.maxR}</span>
            <button type="button" class="t-btn-sm mono" onclick="Radar2D.stepRound(1)" ${state.roundNum >= state.maxR ? "disabled" : ""} title="Ronda siguiente">►</button>
          </div>
          <div class="btn-group">
            <button type="button" class="t-btn-sm mono" id="r2dPlayBtn" onclick="Radar2D.togglePlay()">PLAY</button>
            <button type="button" class="t-btn-sm mono" onclick="Radar2D.restart()">REINICIAR</button>
            <button type="button" class="t-btn-sm mono" id="r2dSpeedBtn" onclick="Radar2D.toggleSpeed()">${state.speed}X</button>
          </div>
        </div>

        <input type="range" id="r2dScrub" class="r2d-scrub" min="0" max="1000" value="0" aria-label="Línea de tiempo de la ronda" oninput="Radar2D.scrub(this.value)">
        <div id="r2dFeed" class="r2d-feed mono"></div>
      </div>`;

    state.canvas = document.getElementById("r2dCanvas");
    state.ctx = state.canvas ? state.canvas.getContext("2d") : null;
    drawFrame();
  }

  function loadRound(rn, autoPlay) {
    if (!state.matchRef || !state.maxR) return;
    stopLoop();
    state.roundNum = clamp(rn, 1, state.maxR);
    const R = state.matchRef.rounds[state.roundNum - 1];
    if (!R) return;
    state.plan = buildRoundChoreography(state.matchRef, R);
    state.time = autoPlay ? 0 : state.plan.duration;
    renderShell();
    if (autoPlay) startLoop();
  }

  try {
    new MutationObserver(() => {
      if (state.canvas && state.plan) drawFrame();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  } catch (e) {}

  window.Radar2D = {
    mount(M, maxR, opts = {}) {
      const host = document.getElementById("radar2d-host");
      if (!host || !M || !maxR) {
        stopLoop();
        return;
      }
      const isSameMap = state.matchRef === M;
      state.matchRef = M;
      state.maxR = maxR;

      if (opts.isAutoPlaying) {
        loadRound(maxR, false);
        return;
      }
      const targetR = opts.forceRound || maxR;
      const shouldAutoPlay = !!(opts.autoPlay || (isSameMap && targetR > state.roundNum));
      loadRound(targetR, shouldAutoPlay);
    },
    selectRound(rn, autoPlay = true) {
      if (!state.matchRef) return;
      loadRound(rn, autoPlay);
    },
    stepRound(delta) {
      loadRound(state.roundNum + delta, true);
    },
    togglePlay() {
      if (state.playing) stopLoop();
      else startLoop();
    },
    restart() {
      stopLoop();
      state.time = 0;
      drawFrame();
      startLoop();
    },
    toggleSpeed() {
      state.speed = state.speed === 1 ? 2 : 1;
      const btn = document.getElementById("r2dSpeedBtn");
      if (btn) btn.textContent = state.speed + "X";
    },
    scrub(val) {
      if (!state.plan) return;
      stopLoop();
      state.time = (Number(val) / 1000) * state.plan.duration;
      drawFrame();
    },
    stop() {
      stopLoop();
    }
  };
})();