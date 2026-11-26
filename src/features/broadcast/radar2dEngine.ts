import type { MatchResult, RoleName, RoundResult } from "../../core/index.ts";

export const GRID = 96;

type Point2D = [number, number];

interface ApiCallout {
  regionName?: string;
  superRegionName?: string;
  location?: { x: number; y: number };
}

interface ApiMapMeta {
  url: string;
  xMultiplier: number;
  yMultiplier: number;
  xScalarToAdd: number;
  yScalarToAdd: number;
  callouts: ApiCallout[];
}

export interface NavSite {
  id: string;
  pt: Point2D;
  chokes: Point2D[];
  choke: Point2D;
  retakes: Point2D[];
  retake: Point2D;
}

export interface NavMesh {
  walk: Uint8Array;
  wallDist: Int16Array;
  sites: NavSite[];
  atkPt: Point2D;
  defPt: Point2D;
  midPt: Point2D;
  snap: (gx: number, gy: number, minDist?: number) => Point2D;
}

export interface MapAssetEntry {
  img: HTMLImageElement | null;
  rotSteps: number;
  nav: NavMesh | null;
  ready: boolean;
  failed: boolean;
  listeners: Array<(entry: MapAssetEntry) => void>;
}

export interface ActorKey {
  t: number;
  x: number;
  y: number;
}

export interface RadarActor {
  id: string;
  ti: 0 | 1;
  isAtk: boolean;
  roleClass: RoleName;
  name: string;
  short: string;
  agent: string;
  aim: number;
  utilStat: number;
  isOpBoost: boolean;
  deadAt: number;
  deathPos: { x: number; y: number } | null;
  keys: ActorKey[];
}

export interface RadarUtility {
  type: "smoke" | "flash" | "recon";
  ti: 0 | 1;
  start: number;
  end: number;
  x: number;
  y: number;
  r: number;
}

export interface RadarEvent {
  t: number;
  k: string;
  v: string;
  as: string | null;
  fb: boolean;
  tr: boolean;
  tacTag: string;
  kPos: Point2D;
  vPos: Point2D;
}

export interface RoundPlan {
  mapName: string;
  nav: NavMesh | null;
  round: RoundResult;
  atkTi: 0 | 1;
  defTi: 0 | 1;
  strategy: string;
  targetSite: { id: string; pt: Point2D };
  actors: Record<string, RadarActor>;
  events: RadarEvent[];
  utilities: RadarUtility[];
  plantTime: number | null;
  defuseTime: number | null;
  duration: number;
}

export interface RadarThemeColors {
  isLight: boolean;
  bg: string;
  fg: string;
  mut: string;
  a: string;
  b: string;
  gold: string;
  ok: string;
  red: string;
  cyan: string;
}

