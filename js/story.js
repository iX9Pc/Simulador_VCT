// ===== Experiencia de partido: tarjetas de jugador, previa y resumen posterior =====
const tColor = n => (TEAM_META[n] && TEAM_META[n].color) || "#E5484D";
const pOvr = p => Math.round(p.aim * .35 + p.fd * .18 + p.clutch * .15 + p.entry * .15 + p.util * .17);
const tier = o => o >= 90 ? "Élite" : o >= 85 ? "Estrella" : o >= 78 ? "Sólido" : "Regular";
const confTxt = c => c >= 80 ? "Datos fiables" : c >= 65 ? "Datos medios" : "Pocos datos: rinde más irregular";
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function radarSVG(p, color) {
  const ax = [["AIM", p.aim], ["FD", p.fd], ["CLU", p.clutch], ["ENT", p.entry], ["UTI", p.util], ["IGL", p.igl]];
  const c = 60, R = 40, pt = (i, f) => { const a = -Math.PI / 2 + i * Math.PI / 3; return [c + Math.cos(a) * R * f, c + Math.sin(a) * R * f]; };
  const ring = f => ax.map((_, i) => pt(i, f).join(",")).join(" ");
  const poly = ax.map((a, i) => pt(i, Math.max(.08, Math.min(1, (a[1] - 40) / 60))).join(",")).join(" ");
  const labels = ax.map((a, i) => { const [x, y] = pt(i, 1.32); return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="8.5" fill="var(--mut)">${a[0]}</text>`; }).join("");
  return `<svg viewBox="0 0 120 120" class="radar" role="img" aria-label="Estadísticas de ${esc(p.n)}"><polygon points="${ring(1)}" fill="none" stroke="var(--bd-hi)"/><polygon points="${ring(.5)}" fill="none" stroke="var(--bd)"/><polygon points="${poly}" fill="${color}" fill-opacity=".28" stroke="${color}" stroke-width="1.6"/>${labels}</svg>`;
}
function playerCard(p, color) {
  const o = pOvr(p);
  return `<article class="pcard" style="--tc:${color}"><div class="pcard-top"><div><b>${esc(p.n)}</b><small>${esc(p.r)}</small></div><div class="pcard-ovr"><strong>${o}</strong><small>${tier(o)}</small></div></div>${radarSVG(p, color)}<small class="pcard-foot">${confTxt(p.conf)} · Potencial ${p.pot}</small></article>`;
}

let _pvKey = "";
function refreshPreview() {
  const box = document.getElementById("preview"); if (!box) return;
  const a = $("#ta").value, b = $("#tb").value;
  if (!a || !b || a === b || !TEAMS[a] || !TEAMS[b]) { box.innerHTML = ""; return; }
  const key = [a, b, currentFormat, getTeamOvr(a), getTeamOvr(b)].join("|");
  if (key === _pvKey) return; _pvKey = key;
  const st = n => TEAMS[n].filter(p => !p.sub).slice(0, 5);
  const side = n => `<div class="pv-team"><h3 style="color:${tColor(n)}">${esc(n)}</h3><div class="pcards">${st(n).map(p => playerCard(p, tColor(n))).join("")}</div></div>`;
  const co = (n) => COACH[n];
  const cRow = (lab, k) => `<div class="cmp"><span>${co(a)[k]}</span><div class="cmp-bar"><i style="width:${co(a)[k] / (co(a)[k] + co(b)[k]) * 100}%;background:${tColor(a)}"></i><i style="width:${co(b)[k] / (co(a)[k] + co(b)[k]) * 100}%;background:${tColor(b)}"></i></div><span>${co(b)[k]}</span><small>${lab}</small></div>`;
  box.innerHTML = `<section class="box story"><div class="box-head"><div><h2>Previa del partido</h2><small class="mut">${esc(a)} vs ${esc(b)} · Bo${currentFormat}</small></div></div>
    <div class="pv-prob" id="pvProb"><small class="mut">Calculando probabilidades…</small></div>
    <div class="pv-meta"><div class="cmp"><span>${getTeamOvr(a)}</span><div class="cmp-bar"><i style="width:50%;background:${tColor(a)}"></i><i style="width:50%;background:${tColor(b)}"></i></div><span>${getTeamOvr(b)}</span><small>Nivel del equipo</small></div>
    ${cRow("Coach · macro", "macro")}${cRow("Coach · micro", "micro")}${cRow("Coach · adaptación", "adapt")}
    <p class="mut pv-coach">Coaches: <b>${esc(co(a).n)}</b> (${esc(a)}) y <b>${esc(co(b).n)}</b> (${esc(b)}).</p></div>
    <div class="pv-teams">${side(a)}${side(b)}</div></section>`;
  setTimeout(() => {
    try {
      const N = 60, A = { name: a, players: TEAMS[a], coach: COACH[a] }, B = { name: b, players: TEAMS[b], coach: COACH[b] };
      let w = 0; for (let i = 0; i < N; i++) { const s = buildSeries(A, B, currentFormat, false); if (s.seriesScore[0] > s.seriesScore[1]) w++; }
      const pa = Math.round(w / N * 100), el = document.getElementById("pvProb"); if (!el || _pvKey !== key) return;
      el.innerHTML = `<div class="pv-probrow"><b style="color:${tColor(a)}">${esc(a)} ${pa}%</b><b style="color:${tColor(b)}">${100 - pa}% ${esc(b)}</b></div><div class="cmp-bar big"><i style="width:${pa}%;background:${tColor(a)}"></i><i style="width:${100 - pa}%;background:${tColor(b)}"></i></div><small class="mut">Estimación con ${N} series simuladas; el resultado real puede salir distinto.</small>`;
    } catch (e) {}
  }, 30);
}

// ---------- Resumen posterior ----------
function momentumSVG(M) {
  const R = M.rounds, n = R.length, W = 640, H = 150, pad = 26, mid = H / 2;
  const diffs = R.map(r => r.score[0] - r.score[1]), mx = Math.max(4, ...diffs.map(Math.abs));
  const x = i => pad + (W - 2 * pad) * (i + .5) / n, y = d => mid - d / mx * (mid - 18);
  const pts = diffs.map((d, i) => [x(i), y(d)]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
  const area = `M${pts[0][0]},${mid} ` + pts.map(p => "L" + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ") + ` L${pts[n - 1][0]},${mid} Z`;
  const half = n >= 12 ? `<line x1="${x(11) + (x(12) - x(11)) / 2}" x2="${x(11) + (x(12) - x(11)) / 2}" y1="8" y2="${H - 8}" stroke="var(--bd-hi)" stroke-dasharray="3 3"/><text x="${x(11) + (x(12) - x(11)) / 2 + 4}" y="14" font-size="9" fill="var(--dim)">cambio de lado</text>` : "";
  const c0 = tColor(M.teams[0].name), c1 = tColor(M.teams[1].name);
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Ventaja de rondas a lo largo del mapa"><clipPath id="cu"><rect x="0" y="0" width="${W}" height="${mid}"/></clipPath><clipPath id="cd"><rect x="0" y="${mid}" width="${W}" height="${mid}"/></clipPath>
  <path d="${area}" fill="${c0}" fill-opacity=".3" clip-path="url(#cu)"/><path d="${area}" fill="${c1}" fill-opacity=".3" clip-path="url(#cd)"/>
  <line x1="${pad}" x2="${W - pad}" y1="${mid}" y2="${mid}" stroke="var(--bd-hi)"/>${half}<path d="${line}" fill="none" stroke="var(--fg)" stroke-width="1.8"/>
  <text x="${pad}" y="12" font-size="10" fill="${c0}">${esc(M.teams[0].name)} por delante</text><text x="${pad}" y="${H - 4}" font-size="10" fill="${c1}">${esc(M.teams[1].name)} por delante</text></svg>`;
}
function economyHTML(M) {
  const rounds = M.rounds || [];
  if (!rounds.length) return "";

  const CODE = { Pistol: "P", Eco: "E", Force: "F", Full: "$" };
  const CLS = { Pistol: "is-pistol", Eco: "is-eco", Force: "is-force", Full: "is-full" };

  const conv = [0, 1].map(ti => {
    const c = { Pistol: [0, 0], Eco: [0, 0], Force: [0, 0], Full: [0, 0] };
    rounds.forEach(r => {
      const k = r.econ[ti] || "Full";
      if (!c[k]) c[k] = [0, 0];
      c[k][1]++;
      if (r.win === ti) c[k][0]++;
    });
    return c;
  });

  const renderHeaderCells = () => rounds.map((r, i) => {
    const sep = (i === 12 || i === 24)
      ? `<span class="econ-half-sep" title="${i === 12 ? "Cambio de lado" : "Overtime"}"></span>`
      : "";
    return `${sep}<span class="econ-rnum mono">${r.n}</span>`;
  }).join("");

  const renderTeamRow = ti => {
    const teamName = M.teams[ti].name;
    const colorCls = ti === 0 ? "ca" : "cb";
    const winCls = ti === 0 ? "is-win-a" : "is-win-b";

    const cells = rounds.map((r, i) => {
      const sep = (i === 12 || i === 24) ? `<span class="econ-half-sep"></span>` : "";
      const type = r.econ[ti] || "Full";
      const oppType = r.econ[1 - ti] || "Full";
      const won = r.win === ti;
      const thrifty = won && type === "Eco" && oppType === "Full";
      const title = `R${r.n} · ${teamName}: ${type} vs ${oppType} · ${won ? "GANADA" : "PERDIDA"}${thrifty ? " (THRIFTY)" : ""}`;
      return `${sep}<button type="button" class="econ-cell mono ${CLS[type] || "is-full"} ${won ? winCls : "is-loss"}${thrifty ? " is-thrifty" : ""}" onclick="jumpToRound(${r.n})" title="${esc(title)}">${CODE[type] || "$"}</button>`;
    }).join("");

    const c = conv[ti];
    const fmtStat = (label, pair) => pair[1] ? `<span>${label} <b>${pair[0]}/${pair[1]}</b></span>` : "";
    const summary = [
      fmtStat("FULL", c.Full),
      fmtStat("FRC", c.Force),
      fmtStat("ECO", c.Eco),
      fmtStat("PST", c.Pistol)
    ].filter(Boolean).join("");

    return `<div class="econ-row">
      <div class="econ-team">
        <span class="team-dot" style="background:var(${ti ? "--b" : "--a"})"></span>
        <b class="${colorCls}">${esc(teamName)}</b>
      </div>
      <div class="econ-track">${cells}</div>
      <div class="econ-conv mono">${summary}</div>
    </div>`;
  };

  return `<div class="econ-matrix-wrap">
    <div class="econ-matrix-head mono">
      <span>ECONOMÍA POR RONDA (${esc(M.mapName.toUpperCase())})</span>
      <span class="mut">CLIC EN UNA RONDA PARA INSPECCIONAR EN EL VISOR 2D</span>
    </div>
    <div class="sc">
      <div class="econ-matrix">
        <div class="econ-row is-head">
          <div class="econ-team mono mut" style="font-size:10px">EQUIPO</div>
          <div class="econ-track">${renderHeaderCells()}</div>
          <div class="econ-conv mono mut" style="font-size:10px">CONVERSIÓN (G/J)</div>
        </div>
        ${renderTeamRow(0)}
        ${renderTeamRow(1)}
      </div>
    </div>
    <div class="econ-legend mono">
      <span><i class="econ-swatch is-pistol">P</i> Pistol</span>
      <span><i class="econ-swatch is-eco">E</i> Eco</span>
      <span><i class="econ-swatch is-force">F</i> Force</span>
      <span><i class="econ-swatch is-full">$</i> Full buy</span>
      <span><i class="econ-swatch is-win-demo"></i> Ronda ganada</span>
      <span><i class="econ-swatch is-thrifty-demo">E</i> Thrifty (Eco vs Full)</span>
    </div>
  </div>`;
}
function whyWon(M, S) {
  const w = M.sc[0] > M.sc[1] ? 0 : 1, l = 1 - w, W = M.teams[w].name, L = M.teams[l].name, R = M.rounds;
  const out = [`${W} ganó ${M.sc[w]}-${M.sc[l]} en ${M.mapName}.`];
  let deficit = 0; R.forEach(r => deficit = Math.max(deficit, r.score[l] - r.score[w]));
  if (deficit >= 4) out[0] = `${W} remontó: llegó a ir ${deficit} rondas abajo y terminó ganando ${M.sc[w]}-${M.sc[l]} en ${M.mapName}.`;
  let fb = [0, 0]; for (const id in S) fb[S[id].ti] += S[id].fb;
  const tot = fb[0] + fb[1];
  if (tot) out.push(fb[w] / tot >= .55 ? `Dominó las aperturas: ${fb[w]} de ${tot} primeras sangres.` : fb[w] / tot <= .45 ? `Ganó aun perdiendo las aperturas (${fb[w]} de ${tot} primeras sangres), así que su fuerza estuvo en el juego de rondas largas.` : `Las aperturas estuvieron parejas (${fb[w]} de ${tot}).`);
  let best = [0, 0], cur = [0, 0]; R.forEach(r => { cur[r.win]++; cur[1 - r.win] = 0; best[r.win] = Math.max(best[r.win], cur[r.win]); });
  const up = R.filter(r => r.win === w && r.econ[w] === "Eco" && r.econ[l] === "Full").length;
  if (best[w] >= 4) out.push(`Su mejor momento fue una racha de ${best[w]} rondas seguidas.`);
  else if (up) out.push(`Ganó ${up} ronda${up > 1 ? "s" : ""} en eco contra un full buy de ${L}.`);
  return out.slice(0, 3);
}
function renderStory(M, S, isSeries, done) {
  const out = document.getElementById("out"); if (!out || !done) return;
  try {
    const ids = Object.keys(S), mvpId = ids.reduce((b, id) => parseFloat(S[id].rating) > parseFloat(S[b].rating) ? id : b, ids[0]);
    const m = S[mvpId], mc = tColor((M.teams[m.ti] || {}).name);
    const mvp = `<div class="mvp" style="--tc:${mc}"><small>MVP ${isSeries ? "de la serie" : "del mapa"}</small><b>${esc(m.u.p.n)}</b><span>${esc(M.teams[m.ti].name)}</span><div class="mvp-stats"><span><b>${m.k}/${m.d}/${m.a}</b>K/D/A</span><span><b>${m.acs || "-"}</b>ACS</span><span><b>${m.rating}</b>Rating</span></div></div>`;
    let body;
    if (isSeries) body = `<div class="story-grid">${mvp}<div><h3>Cómo se decidió</h3><p>${esc(SERIES.maps.map(x => x.mapName + " " + x.sc[0] + "-" + x.sc[1]).join(" · "))}</p></div></div>`;
    else body = `<div class="story-grid">${mvp}<div><h3>Por qué ganó</h3><ul>${whyWon(M, S).map(t => `<li>${esc(t)}</li>`).join("")}</ul></div></div><h3>Ventaja de rondas</h3>${momentumSVG(M)}${economyHTML(M)}`;
    out.insertAdjacentHTML("afterbegin", `<section class="box story"><div class="box-head"><h2>Resumen del ${isSeries ? "partido" : "mapa"}</h2></div>${body}</section>`);
  } catch (e) { console.error(e); }
}

const _go = document.getElementById("go");
if (_go) _go.addEventListener("click", () => setTimeout(refreshPreview, 0));
refreshPreview();