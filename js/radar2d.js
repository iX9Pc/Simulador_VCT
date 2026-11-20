// ===== MÓDULO P6.1: VISOR TÁCTICO 2D POR RONDA (MINIMAPA DETERMINISTA) =====
(function () {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // PRNG determinista (Mulberry32) para que cada ronda reproduzca siempre la misma jugada
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
  const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  // ===== PLANOS ESQUEMÁTICOS DE LOS 7 MAPAS VCT (COORDENADAS 0..100) =====
  const MAP_BLUEPRINTS = {
    Ascent: {
      lanes: [
        [10, 78, 80, 14], [12, 10, 76, 14], // Spawns ATK (abajo) / DEF (arriba)
        [12, 24, 18, 54], [70, 24, 18, 54], // A Main / B Main
        [40, 24, 20, 54],                   // Mid
        [28, 30, 14, 12], [58, 34, 14, 12]  // Tree / Market
      ],
      sites: [
        { id: "A", x: 14, y: 24, w: 18, h: 18, plant: [22, 32], choke: [21, 56], retake: [26, 20] },
        { id: "B", x: 68, y: 24, w: 18, h: 18, plant: [78, 32], choke: [79, 56], retake: [68, 20] }
      ],
      atkSpawn: [50, 86],
      defSpawn: [50, 14],
      mid: [50, 48],
      callouts: [
        { t: "MID", x: 50, y: 50 }, { t: "CAT", x: 35, y: 36 },
        { t: "MKT", x: 65, y: 40 }, { t: "A MAIN", x: 20, y: 66 }, { t: "B MAIN", x: 80, y: 66 }
      ]
    },
    Bind: {
      lanes: [
        [14, 78, 72, 14], [14, 10, 72, 14],
        [12, 24, 24, 54], [64, 24, 24, 54],
        [36, 46, 28, 12], [36, 24, 28, 10]
      ],
      sites: [
        { id: "A", x: 14, y: 24, w: 20, h: 20, plant: [24, 34], choke: [24, 58], retake: [30, 19] },
        { id: "B", x: 66, y: 24, w: 20, h: 20, plant: [76, 33], choke: [74, 58], retake: [68, 19] }
      ],
      atkSpawn: [50, 86],
      defSpawn: [50, 15],
      mid: [50, 52],
      callouts: [
        { t: "SHOWERS", x: 16, y: 52 }, { t: "LAMPS", x: 34, y: 36 },
        { t: "HOOKAH", x: 66, y: 54 }, { t: "TP", x: 42, y: 44 }, { t: "TP", x: 58, y: 28 }
      ]
    },
    Breeze: {
      lanes: [
        [10, 78, 80, 14], [10, 10, 80, 14],
        [10, 24, 22, 54], [68, 24, 22, 54],
        [38, 24, 24, 54], [30, 32, 10, 12], [60, 34, 10, 12]
      ],
      sites: [
        { id: "A", x: 12, y: 24, w: 22, h: 22, plant: [23, 35], choke: [21, 58], retake: [28, 19] },
        { id: "B", x: 68, y: 24, w: 20, h: 20, plant: [78, 34], choke: [78, 58], retake: [66, 19] }
      ],
      atkSpawn: [50, 86],
      defSpawn: [50, 14],
      mid: [50, 50],
      callouts: [
        { t: "CAVE", x: 18, y: 62 }, { t: "PILLAR", x: 50, y: 48 },
        { t: "ELBOW", x: 78, y: 62 }, { t: "HALL", x: 32, y: 22 }
      ]
    },
    Haven: {
      lanes: [
        [10, 80, 80, 12], [10, 10, 80, 12],
        [10, 22, 18, 58], [41, 22, 18, 58], [72, 22, 18, 58],
        [26, 40, 16, 12], [58, 40, 16, 12]
      ],
      sites: [
        { id: "A", x: 11, y: 22, w: 17, h: 18, plant: [19, 31], choke: [19, 58], retake: [24, 18] },
        { id: "B", x: 42, y: 26, w: 16, h: 16, plant: [50, 34], choke: [50, 56], retake: [50, 18] },
        { id: "C", x: 72, y: 22, w: 17, h: 18, plant: [80, 31], choke: [80, 58], retake: [76, 18] }
      ],
      atkSpawn: [50, 86],
      defSpawn: [50, 14],
      mid: [50, 56],
      callouts: [
        { t: "A LONG", x: 18, y: 66 }, { t: "GARAGE", x: 65, y: 46 },
        { t: "C LONG", x: 82, y: 66 }, { t: "WINDOW", x: 50, y: 64 }
      ]
    },
    Lotus: {
      lanes: [
        [10, 80, 80, 12], [10, 10, 80, 12],
        [10, 22, 18, 58], [41, 22, 18, 58], [72, 22, 18, 58],
        [26, 36, 16, 14], [58, 38, 16, 14]
      ],
      sites: [
        { id: "A", x: 11, y: 22, w: 17, h: 19, plant: [19, 31], choke: [19, 57], retake: [25, 18] },
        { id: "B", x: 42, y: 28, w: 16, h: 16, plant: [50, 36], choke: [50, 58], retake: [50, 18] },
        { id: "C", x: 72, y: 22, w: 17, h: 19, plant: [80, 31], choke: [80, 57], retake: [75, 18] }
      ],
      atkSpawn: [50, 86],
      defSpawn: [50, 14],
      mid: [50, 58],
      callouts: [
        { t: "RUBBLE", x: 18, y: 64 }, { t: "TREE", x: 34, y: 42 },
        { t: "MOUND", x: 82, y: 64 }, { t: "WATERFALL", x: 66, y: 30 }
      ]
    },
    Split: {
      lanes: [
        [12, 78, 76, 14], [12, 10, 76, 14],
        [12, 24, 18, 54], [70, 24, 18, 54],
        [40, 24, 20, 54], [28, 30, 14, 12], [58, 30, 14, 12]
      ],
      sites: [
        { id: "A", x: 13, y: 24, w: 18, h: 18, plant: [22, 33], choke: [21, 56], retake: [28, 19] },
        { id: "B", x: 69, y: 24, w: 18, h: 18, plant: [78, 33], choke: [79, 56], retake: [72, 19] }
      ],
      atkSpawn: [50, 86],
      defSpawn: [50, 14],
      mid: [50, 50],
      callouts: [
        { t: "RAMPS", x: 24, y: 46 }, { t: "VENTS", x: 36, y: 36 },
        { t: "MAIL", x: 64, y: 36 }, { t: "SEWERS", x: 34, y: 68 }
      ]
    },
    Sunset: {
      lanes: [
        [12, 78, 76, 14], [12, 10, 76, 14],
        [12, 24, 18, 54], [70, 24, 18, 54],
        [40, 24, 20, 54], [28, 34, 14, 12], [58, 36, 14, 12]
      ],
      sites: [
        { id: "A", x: 13, y: 24, w: 18, h: 18, plant: [22, 33], choke: [21, 57], retake: [27, 19] },
        { id: "B", x: 69, y: 24, w: 18, h: 18, plant: [78, 33], choke: [79, 57], retake: [72, 19] }
      ],
      atkSpawn: [50, 86],
      defSpawn: [50, 14],
      mid: [50, 50],
      callouts: [
        { t: "ELBOW", x: 16, y: 48 }, { t: "MID TOP", x: 50, y: 62 },
        { t: "MKT", x: 64, y: 42 }, { t: "B MAIN", x: 80, y: 62 }
      ]
    }
  };

  // ===== ESTADO INTERNO DEL VISOR =====
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

  // Construye los keyframes deterministas de los 10 jugadores, duelos, plant y defuse
  function buildRoundChoreography(M, R) {
    const bp = MAP_BLUEPRINTS[M.mapName] || MAP_BLUEPRINTS.Ascent;
    const seed = hashString(`${M.mapName}-${R.n}-${R.before[0]}-${R.before[1]}-${R.ev.length}-${M.teams[0].name}`);
    const rng = makeRng(seed);

    const atkTi = getAtkTeamIdx(M, R.n);
    const defTi = 1 - atkTi;
    const targetSite = bp.sites[Math.floor(rng() * bp.sites.length)];
    const otherSites = bp.sites.filter(s => s.id !== targetSite.id);
    const altSite = otherSites[0] || targetSite;

    const jitter = (pt, mag) => [
      clamp(pt[0] + (rng() - 0.5) * mag * 2, 7, 93),
      clamp(pt[1] + (rng() - 0.5) * mag * 2, 7, 93)
    ];

    const actors = {};
    for (let ti = 0; ti < 2; ti++) {
      const isAtk = ti === atkTi;
      M.teams[ti].units.forEach((u, i) => {
        const id = `${ti}-${i}`;
        const spawnBase = isAtk ? bp.atkSpawn : bp.defSpawn;
        const spawnPos = [
          clamp(spawnBase[0] + (i - 2) * 5.2, 16, 84),
          clamp(spawnBase[1] + (rng() - 0.5) * 4, 9, 91)
        ];

        // Posición inicial de default (t = 2.0s)
        let defPos;
        if (isAtk) {
          if (i <= 2) defPos = jitter(targetSite.choke, 5);
          else if (i === 3) defPos = jitter(bp.mid, 6);
          else defPos = jitter(altSite.choke, 5);
        } else {
          if (i <= 1) defPos = jitter(targetSite.plant, 6);
          else if (i === 2) defPos = jitter(bp.mid, 5);
          else defPos = jitter(altSite.plant, 6);
        }

        actors[id] = {
          id,
          ti,
          isAtk,
          name: u.p.n,
          short: u.p.n.slice(0, 2).toUpperCase(),
          agent: u.agent || "",
          role: u.agentRole || u.p.r || "",
          deadAt: Infinity,
          deathPos: null,
          keys: [
            { t: 0, x: spawnPos[0], y: spawnPos[1] },
            { t: 2.0, x: defPos[0], y: defPos[1] }
          ]
        };
      });
    }

    // Programar línea de tiempo de duelos reales R.ev
    const evCount = R.ev.length;
    const events = [];
    let curT = 2.35;
    let lastKillPos = jitter(targetSite.choke, 4);

    // Determinar si ocurre plant de Spike
    const spikeCarrierCandidates = Object.values(actors).filter(a => a.isAtk);
    const planter = spikeCarrierCandidates.find(a => a.role.toLowerCase().includes("controlador") || a.role.toLowerCase().includes("iniciador"))
      || spikeCarrierCandidates[2]
      || spikeCarrierCandidates[0];

    let plantTime = null;
    const plantAtEvIdx = evCount >= 3 ? Math.min(2, Math.floor(evCount * 0.4)) : 0;

    R.ev.forEach((e, idx) => {
      if (idx === 0) {
        curT = 2.4 + rng() * 0.6;
      } else if (e.tr) {
        curT += 0.42 + rng() * 0.28;
      } else {
        curT += 0.85 + rng() * 0.75;
      }

      const killer = actors[e.k];
      const victim = actors[e.v];
      if (!killer || !victim) return;

      // Posición lógica del duelo según momento de la ronda
      let anchor;
      if (e.tr) {
        anchor = jitter(lastKillPos, 4.5);
      } else if (e.fb) {
        anchor = rng() < 0.68 ? jitter(targetSite.choke, 6) : jitter(bp.mid, 6);
      } else if (idx <= 2) {
        anchor = jitter([lerp(targetSite.choke[0], targetSite.plant[0], 0.55), lerp(targetSite.choke[1], targetSite.plant[1], 0.55)], 7);
      } else {
        anchor = jitter(targetSite.plant, 9);
      }

      // Separar ligeramente a atacante y defensor para que el trazador sea legible
      const angle = rng() * Math.PI * 2;
      const dist = 5.5 + rng() * 4.5;
      const kPos = [clamp(anchor[0] + Math.cos(angle) * dist, 8, 92), clamp(anchor[1] + Math.sin(angle) * dist, 8, 92)];
      const vPos = [clamp(anchor[0] - Math.cos(angle) * dist, 8, 92), clamp(anchor[1] - Math.sin(angle) * dist, 8, 92)];

      killer.keys.push({ t: curT, x: kPos[0], y: kPos[1] });
      victim.keys.push({ t: curT, x: vPos[0], y: vPos[1] });
      victim.deadAt = curT;
      victim.deathPos = { x: vPos[0], y: vPos[1] };
      lastKillPos = vPos;

      // Insertar plant de Spike cuando el equipo atacante llega al site y aún hay atacantes vivos
      if (plantTime === null && idx >= plantAtEvIdx) {
        const aliveAtkNow = Object.values(actors).filter(a => a.isAtk && a.deadAt > curT + 0.35);
        if (aliveAtkNow.length >= 1 && (R.win === atkTi || aliveAtkNow.length >= 2 || R.cl)) {
          const activePlanter = aliveAtkNow.includes(planter) ? planter : aliveAtkNow[0];
          plantTime = curT + 0.45;
          activePlanter.keys.push({ t: plantTime, x: targetSite.plant[0], y: targetSite.plant[1] });
          curT = plantTime + 0.35;
        }
      }

      events.push({
        t: curT,
        k: e.k,
        v: e.v,
        as: e.as || null,
        fb: !!e.fb,
        tr: !!e.tr,
        kPos,
        vPos
      });
    });

    // Posiciones de cierre para sobrevivientes (post-plant / retake / defuse)
    const lastEvT = events.length ? events[events.length - 1].t : 3.5;
    let defuseTime = null;
    const endT = lastEvT + (plantTime !== null && R.win === defTi ? 2.0 : 1.3);

    const survivors = Object.values(actors).filter(a => a.deadAt === Infinity);
    survivors.forEach((a, idx) => {
      if (plantTime !== null && R.win === defTi && idx === 0) {
        // Defensor ganador desactiva la Spike
        defuseTime = endT - 0.3;
        a.keys.push({ t: lastEvT + 0.9, x: targetSite.plant[0], y: targetSite.plant[1] });
        a.keys.push({ t: endT, x: targetSite.plant[0], y: targetSite.plant[1] });
      } else {
        const holdPt = plantTime !== null ? jitter(targetSite.plant, 8) : jitter(targetSite.retake, 10);
        a.keys.push({ t: endT, x: holdPt[0], y: holdPt[1] });
      }
    });

    // Si algún jugador vivo no tuvo eventos antes del plant, hacerlo rotar hacia el Site objetivo
    Object.values(actors).forEach(a => {
      a.keys.sort((p, q) => p.t - q.t);
      if (a.keys.length === 2 && a.deadAt === Infinity) {
        const dest = a.isAtk ? jitter(targetSite.plant, 8) : jitter(targetSite.retake, 8);
        a.keys.push({ t: Math.max(3.6, lastEvT), x: dest[0], y: dest[1] });
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
        const f = ease(clamp((effT - a.t) / span, 0, 1));
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
    return {
      bg: v("--bg") || (isLight ? "#F4F5F7" : "#0B0D11"),
      lane: v("--bg2") || (isLight ? "#EAECEF" : "#11141B"),
      laneStroke: v("--bd") || (isLight ? "#D5D9E0" : "#222733"),
      siteFill: isLight ? "rgba(17,20,28,0.06)" : "rgba(236,239,244,0.04)",
      siteStroke: v("--bd-hi") || "#333B4D",
      fg: v("--fg") || "#ECEFF4",
      mut: v("--mut") || "#8A94A6",
      dim: v("--dim") || "#566073",
      a: v("--a") || "#E5484D",
      b: v("--b") || "#38BDF8",
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
    const cssW = Math.max(280, Math.round(rect.width || 460));
    const cssH = Math.round(cssW * 0.66);
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

    // Fondo + cuadrícula táctica 1px
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = C.laneStroke;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1;
    for (let g = 10; g < 100; g += 10) {
      ctx.beginPath(); ctx.moveTo(Math.round(sx(g)) + 0.5, 0); ctx.lineTo(Math.round(sx(g)) + 0.5, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, Math.round(sy(g)) + 0.5); ctx.lineTo(W, Math.round(sy(g)) + 0.5); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Corredores del mapa
    ctx.fillStyle = C.lane;
    ctx.strokeStyle = C.laneStroke;
    ctx.lineWidth = 1;
    plan.bp.lanes.forEach(([x, y, w, h]) => {
      ctx.fillRect(sx(x), sy(y), sx(w), sy(h));
      ctx.strokeRect(Math.round(sx(x)) + 0.5, Math.round(sy(y)) + 0.5, Math.round(sx(w)), Math.round(sy(h)));
    });

    // Sites (A / B / C)
    plan.bp.sites.forEach(s => {
      const isTarget = s.id === plan.targetSite.id;
      ctx.fillStyle = C.siteFill;
      ctx.fillRect(sx(s.x), sy(s.y), sx(s.w), sy(s.h));
      ctx.save();
      ctx.strokeStyle = (isTarget && plan.plantTime !== null && time >= plan.plantTime) ? C.red : C.siteStroke;
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1;
      ctx.strokeRect(sx(s.x) + 0.5, sy(s.y) + 0.5, sx(s.w), sy(s.h));
      ctx.restore();

      ctx.fillStyle = C.dim;
      ctx.font = '700 18px "Barlow Condensed", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(s.id, sx(s.x + s.w / 2), sy(s.y + s.h / 2));
    });

    // Etiquetas tácticas de zonas y Spawns
    ctx.fillStyle = C.dim;
    ctx.font = '600 9px "JetBrains Mono", monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    plan.bp.callouts.forEach(c => ctx.fillText(c.t, sx(c.x), sy(c.y)));
    ctx.fillText("DEF SPAWN", sx(plan.bp.defSpawn[0]), sy(plan.bp.defSpawn[1]) - 6);
    ctx.fillText("ATK SPAWN", sx(plan.bp.atkSpawn[0]), sy(plan.bp.atkSpawn[1]) + 7);

    // Spike (si fue plantada)
    if (plan.plantTime !== null && time >= plan.plantTime) {
      const px = sx(plan.targetSite.plant[0]);
      const py = sy(plan.targetSite.plant[1]);
      const defused = plan.defuseTime !== null && time >= plan.defuseTime;
      const pulse = ((time - plan.plantTime) * 1.4) % 1;

      if (!defused) {
        ctx.strokeStyle = C.red;
        ctx.globalAlpha = 1 - pulse;
        ctx.lineWidth = 1.5;
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

    // Trazadores de disparos y pulsos de asistencia recientes
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

        // Anillo de impacto en la víctima
        ctx.beginPath();
        ctx.arc(sx(ev.vPos[0]), sy(ev.vPos[1]), 4 + dt * 18, 0, Math.PI * 2);
        ctx.stroke();

        // Utilidad de asistencia (línea punteada fina)
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

    // Dibujar bajas (X tácticas fijas) primero para no tapar a los vivos
    Object.values(plan.actors).forEach(a => {
      if (time >= a.deadAt && a.deathPos) {
        const x = sx(a.deathPos.x), y = sy(a.deathPos.y);
        ctx.save();
        ctx.strokeStyle = a.ti === 0 ? C.a : C.b;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x - 4, y - 4); ctx.lineTo(x + 4, y + 4);
        ctx.moveTo(x + 4, y - 4); ctx.lineTo(x - 4, y + 4);
        ctx.stroke();
        ctx.restore();
      }
    });

    // Dibujar jugadores vivos
    Object.values(plan.actors).forEach(a => {
      if (time >= a.deadAt) return;
      const pos = sampleActorPos(a, time);
      const x = sx(pos.x), y = sy(pos.y);
      const col = a.ti === 0 ? C.a : C.b;

      // Punto táctico con borde de contraste
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, y, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = C.bg;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Iniciales del jugador dentro del punto
      ctx.fillStyle = "#FFFFFF";
      ctx.font = '700 7.5px "JetBrains Mono", monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(a.short, x, y + 0.5);
    });

    ctx.restore();
    updateHudReadout();
  }

  function updateHudReadout() {
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
    if (clockEl) {
      clockEl.textContent = `${time.toFixed(1)}s / ${plan.duration.toFixed(1)}s`;
    }
    if (scrubEl) {
      scrubEl.value = String(Math.round((time / plan.duration) * 1000));
    }

    if (aliveEl) {
      const alive0 = Object.values(plan.actors).filter(a => a.ti === 0 && time < a.deadAt).length;
      const alive1 = Object.values(plan.actors).filter(a => a.ti === 1 && time < a.deadAt).length;
      const side0 = plan.atkTi === 0 ? "ATK" : "DEF";
      const side1 = plan.atkTi === 1 ? "ATK" : "DEF";
      aliveEl.innerHTML = `<span class="ca">${esc(state.matchRef.teams[0].name)} (${side0}): <b>${alive0}</b></span>
        <span class="mut">VS</span>
        <span class="cb"><b>${alive1}</b> :(${side1}) ${esc(state.matchRef.teams[1].name)}</span>`;
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
            <b class="${ka.ti ? 'cb' : 'ca'}">${esc(ka.name)}</b>
            <span>→</span>
            <span class="${va.ti ? 'cb' : 'ca'}">${esc(va.name)}</span>
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

  // Redibujar automáticamente si cambia el tema dark/light
  try {
    new MutationObserver(() => {
      if (state.canvas && state.plan) drawFrame();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  } catch (e) {}

  // API pública
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

      // Durante Auto-Play rápido de la serie, muestra el estado final de la ronda actual sin bloquear
      if (opts.isAutoPlaying) {
        loadRound(maxR, false);
        return;
      }
      // Si el usuario avanzó +1 ronda manualmente, reproduce la nueva ronda automáticamente
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