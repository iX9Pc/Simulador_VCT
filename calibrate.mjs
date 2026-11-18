// Uso: node tools/calibrate.mjs [exponente]   (desde la carpeta del proyecto)
// Corre los cruces de data/calibration.json sin navegador y marca los que salen del rango.
import fs from "fs"; import vm from "vm"; import path from "path"; import { fileURLToPath } from "url";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const rd = f => JSON.parse(fs.readFileSync(path.join(root, f), "utf8"));
const cal = rd("data/calibration.json");
const ctx = { DATA: { teams: rd("data/teams.json"), coaches: rd("data/coaches.json") }, console, Math };
vm.createContext(ctx);
let code = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
if (process.argv[2]) code = code.replace(/const EXP = [\d.]+;/, `const EXP = ${process.argv[2]};`);
vm.runInContext(code + "\n;this.buildSeries=buildSeries;this.TEAMS=TEAMS;this.COACH=COACH;this.EXP=EXP;", ctx);
console.log("EXP =", ctx.EXP, "| series por cruce:", cal.series);
const T = n => ({ name: n, players: ctx.TEAMS[n], coach: ctx.COACH[n] });
let bad = 0;
for (const [a, b, lo, hi] of cal.cruces) {
  let w = 0;
  for (let i = 0; i < cal.series; i++) { const s = ctx.buildSeries(T(a), T(b), cal.format); if (s.seriesScore[0] > s.seriesScore[1]) w++; }
  const p = Math.round(w / cal.series * 100), ok = p >= lo && p <= hi; if (!ok) bad++;
  console.log((ok ? "OK  " : "FUERA") + ` ${a} vs ${b}: ${p}%  (objetivo ${lo}-${hi}%)`);
}
console.log(bad ? `${bad} cruce(s) fuera de rango` : "Todo dentro de rango");
