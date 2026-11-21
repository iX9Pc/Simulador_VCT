// ===== MÓDULO P6.1 + FASE B: VISOR 2D TÁCTICO (NAVMESH A*, UTILIDAD, ROLES Y DUELOS) =====
(function () {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const GRID = 96;

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

  function rotateUV(u, v, k) {
    const step = ((k % 4) + 4) % 4;
    if (step === 1) return [1 - v, u];
    if (step === 2) return [1 - u, 1 - v];
    if (step === 3) return [v, 1 - u];
    return [u, v];
  }

  function detectMapRotationSteps(apiMeta) {
    if (!apiMeta || !Array.isArray(apiMeta.callouts) || !apiMeta.xMultiplier) return 0;
    const rawUV = loc => [
      loc.y * apiMeta.xMultiplier + apiMeta.xScalarToAdd,
      loc.x * apiMeta.yMultiplier + apiMeta.yScalarToAdd
    ];
    const avg = list => !list.length ? null : [
      list.reduce((s, p) => s + p[0], 0) / list.length,
      list.reduce((s, p) => s + p[1], 0) / list.length
    ];

    const atkPts = [], defPts = [], siteA = [], siteOther = [];
    apiMeta.callouts.forEach(co => {
      if (!co.location) return;
      const uv = rawUV(co.location);
      const reg = (co.regionName || "").toLowerCase();
      const sup = (co.superRegionName || "").toUpperCase();
      if (sup.includes("ATTACKER") || reg.includes("attacker")) atkPts.push(uv);
      else if (sup.includes("DEFENDER") || reg.includes("defender")) defPts.push(uv);
      else if (reg === "site" && sup === "A") siteA.push(uv);
      else if (reg === "site" && (sup === "B" || sup === "C")) siteOther.push(uv);
    });

    const atk = avg(atkPts), def = avg(defPts);
    if (atk && def && Math.hypot(atk[0] - def[0], atk[1] - def[1]) >= 0.14) {
      const dx = atk[0] - def[0], dy = atk[1] - def[1];
      const scores = [dy, dx, -dy, -dx];
      let bestK = 0;
      for (let k = 1; k < 4; k++) if (scores[k] > scores[bestK]) bestK = k;
      return bestK;
    }

    const aPt = avg(siteA), oPt = avg(siteOther);
    if (aPt && oPt) {
      const sdx = aPt[0] - oPt[0], sdy = aPt[1] - oPt[1];
      const scores = [sdx, -sdy, -sdx, sdy];
      let bestK = 0;
      for (let k = 1; k < 4; k++) if (scores[k] > scores[bestK]) bestK = k;
      return bestK;
    }
    return 0;
  }

  // ===== CARGA DE MINIMAPAS + NAVMESH REAL =====
  const mapAssetCache = {};
  let apiMapsPromise = null;

  function fetchApiMaps() {
    if (!apiMapsPromise) {
      apiMapsPromise = fetch("https://valorant-api.com/v1/maps")
        .then(r => r.ok ? r.json() : null)
        .then(json => {
          const dict = {};
          if (json && Array.isArray(json.data)) {
            json.data.forEach(m => {
              if (m.displayName && m.displayIcon) {
                dict[m.displayName.toLowerCase()] = {
                  url: m.displayIcon,
                  xMultiplier: m.xMultiplier, yMultiplier: m.yMultiplier,
                  xScalarToAdd: m.xScalarToAdd, yScalarToAdd: m.yScalarToAdd,
                  callouts: Array.isArray(m.callouts) ? m.callouts : []
                };
              }
            });
          }
          return dict;
        })
        .catch(() => ({}));
    }
    return apiMapsPromise;
  }

  function buildNavFromImage(im, rotSteps, apiMeta) {
    const off = document.createElement("canvas");
    off.width = GRID; off.height = GRID;
    const octx = off.getContext("2d", { willReadFrequently: true });
    octx.clearRect(0, 0, GRID, GRID);
    octx.save();
    octx.translate(GRID / 2, GRID / 2);
    if (rotSteps) octx.rotate(rotSteps * (Math.PI / 2));
    octx.drawImage(im, -GRID / 2, -GRID / 2, GRID, GRID);
    octx.restore();

    let imgData;
    try { imgData = octx.getImageData(0, 0, GRID, GRID).data; } catch (e) { return null; }

    const total = GRID * GRID;
    const rawWalk = new Uint8Array(total);
    const sitePixel = new Uint8Array(total);

    for (let i = 0; i < total; i++) {
      const r = imgData[i * 4], g = imgData[i * 4 + 1], b = imgData[i * 4 + 2], a = imgData[i * 4 + 3];
      if (a > 110) {
        const isTpLine = g > r + 40 && g > b + 15 && r < 70;
        if (!isTpLine) {
          rawWalk[i] = 1;
          if (r > b + 12 && g > b + 12 && r > 75 && g > 75) sitePixel[i] = 1;
        }
      }
    }

    const visited = new Uint8Array(total);
    let bestComp = [];
    const dirs4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let i = 0; i < total; i++) {
      if (!rawWalk[i] || visited[i]) continue;
      const comp = [], stack = [i];
      visited[i] = 1;
      while (stack.length) {
        const cur = stack.pop();
        comp.push(cur);
        const cx = cur % GRID, cy = (cur / GRID) | 0;
        for (const [dx, dy] of dirs4) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
          const ni = ny * GRID + nx;
          if (rawWalk[ni] && !visited[ni]) { visited[ni] = 1; stack.push(ni); }
        }
      }
      if (comp.length > bestComp.length) bestComp = comp;
    }

    const walk = new Uint8Array(total);
    bestComp.forEach(idx => { walk[idx] = 1; });

    const wallDist = new Int16Array(total);
    wallDist.fill(-1);
    const q = new Int32Array(total);
    let qh = 0, qt = 0;
    for (let i = 0; i < total; i++) {
      if (!walk[i]) { wallDist[i] = 0; q[qt++] = i; }
    }
    while (qh < qt) {
      const cur = q[qh++], d = wallDist[cur], cx = cur % GRID, cy = (cur / GRID) | 0;
      for (const [dx, dy] of dirs4) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
        const ni = ny * GRID + nx;
        if (wallDist[ni] === -1) { wallDist[ni] = d + 1; q[qt++] = ni; }
      }
    }

    const snap = (gx, gy, minDist = 2) => {
      const x0 = clamp(Math.round(gx), 1, GRID - 2);
      const y0 = clamp(Math.round(gy), 1, GRID - 2);
      if (walk[y0 * GRID + x0] && wallDist[y0 * GRID + x0] >= minDist) return [x0, y0];
      let best = null, bestD2 = Infinity;
      for (let rad = 1; rad <= 24; rad++) {
        for (let dy = -rad; dy <= rad; dy++) {
          for (let dx = -rad; dx <= rad; dx++) {
            if (Math.abs(dx) !== rad && Math.abs(dy) !== rad) continue;
            const nx = x0 + dx, ny = y0 + dy;
            if (nx < 1 || ny < 1 || nx >= GRID - 1 || ny >= GRID - 1) continue;
            const ni = ny * GRID + nx;
            if (walk[ni] && wallDist[ni] >= minDist) {
              const d2 = dx * dx + dy * dy;
              if (d2 < bestD2) { bestD2 = d2; best = [nx, ny]; }
            }
          }
        }
        if (best) return best;
      }
      if (minDist > 1) return snap(gx, gy, 1);
      const fb = bestComp[Math.floor(bestComp.length / 2)] || (Math.floor(GRID / 2) * GRID + Math.floor(GRID / 2));
      return [fb % GRID, (fb / GRID) | 0];
    };

    const sites = [];
    let atkPt = null, defPt = null, midPt = null;
    const chokesBySite = { A: [], B: [], C: [] };
    const retakesBySite = { A: [], B: [], C: [] };

    if (apiMeta && apiMeta.callouts && apiMeta.callouts.length && apiMeta.xMultiplier) {
      const toGrid = loc => {
        const u = loc.y * apiMeta.xMultiplier + apiMeta.xScalarToAdd;
        const v = loc.x * apiMeta.yMultiplier + apiMeta.yScalarToAdd;
        const [rx, ry] = rotateUV(u, v, rotSteps);
        return [rx * GRID, ry * GRID];
      };
      const atkAcc = [], defAcc = [], midAcc = [];
      apiMeta.callouts.forEach(co => {
        if (!co.location) return;
        const [gx, gy] = toGrid(co.location);
        const pt = snap(gx, gy, 2);
        const reg = (co.regionName || "").toLowerCase();
        const sup = (co.superRegionName || "").toUpperCase();
        if (reg === "site" && (sup === "A" || sup === "B" || sup === "C")) sites.push({ id: sup, pt });
        else if (sup.includes("ATTACKER") || reg.includes("attacker")) atkAcc.push(pt);
        else if (sup.includes("DEFENDER") || reg.includes("defender")) defAcc.push(pt);
        else if (sup === "MID" || reg.includes("mid")) midAcc.push(pt);
        else if (sup === "A" || sup === "B" || sup === "C") {
          if (reg.includes("main") || reg.includes("long") || reg.includes("short") || reg.includes("lobby") || reg.includes("cave") || reg.includes("rubble") || reg.includes("mound") || reg.includes("window") || reg.includes("hookah") || reg.includes("showers") || reg.includes("bath") || reg.includes("garage") || reg.includes("elbow")) {
            chokesBySite[sup].push(pt);
          } else {
            retakesBySite[sup].push(pt);
          }
        }
      });

      const avgSnap = arr => !arr.length ? null : snap(
        arr.reduce((s, p) => s + p[0], 0) / arr.length,
        arr.reduce((s, p) => s + p[1], 0) / arr.length, 2
      );
      atkPt = avgSnap(atkAcc); defPt = avgSnap(defAcc); midPt = avgSnap(midAcc);
    }

    if (!atkPt || !defPt) {
      let minY = GRID, maxY = 0;
      bestComp.forEach(idx => { const y = (idx / GRID) | 0; if (y < minY) minY = y; if (y > maxY) maxY = y; });
      const topPts = [], botPts = [];
      bestComp.forEach(idx => {
        const x = idx % GRID, y = (idx / GRID) | 0;
        if (wallDist[idx] < 2) return;
        if (y <= minY + 10) topPts.push([x, y]);
        if (y >= maxY - 10) botPts.push([x, y]);
      });
      if (!defPt && topPts.length) defPt = snap(topPts.reduce((s, p) => s + p[0], 0) / topPts.length, topPts.reduce((s, p) => s + p[1], 0) / topPts.length, 2);
      if (!atkPt && botPts.length) atkPt = snap(botPts.reduce((s, p) => s + p[0], 0) / botPts.length, botPts.reduce((s, p) => s + p[1], 0) / botPts.length, 2);
    }
    if (!midPt) midPt = snap(GRID / 2, GRID / 2, 2);

    if (!sites.length) {
      sites.push({ id: "B", pt: snap(GRID * 0.24, GRID * 0.36, 2) });
      sites.push({ id: "A", pt: snap(GRID * 0.78, GRID * 0.36, 2) });
    }

    sites.forEach(s => {
      const chList = chokesBySite[s.id] || [];
      const rtList = retakesBySite[s.id] || [];
      s.chokes = chList.length ? chList : [snap(lerp(s.pt[0], atkPt[0], 0.38), lerp(s.pt[1], atkPt[1], 0.38), 2)];
      s.choke = s.chokes[0];
      s.retakes = rtList.length ? rtList : [snap(lerp(s.pt[0], defPt[0], 0.36), lerp(s.pt[1], defPt[1], 0.36), 2)];
      s.retake = s.retakes[0];
    });

    return { walk, wallDist, sites, atkPt, defPt, midPt, snap };
  }

  function getMapAsset(mapName, onReady) {
    const key = (mapName || "Ascent").toLowerCase();
    if (mapAssetCache[key]) {
      const existing = mapAssetCache[key];
      if (existing.ready) return existing;
      if (onReady && !existing.failed) existing.listeners.push(onReady);
      return existing;
    }
    const entry = { img: null, rotSteps: 0, nav: null, ready: false, failed: false, listeners: [] };
    if (onReady) entry.listeners.push(onReady);
    mapAssetCache[key] = entry;
    const notify = () => {
      const list = entry.listeners.splice(0, entry.listeners.length);
      list.forEach(fn => { try { fn(entry); } catch (e) {} });
    };

    fetchApiMaps().then(dict => {
      const meta = dict[key];
      if (!meta || !meta.url) { entry.failed = true; notify(); return; }
      const rotSteps = detectMapRotationSteps(meta);
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => {
        entry.img = im;
        entry.rotSteps = rotSteps;
        entry.nav = buildNavFromImage(im, rotSteps, meta);
        entry.ready = true;
        notify();
      };
      im.onerror = () => { entry.failed = true; notify(); };
      im.src = meta.url;
    });
    return entry;
  }

  // ===== LOS & A* =====
  function hasLineOfSight(nav, x0, y0, x1, y1, minDist = 1) {
    let ix0 = Math.round(x0), iy0 = Math.round(y0);
    const ix1 = Math.round(x1), iy1 = Math.round(y1);
    const dx = Math.abs(ix1 - ix0), dy = Math.abs(iy1 - iy0);
    const sx = ix0 < ix1 ? 1 : -1, sy = iy0 < iy1 ? 1 : -1;
    let err = dx - dy;
    while (true) {
      if (ix0 < 0 || iy0 < 0 || ix0 >= GRID || iy0 >= GRID) return false;
      if (nav.wallDist[iy0 * GRID + ix0] < minDist) return false;
      if (ix0 === ix1 && iy0 === iy1) return true;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; ix0 += sx; }
      if (e2 < dx) { err += dx; iy0 += sy; }
    }
  }

  function astarPath(nav, startPt, endPt) {
    const sx = clamp(Math.round(startPt[0]), 0, GRID - 1), sy = clamp(Math.round(startPt[1]), 0, GRID - 1);
    const gx = clamp(Math.round(endPt[0]), 0, GRID - 1), gy = clamp(Math.round(endPt[1]), 0, GRID - 1);
    const startIdx = sy * GRID + sx, goalIdx = gy * GRID + gx;
    if (startIdx === goalIdx) return [[sx, sy]];

    const total = GRID * GRID;
    const gScore = new Float32Array(total); gScore.fill(1e9);
    const cameFrom = new Int32Array(total); cameFrom.fill(-1);
    const closed = new Uint8Array(total);
    const heapIdx = [], heapF = [];
    const pushHeap = (idx, f) => {
      let i = heapIdx.length;
      heapIdx.push(idx); heapF.push(f);
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heapF[p] <= heapF[i]) break;
        [heapIdx[p], heapIdx[i]] = [heapIdx[i], heapIdx[p]];
        [heapF[p], heapF[i]] = [heapF[i], heapF[p]];
        i = p;
      }
    };
    const popHeap = () => {
      const top = heapIdx[0], lastI = heapIdx.pop(), lastF = heapF.pop();
      if (heapIdx.length) {
        heapIdx[0] = lastI; heapF[0] = lastF;
        let i = 0, len = heapIdx.length;
        while (true) {
          const l = (i << 1) + 1, r = l + 1;
          let sm = i;
          if (l < len && heapF[l] < heapF[sm]) sm = l;
          if (r < len && heapF[r] < heapF[sm]) sm = r;
          if (sm === i) break;
          [heapIdx[i], heapIdx[sm]] = [heapIdx[sm], heapIdx[i]];
          [heapF[i], heapF[sm]] = [heapF[sm], heapF[i]];
          i = sm;
        }
      }
      return top;
    };

    const dirs8 = [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[-1,1,1.414],[1,-1,1.414],[-1,-1,1.414]];
    gScore[startIdx] = 0;
    pushHeap(startIdx, Math.hypot(gx - sx, gy - sy));

    let found = false;
    while (heapIdx.length) {
      const cur = popHeap();
      if (cur === goalIdx) { found = true; break; }
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cx = cur % GRID, cy = (cur / GRID) | 0, cg = gScore[cur];
      for (let d = 0; d < 8; d++) {
        const dx = dirs8[d][0], dy = dirs8[d][1], stepC = dirs8[d][2];
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
        const ni = ny * GRID + nx;
        if (!nav.walk[ni] || closed[ni]) continue;
        if (dx !== 0 && dy !== 0 && (!nav.walk[cy * GRID + nx] || !nav.walk[ny * GRID + cx])) continue;
        const wd = nav.wallDist[ni];
        const ng = cg + stepC + (wd <= 1 ? 4.2 : wd === 2 ? 0.7 : 0);
        if (ng < gScore[ni]) {
          gScore[ni] = ng;
          cameFrom[ni] = cur;
          pushHeap(ni, ng + Math.hypot(gx - nx, gy - ny));
        }
      }
    }
    if (!found) return [[sx, sy]];

    const raw = [];
    let c = goalIdx;
    while (c !== -1) { raw.push([c % GRID, (c / GRID) | 0]); c = cameFrom[c]; }
    raw.reverse();

    const smooth = [raw[0]];
    let anchor = 0;
    while (anchor < raw.length - 1) {
      let next = anchor + 1;
      for (let test = raw.length - 1; test > anchor + 1; test--) {
        if (hasLineOfSight(nav, raw[anchor][0], raw[anchor][1], raw[test][0], raw[test][1], 2)) { next = test; break; }
      }
      smooth.push(raw[next]);
      anchor = next;
    }
    return smooth;
  }

  function appendAStarKeys(actor, nav, destPt, endT) {
    const last = actor.keys[actor.keys.length - 1];
    if (endT <= last.t + 0.05) return;
    const startT = last.t, span = Math.max(0.25, endT - startT);
    const path = astarPath(nav, [last.x, last.y], destPt);
    if (path.length <= 1) { actor.keys.push({ t: endT, x: last.x, y: last.y }); return; }

    const lens = [];
    let totalLen = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const d = Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]);
      lens.push(d); totalLen += d;
    }
    totalLen = Math.max(0.01, totalLen);
    let acc = 0;
    for (let i = 1; i < path.length; i++) {
      acc += lens[i - 1];
      actor.keys.push({ t: startT + span * (acc / totalLen), x: path[i][0], y: path[i][1] });
    }
  }

  function pickWalkableNear(nav, center, radius, rng, minDist = 2) {
    for (let tries = 0; tries < 28; tries++) {
      const ang = rng() * Math.PI * 2, r = rng() * radius;
      const tx = Math.round(center[0] + Math.cos(ang) * r);
      const ty = Math.round(center[1] + Math.sin(ang) * r);
      if (tx >= 1 && ty >= 1 && tx < GRID - 1 && ty < GRID - 1 && nav.wallDist[ty * GRID + tx] >= minDist) return [tx, ty];
    }
    return nav.snap(center[0], center[1], minDist);
  }

  // Elige posición de duelo realista según arma/rol (OP = ángulo largo; Entry = cercano; Crossfire = ángulo lateral)
  function pickTacticalAngle(nav, victimPt, killerActor, rng, nearPos = null) {
    const isLong = !!(killerActor.isOpBoost || (killerActor.aim >= 92 && killerActor.roleClass !== "Duelista"));
    const minRange = isLong ? 9 : 4;
    const maxRange = isLong ? 19 : 11;

    let bestPt = null, bestScore = -1e9;
    for (let tries = 0; tries < 42; tries++) {
      const ang = rng() * Math.PI * 2;
      const dist = minRange + rng() * (maxRange - minRange);
      const kx = Math.round(victimPt[0] + Math.cos(ang) * dist);
      const ky = Math.round(victimPt[1] + Math.sin(ang) * dist);
      if (kx < 1 || ky < 1 || kx >= GRID - 1 || ky >= GRID - 1) continue;
      if (nav.wallDist[ky * GRID + kx] < 2) continue;
      if (!hasLineOfSight(nav, kx, ky, victimPt[0], victimPt[1], 1)) continue;

      // Preferir posiciones cubiertas cerca de esquinas (wallDist 2–3) y cercanas a su posición actual
      const coverBonus = nav.wallDist[ky * GRID + kx] <= 3 ? 4 : 0;
      const proxPen = nearPos ? Math.hypot(kx - nearPos.x, ky - nearPos.y) * 0.25 : 0;
      const score = coverBonus - proxPen + rng() * 1.5;
      if (score > bestScore) { bestScore = score; bestPt = [kx, ky]; }
    }
    return bestPt || pickWalkableNear(nav, victimPt, 5, rng, 2);
  }

  function classifyRole(roleStr) {
    const r = (roleStr || "").toLowerCase();
    if (r.includes("duelista")) return "Duelista";
    if (r.includes("iniciador")) return "Iniciador";
    if (r.includes("controlador")) return "Controlador";
    if (r.includes("centinela")) return "Centinela";
    return "Flex";
  }

  // ===== ESTADO DEL VISOR =====
  let state = {
    matchRef: null, maxR: 0, roundNum: 1, plan: null,
    time: 0, playing: false, speed: 1, rafId: null, lastTs: 0,
    canvas: null, ctx: null, builtWithNav: false, pendingAutoPlay: false
  };

  function getAtkTeamIdx(M, roundNum) {
    const leftStartsAtk = !!M.leftStartsAtk;
    const ot = roundNum > 24;
    const leftIsAtk = roundNum <= 12 ? leftStartsAtk : !ot ? !leftStartsAtk : (roundNum % 2 === 1 ? leftStartsAtk : !leftStartsAtk);
    return leftIsAtk ? 0 : 1;
  }

  function sampleActorPos(actor, t) {
    const effT = Math.min(t, actor.deadAt);
    const ks = actor.keys;
    if (!ks.length) return { x: GRID / 2, y: GRID / 2, angle: -Math.PI / 2 };
    if (effT <= ks[0].t) return { x: ks[0].x, y: ks[0].y, angle: actor.isAtk ? -Math.PI / 2 : Math.PI / 2 };
    for (let i = 0; i < ks.length - 1; i++) {
      const a = ks[i], b = ks[i + 1];
      if (effT >= a.t && effT <= b.t) {
        const f = clamp((effT - a.t) / Math.max(0.001, b.t - a.t), 0, 1);
        const dx = b.x - a.x, dy = b.y - a.y;
        const angle = (Math.hypot(dx, dy) > 0.1) ? Math.atan2(dy, dx) : (actor.isAtk ? -Math.PI / 2 : Math.PI / 2);
        return { x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f), angle };
      }
    }
    const last = ks[ks.length - 1];
    const prev = ks[Math.max(0, ks.length - 2)];
    const angle = Math.hypot(last.x - prev.x, last.y - prev.y) > 0.1 ? Math.atan2(last.y - prev.y, last.x - prev.x) : (actor.isAtk ? -Math.PI / 2 : Math.PI / 2);
    return { x: last.x, y: last.y, angle };
  }

  // ===== COREOGRAFÍA TÁCTICA CON ROLES, UTILIDAD Y SENTIDO COMÚN =====
  function buildRoundChoreography(M, R, nav) {
    const seed = hashString(`${M.mapName}-${R.n}-${R.before[0]}-${R.before[1]}-${R.ev.length}-${M.teams[0].name}`);
    const rng = makeRng(seed);
    const atkTi = getAtkTeamIdx(M, R.n);
    const defTi = 1 - atkTi;

    if (!nav) {
      return {
        mapName: M.mapName, nav: null, round: R, atkTi, defTi,
        strategy: "CARGANDO", targetSite: { id: "A", pt: [GRID / 2, GRID / 2] },
        actors: {}, events: [], utilities: [], plantTime: null, defuseTime: null, duration: 6
      };
    }

    // Selección de estrategia variada según economía y mapa
    const atkEcon = R.econ ? R.econ[atkTi] : "Full";
    const strategies = atkEcon === "Eco" || atkEcon === "Pistol"
      ? ["ECO RUSH", "FAST EXECUTE", "MID SPLIT"]
      : ["DEFAULT + EXECUTE", "MID SPLIT", "FAKE & ROTATE", "FAST EXECUTE"];
    const strategy = strategies[Math.floor(rng() * strategies.length)];

    const targetSite = nav.sites[Math.floor(rng() * nav.sites.length)];
    const altSite = nav.sites.find(s => s.id !== targetSite.id) || targetSite;
    const targetChoke = targetSite.chokes[Math.floor(rng() * targetSite.chokes.length)] || targetSite.choke;
    const altChoke = altSite.chokes[Math.floor(rng() * altSite.chokes.length)] || altSite.choke;

    const actors = {};
    const utilities = [];

    for (let ti = 0; ti < 2; ti++) {
      const isAtk = ti === atkTi;
      const baseSpawn = isAtk ? nav.atkPt : nav.defPt;

      M.teams[ti].units.forEach((u, i) => {
        const id = `${ti}-${i}`;
        const roleClass = classifyRole(u.agentRole || u.p.r);
        const sp = pickWalkableNear(nav, baseSpawn, 4.5, rng, 2);

        actors[id] = {
          id, ti, isAtk, roleClass,
          name: u.p.n,
          short: u.p.n.slice(0, 2).toUpperCase(),
          agent: u.agent || "",
          aim: u.p.aim || 82,
          utilStat: u.p.util || 80,
          isOpBoost: !!u.isOpBoost,
          deadAt: Infinity,
          deathPos: null,
          keys: [{ t: 0, x: sp[0], y: sp[1] }]
        };

        // Apertura con sentido común según ROL y ESTRATEGIA
        let openAnchor;
        if (isAtk) {
          if (strategy === "ECO RUSH" || strategy === "FAST EXECUTE") {
            openAnchor = roleClass === "Centinela" ? nav.midPt : targetChoke;
          } else if (strategy === "MID SPLIT") {
            openAnchor = (roleClass === "Duelista" || roleClass === "Iniciador") ? nav.midPt
                       : roleClass === "Centinela" ? altChoke : targetChoke;
          } else if (strategy === "FAKE & ROTATE") {
            openAnchor = (roleClass === "Duelista" || roleClass === "Controlador") ? altChoke
                       : roleClass === "Centinela" ? targetChoke : nav.midPt;
          } else {
            // DEFAULT + EXECUTE
            openAnchor = roleClass === "Duelista" ? targetChoke
                       : roleClass === "Iniciador" ? targetChoke
                       : roleClass === "Controlador" ? nav.midPt
                       : roleClass === "Centinela" ? altChoke : targetChoke;
          }
        } else {
          // Defensa balanceada: ancla en cada site + control de Mid
          if (roleClass === "Centinela") openAnchor = targetSite.pt;
          else if (roleClass === "Controlador") openAnchor = altSite.pt;
          else if (roleClass === "Duelista") openAnchor = rng() < 0.55 ? nav.midPt : targetSite.choke;
          else if (roleClass === "Iniciador") openAnchor = targetSite.retake;
          else openAnchor = altSite.retake;
        }

        const openPt = pickWalkableNear(nav, openAnchor, 4.5, rng, 2);
        appendAStarKeys(actors[id], nav, openPt, strategy === "ECO RUSH" ? 1.65 : 2.15);
      });
    }

    // Utilidad táctica de apertura (Smokes en retake del site + Recon de iniciador)
    const atkCtrl = Object.values(actors).find(a => a.isAtk && a.roleClass === "Controlador");
    const atkInit = Object.values(actors).find(a => a.isAtk && a.roleClass === "Iniciador");
    if (atkCtrl) {
      const smokePt = pickWalkableNear(nav, targetSite.retake, 2.5, rng, 1);
      utilities.push({ type: "smoke", ti: atkTi, start: 2.0, end: 7.5, x: smokePt[0], y: smokePt[1], r: 6.2 });
    }
    if (atkInit) {
      const reconPt = pickWalkableNear(nav, targetSite.pt, 4, rng, 1);
      utilities.push({ type: "recon", ti: atkTi, start: 1.85, end: 2.85, x: reconPt[0], y: reconPt[1], r: 9 });
    }

    const events = [];
    let curT = strategy === "ECO RUSH" ? 1.9 : 2.4;
    let lastCombatPt = targetChoke;
    let plantTime = null;

    const atkActors = Object.values(actors).filter(a => a.isAtk);
    const planter = atkActors.find(a => a.roleClass === "Controlador")
      || atkActors.find(a => a.roleClass === "Iniciador")
      || atkActors[0];

    // Contar cuántos defensores protegen el site objetivo inicialmente
    let siteDefendersAlive = Object.values(actors).filter(a => {
      if (a.isAtk) return false;
      const last = a.keys[a.keys.length - 1];
      return Math.hypot(last.x - targetSite.pt[0], last.y - targetSite.pt[1]) < 24;
    }).length;

    R.ev.forEach((e, idx) => {
      if (idx === 0) curT += 0.35 + rng() * 0.45;
      else if (e.tr) curT += 0.38 + rng() * 0.22;
      else curT += 0.90 + rng() * 0.65;

      const killer = actors[e.k], victim = actors[e.v];
      if (!killer || !victim) return;

      // Elegir zona del enfrentamiento con sentido táctico
      let anchor;
      if (e.tr) anchor = lastCombatPt;
      else if (e.fb && strategy === "FAKE & ROTATE") anchor = altChoke;
      else if (e.fb && strategy === "MID SPLIT") anchor = nav.midPt;
      else if (e.fb) anchor = rng() < 0.7 ? targetChoke : nav.midPt;
      else if (plantTime !== null) anchor = rng() < 0.7 ? targetSite.pt : targetSite.retake;
      else if (idx <= 2) anchor = rng() < 0.55 ? targetChoke : targetSite.pt;
      else anchor = targetSite.pt;

      const vPt = pickWalkableNear(nav, anchor, 4.5, rng, 2);
      const kCur = sampleActorPos(killer, curT);
      const kPt = pickTacticalAngle(nav, vPt, killer, rng, kCur);

      appendAStarKeys(victim, nav, vPt, curT);
      appendAStarKeys(killer, nav, kPt, curT);

      // Clasificar factor táctico real del duelo (posición, utilidad, ventaja, puntería)
      const duelDist = Math.hypot(kPt[0] - vPt[0], kPt[1] - vPt[1]);
      const aliveKTeam = Object.values(actors).filter(a => a.ti === killer.ti && a.deadAt > curT).length;
      const aliveVTeam = Object.values(actors).filter(a => a.ti === victim.ti && a.deadAt > curT).length;
      let tacTag = "DUELO AIM";

      if (e.as && actors[e.as]) {
        const asAct = actors[e.as];
        const uType = (asAct.roleClass === "Iniciador" || asAct.roleClass === "Duelista") ? "flash" : "smoke";
        utilities.push({ type: uType, ti: killer.ti, start: curT - 0.35, end: uType === "flash" ? curT + 0.25 : curT + 3.2, x: vPt[0], y: vPt[1], r: uType === "flash" ? 6 : 5.5 });
        tacTag = uType === "flash" ? "FLASH + ANG" : "UTIL + ANG";
      } else if (e.tr) {
        tacTag = "CROSSFIRE";
      } else if (killer.isOpBoost && duelDist >= 11) {
        tacTag = "OP LARGO";
      } else if (aliveKTeam === 1 && aliveVTeam >= 2) {
        tacTag = `CLUTCH 1v${aliveVTeam}`;
      } else if (aliveKTeam > aliveVTeam + 1) {
        tacTag = "VENTAJA NUM.";
      } else if (duelDist >= 12) {
        tacTag = "ÁNGULO LARGO";
      }

      victim.deadAt = curT;
      victim.deathPos = { x: vPt[0], y: vPt[1] };
      lastCombatPt = vPt;

      if (!victim.isAtk && Math.hypot(vPt[0] - targetSite.pt[0], vPt[1] - targetSite.pt[1]) < 24) {
        siteDefendersAlive = Math.max(0, siteDefendersAlive - 1);
      }

      // SENTIDO COMÚN DE PLANT: solo plantar cuando el site está despejado o con ventaja clara y humo activo
      if (plantTime === null) {
        const aliveAtkNow = Object.values(actors).filter(a => a.isAtk && a.deadAt > curT + 0.55);
        const aliveDefNow = Object.values(actors).filter(a => !a.isAtk && a.deadAt > curT + 0.55);
        const siteIsClear = siteDefendersAlive === 0 || aliveDefNow.length <= 2;
        const canSafePlant = aliveAtkNow.length >= 1 && siteIsClear && (R.win === atkTi || aliveAtkNow.length >= aliveDefNow.length);

        if (canSafePlant && idx >= 1) {
          const activePlanter = aliveAtkNow.includes(planter) ? planter : aliveAtkNow[0];
          plantTime = curT + 0.65;
          appendAStarKeys(activePlanter, nav, targetSite.pt, plantTime);

          // Resto de atacantes vivos toman posiciones de cobertura post-plant en el site
          aliveAtkNow.forEach(mate => {
            if (mate !== activePlanter) {
              const coverPt = pickWalkableNear(nav, targetSite.pt, 8, rng, 2);
              appendAStarKeys(mate, nav, coverPt, plantTime + 0.4);
            }
          });
          // Defensores sobrevivientes rotan hacia el retake del site plantado
          aliveDefNow.forEach(defA => {
            const retPt = pickWalkableNear(nav, targetSite.retake, 6, rng, 2);
            appendAStarKeys(defA, nav, retPt, plantTime + 0.6);
          });
          curT = plantTime + 0.4;
        }
      }

      events.push({
        t: curT, k: e.k, v: e.v, as: e.as || null,
        fb: !!e.fb, tr: !!e.tr, tacTag,
        kPos: kPt, vPos: vPt
      });
    });

    const lastEvT = events.length ? events[events.length - 1].t : 3.6;
    let defuseTime = null;
    const endT = lastEvT + (plantTime !== null && R.win === defTi ? 2.1 : 1.3);

    const survivors = Object.values(actors).filter(a => a.deadAt === Infinity);
    survivors.forEach((a, idx) => {
      if (plantTime !== null && R.win === defTi && idx === 0) {
        defuseTime = endT - 0.3;
        appendAStarKeys(a, nav, targetSite.pt, lastEvT + 1.0);
        appendAStarKeys(a, nav, targetSite.pt, endT);
      } else {
        const destAnchor = plantTime !== null ? targetSite.pt : targetSite.retake;
        const holdPt = pickWalkableNear(nav, destAnchor, 7.5, rng, 2);
        appendAStarKeys(a, nav, holdPt, endT);
      }
    });

    return {
      mapName: M.mapName, nav, round: R, atkTi, defTi, strategy, targetSite,
      actors, events, utilities, plantTime, defuseTime, duration: Math.max(5.5, endT)
    };
  }

  function getThemeColors() {
    const cs = getComputedStyle(document.documentElement);
    const v = name => cs.getPropertyValue(name).trim();
    const isLight = document.documentElement.getAttribute("data-theme") === "light";
    const colA = v("--a") || "#E5484D";
    let colB = v("--b") || "#38BDF8";
    if (colorDist(colA, colB) < 95) colB = isLight ? "#0284C7" : "#38BDF8";
    return {
      isLight, bg: v("--bg") || (isLight ? "#F4F5F7" : "#0B0D11"),
      fg: v("--fg") || "#ECEFF4", mut: v("--mut") || "#8A94A6",
      a: colA, b: colB, gold: v("--gold") || "#EAB308",
      ok: v("--ok") || "#10B981", red: v("--vct-red") || "#E5484D", cyan: v("--vct-cyan") || "#38BDF8"
    };
  }

  function drawFrame() {
    const { canvas, ctx, plan, time } = state;
    if (!canvas || !ctx || !plan) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(280, Math.round(rect.width || 440));
    const cssH = cssW;
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.height = cssH + "px";
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    const C = getThemeColors();
    const W = cssW, H = cssH, pad = W * 0.04, size = W * 0.92;
    const sx = gx => pad + (gx / GRID) * size;
    const sy = gy => pad + (gy / GRID) * size;

    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    const mapAsset = mapAssetCache[(plan.mapName || "Ascent").toLowerCase()];
    if (!mapAsset || !mapAsset.ready || !mapAsset.img) {
      ctx.fillStyle = C.mut;
      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.textAlign = "center";
      ctx.fillText(mapAsset && mapAsset.failed ? `MINIMAPA ${plan.mapName.toUpperCase()} NO DISPONIBLE` : `CARGANDO MINIMAPA ${plan.mapName.toUpperCase()}...`, W / 2, H / 2);
      ctx.restore();
      updateHudReadout(C);
      return;
    }

    ctx.save();
    ctx.translate(W / 2, H / 2);
    if (mapAsset.rotSteps) ctx.rotate(mapAsset.rotSteps * (Math.PI / 2));
    ctx.filter = C.isLight
      ? "invert(0.88) hue-rotate(180deg) contrast(1.05) opacity(0.88)"
      : "brightness(0.88) contrast(1.12) saturate(0.85)";
    ctx.drawImage(mapAsset.img, -size / 2, -size / 2, size, size);
    ctx.restore();

    if (!plan.nav) { ctx.restore(); updateHudReadout(C); return; }

    // 1. Etiquetas de Sites
    ctx.fillStyle = C.fg;
    ctx.globalAlpha = 0.72;
    ctx.font = '700 13px "Barlow Condensed", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    plan.nav.sites.forEach(s => ctx.fillText(s.id, sx(s.pt[0]), sy(s.pt[1])));
    ctx.globalAlpha = 1;

    // 2. Utilidad activa (Smokes, Flashes, Recon)
    (plan.utilities || []).forEach(u => {
      if (time < u.start || time > u.end) return;
      const ux = sx(u.x), uy = sy(u.y), ur = (u.r / GRID) * size;
      const prog = clamp((time - u.start) / Math.max(0.1, u.end - u.start), 0, 1);

      ctx.save();
      if (u.type === "smoke") {
        ctx.fillStyle = u.ti === 0 ? "rgba(138,148,166,0.34)" : "rgba(56,189,248,0.22)";
        ctx.strokeStyle = u.ti === 0 ? C.a : C.b;
        ctx.globalAlpha = prog > 0.85 ? (1 - prog) / 0.15 : 0.85;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(ux, uy, ur, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      } else if (u.type === "flash") {
        ctx.strokeStyle = C.gold;
        ctx.fillStyle = "rgba(234,179,8,0.28)";
        ctx.globalAlpha = 1 - prog;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(ux, uy, ur * (0.4 + prog * 0.9), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      } else if (u.type === "recon") {
        ctx.strokeStyle = C.cyan;
        ctx.globalAlpha = 1 - prog;
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(ux, uy, ur * prog, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    });

    // 3. Spike plantada
    if (plan.plantTime !== null && time >= plan.plantTime) {
      const px = sx(plan.targetSite.pt[0]), py = sy(plan.targetSite.pt[1]);
      const defused = plan.defuseTime !== null && time >= plan.defuseTime;
      const pulse = ((time - plan.plantTime) * 1.4) % 1;

      if (!defused) {
        ctx.strokeStyle = C.red;
        ctx.globalAlpha = 1 - pulse;
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(px, py, 5 + pulse * 14, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = defused ? C.ok : C.red;
      ctx.fillRect(-4.5, -4.5, 9, 9);
      ctx.strokeStyle = C.bg; ctx.lineWidth = 1;
      ctx.strokeRect(-4.5, -4.5, 9, 9);
      ctx.restore();
    }

    // 4. Trazadores de duelos
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
        ctx.restore();
      }
    });

    // 5. Bajas (X)
    Object.values(plan.actors).forEach(a => {
      if (time >= a.deadAt && a.deathPos) {
        const x = sx(a.deathPos.x), y = sy(a.deathPos.y);
        ctx.save();
        ctx.strokeStyle = a.ti === 0 ? C.a : C.b;
        ctx.globalAlpha = 0.75;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(x - 3.8, y - 3.8); ctx.lineTo(x + 3.8, y + 3.8);
        ctx.moveTo(x + 3.8, y - 3.8); ctx.lineTo(x - 3.8, y + 3.8);
        ctx.stroke();
        ctx.restore();
      }
    });

    // 6. Jugadores vivos con separación validada + indicador direccional de mira
    const aliveList = Object.values(plan.actors)
      .filter(a => time < a.deadAt)
      .map(a => ({ a, pos: sampleActorPos(a, time) }));

    const isSafeCell = (x, y) => {
      const ix = Math.round(x), iy = Math.round(y);
      return ix >= 1 && iy >= 1 && ix < GRID - 1 && iy < GRID - 1 && plan.nav.wallDist[iy * GRID + ix] >= 1;
    };

    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < aliveList.length; i++) {
        for (let j = i + 1; j < aliveList.length; j++) {
          const p1 = aliveList[i].pos, p2 = aliveList[j].pos;
          const dx = p2.x - p1.x, dy = p2.y - p1.y, dist = Math.hypot(dx, dy);
          if (dist < 4.2) {
            const push = (4.2 - dist) / 2;
            const ang = dist > 0.01 ? Math.atan2(dy, dx) : (i * 1.7 + j);
            const nx1 = p1.x - Math.cos(ang) * push, ny1 = p1.y - Math.sin(ang) * push;
            const nx2 = p2.x + Math.cos(ang) * push, ny2 = p2.y + Math.sin(ang) * push;
            if (isSafeCell(nx1, ny1)) { p1.x = nx1; p1.y = ny1; }
            if (isSafeCell(nx2, ny2)) { p2.x = nx2; p2.y = ny2; }
          }
        }
      }
    }

    aliveList.forEach(({ a, pos }) => {
      const x = sx(pos.x), y = sy(pos.y), col = a.ti === 0 ? C.a : C.b;
      // Cono sutil de dirección / ángulo que sostiene
      ctx.save();
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.22;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, 16, pos.angle - 0.36, pos.angle + 0.36);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = C.bg; ctx.lineWidth = 1.5; ctx.stroke();

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

    let phaseTxt = `${plan.strategy} · SITE ${plan.targetSite.id}`, phaseCls = "mut";
    if (time >= plan.duration - 0.05) {
      phaseTxt = `RONDA PARA ${state.matchRef.teams[plan.round.win].name.toUpperCase()}`;
      phaseCls = plan.round.win === 0 ? "ca" : "cb";
    } else if (plan.defuseTime !== null && time >= plan.defuseTime) {
      phaseTxt = "SPIKE DESACTIVADA"; phaseCls = "kd-pos";
    } else if (plan.plantTime !== null && time >= plan.plantTime) {
      phaseTxt = `SPIKE PLANTADA · SITE ${plan.targetSite.id}`; phaseCls = "kd-neg";
    } else if (time >= 2.2) {
      phaseTxt = `${plan.strategy} → SITE ${plan.targetSite.id}`; phaseCls = "stat-elite";
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
        ? `<span class="mut">Plan atacante: ${esc(plan.strategy)} · Desplegando utilidad de apertura.</span>`
        : happened.slice(-3).map(e => {
            const ka = plan.actors[e.k], va = plan.actors[e.v];
            return `<div class="r2d-feed-row">
              <span class="mut">${e.t.toFixed(1)}s</span>
              <b style="color:${ka.ti ? C.b : C.a}">${esc(ka.name)}</b>
              <span>→</span>
              <span style="color:${va.ti ? C.b : C.a}">${esc(va.name)}</span>
              ${e.fb ? '<span class="k-tag k-fb">FB</span>' : ""}
              ${e.tr ? '<span class="k-tag k-tr">TR</span>' : ""}
              <span class="econ-pill" style="margin-left:auto;font-size:9px">${esc(e.tacTag || "DUELO")}</span>
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
    if (!state.plan || !state.builtWithNav) return;
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
    state.pendingAutoPlay = !!autoPlay;
    const targetMatch = state.matchRef;
    const R = targetMatch.rounds[state.roundNum - 1];
    if (!R) return;

    const mapAsset = getMapAsset(targetMatch.mapName, () => {
      if (state.matchRef === targetMatch && !state.builtWithNav) {
        loadRound(state.roundNum, state.pendingAutoPlay);
      }
    });

    state.builtWithNav = !!(mapAsset && mapAsset.ready && mapAsset.nav);
    state.plan = buildRoundChoreography(targetMatch, R, state.builtWithNav ? mapAsset.nav : null);
    state.time = autoPlay ? 0 : state.plan.duration;
    renderShell();
    if (autoPlay && state.builtWithNav) startLoop();
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