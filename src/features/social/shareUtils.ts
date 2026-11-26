import type { SeriesFormat, SeriesResult, TeamMeta } from "../../core/index.ts";
import { computeSeriesStats } from "../broadcast/stats.ts";

export type CompactPlayerRow = [
  name: string,
  agent: string,
  rating: string,
  acs: number,
  k: number,
  d: number,
  a: number,
  kast: number
];

export interface CompactSeriesSnapshot {
  id: string;
  v: 1;
  d: string;
  f: SeriesFormat;
  a: string;
  ca: string;
  b: string;
  cb: string;
  sa: number;
  sb: number;
  maps: Array<[string, number, number]>;
  mvp: [string, string, string, number, string];
  p0: CompactPlayerRow[];
  p1: CompactPlayerRow[];
}

export function buildCompactSnapshot(
  series: SeriesResult,
  teamMeta: Record<string, TeamMeta>
): CompactSeriesSnapshot {
  const M0 = series.maps[0];
  const tA = M0.teams[0].name;
  const tB = M0.teams[1].name;
  const S = computeSeriesStats(series, series.maps.length, true);
  const list0 = Object.values(S)
    .filter((s) => s.ti === 0)
    .sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));
  const list1 = Object.values(S)
    .filter((s) => s.ti === 1)
    .sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));
  const winIdx = series.seriesScore[0] > series.seriesScore[1] ? 0 : 1;
  const mvp = (winIdx === 0 ? list0[0] : list1[0]) || list0[0];

  const dateStr = new Date().toISOString().slice(0, 16).replace("T", " ");

  return {
    id: `H-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    v: 1,
    d: dateStr,
    f: series.format,
    a: tA,
    ca: teamMeta[tA]?.color || "#E5484D",
    b: tB,
    cb: teamMeta[tB]?.color || "#38BDF8",
    sa: series.seriesScore[0],
    sb: series.seriesScore[1],
    maps: series.maps.map((m) => [m.mapName, m.sc[0], m.sc[1]]),
    mvp: [mvp.u.p.n, winIdx === 0 ? tA : tB, mvp.rating, mvp.acs, `${mvp.k}/${mvp.d}/${mvp.a}`],
    p0: list0.map((s) => [
      s.u.p.n,
      s.agents[0] || s.u.agent || "-",
      s.rating,
      s.acs,
      s.k,
      s.d,
      s.a,
      s.kast
    ]),
    p1: list1.map((s) => [
      s.u.p.n,
      s.agents[0] || s.u.agent || "-",
      s.rating,
      s.acs,
      s.k,
      s.d,
      s.a,
      s.kast
    ])
  };
}

export function encodeSharePayload(snap: CompactSeriesSnapshot): string {
  const clean = {
    v: 1,
    d: snap.d,
    f: snap.f,
    a: snap.a,
    ca: snap.ca,
    b: snap.b,
    cb: snap.cb,
    sa: snap.sa,
    sb: snap.sb,
    maps: snap.maps,
    mvp: snap.mvp,
    p0: snap.p0,
    p1: snap.p1
  };
  const json = JSON.stringify(clean);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeSharePayload(str: string): CompactSeriesSnapshot | null {
  try {
    let b64 = str.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    const obj = JSON.parse(json) as Partial<CompactSeriesSnapshot>;
    if (!obj || !obj.a || !obj.b || !Array.isArray(obj.maps)) return null;
    return {
      id: obj.id || "SHARED",
      v: 1,
      d: obj.d || "",
      f: (obj.f === 1 || obj.f === 3 || obj.f === 5 ? obj.f : 3) as SeriesFormat,
      a: obj.a,
      ca: obj.ca || "#E5484D",
      b: obj.b,
      cb: obj.cb || "#38BDF8",
      sa: Number(obj.sa) || 0,
      sb: Number(obj.sb) || 0,
      maps: obj.maps,
      mvp: obj.mvp || ["-", obj.a, "1.00", 200, "0/0/0"],
      p0: Array.isArray(obj.p0) ? obj.p0 : [],
      p1: Array.isArray(obj.p1) ? obj.p1 : []
    };
  } catch {
    return null;
  }
}

export async function copyShareLink(snap: CompactSeriesSnapshot): Promise<string> {
  const token = encodeSharePayload(snap);
  const base =
    window.location.origin === "null"
      ? window.location.href.split("#")[0]
      : window.location.origin + window.location.pathname;
  const url = `${base}#res=${token}`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      return "LINK COPIADO AL PORTAPAPELES";
    } catch {
      window.prompt("Copia este enlace de resultado:", url);
      return "LINK GENERADO";
    }
  }

  window.prompt("Copia este enlace de resultado:", url);
  return "LINK GENERADO";
}