function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function parseHexRgb(color: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec((color || "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function colorDist(c1: string, c2: string): number {
  const a = parseHexRgb(c1);
  const b = parseHexRgb(c2);
  if (!a || !b) return 200;
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function rotateUV(u: number, v: number, k: number): Point2D {
  const step = ((k % 4) + 4) % 4;
  if (step === 1) return [1 - v, u];
  if (step === 2) return [1 - u, 1 - v];
  if (step === 3) return [v, 1 - u];
  return [u, v];
}

function detectMapRotationSteps(apiMeta: ApiMapMeta | null): number {
  if (!apiMeta || !Array.isArray(apiMeta.callouts) || !apiMeta.xMultiplier) return 0;
  const rawUV = (loc: { x: number; y: number }): Point2D => [
    loc.y * apiMeta.xMultiplier + apiMeta.xScalarToAdd,
    loc.x * apiMeta.yMultiplier + apiMeta.yScalarToAdd
  ];
  const avg = (list: Point2D[]): Point2D | null =>
    !list.length
      ? null
      : [
          list.reduce((s, p) => s + p[0], 0) / list.length,
          list.reduce((s, p) => s + p[1], 0) / list.length
        ];

  const atkPts: Point2D[] = [];
  const defPts: Point2D[] = [];
  const siteA: Point2D[] = [];
  const siteOther: Point2D[] = [];

  apiMeta.callouts.forEach((co) => {
    if (!co.location) return;
    const uv = rawUV(co.location);
    const reg = (co.regionName || "").toLowerCase();
    const sup = (co.superRegionName || "").toUpperCase();
    if (sup.includes("ATTACKER") || reg.includes("attacker")) atkPts.push(uv);
    else if (sup.includes("DEFENDER") || reg.includes("defender")) defPts.push(uv);
    else if (reg === "site" && sup === "A") siteA.push(uv);
    else if (reg === "site" && (sup === "B" || sup === "C")) siteOther.push(uv);
  });

  const atk = avg(atkPts);
  const def = avg(defPts);
  if (atk && def && Math.hypot(atk[0] - def[0], atk[1] - def[1]) >= 0.14) {
    const dx = atk[0] - def[0];
    const dy = atk[1] - def[1];
    const scores = [dy, dx, -dy, -dx];
    let bestK = 0;
    for (let k = 1; k < 4; k++) if (scores[k] > scores[bestK]) bestK = k;
    return bestK;
  }

  const aPt = avg(siteA);
  const oPt = avg(siteOther);
  if (aPt && oPt) {
    const sdx = aPt[0] - oPt[0];
    const sdy = aPt[1] - oPt[1];
    const scores = [sdx, -sdy, -sdx, sdy];
    let bestK = 0;
    for (let k = 1; k < 4; k++) if (scores[k] > scores[bestK]) bestK = k;
    return bestK;
  }
  return 0;
}

const mapAssetCache: Record<string, MapAssetEntry> = {};
let apiMapsPromise: Promise<Record<string, ApiMapMeta>> | null = null;

function fetchApiMaps(): Promise<Record<string, ApiMapMeta>> {
  if (!apiMapsPromise) {
    apiMapsPromise = fetch("https://valorant-api.com/v1/maps")
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { data?: Array<Record<string, unknown>> } | null) => {
        const dict: Record<string, ApiMapMeta> = {};
        if (json && Array.isArray(json.data)) {
          json.data.forEach((m) => {
            const name = typeof m.displayName === "string" ? m.displayName : "";
            const icon = typeof m.displayIcon === "string" ? m.displayIcon : "";
            if (name && icon) {
              dict[name.toLowerCase()] = {
                url: icon,
                xMultiplier: Number(m.xMultiplier) || 0,
                yMultiplier: Number(m.yMultiplier) || 0,
                xScalarToAdd: Number(m.xScalarToAdd) || 0,
                yScalarToAdd: Number(m.yScalarToAdd) || 0,
                callouts: Array.isArray(m.callouts) ? (m.callouts as ApiCallout[]) : []
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

function buildNavFromImage(
  im: HTMLImageElement,
  rotSteps: number,
  apiMeta: ApiMapMeta | null
): NavMesh | null {
  const off = document.createElement("canvas");
  off.width = GRID;
  off.height = GRID;
  const octx = off.getContext("2d", { willReadFrequently: true });
  if (!octx) return null;

  octx.clearRect(0, 0, GRID, GRID);
  octx.save();
  octx.translate(GRID / 2, GRID / 2);
  if (rotSteps) octx.rotate(rotSteps * (Math.PI / 2));
  octx.drawImage(im, -GRID / 2, -GRID / 2, GRID, GRID);
  octx.restore();

  let imgData: Uint8ClampedArray;
  try {
    imgData = octx.getImageData(0, 0, GRID, GRID).data;
  } catch {
    return null;
  }

  const total = GRID * GRID;
  const rawWalk = new Uint8Array(total);

  for (let i = 0; i < total; i++) {
    const r = imgData[i * 4];
    const g = imgData[i * 4 + 1];
    const b = imgData[i * 4 + 2];
    const a = imgData[i * 4 + 3];
    if (a > 110) {
      const isTpLine = g > r + 40 && g > b + 15 && r < 70;
      if (!isTpLine) rawWalk[i] = 1;
    }
  }

  const visited = new Uint8Array(total);
  let bestComp: number[] = [];
  const dirs4: readonly Point2D[] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];

  for (let i = 0; i < total; i++) {
    if (!rawWalk[i] || visited[i]) continue;
    const comp: number[] = [];
    const stack: number[] = [i];
    visited[i] = 1;
    while (stack.length) {
      const cur = stack.pop()!;
      comp.push(cur);
      const cx = cur % GRID;
      const cy = (cur / GRID) | 0;
      for (const [dx, dy] of dirs4) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
        const ni = ny * GRID + nx;
        if (rawWalk[ni] && !visited[ni]) {
          visited[ni] = 1;
          stack.push(ni);
        }
      }
    }
    if (comp.length > bestComp.length) bestComp = comp;
  }

  const walk = new Uint8Array(total);
  bestComp.forEach((idx) => {
    walk[idx] = 1;
  });

  const wallDist = new Int16Array(total);
  wallDist.fill(-1);
  const q = new Int32Array(total);
  let qh = 0;
  let qt = 0;
  for (let i = 0; i < total; i++) {
    if (!walk[i]) {
      wallDist[i] = 0;
      q[qt++] = i;
    }
  }
  while (qh < qt) {
    const cur = q[qh++];
    const d = wallDist[cur];
    const cx = cur % GRID;
    const cy = (cur / GRID) | 0;
    for (const [dx, dy] of dirs4) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
      const ni = ny * GRID + nx;
      if (wallDist[ni] === -1) {
        wallDist[ni] = d + 1;
        q[qt++] = ni;
      }
    }
  }

  const snap = (gx: number, gy: number, minDist = 2): Point2D => {
    const x0 = clamp(Math.round(gx), 1, GRID - 2);
    const y0 = clamp(Math.round(gy), 1, GRID - 2);
    if (walk[y0 * GRID + x0] && wallDist[y0 * GRID + x0] >= minDist) return [x0, y0];
    let best: Point2D | null = null;
    let bestD2 = Infinity;
    for (let rad = 1; rad <= 24; rad++) {
      for (let dy = -rad; dy <= rad; dy++) {
        for (let dx = -rad; dx <= rad; dx++) {
          if (Math.abs(dx) !== rad && Math.abs(dy) !== rad) continue;
          const nx = x0 + dx;
          const ny = y0 + dy;
          if (nx < 1 || ny < 1 || nx >= GRID - 1 || ny >= GRID - 1) continue;
          const ni = ny * GRID + nx;
          if (walk[ni] && wallDist[ni] >= minDist) {
            const d2 = dx * dx + dy * dy;
            if (d2 < bestD2) {
              bestD2 = d2;
              best = [nx, ny];
            }
          }
        }
      }
      if (best) return best;
    }
    if (minDist > 1) return snap(gx, gy, 1);
    const fb =
      bestComp[Math.floor(bestComp.length / 2)] ||
      Math.floor(GRID / 2) * GRID + Math.floor(GRID / 2);
    return [fb % GRID, (fb / GRID) | 0];
  };

  const rawSites: Array<{ id: string; pt: Point2D }> = [];
  let atkPt: Point2D | null = null;
  let defPt: Point2D | null = null;
  let midPt: Point2D | null = null;
  const chokesBySite: Record<string, Point2D[]> = { A: [], B: [], C: [] };
  const retakesBySite: Record<string, Point2D[]> = { A: [], B: [], C: [] };

  if (apiMeta && apiMeta.callouts.length && apiMeta.xMultiplier) {
    const toGrid = (loc: { x: number; y: number }): Point2D => {
      const u = loc.y * apiMeta.xMultiplier + apiMeta.xScalarToAdd;
      const v = loc.x * apiMeta.yMultiplier + apiMeta.yScalarToAdd;
      const [rx, ry] = rotateUV(u, v, rotSteps);
      return [rx * GRID, ry * GRID];
    };
    const atkAcc: Point2D[] = [];
    const defAcc: Point2D[] = [];
    const midAcc: Point2D[] = [];

    apiMeta.callouts.forEach((co) => {
      if (!co.location) return;
      const [gx, gy] = toGrid(co.location);
      const pt = snap(gx, gy, 2);
      const reg = (co.regionName || "").toLowerCase();
      const sup = (co.superRegionName || "").toUpperCase();
      if (reg === "site" && (sup === "A" || sup === "B" || sup === "C")) {
        rawSites.push({ id: sup, pt });
      } else if (sup.includes("ATTACKER") || reg.includes("attacker")) {
        atkAcc.push(pt);
      } else if (sup.includes("DEFENDER") || reg.includes("defender")) {
        defAcc.push(pt);
      } else if (sup === "MID" || reg.includes("mid")) {
        midAcc.push(pt);
      } else if (sup === "A" || sup === "B" || sup === "C") {
        if (
          reg.includes("main") ||
          reg.includes("long") ||
          reg.includes("short") ||
          reg.includes("lobby") ||
          reg.includes("cave") ||
          reg.includes("rubble") ||
          reg.includes("mound") ||
          reg.includes("window") ||
          reg.includes("hookah") ||
          reg.includes("showers") ||
          reg.includes("bath") ||
          reg.includes("garage") ||
          reg.includes("elbow")
        ) {
          chokesBySite[sup].push(pt);
        } else {
          retakesBySite[sup].push(pt);
        }
      }
    });

    const avgSnap = (arr: Point2D[]): Point2D | null =>
      !arr.length
        ? null
        : snap(
            arr.reduce((s, p) => s + p[0], 0) / arr.length,
            arr.reduce((s, p) => s + p[1], 0) / arr.length,
            2
          );
    atkPt = avgSnap(atkAcc);
    defPt = avgSnap(defAcc);
    midPt = avgSnap(midAcc);
  }

  if (!atkPt || !defPt) {
    let minY = GRID;
    let maxY = 0;
    bestComp.forEach((idx) => {
      const y = (idx / GRID) | 0;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });
    const topPts: Point2D[] = [];
    const botPts: Point2D[] = [];
    bestComp.forEach((idx) => {
      const x = idx % GRID;
      const y = (idx / GRID) | 0;
      if (wallDist[idx] < 2) return;
      if (y <= minY + 10) topPts.push([x, y]);
      if (y >= maxY - 10) botPts.push([x, y]);
    });
    if (!defPt && topPts.length) {
      defPt = snap(
        topPts.reduce((s, p) => s + p[0], 0) / topPts.length,
        topPts.reduce((s, p) => s + p[1], 0) / topPts.length,
        2
      );
    }
    if (!atkPt && botPts.length) {
      atkPt = snap(
        botPts.reduce((s, p) => s + p[0], 0) / botPts.length,
        botPts.reduce((s, p) => s + p[1], 0) / botPts.length,
        2
      );
    }
  }

  const finalAtk = atkPt ?? snap(GRID * 0.5, GRID * 0.84, 2);
  const finalDef = defPt ?? snap(GRID * 0.5, GRID * 0.16, 2);
  const finalMid = midPt ?? snap(GRID / 2, GRID / 2, 2);

  if (!rawSites.length) {
    rawSites.push({ id: "B", pt: snap(GRID * 0.24, GRID * 0.36, 2) });
    rawSites.push({ id: "A", pt: snap(GRID * 0.78, GRID * 0.36, 2) });
  }

  const sites: NavSite[] = rawSites.map((s) => {
    const chList = chokesBySite[s.id] || [];
    const rtList = retakesBySite[s.id] || [];
    const chokes: Point2D[] = chList.length
      ? chList
      : [snap(lerp(s.pt[0], finalAtk[0], 0.38), lerp(s.pt[1], finalAtk[1], 0.38), 2)];
    const retakes: Point2D[] = rtList.length
      ? rtList
      : [snap(lerp(s.pt[0], finalDef[0], 0.36), lerp(s.pt[1], finalDef[1], 0.36), 2)];
    return {
      id: s.id,
      pt: s.pt,
      chokes,
      choke: chokes[0],
      retakes,
      retake: retakes[0]
    };
  });

  return { walk, wallDist, sites, atkPt: finalAtk, defPt: finalDef, midPt: finalMid, snap };
}

export function getCachedMapAsset(mapName: string): MapAssetEntry | undefined {
  return mapAssetCache[(mapName || "Ascent").toLowerCase()];
}

export function subscribeMapAsset(
  mapName: string,
  onReady: (entry: MapAssetEntry) => void
): { entry: MapAssetEntry; unsubscribe: () => void } {
  const key = (mapName || "Ascent").toLowerCase();
  if (mapAssetCache[key]) {
    const existing = mapAssetCache[key];
    if (!existing.ready && !existing.failed) {
      existing.listeners.push(onReady);
    }
    return {
      entry: existing,
      unsubscribe: () => {
        existing.listeners = existing.listeners.filter((fn) => fn !== onReady);
      }
    };
  }

  const entry: MapAssetEntry = {
    img: null,
    rotSteps: 0,
    nav: null,
    ready: false,
    failed: false,
    listeners: [onReady]
  };
  mapAssetCache[key] = entry;

  const notify = () => {
    const list = entry.listeners.splice(0, entry.listeners.length);
    list.forEach((fn) => {
      try {
        fn(entry);
      } catch {
        // noop
      }
    });
  };

  fetchApiMaps().then((dict) => {
    const meta = dict[key];
    if (!meta || !meta.url) {
      entry.failed = true;
      notify();
      return;
    }
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
    im.onerror = () => {
      entry.failed = true;
      notify();
    };
    im.src = meta.url;
  });

  return {
    entry,
    unsubscribe: () => {
      entry.listeners = entry.listeners.filter((fn) => fn !== onReady);
    }
  };
}

function hasLineOfSight(
  nav: NavMesh,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  minDist = 1
): boolean {
  let ix0 = Math.round(x0);
  let iy0 = Math.round(y0);
  const ix1 = Math.round(x1);
  const iy1 = Math.round(y1);
  const dx = Math.abs(ix1 - ix0);
  const dy = Math.abs(iy1 - iy0);
  const sx = ix0 < ix1 ? 1 : -1;
  const sy = iy0 < iy1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    if (ix0 < 0 || iy0 < 0 || ix0 >= GRID || iy0 >= GRID) return false;
    if (nav.wallDist[iy0 * GRID + ix0] < minDist) return false;
    if (ix0 === ix1 && iy0 === iy1) return true;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      ix0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      iy0 += sy;
    }
  }
}

function astarPath(nav: NavMesh, startPt: Point2D, endPt: Point2D): Point2D[] {
  const sx = clamp(Math.round(startPt[0]), 0, GRID - 1);
  const sy = clamp(Math.round(startPt[1]), 0, GRID - 1);
  const gx = clamp(Math.round(endPt[0]), 0, GRID - 1);
  const gy = clamp(Math.round(endPt[1]), 0, GRID - 1);
  const startIdx = sy * GRID + sx;
  const goalIdx = gy * GRID + gx;
  if (startIdx === goalIdx) return [[sx, sy]];

  const total = GRID * GRID;
  const gScore = new Float32Array(total);
  gScore.fill(1e9);
  const cameFrom = new Int32Array(total);
  cameFrom.fill(-1);
  const closed = new Uint8Array(total);
  const heapIdx: number[] = [];
  const heapF: number[] = [];

  const pushHeap = (idx: number, f: number) => {
    let i = heapIdx.length;
    heapIdx.push(idx);
    heapF.push(f);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heapF[p] <= heapF[i]) break;
      [heapIdx[p], heapIdx[i]] = [heapIdx[i], heapIdx[p]];
      [heapF[p], heapF[i]] = [heapF[i], heapF[p]];
      i = p;
    }
  };

  const popHeap = (): number => {
    const top = heapIdx[0];
    const lastI = heapIdx.pop()!;
    const lastF = heapF.pop()!;
    if (heapIdx.length) {
      heapIdx[0] = lastI;
      heapF[0] = lastF;
      let i = 0;
      const len = heapIdx.length;
      while (true) {
        const l = (i << 1) + 1;
        const r = l + 1;
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

  const dirs8: readonly [number, number, number][] = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, 1.414],
    [-1, 1, 1.414],
    [1, -1, 1.414],
    [-1, -1, 1.414]
  ];

  gScore[startIdx] = 0;
  pushHeap(startIdx, Math.hypot(gx - sx, gy - sy));

  let found = false;
  while (heapIdx.length) {
    const cur = popHeap();
    if (cur === goalIdx) {
      found = true;
      break;
    }
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % GRID;
    const cy = (cur / GRID) | 0;
    const cg = gScore[cur];

    for (let d = 0; d < 8; d++) {
      const [dx, dy, stepC] = dirs8[d];
      const nx = cx + dx;
      const ny = cy + dy;
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

  const raw: Point2D[] = [];
  let c = goalIdx;
  while (c !== -1) {
    raw.push([c % GRID, (c / GRID) | 0]);
    c = cameFrom[c];
  }
  raw.reverse();

  const smooth: Point2D[] = [raw[0]];
  let anchor = 0;
  while (anchor < raw.length - 1) {
    let next = anchor + 1;
    for (let test = raw.length - 1; test > anchor + 1; test--) {
      if (hasLineOfSight(nav, raw[anchor][0], raw[anchor][1], raw[test][0], raw[test][1], 2)) {
        next = test;
        break;
      }
    }
    smooth.push(raw[next]);
    anchor = next;
  }
  return smooth;
}

function appendAStarKeys(actor: RadarActor, nav: NavMesh, destPt: Point2D, endT: number): void {
  const last = actor.keys[actor.keys.length - 1];
  if (endT <= last.t + 0.05) return;
  const startT = last.t;
  const span = Math.max(0.25, endT - startT);
  const path = astarPath(nav, [last.x, last.y], destPt);
  if (path.length <= 1) {
    actor.keys.push({ t: endT, x: last.x, y: last.y });
    return;
  }

  const lens: number[] = [];
  let totalLen = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const d = Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]);
    lens.push(d);
    totalLen += d;
  }
  totalLen = Math.max(0.01, totalLen);
  let acc = 0;
  for (let i = 1; i < path.length; i++) {
    acc += lens[i - 1];
    actor.keys.push({ t: startT + span * (acc / totalLen), x: path[i][0], y: path[i][1] });
  }
}

function pickWalkableNear(
  nav: NavMesh,
  center: Point2D,
  radius: number,
  rng: () => number,
  minDist = 2
): Point2D {
  for (let tries = 0; tries < 28; tries++) {
    const ang = rng() * Math.PI * 2;
    const r = rng() * radius;
    const tx = Math.round(center[0] + Math.cos(ang) * r);
    const ty = Math.round(center[1] + Math.sin(ang) * r);
    if (
      tx >= 1 &&
      ty >= 1 &&
      tx < GRID - 1 &&
      ty < GRID - 1 &&
      nav.wallDist[ty * GRID + tx] >= minDist
    ) {
      return [tx, ty];
    }
  }
  return nav.snap(center[0], center[1], minDist);
}

function pickTacticalAngle(
  nav: NavMesh,
  victimPt: Point2D,
  killerActor: RadarActor,
  rng: () => number,
  nearPos: { x: number; y: number } | null = null
): Point2D {
  const isLong = Boolean(
    killerActor.isOpBoost || (killerActor.aim >= 92 && killerActor.roleClass !== "Duelista")
  );
  const minRange = isLong ? 9 : 4;
  const maxRange = isLong ? 19 : 11;

  let bestPt: Point2D | null = null;
  let bestScore = -1e9;
  for (let tries = 0; tries < 42; tries++) {
    const ang = rng() * Math.PI * 2;
    const dist = minRange + rng() * (maxRange - minRange);
    const kx = Math.round(victimPt[0] + Math.cos(ang) * dist);
    const ky = Math.round(victimPt[1] + Math.sin(ang) * dist);
    if (kx < 1 || ky < 1 || kx >= GRID - 1 || ky >= GRID - 1) continue;
    if (nav.wallDist[ky * GRID + kx] < 2) continue;
    if (!hasLineOfSight(nav, kx, ky, victimPt[0], victimPt[1], 1)) continue;

    const coverBonus = nav.wallDist[ky * GRID + kx] <= 3 ? 4 : 0;
    const proxPen = nearPos ? Math.hypot(kx - nearPos.x, ky - nearPos.y) * 0.25 : 0;
    const score = coverBonus - proxPen + rng() * 1.5;
    if (score > bestScore) {
      bestScore = score;
      bestPt = [kx, ky];
    }
  }
  return bestPt || pickWalkableNear(nav, victimPt, 5, rng, 2);
}

function classifyRole(roleStr: string): RoleName {
  const r = (roleStr || "").toLowerCase();
  if (r.includes("duelista")) return "Duelista";
  if (r.includes("iniciador")) return "Iniciador";
  if (r.includes("controlador")) return "Controlador";
  if (r.includes("centinela")) return "Centinela";
  return "Flex";
}

function getAtkTeamIdx(M: MatchResult, roundNum: number): 0 | 1 {
  const leftStartsAtk = Boolean(M.leftStartsAtk);
  const ot = roundNum > 24;
  const leftIsAtk =
    roundNum <= 12
      ? leftStartsAtk
      : !ot
        ? !leftStartsAtk
        : roundNum % 2 === 1
          ? leftStartsAtk
          : !leftStartsAtk;
  return leftIsAtk ? 0 : 1;
}

export function sampleActorPos(
  actor: RadarActor,
  t: number
): { x: number; y: number; angle: number } {
  const effT = Math.min(t, actor.deadAt);
  const ks = actor.keys;
  if (!ks.length) return { x: GRID / 2, y: GRID / 2, angle: -Math.PI / 2 };
  if (effT <= ks[0].t) {
    return { x: ks[0].x, y: ks[0].y, angle: actor.isAtk ? -Math.PI / 2 : Math.PI / 2 };
  }
  for (let i = 0; i < ks.length - 1; i++) {
    const a = ks[i];
    const b = ks[i + 1];
    if (effT >= a.t && effT <= b.t) {
      const f = clamp((effT - a.t) / Math.max(0.001, b.t - a.t), 0, 1);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const angle =
        Math.hypot(dx, dy) > 0.1 ? Math.atan2(dy, dx) : actor.isAtk ? -Math.PI / 2 : Math.PI / 2;
      return { x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f), angle };
    }
  }
  const last = ks[ks.length - 1];
  const prev = ks[Math.max(0, ks.length - 2)];
  const angle =
    Math.hypot(last.x - prev.x, last.y - prev.y) > 0.1
      ? Math.atan2(last.y - prev.y, last.x - prev.x)
      : actor.isAtk
        ? -Math.PI / 2
        : Math.PI / 2;
  return { x: last.x, y: last.y, angle };
}

export function buildRoundChoreography(
  M: MatchResult,
  R: RoundResult,
  nav: NavMesh | null
): RoundPlan {
  const seed = hashString(
    `${M.mapName}-${R.n}-${R.before[0]}-${R.before[1]}-${R.ev.length}-${M.teams[0].name}`
  );
  const rng = makeRng(seed);
  const atkTi = getAtkTeamIdx(M, R.n);
  const defTi: 0 | 1 = atkTi === 0 ? 1 : 0;

  if (!nav) {
    return {
      mapName: M.mapName,
      nav: null,
      round: R,
      atkTi,
      defTi,
      strategy: "CARGANDO",
      targetSite: { id: "A", pt: [GRID / 2, GRID / 2] },
      actors: {},
      events: [],
      utilities: [],
      plantTime: null,
      defuseTime: null,
      duration: 6
    };
  }

  const atkEcon = R.econ ? R.econ[atkTi] : "Full";
  const strategies =
    atkEcon === "Eco" || atkEcon === "Pistol"
      ? ["ECO RUSH", "FAST EXECUTE", "MID SPLIT"]
      : ["DEFAULT + EXECUTE", "MID SPLIT", "FAKE & ROTATE", "FAST EXECUTE"];
  const strategy = strategies[Math.floor(rng() * strategies.length)];

  const targetSite = nav.sites[Math.floor(rng() * nav.sites.length)];
  const altSite = nav.sites.find((s) => s.id !== targetSite.id) || targetSite;
  const targetChoke =
    targetSite.chokes[Math.floor(rng() * targetSite.chokes.length)] || targetSite.choke;
  const altChoke = altSite.chokes[Math.floor(rng() * altSite.chokes.length)] || altSite.choke;

  const actors: Record<string, RadarActor> = {};
  const utilities: RadarUtility[] = [];

  for (const ti of [0, 1] as const) {
    const isAtk = ti === atkTi;
    const baseSpawn = isAtk ? nav.atkPt : nav.defPt;

    M.teams[ti].units.forEach((u, i) => {
      const id = `${ti}-${i}`;
      const roleClass = classifyRole(u.agentRole || u.p.r);
      const sp = pickWalkableNear(nav, baseSpawn, 4.5, rng, 2);

      actors[id] = {
        id,
        ti,
        isAtk,
        roleClass,
        name: u.p.n,
        short: u.p.n.slice(0, 2).toUpperCase(),
        agent: u.agent || "",
        aim: u.p.aim || 82,
        utilStat: u.p.util || 80,
        isOpBoost: Boolean(u.isOpBoost),
        deadAt: Infinity,
        deathPos: null,
        keys: [{ t: 0, x: sp[0], y: sp[1] }]
      };

      let openAnchor: Point2D;
      if (isAtk) {
        if (strategy === "ECO RUSH" || strategy === "FAST EXECUTE") {
          openAnchor = roleClass === "Centinela" ? nav.midPt : targetChoke;
        } else if (strategy === "MID SPLIT") {
          openAnchor =
            roleClass === "Duelista" || roleClass === "Iniciador"
              ? nav.midPt
              : roleClass === "Centinela"
                ? altChoke
                : targetChoke;
        } else if (strategy === "FAKE & ROTATE") {
          openAnchor =
            roleClass === "Duelista" || roleClass === "Controlador"
              ? altChoke
              : roleClass === "Centinela"
                ? targetChoke
                : nav.midPt;
        } else {
          openAnchor =
            roleClass === "Duelista" || roleClass === "Iniciador"
              ? targetChoke
              : roleClass === "Controlador"
                ? nav.midPt
                : roleClass === "Centinela"
                  ? altChoke
                  : targetChoke;
        }
      } else {
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

  const atkCtrl = Object.values(actors).find((a) => a.isAtk && a.roleClass === "Controlador");
  const atkInit = Object.values(actors).find((a) => a.isAtk && a.roleClass === "Iniciador");
  if (atkCtrl) {
    const smokePt = pickWalkableNear(nav, targetSite.retake, 2.5, rng, 1);
    utilities.push({
      type: "smoke",
      ti: atkTi,
      start: 2.0,
      end: 7.5,
      x: smokePt[0],
      y: smokePt[1],
      r: 6.2
    });
  }
  if (atkInit) {
    const reconPt = pickWalkableNear(nav, targetSite.pt, 4, rng, 1);
    utilities.push({
      type: "recon",
      ti: atkTi,
      start: 1.85,
      end: 2.85,
      x: reconPt[0],
      y: reconPt[1],
      r: 9
    });
  }

  const events: RadarEvent[] = [];
  let curT = strategy === "ECO RUSH" ? 1.9 : 2.4;
  let lastCombatPt: Point2D = targetChoke;
  let plantTime: number | null = null;

  const atkActors = Object.values(actors).filter((a) => a.isAtk);
  const planter =
    atkActors.find((a) => a.roleClass === "Controlador") ||
    atkActors.find((a) => a.roleClass === "Iniciador") ||
    atkActors[0];

  let siteDefendersAlive = Object.values(actors).filter((a) => {
    if (a.isAtk) return false;
    const last = a.keys[a.keys.length - 1];
    return Math.hypot(last.x - targetSite.pt[0], last.y - targetSite.pt[1]) < 24;
  }).length;

  R.ev.forEach((e, idx) => {
    if (idx === 0) curT += 0.35 + rng() * 0.45;
    else if (e.tr) curT += 0.38 + rng() * 0.22;
    else curT += 0.9 + rng() * 0.65;

    const killer = actors[e.k];
    const victim = actors[e.v];
    if (!killer || !victim) return;

    let anchor: Point2D;
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

    const duelDist = Math.hypot(kPt[0] - vPt[0], kPt[1] - vPt[1]);
    const aliveKTeam = Object.values(actors).filter((a) => a.ti === killer.ti && a.deadAt > curT).length;
    const aliveVTeam = Object.values(actors).filter((a) => a.ti === victim.ti && a.deadAt > curT).length;
    let tacTag = "DUELO AIM";

    if (e.as && actors[e.as]) {
      const asAct = actors[e.as];
      const uType: "flash" | "smoke" =
        asAct.roleClass === "Iniciador" || asAct.roleClass === "Duelista" ? "flash" : "smoke";
      utilities.push({
        type: uType,
        ti: killer.ti,
        start: curT - 0.35,
        end: uType === "flash" ? curT + 0.25 : curT + 3.2,
        x: vPt[0],
        y: vPt[1],
        r: uType === "flash" ? 6 : 5.5
      });
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

    if (plantTime === null) {
      const aliveAtkNow = Object.values(actors).filter((a) => a.isAtk && a.deadAt > curT + 0.55);
      const aliveDefNow = Object.values(actors).filter((a) => !a.isAtk && a.deadAt > curT + 0.55);
      const siteIsClear = siteDefendersAlive === 0 || aliveDefNow.length <= 2;
      const canSafePlant =
        aliveAtkNow.length >= 1 &&
        siteIsClear &&
        (R.win === atkTi || aliveAtkNow.length >= aliveDefNow.length);

      if (canSafePlant && idx >= 1) {
        const activePlanter = aliveAtkNow.includes(planter) ? planter : aliveAtkNow[0];
        plantTime = curT + 0.65;
        appendAStarKeys(activePlanter, nav, targetSite.pt, plantTime);

        aliveAtkNow.forEach((mate) => {
          if (mate !== activePlanter) {
            const coverPt = pickWalkableNear(nav, targetSite.pt, 8, rng, 2);
            appendAStarKeys(mate, nav, coverPt, plantTime! + 0.4);
          }
        });
        aliveDefNow.forEach((defA) => {
          const retPt = pickWalkableNear(nav, targetSite.retake, 6, rng, 2);
          appendAStarKeys(defA, nav, retPt, plantTime! + 0.6);
        });
        curT = plantTime + 0.4;
      }
    }

    events.push({
      t: curT,
      k: e.k,
      v: e.v,
      as: e.as || null,
      fb: Boolean(e.fb),
      tr: Boolean(e.tr),
      tacTag,
      kPos: kPt,
      vPos: vPt
    });
  });

  const lastEvT = events.length ? events[events.length - 1].t : 3.6;
  let defuseTime: number | null = null;
  const endT = lastEvT + (plantTime !== null && R.win === defTi ? 2.1 : 1.3);

  const survivors = Object.values(actors).filter((a) => a.deadAt === Infinity);
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
    mapName: M.mapName,
    nav,
    round: R,
    atkTi,
    defTi,
    strategy,
    targetSite,
    actors,
    events,
    utilities,
    plantTime,
    defuseTime,
    duration: Math.max(5.5, endT)
  };
}

export function getRadarThemeColors(): RadarThemeColors {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  const isLight = document.documentElement.getAttribute("data-theme") === "light";
  const colA = v("--a") || "#E5484D";
  let colB = v("--b") || "#38BDF8";
  if (colorDist(colA, colB) < 95) colB = isLight ? "#0284C7" : "#38BDF8";
  return {
    isLight,
    bg: v("--bg") || (isLight ? "#F4F5F7" : "#0B0D11"),
    fg: v("--fg") || "#ECEFF4",
    mut: v("--mut") || "#8A94A6",
    a: colA,
    b: colB,
    gold: v("--gold") || "#EAB308",
    ok: v("--ok") || "#10B981",
    red: v("--vct-red") || "#E5484D",
    cyan: v("--vct-cyan") || "#38BDF8"
  };
}

export function drawRadarFrame(
  canvas: HTMLCanvasElement,
  plan: RoundPlan,
  time: number
): RadarThemeColors {
  const ctx = canvas.getContext("2d");
  const C = getRadarThemeColors();
  if (!ctx) return C;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const cssW = Math.max(280, Math.round(rect.width || 440));
  const cssH = cssW;
  if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.height = `${cssH}px`;
  }

  ctx.save();
  ctx.scale(dpr, dpr);

  const W = cssW;
  const H = cssH;
  const pad = W * 0.04;
  const size = W * 0.92;
  const sx = (gx: number) => pad + (gx / GRID) * size;
  const sy = (gy: number) => pad + (gy / GRID) * size;

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  const mapAsset = getCachedMapAsset(plan.mapName);
  if (!mapAsset || !mapAsset.ready || !mapAsset.img) {
    ctx.fillStyle = C.mut;
    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.textAlign = "center";
    ctx.fillText(
      mapAsset && mapAsset.failed
        ? `MINIMAPA ${plan.mapName.toUpperCase()} NO DISPONIBLE`
        : `CARGANDO MINIMAPA ${plan.mapName.toUpperCase()}...`,
      W / 2,
      H / 2
    );
    ctx.restore();
    return C;
  }

  ctx.save();
  ctx.translate(W / 2, H / 2);
  if (mapAsset.rotSteps) ctx.rotate(mapAsset.rotSteps * (Math.PI / 2));
  ctx.filter = C.isLight
    ? "invert(0.88) hue-rotate(180deg) contrast(1.05) opacity(0.88)"
    : "brightness(0.88) contrast(1.12) saturate(0.85)";
  ctx.drawImage(mapAsset.img, -size / 2, -size / 2, size, size);
  ctx.restore();

  if (!plan.nav) {
    ctx.restore();
    return C;
  }

  // 1. Etiquetas de Sites
  ctx.fillStyle = C.fg;
  ctx.globalAlpha = 0.72;
  ctx.font = '700 13px "Barlow Condensed", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  plan.nav.sites.forEach((s) => ctx.fillText(s.id, sx(s.pt[0]), sy(s.pt[1])));
  ctx.globalAlpha = 1;

  // 2. Utilidad activa (Smokes, Flashes, Recon)
  plan.utilities.forEach((u) => {
    if (time < u.start || time > u.end) return;
    const ux = sx(u.x);
    const uy = sy(u.y);
    const ur = (u.r / GRID) * size;
    const prog = clamp((time - u.start) / Math.max(0.1, u.end - u.start), 0, 1);

    ctx.save();
    if (u.type === "smoke") {
      ctx.fillStyle = u.ti === 0 ? "rgba(138,148,166,0.34)" : "rgba(56,189,248,0.22)";
      ctx.strokeStyle = u.ti === 0 ? C.a : C.b;
      ctx.globalAlpha = prog > 0.85 ? (1 - prog) / 0.15 : 0.85;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(ux, uy, ur, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (u.type === "flash") {
      ctx.strokeStyle = C.gold;
      ctx.fillStyle = "rgba(234,179,8,0.28)";
      ctx.globalAlpha = 1 - prog;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ux, uy, ur * (0.4 + prog * 0.9), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (u.type === "recon") {
      ctx.strokeStyle = C.cyan;
      ctx.globalAlpha = 1 - prog;
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(ux, uy, ur * prog, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  });

  // 3. Spike plantada
  if (plan.plantTime !== null && time >= plan.plantTime) {
    const px = sx(plan.targetSite.pt[0]);
    const py = sy(plan.targetSite.pt[1]);
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

  // 4. Trazadores de duelos
  plan.events.forEach((ev) => {
    const dt = time - ev.t;
    if (dt >= 0 && dt <= 0.45) {
      const alpha = 1 - dt / 0.45;
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
  Object.values(plan.actors).forEach((a) => {
    if (time >= a.deadAt && a.deathPos) {
      const x = sx(a.deathPos.x);
      const y = sy(a.deathPos.y);
      ctx.save();
      ctx.strokeStyle = a.ti === 0 ? C.a : C.b;
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(x - 3.8, y - 3.8);
      ctx.lineTo(x + 3.8, y + 3.8);
      ctx.moveTo(x + 3.8, y - 3.8);
      ctx.lineTo(x - 3.8, y + 3.8);
      ctx.stroke();
      ctx.restore();
    }
  });

  // 6. Jugadores vivos con separación validada + cono de mira
  const aliveList = Object.values(plan.actors)
    .filter((a) => time < a.deadAt)
    .map((a) => ({ a, pos: sampleActorPos(a, time) }));

  const nav = plan.nav;
  const isSafeCell = (x: number, y: number) => {
    const ix = Math.round(x);
    const iy = Math.round(y);
    return (
      ix >= 1 &&
      iy >= 1 &&
      ix < GRID - 1 &&
      iy < GRID - 1 &&
      nav.wallDist[iy * GRID + ix] >= 1
    );
  };

  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < aliveList.length; i++) {
      for (let j = i + 1; j < aliveList.length; j++) {
        const p1 = aliveList[i].pos;
        const p2 = aliveList[j].pos;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 4.2) {
          const push = (4.2 - dist) / 2;
          const ang = dist > 0.01 ? Math.atan2(dy, dx) : i * 1.7 + j;
          const nx1 = p1.x - Math.cos(ang) * push;
          const ny1 = p1.y - Math.sin(ang) * push;
          const nx2 = p2.x + Math.cos(ang) * push;
          const ny2 = p2.y + Math.sin(ang) * push;
          if (isSafeCell(nx1, ny1)) {
            p1.x = nx1;
            p1.y = ny1;
          }
          if (isSafeCell(nx2, ny2)) {
            p2.x = nx2;
            p2.y = ny2;
          }
        }
      }
    }
  }

  aliveList.forEach(({ a, pos }) => {
    const x = sx(pos.x);
    const y = sy(pos.y);
    const col = a.ti === 0 ? C.a : C.b;

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
  return C;
}