// ===== MÓDULO P6.1: VISOR TÁCTICO 2D CON MINIMAPAS REALES + GRAFO DE NAVEGACIÓN =====
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
    const m = /^#([0-9a-f]{6})$/i.exec((color || "").trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function colorDist(c1, c2) {
    const a = parseHexRgb(c1), b = parseHexRgb(c2);
    if (!a || !b) return 200;
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  }

  // ===== CARGADOR DE MINIMAPAS REALES (LOCAL maps/<mapa>.png → FALLBACK valorant-api.com) =====
  const mapImgCache = {};
  let apiMapsPromise = null;

  function fetchApiMapIcons() {
    if (!apiMapsPromise) {
      apiMapsPromise = fetch("https://valorant-api.com/v1/maps")
        .then(r => r.ok ? r.json() : null)
        .then(json => {
          const dict = {};
          if (json && Array.isArray(json.data)) {
            json.data.forEach(m => {
              if (m.displayName && m.displayIcon) {
                dict[m.displayName.toLowerCase()] = m.displayIcon;
              }
            });
          }
          return dict;
        })
        .catch(() => ({}));
    }
    return apiMapsPromise;
  }

  function getMapImage(mapName, onReady) {
    const key = (mapName || "Ascent").toLowerCase();
    if (mapImgCache[key]) return mapImgCache[key];

    const entry = { img: null, ready: false, failed: false };
    mapImgCache[key] = entry;

    const loadUrl = (url, isFallback) => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => {
        entry.img = im;
        entry.ready = true;
        if (onReady) onReady();
      };
      im.onerror = () => {
        if (!isFallback) {
          fetchApiMapIcons().then(dict => {
            if (dict[key]) loadUrl(dict[key], true);
            else entry.failed = true;
          });
        } else {
          entry.failed = true;
        }
      };
      im.src = url;
    };

    // Intenta primero archivo local en maps/<mapa>.png; si no existe, usa valorant-api.com
    loadUrl(`maps/${key}.png`, false);
    return entry;
  }

  // ===== GRAFOS DE NAVEGACIÓN POR MAPA (0..100, RESPETAN PAREDES Y VACÍOS) =====
  const MAP_BLUEPRINTS = {
    Ascent: {
      sites: [
        { id: "B", plantNode: "bSite", chokeNode: "bMain", retakeNode: "bCt" },
        { id: "A", plantNode: "aSite", chokeNode: "aMain", retakeNode: "aCt" }
      ],
      atkNode: "atk", defNode: "def", midNode: "mid",
      nodes: {
        atk: [50, 86], def: [52, 13],
        bLobby: [31, 72], bMain: [22, 55], bSite: [22, 32], bCt: [33, 21], market: [36, 39],
        midBot: [50, 67], mid: [50, 50], midTop: [50, 36], cat: [63, 33],
        aLobby: [68, 70], aMain: [78, 55], aSite: [79, 34], aCt: [68, 21]
      },
      edges: [
        ["atk", "bLobby"], ["atk", "midBot"], ["atk", "aLobby"],
        ["bLobby", "bMain"], ["bMain", "bSite"], ["bSite", "market"], ["bSite", "bCt"],
        ["bCt", "def"], ["bCt", "market"], ["market", "midTop"],
        ["midBot", "mid"], ["mid", "midTop"], ["midTop", "cat"], ["cat", "aSite"],
        ["aLobby", "aMain"], ["aMain", "aSite"], ["aSite", "aCt"], ["aCt", "def"]
      ]
    },
    Bind: {
      sites: [
        { id: "B", plantNode: "bSite", chokeNode: "hookah", retakeNode: "bCt" },
        { id: "A", plantNode: "aSite", chokeNode: "aShort", retakeNode: "aCt" }
      ],
      atkNode: "atk", defNode: "def", midNode: "aShort",
      nodes: {
        atk: [50, 86], def: [50, 14],
        bLobby: [33, 72], bLong: [21, 56], hookah: [38, 54], bSite: [29, 31], bCt: [37, 22],
        aLobby: [67, 72], aShort: [62, 53], showers: [83, 55], aSite: [71, 36], aCt: [64, 22]
      },
      edges: [
        ["atk", "bLobby"], ["atk", "aLobby"],
        ["bLobby", "bLong"], ["bLobby", "hookah"], ["bLong", "bSite"], ["hookah", "bSite"],
        ["bSite", "bCt"], ["bCt", "def"],
        ["aLobby", "aShort"], ["aLobby", "showers"], ["aShort", "aSite"], ["showers", "aSite"],
        ["aSite", "aCt"], ["aCt", "def"], ["aShort", "hookah"]
      ]
    },
    Breeze: {
      sites: [
        { id: "B", plantNode: "bSite", chokeNode: "bMain", retakeNode: "bCt" },
        { id: "A", plantNode: "aSite", chokeNode: "cave", retakeNode: "aCt" }
      ],
      atkNode: "atk", defNode: "def", midNode: "mid",
      nodes: {
        atk: [50, 87], def: [50, 14],
        bLobby: [32, 71], bMain: [22, 57], bSite: [27, 34], bCt: [35, 22], bTunnel: [36, 42],
        midBot: [50, 68], mid: [50, 52], midTop: [50, 34], doors: [66, 39],
        aLobby: [65, 75], cave: [78, 65], aSite: [81, 49], aCt: [68, 26]
      },
      edges: [
        ["atk", "bLobby"], ["atk", "midBot"], ["atk", "aLobby"],
        ["bLobby", "bMain"], ["bMain", "bSite"], ["bSite", "bCt"], ["bCt", "def"],
        ["bSite", "bTunnel"], ["bTunnel", "midTop"],
        ["midBot", "mid"], ["mid", "midTop"], ["midTop", "def"], ["midTop", "doors"], ["doors", "aSite"],
        ["aLobby", "cave"], ["cave", "aSite"], ["aSite", "aCt"], ["aCt", "def"]
      ]
    },
    Haven: {
      sites: [
        { id: "C", plantNode: "cSite", chokeNode: "cLong", retakeNode: "cCt" },
        { id: "B", plantNode: "bSite", chokeNode: "mid", retakeNode: "def" },
        { id: "A", plantNode: "aSite", chokeNode: "aLong", retakeNode: "aCt" }
      ],
      atkNode: "atk", defNode: "def", midNode: "mid",
      nodes: {
        atk: [50, 87], def: [50, 16],
        cLobby: [30, 73], cLong: [19, 60], cSite: [19, 41], cCt: [29, 26], garage: [35, 49],
        midBot: [50, 68], mid: [50, 56], bSite: [50, 44],
        aLobby: [68, 71], aLong: [80, 58], aShort: [65, 49], aSite: [81, 41], aCt: [71, 26]
      },
      edges: [
        ["atk", "cLobby"], ["atk", "midBot"], ["atk", "aLobby"],
        ["cLobby", "cLong"], ["cLong", "cSite"], ["cSite", "garage"], ["cSite", "cCt"], ["cCt", "def"],
        ["garage", "mid"], ["midBot", "mid"], ["mid", "bSite"], ["bSite", "def"],
        ["aLobby", "aLong"], ["aLobby", "aShort"], ["aLong", "aSite"], ["aShort", "aSite"],
        ["aShort", "mid"], ["aSite", "aCt"], ["aCt", "def"]
      ]
    },
    Lotus: {
      sites: [
        { id: "C", plantNode: "cSite", chokeNode: "cMound", retakeNode: "cCt" },
        { id: "B", plantNode: "bSite", chokeNode: "bMain", retakeNode: "def" },
        { id: "A", plantNode: "aSite", chokeNode: "rubble", retakeNode: "aCt" }
      ],
      atkNode: "atk", defNode: "def", midNode: "bMain",
      nodes: {
        atk: [51, 86], def: [50, 17],
        cLobby: [34, 75], cMound: [22, 65], cSite: [21, 49], cCt: [28, 28], cLink: [35, 49],
        bMain: [50, 64], bSite: [50, 46],
        aLobby: [68, 73], rubble: [80, 57], tree: [64, 42], aSite: [80, 35], aCt: [70, 26]
      },
      edges: [
        ["atk", "cLobby"], ["atk", "bMain"], ["atk", "aLobby"],
        ["cLobby", "cMound"], ["cMound", "cSite"], ["cSite", "cLink"], ["cLink", "bSite"],
        ["cSite", "cCt"], ["cCt", "def"],
        ["bMain", "bSite"], ["bSite", "def"], ["bSite", "tree"], ["tree", "aSite"],
        ["aLobby", "rubble"], ["rubble", "aSite"], ["aSite", "aCt"], ["aCt", "def"]
      ]
    },
    Split: {
      sites: [
        { id: "B", plantNode: "bSite", chokeNode: "bMain", retakeNode: "bCt" },
        { id: "A", plantNode: "aSite", chokeNode: "aMain", retakeNode: "aCt" }
      ],
      atkNode: "atk", defNode: "def", midNode: "mid",
      nodes: {
        atk: [50, 87], def: [50, 14],
        bLobby: [32, 72], bMain: [22, 54], bSite: [26, 34], bCt: [35, 22], mail: [38, 38],
        midBot: [50, 68], mid: [50, 52], vents: [63, 36],
        aLobby: [68, 72], aMain: [78, 55], aSite: [80, 35], aCt: [66, 22]
      },
      edges: [
        ["atk", "bLobby"], ["atk", "midBot"], ["atk", "aLobby"],
        ["bLobby", "bMain"], ["bMain", "bSite"], ["bSite", "mail"], ["bSite", "bCt"], ["bCt", "def"],
        ["midBot", "mid"], ["mid", "mail"], ["mid", "vents"], ["vents", "aSite"],
        ["aLobby", "aMain"], ["aMain", "aSite"], ["aSite", "aCt"], ["aCt", "def"]
      ]
    },
    Sunset: {
      sites: [
        { id: "B", plantNode: "bSite", chokeNode: "bMain", retakeNode: "bCt" },
        { id: "A", plantNode: "aSite", chokeNode: "aMain", retakeNode: "aCt" }
      ],
      atkNode: "atk", defNode: "def", midNode: "mid",
      nodes: {
        atk: [50, 86], def: [50, 17],
        bLobby: [32, 73], bMain: [22, 61], bSite: [23, 44], bCt: [30, 28], market: [36, 44],
        midBot: [50, 68], mid: [50, 52], midTop: [50, 38], aLink: [64, 40],
        aLobby: [67, 73], aMain: [78, 59], aSite: [78, 41], aCt: [68, 28]
      },
      edges: [
        ["atk", "bLobby"], ["atk", "midBot"], ["atk", "aLobby"],
        ["bLobby", "bMain"], ["bMain", "bSite"], ["bSite", "market"], ["bSite", "bCt"], ["bCt", "def"],
        ["midBot", "mid"], ["mid", "midTop"], ["midTop", "market"], ["midTop", "aLink"], ["aLink", "aSite"],
        ["aLobby", "aMain"], ["aMain", "aSite"], ["aSite", "aCt"], ["aCt", "def"]
      ]
    },
    Abyss: {
      sites: [
        { id: "B", plantNode: "bSite", chokeNode: "bMain", retakeNode: "bCt" },
        { id: "A", plantNode: "aSite", chokeNode: "aMain", retakeNode: "aCt" }
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
      ]
    },
    Fracture: {
      sites: [
        { id: "B", plantNode: "bSite", chokeNode: "bMain", retakeNode: "bCt" },
        { id: "A", plantNode: "aSite", chokeNode: "aMain", retakeNode: "aCt" }
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
      ]
    },
    Icebox: {
      sites: [
        { id: "B", plantNode: "bSite", chokeNode: "bMain", retakeNode: "bCt" },
        { id: "A", plantNode: "aSite", chokeNode: "aMain", retakeNode: "aCt" }
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
      ]
    },
    Pearl: {
      sites: [
        { id: "B", plantNode: "bSite", chokeNode: "bLong", retakeNode: "bCt" },
        { id: "A", plantNode: "aSite", chokeNode: "aMain", retakeNode: "aCt" }
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
      ]
    }
  };

  function buildAdj(bp) {
    const adj = {};
    for (const k in bp.nodes) adj[k] = [];
    bp.edges.forEach(([a, b]) => {
      if (adj[a] && adj[b]) { adj[a].push(b); adj[b].push(a); }
    });
    return adj;
  }

  function findPath(adj, start, goal) {
    if (start === goal) return [start];
    const q = [[start]], seen = new Set([start]);
    while (q.length) {
      const path = q.shift(), cur = path[path.length - 1];
      for (const nxt of (adj[cur] || [])) {
        if (nxt === goal) return [...path, nxt];
        if (!seen.has(nxt)) { seen.add(nxt); q.push([...path, nxt]); }
      }
    }
    return [start, goal];
  }

  function appendPathKeys(actor, bp, adj, toNode, endT, rng, jitterMag = 1.8) {
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
      const j = i === path.length - 1 ? jitterMag : 0.7;
      actor.keys.push({
        t: startT + span * frac,
        x: pts[i][0] + (rng() - 0.5) * j * 2,
        y: pts[i][1] + (rng() - 0.5) * j * 2,
        node: path[i]
      });
    }
  }

  let state = {
    matchRef: null, maxR: 0, roundNum: 1, plan: null,
    time: 0, playing: false, speed: 1, rafId: null, lastTs: 0,
    canvas: null, ctx: null
  };

  function getAtkTeamIdx(M, roundNum) {
    const leftStartsAtk = !!M.leftStartsAtk;
    const ot = roundNum > 24;
    const leftIsAtk = roundNum <= 12 ? leftStartsAtk : !ot ? !leftStartsAtk : (roundNum % 2 === 1 ? leftStartsAtk : !leftStartsAtk);
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
    const altSite = bp.sites.find(s => s.id !== targetSite.id) || targetSite;

    const actors = {};
    for (let ti = 0; ti < 2; ti++) {
      const isAtk = ti === atkTi;
      const spawnNode = isAtk ? bp.atkNode : bp.defNode;
      const spawnPt = bp.nodes[spawnNode];

      M.teams[ti].units.forEach((u, i) => {
        const id = `${ti}-${i}`;
        actors[id] = {
          id, ti, isAtk,
          name: u.p.n,
          short: u.p.n.slice(0, 2).toUpperCase(),
          agent: u.agent || "",
          role: u.agentRole || u.p.r || "",
          deadAt: Infinity,
          deathPos: null,
          keys: [{ t: 0, x: spawnPt[0] + (i - 2) * 2.5, y: spawnPt[1] + (rng() - 0.5) * 2, node: spawnNode }]
        };

        let openNode;
        if (isAtk) openNode = i <= 2 ? targetSite.chokeNode : i === 3 ? bp.midNode : altSite.chokeNode;
        else openNode = i <= 1 ? targetSite.plantNode : i === 2 ? bp.midNode : altSite.plantNode;
        appendPathKeys(actors[id], bp, adj, openNode, 2.1, rng, 2.4);
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

      const killer = actors[e.k], victim = actors[e.v];
      if (!killer || !victim) return;

      let fightNode;
      if (e.tr) fightNode = lastCombatNode;
      else if (e.fb) fightNode = rng() < 0.65 ? targetSite.chokeNode : bp.midNode;
      else if (idx <= 2) fightNode = rng() < 0.55 ? targetSite.chokeNode : targetSite.plantNode;
      else fightNode = rng() < 0.75 ? targetSite.plantNode : targetSite.retakeNode;

      const neighbors = adj[fightNode] || [fightNode];
      const killerNode = rng() < 0.5 ? fightNode : neighbors[Math.floor(rng() * neighbors.length)];

      appendPathKeys(killer, bp, adj, killerNode, curT, rng, 2.4);
      appendPathKeys(victim, bp, adj, fightNode, curT, rng, 2.4);

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
          appendPathKeys(activePlanter, bp, adj, targetSite.plantNode, plantTime, rng, 1.0);
          curT = plantTime + 0.35;
        }
      }

      events.push({
        t: curT, k: e.k, v: e.v, as: e.as || null,
        fb: !!e.fb, tr: !!e.tr,
        kPos: [kLast.x, kLast.y], vPos: [vLast.x, vLast.y]
      });
    });

    const lastEvT = events.length ? events[events.length - 1].t : 3.6;
    let defuseTime = null;
    const endT = lastEvT + (plantTime !== null && R.win === defTi ? 2.1 : 1.3);

    const survivors = Object.values(actors).filter(a => a.deadAt === Infinity);
    survivors.forEach((a, idx) => {
      if (plantTime !== null && R.win === defTi && idx === 0) {
        defuseTime = endT - 0.3;
        appendPathKeys(a, bp, adj, targetSite.plantNode, lastEvT + 1.0, rng, 0.8);
        appendPathKeys(a, bp, adj, targetSite.plantNode, endT, rng, 0.5);
      } else {
        const destNode = plantTime !== null ? targetSite.plantNode : targetSite.retakeNode;
        appendPathKeys(a, bp, adj, destNode, endT, rng, 3.2);
      }
    });

    return {
      mapName: M.mapName, bp, round: R, atkTi, defTi, targetSite,
      actors, events, plantTime, defuseTime, duration: Math.max(5.5, endT)
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
        const f = clamp((effT - a.t) / Math.max(0.001, b.t - a.t), 0, 1);
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
    if (colorDist(colA, colB) < 95) colB = isLight ? "#0284C7" : "#38BDF8";
    return {
      isLight,
      bg: v("--bg") || (isLight ? "#F4F5F7" : "#0B0D11"),
      bd: v("--bd") || "#222733",
      fg: v("--fg") || "#ECEFF4",
      mut: v("--mut") || "#8A94A6",
      a: colA, b: colB,
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
    const cssH = cssW; // 1:1 para preservar la proporción exacta del minimapa oficial
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

    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    // 1. Minimapa oficial real
    const mapAsset = getMapImage(plan.mapName, () => drawFrame());
    if (mapAsset.ready && mapAsset.img) {
      ctx.save();
      ctx.filter = C.isLight
        ? "invert(0.88) hue-rotate(180deg) contrast(1.05) opacity(0.88)"
        : "brightness(0.88) contrast(1.12) saturate(0.85)";
      ctx.drawImage(mapAsset.img, W * 0.03, H * 0.03, W * 0.94, H * 0.94);
      ctx.restore();
    } else {
      ctx.fillStyle = C.mut;
      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.textAlign = "center";
      ctx.fillText(mapAsset.failed ? `MINIMAPA ${plan.mapName.toUpperCase()} NO DISPONIBLE` : `CARGANDO MINIMAPA ${plan.mapName.toUpperCase()}...`, W / 2, H / 2);
    }

    // 2. Spike plantada
    if (plan.plantTime !== null && time >= plan.plantTime) {
      const pt = plan.bp.nodes[plan.targetSite.plantNode];
      const px = sx(pt[0]), py = sy(pt[1]);
      const defused = plan.defuseTime !== null && time >= plan.defuseTime;
      const pulse = ((time - plan.plantTime) * 1.4) % 1;

      if (!defused) {
        ctx.strokeStyle = C.red;
        ctx.globalAlpha = 1 - pulse;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(px, py, 5 + pulse * 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = defused ? C.ok : C.red;
      ctx.fillRect(-4.5, -4.5, 9, 9);
      ctx.strokeStyle = C.bg;
      ctx.lineWidth = 1;
      ctx.strokeRect(-4.5, -4.5, 9, 9);
      ctx.restore();
    }

    // 3. Trazadores de duelos y asistencias
    plan.events.forEach(ev => {
      const dt = time - ev.t;
      if (dt >= 0 && dt <= 0.45) {
        const alpha = 1 - (dt / 0.45);
        const killer = plan.actors[ev.k];
        const col = killer && killer.ti === 0 ? C.a : C.b;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = ev.fb ? C.gold : col;
        ctx.lineWidth = ev.fb ? 2.2 : 1.6;
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

    // 4. Bajas (X fijas)
    Object.values(plan.actors).forEach(a => {
      if (time >= a.deadAt && a.deathPos) {
        const x = sx(a.deathPos.x), y = sy(a.deathPos.y);
        ctx.save();
        ctx.strokeStyle = a.ti === 0 ? C.a : C.b;
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(x - 4, y - 4); ctx.lineTo(x + 4, y + 4);
        ctx.moveTo(x + 4, y - 4); ctx.lineTo(x - 4, y + 4);
        ctx.stroke();
        ctx.restore();
      }
    });

    // 5. Jugadores vivos con ligera repulsión para que nunca se tapen entre sí
    const aliveList = Object.values(plan.actors)
      .filter(a => time < a.deadAt)
      .map(a => ({ a, pos: sampleActorPos(a, time) }));

    for (let i = 0; i < aliveList.length; i++) {
      for (let j = i + 1; j < aliveList.length; j++) {
        const p1 = aliveList[i].pos, p2 = aliveList[j].pos;
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 4.2) {
          const push = (4.2 - dist) / 2;
          const ang = dist > 0.01 ? Math.atan2(dy, dx) : (i + j);
          p1.x -= Math.cos(ang) * push; p1.y -= Math.sin(ang) * push;
          p2.x += Math.cos(ang) * push; p2.y += Math.sin(ang) * push;
        }
      }
    }

    aliveList.forEach(({ a, pos }) => {
      const x = sx(pos.x), y = sy(pos.y);
      const col = a.ti === 0 ? C.a : C.b;

      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, y, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = C.bg;
      ctx.lineWidth = 1.6;
      ctx.stroke();

      ctx.fillStyle = "#FFFFFF";
      ctx.font = '700 7.5px "JetBrains Mono", monospace';
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

    let phaseTxt = "DEFAULT / APERTURA", phaseCls = "mut";
    if (time >= plan.duration - 0.05) {
      phaseTxt = `RONDA PARA ${state.matchRef.teams[plan.round.win].name.toUpperCase()}`;
      phaseCls = plan.round.win === 0 ? "ca" : "cb";
    } else if (plan.defuseTime !== null && time >= plan.defuseTime) {
      phaseTxt = "SPIKE DESACTIVADA"; phaseCls = "kd-pos";
    } else if (plan.plantTime !== null && time >= plan.plantTime) {
      phaseTxt = `SPIKE PLANTADA · SITE ${plan.targetSite.id}`; phaseCls = "kd-neg";
    } else if (time >= 2.2) {
      phaseTxt = `EJECUCIÓN · SITE ${plan.targetSite.id}`; phaseCls = "stat-elite";
    }

    if (phaseEl) { phaseEl.textContent = phaseTxt; phaseEl.className = "mono r2d-phase " + phaseCls; }
    if (clockEl) clockEl.textContent = `${time.toFixed(1)}s / ${plan.duration.toFixed(1)}s`;
    if (scrubEl) scrubEl.value = String(Math.round((time / plan.duration) * 1000));

    if (aliveEl) {
      const alive0 = Object.values(plan.actors).filter(a => a.ti === 0 && time < a.deadAt).length;
      const alive1 = Object.values(plan.actors).filter(a => a.ti === 1 && time < a.deadAt).length;
      const side0 = plan.atkTi === 0 ? "ATK" : "DEF", side1 = plan.atkTi === 1 ? "ATK" : "DEF";
      aliveEl.innerHTML = `<span style="color:${C.a}">${esc(state.matchRef.teams[0].name)} (${side0}): <b>${alive0}</b></span>
        <span class="mut">VS</span>
        <span style="color:${C.b}"><b>${alive1}</b> :(${side1}) ${esc(state.matchRef.teams[1].name)}</span>`;
    }

    if (feedEl) {
      const happened = plan.events.filter(e => e.t <= time);
      feedEl.innerHTML = !happened.length
        ? `<span class="mut">Sin duelos resueltos en este instante.</span>`
        : happened.slice(-3).map(e => {
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

  function stopLoop() {
    if (state.rafId) { cancelAnimationFrame(state.rafId); state.rafId = null; }
    state.playing = false;
    const btn = document.getElementById("r2dPlayBtn");
    if (btn) { btn.textContent = "PLAY"; btn.classList.remove("live-active"); }
  }

  function tick(ts) {
    if (!state.playing || !state.plan) return;
    if (!state.lastTs) state.lastTs = ts;
    const dt = Math.min(0.1, (ts - state.lastTs) / 1000) * state.speed;
    state.lastTs = ts;
    state.time = Math.min(state.plan.duration, state.time + dt);
    drawFrame();
    if (state.time >= state.plan.duration) { stopLoop(); return; }
    state.rafId = requestAnimationFrame(tick);
  }

  function startLoop() {
    if (!state.plan) return;
    if (state.time >= state.plan.duration - 0.05) state.time = 0;
    state.playing = true;
    state.lastTs = 0;
    const btn = document.getElementById("r2dPlayBtn");
    if (btn) { btn.textContent = "PAUSA"; btn.classList.add("live-active"); }
    state.rafId = requestAnimationFrame(tick);
  }

  function renderShell() {
    const host = document.getElementById("radar2d-host");
    if (!host || !state.matchRef || !state.plan) return;
    const M = state.matchRef, R = state.plan.round;

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
      if (!host || !M || !maxR) { stopLoop(); return; }
      const isSameMap = state.matchRef === M;
      state.matchRef = M;
      state.maxR = maxR;
      if (opts.isAutoPlaying) { loadRound(maxR, false); return; }
      const targetR = opts.forceRound || maxR;
      loadRound(targetR, !!(opts.autoPlay || (isSameMap && targetR > state.roundNum)));
    },
    selectRound(rn, autoPlay = true) { if (state.matchRef) loadRound(rn, autoPlay); },
    stepRound(delta) { loadRound(state.roundNum + delta, true); },
    togglePlay() { if (state.playing) stopLoop(); else startLoop(); },
    restart() { stopLoop(); state.time = 0; drawFrame(); startLoop(); },
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
    stop() { stopLoop(); }
  };
})();