export async function exportSnapshotPNG(snap: CompactSeriesSnapshot): Promise<void> {
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // noop
    }
  }

  const W = 1200;
  const H = 675;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Fondo táctico oscuro
  ctx.fillStyle = "#0B0D11";
  ctx.fillRect(0, 0, W, H);

  // Marco exterior 1px
  ctx.strokeStyle = "#222733";
  ctx.lineWidth = 1;
  ctx.strokeRect(18.5, 18.5, W - 37, H - 37);

  // Franja superior
  ctx.fillStyle = "#11141B";
  ctx.fillRect(19, 19, W - 38, 42);
  ctx.strokeStyle = "#222733";
  ctx.beginPath();
  ctx.moveTo(19, 61.5);
  ctx.lineTo(W - 19, 61.5);
  ctx.stroke();

  ctx.fillStyle = "#E5484D";
  ctx.fillRect(36, 33, 12, 12);
  ctx.fillStyle = "#ECEFF4";
  ctx.font = '700 15px "JetBrains Mono", monospace';
  ctx.textAlign = "left";
  ctx.fillText("VCT SIM 2027 // OFFICIAL MATCH REPORT", 58, 45);

  ctx.fillStyle = "#8A94A6";
  ctx.font = '600 13px "JetBrains Mono", monospace';
  ctx.textAlign = "right";
  ctx.fillText(`FORMATO BO${snap.f}  ·  ${snap.d}`, W - 36, 44);

  // Marcador Central
  ctx.fillStyle = "#11141B";
  ctx.fillRect(36, 78, W - 72, 148);
  ctx.strokeStyle = "#333B4D";
  ctx.strokeRect(36.5, 78.5, W - 73, 148);

  ctx.fillStyle = snap.ca;
  ctx.fillRect(37, 79, (W - 74) / 2 - 4, 3);
  ctx.fillStyle = snap.cb;
  ctx.fillRect(W / 2 + 4, 79, (W - 74) / 2 - 4, 3);

  ctx.fillStyle = snap.ca;
  ctx.font = '700 42px "Barlow Condensed", sans-serif';
  ctx.textAlign = "left";
  ctx.fillText(snap.a.toUpperCase(), 64, 152);

  ctx.fillStyle = snap.cb;
  ctx.textAlign = "right";
  ctx.fillText(snap.b.toUpperCase(), W - 64, 152);

  ctx.fillStyle = "#0B0D11";
  ctx.fillRect(W / 2 - 110, 96, 220, 82);
  ctx.strokeStyle = "#222733";
  ctx.strokeRect(W / 2 - 109.5, 96.5, 219, 81);

  ctx.font = '700 56px "JetBrains Mono", monospace';
  ctx.textAlign = "center";
  ctx.fillStyle = snap.ca;
  ctx.fillText(String(snap.sa), W / 2 - 48, 156);
  ctx.fillStyle = "#566073";
  ctx.fillText(":", W / 2, 152);
  ctx.fillStyle = snap.cb;
  ctx.fillText(String(snap.sb), W / 2 + 48, 156);

  const mapsLine = snap.maps.map((m) => `${m[0].toUpperCase()}  ${m[1]}-${m[2]}`).join("    |    ");
  ctx.fillStyle = "#8A94A6";
  ctx.font = '600 13px "JetBrains Mono", monospace';
  ctx.textAlign = "center";
  ctx.fillText(mapsLine, W / 2, 206);

  // Franja MVP
  ctx.fillStyle = "#11141B";
  ctx.fillRect(36, 240, W - 72, 46);
  ctx.strokeStyle = "#EAB308";
  ctx.strokeRect(36.5, 240.5, W - 73, 46);

  ctx.fillStyle = "#EAB308";
  ctx.font = '700 13px "JetBrains Mono", monospace';
  ctx.textAlign = "left";
  ctx.fillText("MVP DE LA SERIE", 54, 268);

  ctx.fillStyle = "#ECEFF4";
  ctx.font = '700 20px "Barlow Condensed", sans-serif';
  ctx.fillText(`${snap.mvp[0]} (${snap.mvp[1]})`, 200, 270);

  ctx.fillStyle = "#8A94A6";
  ctx.font = '600 13px "JetBrains Mono", monospace';
  ctx.textAlign = "right";
  ctx.fillText(
    `RATING 2.0: ${snap.mvp[2]}   ·   ACS: ${snap.mvp[3]}   ·   K/D/A: ${snap.mvp[4]}`,
    W - 54,
    268
  );

  // Boxscores lado a lado
  const drawTeamBox = (x: number, title: string, color: string, rows: CompactPlayerRow[]) => {
    const bw = (W - 88) / 2;
    const by = 302;
    const bh = 312;
    ctx.fillStyle = "#11141B";
    ctx.fillRect(x, by, bw, bh);
    ctx.strokeStyle = "#222733";
    ctx.strokeRect(x + 0.5, by + 0.5, bw - 1, bh - 1);

    ctx.fillStyle = color;
    ctx.fillRect(x + 14, by + 15, 8, 8);
    ctx.font = '700 18px "Barlow Condensed", sans-serif';
    ctx.textAlign = "left";
    ctx.fillText(title.toUpperCase(), x + 30, by + 25);

    ctx.fillStyle = "#0B0D11";
    ctx.fillRect(x + 1, by + 36, bw - 2, 26);
    ctx.fillStyle = "#8A94A6";
    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.textAlign = "left";
    ctx.fillText("JUGADOR", x + 14, by + 53);
    ctx.fillText("AGENTE", x + 160, by + 53);
    ctx.textAlign = "right";
    ctx.fillText("R2.0", x + 315, by + 53);
    ctx.fillText("ACS", x + 375, by + 53);
    ctx.fillText("K/D/A", x + 465, by + 53);
    ctx.fillText("KAST", x + bw - 14, by + 53);

    rows.slice(0, 5).forEach((p, idx) => {
      const ry = by + 92 + idx * 44;
      ctx.strokeStyle = "#1D222D";
      ctx.beginPath();
      ctx.moveTo(x + 10, ry + 14);
      ctx.lineTo(x + bw - 10, ry + 14);
      ctx.stroke();

      ctx.textAlign = "left";
      ctx.fillStyle = "#ECEFF4";
      ctx.font = '600 14px "Barlow", sans-serif';
      ctx.fillText(String(p[0]).slice(0, 14), x + 14, ry);

      ctx.fillStyle = "#8A94A6";
      ctx.font = '500 12px "JetBrains Mono", monospace';
      ctx.fillText(String(p[1]).slice(0, 10), x + 160, ry);

      ctx.textAlign = "right";
      const rVal = parseFloat(p[2]);
      ctx.fillStyle = rVal >= 1.18 ? "#EAB308" : rVal >= 1.02 ? "#10B981" : "#ECEFF4";
      ctx.font = '700 13px "JetBrains Mono", monospace';
      ctx.fillText(String(p[2]), x + 315, ry);

      ctx.fillStyle = "#ECEFF4";
      ctx.fillText(String(p[3]), x + 375, ry);
      ctx.fillStyle = "#8A94A6";
      ctx.fillText(`${p[4]}/${p[5]}/${p[6]}`, x + 465, ry);
      ctx.fillText(`${p[7]}%`, x + bw - 14, ry);
    });
  };

  drawTeamBox(36, snap.a, snap.ca, snap.p0);
  drawTeamBox(36 + (W - 88) / 2 + 16, snap.b, snap.cb, snap.p1);

  // Pie de imagen
  ctx.fillStyle = "#566073";
  ctx.font = '500 11.5px "JetBrains Mono", monospace';
  ctx.textAlign = "left";
  ctx.fillText("VCT SIM 2027 · VLR.GG DATA & 30-AGENT COMPOSITION ENGINE", 36, H - 32);
  ctx.textAlign = "right";
  ctx.fillText("GENERADO LOCALMENTE", W - 36, H - 32);

  const safeA = snap.a.replace(/[^a-z0-9]/gi, "").slice(0, 12);
  const safeB = snap.b.replace(/[^a-z0-9]/gi, "").slice(0, 12);
  const link = document.createElement("a");
  link.download = `vct-sim-${safeA}-vs-${safeB}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}