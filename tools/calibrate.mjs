// Uso:
//   node tools/calibrate.mjs [exponente]        (Node 22.18+ / 24+)
//   npm run calibrate -- [exponente]            (vía tsx en cualquier versión de Node)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSeries, DEFAULT_EXP } from "../src/core/index.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const rd = (f) => JSON.parse(fs.readFileSync(path.join(root, f), "utf8"));

const cal = rd("data/calibration.json");
const teamsJson = rd("data/teams.json");
const coachesJson = rd("data/coaches.json");

const exp = process.argv[2] ? Number(process.argv[2]) : DEFAULT_EXP;
if (!Number.isFinite(exp) || exp <= 0) {
  console.error(`Exponente inválido: ${process.argv[2]}`);
  process.exit(1);
}

console.log("EXP =", exp, "| series por cruce:", cal.series);

const makeTeam = (name) => ({
  name,
  players: teamsJson.teams[name].players,
  coach: coachesJson[name]
});

let bad = 0;
for (const [a, b, lo, hi] of cal.cruces) {
  let w = 0;
  const tA = makeTeam(a);
  const tB = makeTeam(b);
  for (let i = 0; i < cal.series; i++) {
    const s = buildSeries(tA, tB, cal.format, { exp });
    if (s.seriesScore[0] > s.seriesScore[1]) w++;
  }
  const p = Math.round((w / cal.series) * 100);
  const ok = p >= lo && p <= hi;
  if (!ok) bad++;
  console.log(`${ok ? "OK  " : "FUERA"} ${a} vs ${b}: ${p}%  (objetivo ${lo}-${hi}%)`);
}

console.log(bad ? `${bad} cruce(s) fuera de rango` : "Todo dentro de rango");
if (bad > 0) process.exitCode = 1;