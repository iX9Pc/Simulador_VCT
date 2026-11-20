const $ = s => document.querySelector(s);

// Sincronizar tema guardado entre index.html y manager.html
try {
  const savedTheme = localStorage.getItem("vct_sim_theme");
  if (savedTheme === "light" || savedTheme === "dark") {
    document.documentElement.setAttribute("data-theme", savedTheme);
    if ($("#themeLabel")) $("#themeLabel").textContent = savedTheme.toUpperCase();
  }
} catch (e) {}

window.handleLogoError = function(imgEl) {
  const file = imgEl.getAttribute("data-file");
  const code = imgEl.getAttribute("data-code") || "VCT";
  const color = imgEl.getAttribute("data-color") || "#E5484D";
  const step = parseInt(imgEl.getAttribute("data-step") || "0", 10);

  const altPaths = [
    "./" + file,
    file.toLowerCase(),
    "img/" + file,
    "assets/" + file,
    "logos/" + file,
    "../" + file
  ];

  if (step < altPaths.length) {
    imgEl.setAttribute("data-step", String(step + 1));
    imgEl.src = altPaths[step];
    return;
  }

  imgEl.onerror = null;
  imgEl.classList.remove("logo-invert", "logo-fut", "logo-light-invert");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
    <rect width="80" height="80" rx="2" fill="#11141B" stroke="${color}" stroke-width="3"/>
    <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#ECEFF4" font-family="JetBrains Mono, monospace" font-weight="700" font-size="22">${code}</text>
  </svg>`;
  imgEl.src = "data:image/svg+xml;utf8," + encodeURIComponent(svg);
};

window.handleRoleIconError = function(imgEl) {
  const file = imgEl.getAttribute("data-file");
  const step = parseInt(imgEl.getAttribute("data-step") || "0", 10);
  const altPaths = ["./" + file, "img/" + file, "assets/" + file, "roles/" + file, "icons/" + file];
  if (step < altPaths.length) {
    imgEl.setAttribute("data-step", String(step + 1));
    imgEl.src = altPaths[step];
    return;
  }
  imgEl.onerror = null;
  imgEl.style.display = "none";
};

function renderTeamLogo(teamName, cls = "") {
  const m = TEAM_META[teamName] || { logo: "vct.png", code: teamName.slice(0, 3).toUpperCase(), color: "#E5484D", logoCls: "" };
  return `<img src="${m.logo}" alt="${teamName}" class="${cls} ${m.logoCls || ""}" data-file="${m.logo}" data-code="${m.code}" data-color="${m.color}" data-step="0" onerror="handleLogoError(this)">`;
}

function getRoleIcon(roleStr) {
  const r = (roleStr || "").toLowerCase();
  let file = null, label = "Flex";
  if (r.startsWith("iniciador") || (!r.startsWith("duelista") && !r.startsWith("controlador") && !r.startsWith("centinela") && r.includes("iniciador"))) {
    file = "iniciador.png"; label = "Iniciador";
  } else if (r.startsWith("controlador") || (!r.startsWith("duelista") && !r.startsWith("centinela") && r.includes("controlador"))) {
    file = "controlador.png"; label = "Controlador";
  } else if (r.startsWith("centinela") || (!r.startsWith("duelista") && r.includes("centinela"))) {
    file = "centinela.png"; label = "Centinela";
  } else if (r.includes("duelista")) {
    file = "duelista.png"; label = "Duelista";
  }
  if (!file) {
    return `<svg class="role-ico-svg" width="13" height="13" style="width:13px;height:13px;flex-shrink:0;display:inline-block;vertical-align:-2px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-label="Flex"><polygon points="12 2 22 12 12 22 2 12"/></svg>`;
  }
  return `<img src="${file}" alt="${label}" title="${label}" width="13" height="13" class="role-ico" data-file="${file}" data-step="0" onerror="handleRoleIconError(this)">`;
}

function syncMapSelector() {
  const sel = $("#mapSel");
  if (!sel) return;
  const prev = sel.value || "AUTO";
  sel.innerHTML = `<option value="AUTO">1v1 + Veto Oficial de Coaches (Auto)</option>` +
    Object.keys(MAP_POOL).map(m => `<option value="${m}">Forzar Mapa 1: ${m}</option>`).join("");
  if (prev === "AUTO" || MAP_POOL[prev]) sel.value = prev;
}

function applyTeamColorsForPair(a, b) {
  const metaA = TEAM_META[a] || { color: "#E5484D", reg: "VCT" };
  let colorA = metaA.color;
  const metaB = TEAM_META[b] || { color: "#38BDF8", reg: "VCT" };
  let colorB = metaB.color;

  if (a && b && Math.abs(parseInt(colorA.slice(1, 3), 16) - parseInt(colorB.slice(1, 3), 16)) < 38 &&
      Math.abs(parseInt(colorA.slice(3, 5), 16) - parseInt(colorB.slice(3, 5), 16)) < 48) {
    colorB = "#38BDF8";
  }

  document.documentElement.style.setProperty("--a", colorA);
  document.documentElement.style.setProperty("--a-soft", colorA + "22");
  document.documentElement.style.setProperty("--b", colorB);
  document.documentElement.style.setProperty("--b-soft", colorB + "22");
  return { metaA, metaB, colorA, colorB };
}

function applyDynamicTeamColors() {
  if (!$("#ta") || !$("#tb")) return;
  const a = $("#ta").value, b = $("#tb").value;
  const { metaA, metaB, colorA, colorB } = applyTeamColorsForPair(a, b);

  if ($("#pickerCardA")) $("#pickerCardA").style.setProperty("--team-color", colorA);
  if ($("#pickerCardB")) $("#pickerCardB").style.setProperty("--team-color", colorB);
  if ($("#logoWrapA")) $("#logoWrapA").innerHTML = renderTeamLogo(a);
  if ($("#logoWrapB")) $("#logoWrapB").innerHTML = renderTeamLogo(b);

  if (a && TEAMS[a] && $("#metaA")) {
    $("#metaA").innerHTML = `<span>${metaA.reg}</span> · <span>DT ${COACH[a].n}</span> <span class="ovr-pill">OVR ${getTeamOvr(a)}</span>`;
  }
  if (b && TEAMS[b] && $("#metaB")) {
    $("#metaB").innerHTML = `<span>${metaB.reg}</span> · <span>DT ${COACH[b].n}</span> <span class="ovr-pill">OVR ${getTeamOvr(b)}</span>`;
  }
}

let SERIES = null;
let _bootDone = false;
let liveTimer = null, currentFormat = 3;

function initSeriesState(series, startProgressive) {
  const lastIdx = Math.max(0, series.maps.length - 1);
  series.liveFinished = !startProgressive;
  series.liveMapIdx = startProgressive ? 0 : lastIdx;
  series.liveShown = startProgressive ? 0 : series.maps[lastIdx].rounds.length;
  series.revealedMaps = startProgressive ? 1 : series.maps.length;
  series.activeTab = startProgressive ? 0 : (series.format > 1 ? "SERIES" : 0);
  return series;
}

function stopLive() {
  if (liveTimer) {
    clearInterval(liveTimer);
    liveTimer = null;
  }
  const btn = $("#liveBtn");
  if (btn) {
    btn.classList.remove("live-active");
    btn.textContent = "Auto-Play";
  }
}

function getLiveSeriesWins(series) {
  if (series.liveFinished) return series.seriesScore;
  let w0 = 0, w1 = 0;
  for (let i = 0; i <= series.liveMapIdx && i < series.maps.length; i++) {
    const m = series.maps[i];
    if (i < series.liveMapIdx || series.liveShown >= m.rounds.length) {
      if (m.sc[0] > m.sc[1]) w0++;
      else w1++;
    }
  }
  return [w0, w1];
}

function computeStatsForMatch(M, maxRounds) {
  const S = {};
  M.teams.forEach((t, ti) => t.units.forEach((u, i) => {
    S[ti + "-" + i] = { k: 0, d: 0, a: 0, fb: 0, fd: 0, cl: 0, kastRounds: 0, u, ti, agents: [u.agent] };
  }));

  for (let r = 0; r < maxRounds; r++) {
    const R = M.rounds[r];
    const roundKast = new Set(R.survivors || []);
    R.ev.forEach(e => {
      S[e.k].k++;
      S[e.v].d++;
      roundKast.add(e.k);
      if (e.as) {
        S[e.as].a++;
        roundKast.add(e.as);
      }
      if (e.tr) roundKast.add(e.v);
      if (e.fb) {
        S[e.k].fb++;
        S[e.v].fd++;
      }
    });
    if (R.cl && R.cl.won) S[R.cl.id].cl++;
    roundKast.forEach(id => { if (S[id]) S[id].kastRounds++; });
  }

  for (const id in S) {
    const s = S[id];
    const rds = Math.max(1, maxRounds);
    s.acs = maxRounds ? Math.round((s.k * 150 + s.a * 40 + s.cl * 100) / rds + 90) : 0;
    s.kast = maxRounds ? Math.round((s.kastRounds / rds) * 100) : 0;
    const kpr = s.k / rds, dpr = s.d / rds, apr = s.a / rds;
    s.rating = maxRounds
      ? (0.32 + (kpr * 0.72) + ((1 - dpr) * 0.42) + (apr * 0.28) + ((s.kast / 100) * 0.26) + ((s.fb - s.fd) / rds) * 0.35 + (s.cl / rds) * 0.5).toFixed(2)
      : "1.00";
  }
  return S;
}

function computeSeriesStats(series) {
  const firstM = series.maps[0];
  const S = {};
  firstM.teams.forEach((t, ti) => t.units.forEach((u, i) => {
    S[ti + "-" + i] = { k: 0, d: 0, a: 0, fb: 0, fd: 0, cl: 0, kastRounds: 0, totalRounds: 0, formSum: 0, u, ti, agents: [] };
  }));

  const playedCount = series.liveFinished ? series.maps.length : series.revealedMaps;
  for (let idx = 0; idx < playedCount; idx++) {
    const m = series.maps[idx];
    const mStats = computeStatsForMatch(m, m.rounds.length);
    const rLen = m.rounds.length;
    for (const id in mStats) {
      S[id].k += mStats[id].k;
      S[id].d += mStats[id].d;
      S[id].a += mStats[id].a;
      S[id].fb += mStats[id].fb;
      S[id].fd += mStats[id].fd;
      S[id].cl += mStats[id].cl;
      S[id].kastRounds += mStats[id].kastRounds;
      S[id].totalRounds += rLen;
      S[id].formSum += mStats[id].u.form;
      const ag = mStats[id].u.agent;
      if (ag && !S[id].agents.includes(ag)) S[id].agents.push(ag);
    }
  }

  for (const id in S) {
    const s = S[id];
    const rds = Math.max(1, s.totalRounds);
    s.acs = Math.round((s.k * 150 + s.a * 40 + s.cl * 100) / rds + 90);
    s.kast = Math.round((s.kastRounds / rds) * 100);
    const kpr = s.k / rds, dpr = s.d / rds, apr = s.a / rds;
    s.rating = (0.32 + (kpr * 0.72) + ((1 - dpr) * 0.42) + (apr * 0.28) + ((s.kast / 100) * 0.26) + ((s.fb - s.fd) / rds) * 0.35 + (s.cl / rds) * 0.5).toFixed(2);
    s.u = { ...s.u, form: s.formSum / Math.max(1, playedCount) };
  }
  return S;
}

function getHalfSplits(M, maxR) {
  const rounds = M.rounds;
  let h1 = [0, 0], h2 = [0, 0], ot = [0, 0];
  for (let i = 0; i < maxR; i++) {
    const w = rounds[i].win;
    if (i < 12) h1[w]++;
    else if (i < 24) h2[w]++;
    else ot[w]++;
  }
  const s1 = M.leftStartsAtk ? "ATK/DEF" : "DEF/ATK";
  const s2 = M.leftStartsAtk ? "DEF/ATK" : "ATK/DEF";
  let txt = `1H (${s1}): ${h1[0]}-${h1[1]}`;
  if (maxR > 12) txt += ` · 2H (${s2}): ${h2[0]}-${h2[1]}`;
  if (maxR > 24) txt += ` · OT: ${ot[0]}-${ot[1]}`;
  return txt;
}

window.selectSeriesTab = function(tab) {
  stopLive();
  if (!SERIES) return;
  if (tab === "SERIES") {
    if (!SERIES.liveFinished) return;
    SERIES.activeTab = "SERIES";
    render();
    return;
  }
  if (typeof tab !== "number" || tab < 0 || tab >= SERIES.maps.length) return;
  if (!SERIES.liveFinished && tab > SERIES.liveMapIdx) return;
  SERIES.activeTab = tab;
  render();
};

window.jumpToRound = function(rn) {
  const el = document.getElementById("round-det-" + rn);
  if (el) {
    el.open = true;
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  if (window.Radar2D) window.Radar2D.selectRound(rn, true);
};

function renderAxisBadges(compObj) {
  if (!compObj || !compObj.bonuses) return "";
  const mapLabels = [
    ["MAC", compObj.bonuses.macro],
    ["UTI", compObj.bonuses.util],
    ["ENT", compObj.bonuses.entrada],
    ["DEF", compObj.bonuses.defensa],
    ["FLX", compObj.bonuses.flex]
  ];
  return `<div class="comp-axes mono">` + mapLabels.map(([lab, val]) => {
    const pct = (val * 100).toFixed(1);
    const cls = val > 0.004 ? "kd-pos" : val < -0.004 ? "kd-neg" : "mut";
    const sign = val > 0 ? "+" : "";
    return `<span class="axis-pill ${cls}">${lab} ${sign}${pct}%</span>`;
  }).join("") + `</div>`;
}

function render() {
  const outEl = $("#out");
  if (!outEl) return;
  if (!SERIES || !SERIES.maps.length) {
    outEl.innerHTML = "";
    return;
  }

  const isSeriesSummary = SERIES.format > 1 && SERIES.activeTab === "SERIES";
  const currentMapIdx = isSeriesSummary ? (SERIES.maps.length - 1) : (typeof SERIES.activeTab === "number" ? SERIES.activeTab : 0);
  const M = SERIES.maps[currentMapIdx];
  const isViewedMapFinished = SERIES.liveFinished || currentMapIdx < SERIES.liveMapIdx || (currentMapIdx === SERIES.liveMapIdx && SERIES.liveShown >= M.rounds.length);
  const maxR = (isSeriesSummary || isViewedMapFinished) ? M.rounds.length : Math.min(SERIES.liveShown, M.rounds.length);
  const S = isSeriesSummary ? computeSeriesStats(SERIES) : computeStatsForMatch(M, maxR);
  const R = M.rounds;
  const cur = isSeriesSummary ? SERIES.seriesScore : (maxR ? R[maxR - 1].score : [0, 0]);
  const done = isSeriesSummary ? true : isViewedMapFinished;
  const nm = id => S[id].u.p.n;
  const w = cur[0] > cur[1] ? 0 : 1;
  const t0 = M.teams[0], t1 = M.teams[1];
  const liveWins = getLiveSeriesWins(SERIES);

  let h = "";

  if (SERIES.vetoData) {
    const vd = SERIES.vetoData;
    const d = vd.duel;
    h += `
    <div class="veto-panel">
      <div class="duel-banner">
        <div class="duel-left">
          <span class="duel-badge">1V1 APERTURA</span>
          <span>
            DT <b>${t0.coach.n}</b> asigna a <b class="ca">${d.repLeft.n}</b> <small class="mut">(${d.reasonLeft})</small>
            vs
            DT <b>${t1.coach.n}</b> asigna a <b class="cb">${d.repRight.n}</b> <small class="mut">(${d.reasonRight})</small>
          </span>
        </div>
        <div class="duel-outcome">
          Victoria: <b>${d.winnerPlayer.n}</b> (${d.score1v1[0]}-${d.score1v1[1]}) · <b>${d.winnerTeamName}</b> toma <b>${d.chosenRole}</b> (A: ${d.teamA.name} / B: ${d.teamB.name})
        </div>
      </div>
      <div class="veto-steps-grid">
        ${vd.steps.map(st => `
          <div class="veto-step-card is-${st.type}">
            <div class="v-step-top">
              <span>${st.actor}</span>
              <span class="v-tag">${st.type === "ban" ? "BAN" : st.type === "decider" ? "DEC" : "PICK"}</span>
            </div>
            <div class="v-step-map">${st.mapName}</div>
            <div class="v-step-sub">${st.detail}</div>
          </div>
        `).join("")}
      </div>
    </div>`;
  }

  if (SERIES.format > 1) {
    h += `<div class="series-tabs">
      <button type="button" class="series-tab ${isSeriesSummary ? 'active' : ''} ${!SERIES.liveFinished ? 'unplayed' : ''}" onclick="selectSeriesTab('SERIES')" title="${SERIES.liveFinished ? 'Estadísticas globales de la serie' : 'Disponible al concluir la serie'}">
        GLOBAL SERIE BO${SERIES.format} [${liveWins[0]}-${liveWins[1]}]
      </button>`;

    SERIES.maps.forEach((mObj, idx) => {
      const isRevealed = SERIES.liveFinished || idx <= SERIES.liveMapIdx;
      const isFinishedMap = SERIES.liveFinished || idx < SERIES.liveMapIdx || (idx === SERIES.liveMapIdx && SERIES.liveShown >= mObj.rounds.length);
      const mw = !isFinishedMap ? "var(--mut)" : (mObj.sc[0] > mObj.sc[1] ? "var(--a)" : "var(--b)");

      let scoreLabel = "PENDIENTE";
      if (isFinishedMap) {
        scoreLabel = `${mObj.sc[0]}-${mObj.sc[1]}`;
      } else if (isRevealed) {
        const liveR = Math.min(SERIES.liveShown, mObj.rounds.length);
        scoreLabel = liveR > 0
          ? `${mObj.rounds[liveR - 1].score[0]}-${mObj.rounds[liveR - 1].score[1]} · R${liveR}`
          : "0-0";
      }

      h += `<button type="button" class="series-tab ${SERIES.activeTab === idx ? 'active' : ''} ${!isRevealed ? 'unplayed' : ''}" onclick="selectSeriesTab(${idx})">
        <span class="map-win-dot" style="background:${mw}"></span>
        M${idx + 1} · ${mObj.mapName.toUpperCase()} (${scoreLabel})
      </button>`;
    });
    h += `</div>`;
  }

  const mapHeaderLabel = isSeriesSummary
    ? `GLOBAL BO${SERIES.format} · ${SERIES.maps.map(m => `${m.mapName} ${m.sc[0]}-${m.sc[1]}`).join(" / ")}`
    : `MAPA ${currentMapIdx + 1}/${SERIES.maps.length}: ${M.mapName.toUpperCase()} (PICK: ${M.pickedBy}) · SERIE [${liveWins[0]}-${liveWins[1]}] · ${done ? "FINAL (" + R.length + " RND)" : "VIVO R" + maxR + "/" + R.length}`;

  const splitSubtitle = isSeriesSummary
    ? `TOTAL RONDAS: ${SERIES.maps.reduce((a, m) => a + m.rounds.length, 0)} (${SERIES.maps.length} MAPAS)`
    : getHalfSplits(M, maxR);

  h += `
  <div class="score">
    <div class="score-side">
      <div class="score-logo">${renderTeamLogo(t0.name)}</div>
      <div class="score-team">
        <span class="region-tag">${(TEAM_META[t0.name] && TEAM_META[t0.name].reg) || "VCT"}</span>
        <div class="t ca">${t0.name}</div>
        <div class="score-coach">
          <span>DT <b>${t0.coach.n}</b></span>
          <span class="mono">MAC ${t0.coach.macro} · ADP ${t0.coach.adapt}</span>
        </div>
      </div>
    </div>

    <div class="score-center">
      <span class="map-pill-top">${mapHeaderLabel}</span>
      <div class="n">
        <span class="ca">${cur[0]}</span> <span style="color:var(--dim)">:</span> <span class="cb">${cur[1]}</span>
      </div>
      <div class="half-splits">${splitSubtitle}</div>
    </div>

    <div class="score-side right">
      <div class="score-logo">${renderTeamLogo(t1.name)}</div>
      <div class="score-team">
        <span class="region-tag">${(TEAM_META[t1.name] && TEAM_META[t1.name].reg) || "VCT"}</span>
        <div class="t cb">${t1.name}</div>
        <div class="score-coach">
          <span class="mono">MAC ${t1.coach.macro} · ADP ${t1.coach.adapt}</span>
          <span>DT <b>${t1.coach.n}</b></span>
        </div>
      </div>
    </div>
  </div>`;

  if (!isSeriesSummary && M.comps) {
    const renderCompSide = (teamObj, compObj, colorCls) => {
      const chips = compObj.assignments.map(a => {
        const hiCls = a.isOpBoost ? "is-op" : (a.hushMastery >= 0.9 ? "is-hush" : "");
        return `<span class="agent-chip ${hiCls}" title="${a.playerName} · ${a.agent} (${a.role}) · Fit Mapa ${a.mapFit}">
          ${getRoleIcon(a.role)}<span>${a.agent}</span>
        </span>`;
      }).join("");
      const tags = compObj.tags.length ? `<span class="comp-tags mono">${compObj.tags.join(" · ")}</span>` : "";
      return `<div class="comp-side">
        <div class="comp-head">
          <b class="${colorCls}">${teamObj.name}</b>
          <span class="mono comp-fit">COMP ${compObj.compScore}</span>
          ${tags}
        </div>
        <div class="comp-chips">${chips}</div>
        ${renderAxisBadges(compObj)}
      </div>`;
    };
    h += `<div class="comp-bar">
      ${renderCompSide(t0, M.comps[0], "ca")}
      ${renderCompSide(t1, M.comps[1], "cb")}
    </div>`;
  }

  let mvp = null;
  if (done) mvp = Object.values(S).filter(s => s.ti == w).sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating))[0];

  if (!isSeriesSummary) {
    const slicedR = R.slice(0, maxR);
    const h1R = slicedR.filter(x => x.n <= 12);
    const h2R = slicedR.filter(x => x.n >= 13 && x.n <= 24);
    const otR = slicedR.filter(x => x.n > 24);

    const renderPipList = arr => arr.map(x => {
      const isSpecial = (x.cl && x.cl.won && x.cl.x >= 2) || x.hl.some(hItem => hItem.t === "ace");
      const hasTo = x.timeouts && x.timeouts.length > 0;
      return `<div class="strip-pip ${x.win ? "sb" : "sa"}${isSpecial ? " st" : ""}" onclick="jumpToRound(${x.n})" title="R${x.n} (${x.econ[0]} vs ${x.econ[1]}) · Gana ${M.teams[x.win].name}${hasTo ? ' · Pausa Táctica' : ''}">
        <span>${x.n}</span>
        ${hasTo ? '<span class="pip-to"></span>' : ""}
      </div>`;
    }).join("");

    const h1Sides = M.leftStartsAtk ? `${t0.name} ATK / ${t1.name} DEF` : `${t0.name} DEF / ${t1.name} ATK`;
    const h2Sides = M.leftStartsAtk ? `${t0.name} DEF / ${t1.name} ATK` : `${t0.name} ATK / ${t1.name} DEF`;

    h += `<div class="timeline-wrap">
      <div class="timeline-header">
        <span>Secuencia de Rondas (${M.mapName}) — Selecciona una ronda para inspeccionar duelos</span>
        <span>Contorno Oro = Clutch 1v2+ / Ace · Punto Púrpura = Timeout</span>
      </div>
      <div class="timeline-halves">
        <div class="half-block">
          <span class="half-title">1ª Mitad (R1–R12 · ${h1Sides})</span>
          <div class="strip">${renderPipList(h1R)}</div>
        </div>
        ${h2R.length ? `<div class="half-block">
          <span class="half-title">2ª Mitad (R13–R24 · ${h2Sides})</span>
          <div class="strip">${renderPipList(h2R)}</div>
        </div>` : ""}
        ${otR.length ? `<div class="half-block">
          <span class="half-title">Overtime (R25+)</span>
          <div class="strip">${renderPipList(otR)}</div>
        </div>` : ""}
      </div>
    </div>`;
  }

  h += `<div class="grid"><div>`;
  for (let ti = 0; ti < 2; ti++) {
    const tName = M.teams[ti].name;
    const dotColor = ti ? "var(--b)" : "var(--a)";
    h += `<div class="box">
      <div class="box-head">
        <div class="box-title-wrap">
          <span class="team-dot" style="background:${dotColor}"></span>
          ${renderTeamLogo(tName, "mini-team-logo")}
          <h2 class="${ti ? "cb" : "ca"}">${tName}</h2>
        </div>
        <span class="mono mut" style="font-size:11px">DT ${M.teams[ti].coach.n} · DISC ${M.teams[ti].coach.disc}</span>
      </div>
      <div class="sc">
        <table>
          <thead>
            <tr>
              <th>Jugador</th>
              <th style="text-align:left">Agente</th>
              <th title="VLR Rating 2.0">R 2.0</th>
              <th title="Average Combat Score">ACS</th>
              <th>K</th>
              <th>D</th>
              <th>A</th>
              <th>+/-</th>
              <th title="Kill, Assist, Survived, Traded %">KAST</th>
              <th>FB</th>
              <th>CL</th>
              ${done ? "<th>FORMA</th>" : ""}
            </tr>
          </thead>
          <tbody>`;

    Object.values(S).filter(s => s.ti == ti).sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating)).forEach(s => {
      const f = s.u.form;
      const fDelta = (f * 100 - 100).toFixed(1);
      const fCls = f > 1.03 ? "kd-pos" : f < 0.97 ? "kd-neg" : "mut";
      const diff = s.k - s.d;
      const diffCls = diff > 0 ? "kd-pos" : diff < 0 ? "kd-neg" : "mut";
      const ratVal = parseFloat(s.rating);
      const ratCls = ratVal >= 1.18 ? "rat-elite" : ratVal >= 1.02 ? "rat-good" : "mut";
      const acsColor = s.acs >= 245 ? "var(--gold)" : s.acs >= 195 ? "var(--ok)" : "var(--mut)";
      const isIGL = s.u.p.r.includes("IGL") || s.u.p.igl >= 85;
      const tagCls = s.u.isOpBoost ? "is-op" : (s.u.hushMastery >= 0.9 ? "is-hush" : "");
      const suffix = s.u.isOpBoost ? " [OP]" : (s.u.hushMastery >= 0.9 ? " [M]" : "");
      const agentDisplay = isSeriesSummary
        ? `<span class="agent-tag mono">${(s.agents || [s.u.agent]).join(" / ")}</span>`
        : `<span class="agent-tag mono ${tagCls}">${getRoleIcon(s.u.agentRole || s.u.p.r)} ${s.u.agent}${suffix}</span>`;

      h += `<tr>
        <td>
          <div class="pl">
            <span class="av">${s.u.p.n.slice(0, 2).toUpperCase()}</span>
            <span>
              <b>${s.u.p.n}${isIGL ? '<span class="igl-tag">IGL</span>' : ""}${s === mvp ? '<em class="badge">MVP</em>' : ""}</b>
              <small>${getRoleIcon(s.u.p.r)} ${s.u.p.r}</small>
            </span>
          </div>
        </td>
        <td style="text-align:left">${agentDisplay}</td>
        <td class="mono ${ratCls}">${s.rating}</td>
        <td class="mono">
          <div class="acs-cell">
            <b>${s.acs}</b>
            <div class="acs-bar-track"><div class="acs-bar-fill" style="width:${Math.min(100, s.acs / 3.4)}%;background:${acsColor}"></div></div>
          </div>
        </td>
        <td class="mono"><b>${s.k}</b></td>
        <td class="mono">${s.d}</td>
        <td class="mono">${s.a}</td>
        <td class="mono ${diffCls}">${diff > 0 ? "+" + diff : diff}</td>
        <td class="mono">${s.kast}%</td>
        <td class="mono">${s.fb}</td>
        <td class="mono">${s.cl}</td>
        ${done ? `<td class="mono ${fCls}">${fDelta > 0 ? "+" + fDelta : fDelta}%</td>` : ""}
      </tr>`;
    });
    h += `</tbody></table></div></div>`;
  }
  h += `</div><div>`;

  if (!isSeriesSummary && maxR > 0) {
    h += `<div id="radar2d-host"></div>`;
  }

  const hl = [];
  if (isSeriesSummary) {
    SERIES.maps.forEach((mObj, mIdx) => {
      mObj.rounds.forEach(rObj => {
        rObj.hl.forEach(x => hl.push({ ...x, mapTag: `M${mIdx + 1} (${mObj.mapName}) · R${x.r}` }));
      });
    });
  } else {
    for (let r = 0; r < maxR; r++) {
      R[r].hl.forEach(x => hl.push({ ...x, mapTag: `M${currentMapIdx + 1} · R${x.r}` }));
    }
  }

  const ic = {
    ace: "ACE / CLUTCH ÉLITE",
    cl: "CLUTCH 1vX",
    mk: "MULTIKILL",
    up: "THRIFTY / ECO",
    to: "TIMEOUT TÁCTICO"
  };

  h += `<div class="box">
    <div class="box-head">
      <h2>Registro de Jugadas Clave</h2>
      <span class="mono mut" style="font-size:11px">${hl.length} EVENTOS</span>
    </div>
    <div class="hl-scroll">`;
  h += hl.length
    ? hl.slice().reverse().map(x => {
        const cleanText = String(x.x).replace(/⏸️\s*/g, "");
        return `<div class="hl ${x.t}">
          <div class="hl-head"><span class="hl-tag">${ic[x.t] || "EVENTO"}</span><span class="mono mut" style="font-size:10.5px">${x.mapTag}</span></div>
          <div>${cleanText}</div>
        </div>`;
      }).join("")
    : `<span class="mut">Sin eventos críticos registrados en este tramo.</span>`;
  h += `</div></div>`;

  h += `<div class="box">
    <div class="box-head">
      <h2>Log de Rondas (${M.mapName})</h2>
      <span class="mono mut" style="font-size:11px">${maxR} / ${R.length} RND</span>
    </div>
    <div class="rounds-scroll">`;
  for (let r = maxR - 1; r >= 0; r--) {
    const x = R[r];
    const winClass = x.win ? "cb" : "ca";
    const hasTo = x.timeouts && x.timeouts.length > 0;
    h += `<details class="round-item" id="round-det-${x.n}" ${r === maxR - 1 ? "open" : ""}>
      <summary class="round-sum">
        <span>
          <b class="mono">R${x.n}</b>
          <span class="mono mut">[${x.before[0]}-${x.before[1]}]</span>
          · <b class="${winClass}">${M.teams[x.win].name}</b>
          ${hasTo ? '<span class="k-tag k-to" style="margin-left:6px">TIMEOUT</span>' : ""}
        </span>
        <span class="econ-pill">${x.econ[0]} vs ${x.econ[1]}</span>
      </summary>
      <div class="kill-list">` +
      (hasTo ? x.timeouts.map(to => `<div class="kill-row"><span class="k-tag k-to">PAUSA</span> <b>DT ${to.coach}</b> (${to.team})</div>`).join("") : "") +
      x.ev.map(e => {
        const kTeam = e.k.startsWith("0") ? "ca" : "cb";
        const vTeam = e.v.startsWith("0") ? "ca" : "cb";
        return `<div class="kill-row">
          <b class="${kTeam}">${nm(e.k)}</b>
          <span>→</span>
          <span class="${vTeam}">${nm(e.v)}</span>
          ${e.fb ? '<span class="k-tag k-fb">FB</span>' : ""}
          ${e.tr ? '<span class="k-tag k-tr">TR</span>' : ""}
        </div>`;
      }).join("") +
      `</div></details>`;
  }
  h += `</div></div></div></div>`;

  if (done && typeof window.renderShareBarHTML === "function") {
    h = window.renderShareBarHTML(SERIES, M, S, isSeriesSummary) + h;
  }
  outEl.innerHTML = h;
  if (typeof renderStory === "function") renderStory(M, S, isSeriesSummary, done);
  if (window.Radar2D) {
    if (!isSeriesSummary && maxR > 0) {
      window.Radar2D.mount(M, maxR, { isAutoPlaying: !!liveTimer });
    } else {
      window.Radar2D.stop();
    }
  }
}

function pair() {
  if (!$("#ta") || !$("#tb")) return null;
  const a = $("#ta").value, b = $("#tb").value;
  if (a == b) {
    if ($("#msg")) $("#msg").innerHTML = `<div class="cal-card" style="border-color:var(--vct-red)"><b style="color:var(--vct-red)">Selecciona dos equipos distintos para ejecutar la simulación.</b></div>`;
    return null;
  }
  if ($("#msg")) $("#msg").innerHTML = "";
  return [
    { name: a, players: TEAMS[a], coach: COACH[a] },
    { name: b, players: TEAMS[b], coach: COACH[b] }
  ];
}

function advanceLiveRound() {
  if (!SERIES || SERIES.liveFinished) {
    stopLive();
    return false;
  }

  SERIES.activeTab = SERIES.liveMapIdx;
  const activeM = SERIES.maps[SERIES.liveMapIdx];

  if (SERIES.liveShown < activeM.rounds.length) {
    SERIES.liveShown++;
    if (SERIES.liveShown >= activeM.rounds.length && SERIES.liveMapIdx === SERIES.maps.length - 1) {
      SERIES.liveFinished = true;
      SERIES.revealedMaps = SERIES.maps.length;
      if (!SERIES._isExternal && typeof window.recordCompletedSeries === "function") window.recordCompletedSeries(SERIES);
      stopLive();
    }
    render();
    return !SERIES.liveFinished;
  }

  if (SERIES.liveMapIdx + 1 < SERIES.maps.length) {
    SERIES.liveMapIdx++;
    SERIES.revealedMaps = Math.max(SERIES.revealedMaps, SERIES.liveMapIdx + 1);
    SERIES.activeTab = SERIES.liveMapIdx;
    SERIES.liveShown = 1;
    if (SERIES.liveShown >= SERIES.maps[SERIES.liveMapIdx].rounds.length && SERIES.liveMapIdx === SERIES.maps.length - 1) {
      SERIES.liveFinished = true;
      if (!SERIES._isExternal && typeof window.recordCompletedSeries === "function") window.recordCompletedSeries(SERIES);
      stopLive();
    }
    render();
    return !SERIES.liveFinished;
  }

  SERIES.liveFinished = true;
  SERIES.revealedMaps = SERIES.maps.length;
  if (!SERIES._isExternal && typeof window.recordCompletedSeries === "function") window.recordCompletedSeries(SERIES);
  stopLive();
  render();
  return false;
}

// Controles compartidos (+1 Ronda y Auto-Play funcionan tanto en index.html como en manager.html)
if ($("#st")) {
  $("#st").onclick = () => {
    stopLive();
    if ($("#ta") && $("#tb")) {
      const p = pair();
      if (!p) return;
      if (!SERIES || SERIES.liveFinished) {
        SERIES = initSeriesState(buildSeries(p[0], p[1], currentFormat, true), true);
      }
    } else if (!SERIES) {
      return;
    } else if (SERIES.liveFinished) {
      SERIES = initSeriesState({ ...SERIES, _isExternal: true }, true);
    }
    advanceLiveRound();
  };
}

if ($("#liveBtn")) {
  $("#liveBtn").onclick = () => {
    if (liveTimer) {
      stopLive();
      return;
    }
    if ($("#ta") && $("#tb")) {
      const p = pair();
      if (!p) return;
      if (!SERIES || SERIES.liveFinished) {
        SERIES = initSeriesState(buildSeries(p[0], p[1], currentFormat, true), true);
      } else {
        SERIES.activeTab = SERIES.liveMapIdx;
      }
    } else {
      if (!SERIES) return;
      if (SERIES.liveFinished) SERIES = initSeriesState({ ...SERIES, _isExternal: true }, true);
      else SERIES.activeTab = SERIES.liveMapIdx;
    }

    const btn = $("#liveBtn");
    btn.classList.add("live-active");
    btn.textContent = "Pausar";

    if (!advanceLiveRound()) return;
    liveTimer = setInterval(() => {
      if (!advanceLiveRound()) stopLive();
    }, 340);
  };
}

if ($("#themeToggle")) {
  $("#themeToggle").onclick = () => {
    const root = document.documentElement;
    const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("vct_sim_theme", next); } catch (e) {}
    if ($("#themeLabel")) $("#themeLabel").textContent = next.toUpperCase();
  };
}

// ===== CONTROLES EXCLUSIVOS DE INDEX.HTML (SIMULADOR RÁPIDO + BASE DE DATOS) =====
let activeRegion = "ALL";
let searchQuery = "";

function formatStatCell(team, idx, key, val) {
  const cls = val >= 94 ? "stat-elite" : val >= 89 ? "stat-high" : val <= 76 ? "stat-low" : "";
  return `<td class="mono ${cls}">
    <input type="number" min="40" max="99" value="${val}" class="stat-edit"
      aria-label="${TEAMS[team][idx].n} ${key}"
      onchange="updatePlayerStat('${team}', ${idx}, '${key}', this.value)">
  </td>`;
}

window.updatePlayerStat = function(team, idx, key, val) {
  const num = Math.max(40, Math.min(99, parseInt(val, 10) || 75));
  TEAMS[team][idx][key] = num;
  saveTeams();
  applyDynamicTeamColors();
  renderDatabase();
};

window.toggleSubStatus = function(team, idx) {
  const roster = TEAMS[team];
  const target = roster[idx];
  if (target.sub) {
    const currentStarters = roster.filter(p => !p.sub);
    if (currentStarters.length >= 5) currentStarters[currentStarters.length - 1].sub = 1;
    target.sub = 0;
  } else {
    const waitingSub = roster.find((p, i) => p.sub && i !== idx);
    if (waitingSub) {
      waitingSub.sub = 0;
      target.sub = 1;
    }
  }
  saveTeams();
  applyDynamicTeamColors();
  renderDatabase();
  if ($("#go")) $("#go").click();
};

function renderDatabase() {
  const rosEl = $("#ros");
  if (!rosEl) return;
  const q = searchQuery.trim().toLowerCase();
  let r = `<table>
    <thead>
      <tr>
        <th>Jugador</th>
        <th>Estado</th>
        <th>Rol &amp; Pool de Agentes</th>
        <th title="Puntería y Duelos (0-99)">AIM</th>
        <th title="Primer Duelo / Apertura (0-99)">FD</th>
        <th title="Resolución de Clutches 1vX (0-99)">CLU</th>
        <th title="Agresividad de Entrada (0-99)">ENT</th>
        <th title="Impacto de Utilidad y Asistencias (0-99)">UTI</th>
        <th title="Lectura de Juego / Calling (0-99)">IGL</th>
        <th title="Confianza Estadística (0-99)">CONF</th>
        <th title="Consistencia / KAST (0-99)">CONS</th>
        <th title="Techo de Potencial (0-99)">POT</th>
      </tr>
    </thead>
    <tbody>`;

  for (const t in TEAMS) {
    const meta = TEAM_META[t] || { reg: "VCT", color: "#E5484D" };
    if (activeRegion !== "ALL" && meta.reg !== activeRegion) continue;

    const matchingPlayers = TEAMS[t]
      .map((p, idx) => ({ p, idx }))
      .filter(({ p }) => {
        if (!q) return true;
        const pool = getPlayerAgents(p).join(" ").toLowerCase();
        return p.n.toLowerCase().includes(q) || p.r.toLowerCase().includes(q) || t.toLowerCase().includes(q) || pool.includes(q);
      });

    if (!matchingPlayers.length) continue;

    const c = COACH[t];
    const hasBench = TEAMS[t].length > 5;
    const mp = getTeamMapProfile(t);
    const bestStr = mp.best.map(x => `${x.mapName} (${x.score})`).join(", ");
    const worstStr = `${mp.worst.mapName} (${mp.worst.score})`;

    r += `<tr class="team-group-row">
      <td colspan="12" class="r">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:space-between">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            ${renderTeamLogo(t, "mini-team-logo")}
            <span class="region-tag">${meta.reg}</span>
            <b style="color:var(--fg);font-size:14px">${t}</b>
            <span class="mono" style="font-size:11px;color:var(--mut)">
              DT <b style="color:var(--fg)">${c.n}</b> · MAC ${c.macro} · MIC ${c.micro} · ADP ${c.adapt} · DEV ${c.dev} · DISC ${c.disc} · <b style="color:var(--fg)">OVR ${getTeamOvr(t)}</b>
            </span>
          </div>
          <div class="mono" style="font-size:10.5px;color:var(--mut)">
            <span style="color:var(--ok)">FUERTES: ${bestStr}</span> · <span style="color:var(--vct-red)">DÉBIL: ${worstStr}</span>
          </div>
        </div>
      </td>
    </tr>`;

    matchingPlayers.forEach(({ p, idx }) => {
      const statusBtn = hasBench
        ? `<button type="button" class="sub-swap-btn ${p.sub ? 'is-sub' : 'is-starter'}" onclick="toggleSubStatus('${t}', ${idx})">${p.sub ? '6TH SUB ⇄' : 'TITULAR ⇄'}</button>`
        : `<span class="sub-swap-btn is-starter" style="cursor:default">TITULAR</span>`;
      const topAgents = getPlayerAgents(p).slice(0, 3).join(", ");
      const hushTag = HUSH_MASTERY[p.n] >= 0.9 ? `<span class="igl-tag" style="color:var(--purple);border-color:var(--purple)">HUSH</span>` : "";

      r += `<tr>
        <td><b>${p.n}</b>${hushTag}</td>
        <td style="text-align:left">${statusBtn}</td>
        <td class="r">${getRoleIcon(p.r)} ${p.r} <span class="mono mut" style="font-size:10.5px;margin-left:6px">[${topAgents}]</span></td>
        ${formatStatCell(t, idx, "aim", p.aim)}
        ${formatStatCell(t, idx, "fd", p.fd)}
        ${formatStatCell(t, idx, "clutch", p.clutch)}
        ${formatStatCell(t, idx, "entry", p.entry)}
        ${formatStatCell(t, idx, "util", p.util)}
        ${formatStatCell(t, idx, "igl", p.igl)}
        ${formatStatCell(t, idx, "conf", p.conf)}
        ${formatStatCell(t, idx, "cons", p.cons)}
        ${formatStatCell(t, idx, "pot", p.pot)}
      </tr>`;
    });
  }
  r += `</tbody></table>`;
  rosEl.innerHTML = r;
}

function updateDynamicCounters() {
  const teamNames = Object.keys(TEAMS);
  const totalPlayers = teamNames.reduce((acc, t) => acc + TEAMS[t].length, 0);
  const metaEl = $("#brandMeta");
  if (metaEl && $("#ta")) {
    metaEl.textContent = `VLR.GG TACTICAL ENGINE · ${teamNames.length} FRANQUICIAS · ${totalPlayers} PROS`;
  }
  const regCounts = { ALL: teamNames.length, AMERICAS: 0, EMEA: 0, PACIFIC: 0, CHINA: 0 };
  teamNames.forEach(t => {
    const reg = (TEAM_META[t] && TEAM_META[t].reg) || "";
    if (regCounts[reg] !== undefined) regCounts[reg]++;
  });
  document.querySelectorAll("#regionTabs .tab-btn").forEach(btn => {
    const r = btn.dataset.reg;
    if (regCounts[r] !== undefined) btn.textContent = `${r === "ALL" ? "TODOS" : r} (${regCounts[r]})`;
  });
}

window.refreshTeamSelects = function(selectInA = null) {
  const selA = $("#ta"), selB = $("#tb");
  if (!selA || !selB) return;
  const prevA = selectInA || selA.value;
  const prevB = selB.value;
  selA.innerHTML = "";
  selB.innerHTML = "";
  for (const t of Object.keys(TEAMS)) {
    selA.add(new Option(t, t));
    selB.add(new Option(t, t));
  }
  if (TEAMS[prevA]) selA.value = prevA;
  if (TEAMS[prevB] && prevB !== selA.value) selB.value = prevB;
  else selB.selectedIndex = selA.selectedIndex === 0 ? 1 : 0;
  applyDynamicTeamColors();
  updateDynamicCounters();
  renderDatabase();
};

window.closeMgrViewer = function() {
  stopLive();
  if (window.Radar2D) window.Radar2D.stop();
  const sec = $("#mgrViewerSection");
  if (sec) sec.hidden = true;
};

window.loadExternalSeriesIntoViewer = function(teamAName, teamBName, seriesObj, autoPlay = false, contextLabel = "") {
  stopLive();
  applyTeamColorsForPair(teamAName, teamBName);

  const mgrSec = $("#mgrViewerSection");
  if (mgrSec) mgrSec.hidden = false;

  if ($("#ta") && $("#tb")) {
    $("#ta").value = teamAName;
    $("#tb").value = teamBName;
    applyDynamicTeamColors();
  }

  currentFormat = seriesObj.format || 3;
  document.querySelectorAll("#formatGroup .seg-btn").forEach(b => {
    b.classList.toggle("active", parseInt(b.dataset.fmt, 10) === currentFormat);
  });

  SERIES = initSeriesState({ ...seriesObj, _isExternal: true }, autoPlay);

  if (contextLabel && $("#msg")) {
    const backAction = mgrSec
      ? `<button type="button" class="t-btn-sm mono" onclick="closeMgrViewer()">Volver a mi Club</button>`
      : `<a href="#torneo" class="nav-link mono" style="border:1px solid var(--bd-hi);font-size:11px;padding:4px 9px">Volver al Torneo</a>`;
    $("#msg").innerHTML = `<div class="cal-card" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <span class="mono" style="font-size:11.5px"><b>SERIE OFICIAL</b> · ${contextLabel}</span>
      ${backAction}
    </div>`;
  }

  render();
  if (typeof refreshPreview === "function") refreshPreview();
  const targetScroll = mgrSec || $("#out");
  if (targetScroll) targetScroll.scrollIntoView({ behavior: "smooth", block: "start" });

  if (autoPlay) {
    const btn = $("#liveBtn");
    if (btn) {
      btn.classList.add("live-active");
      btn.textContent = "Pausar";
    }
    if (advanceLiveRound()) {
      liveTimer = setInterval(() => {
        if (!advanceLiveRound()) stopLive();
      }, 340);
    }
  }
};

// Inicialización de la página principal (solo se ejecuta en index.html)
if ($("#ta") && $("#tb")) {
  document.querySelectorAll("#formatGroup .seg-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll("#formatGroup .seg-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentFormat = parseInt(btn.dataset.fmt, 10) || 3;
      if ($("#go")) $("#go").click();
    };
  });

  if ($("#mapSel")) {
    $("#mapSel").onchange = () => {
      const v = $("#mapSel").value;
      if ($("#mapModInfo")) {
        $("#mapModInfo").textContent = v === "AUTO"
          ? "Protocolo VCT: 1v1 define Equipo A/B + Veto de 7 pasos (con sinergia de 30 agentes)"
          : MAP_POOL[v].desc;
      }
      if ($("#go")) $("#go").click();
    };
  }

  if ($("#go")) {
    $("#go").onclick = () => {
      stopLive();
      const p = pair();
      if (!p) return;
      SERIES = initSeriesState(buildSeries(p[0], p[1], currentFormat, false), false);
      if (_bootDone && typeof window.recordCompletedSeries === "function") {
        window.recordCompletedSeries(SERIES);
      }
      render();
    };
  }

  if ($("#cal")) {
    $("#cal").onclick = () => {
      stopLive();
      const p = pair();
      if (!p) return;
      let w = 0, ot = 0, rd = 0, totalMaps = 0, N = 500;
      for (let i = 0; i < N; i++) {
        const s = buildSeries(p[0], p[1], currentFormat, false);
        if (s.seriesScore[0] > s.seriesScore[1]) w++;
        totalMaps += s.maps.length;
        s.maps.forEach(m => {
          if (m.rounds.length > 24) ot++;
          rd += m.rounds.length;
        });
      }
      const pctA = (w / N * 100).toFixed(1);
      const pctB = ((N - w) / N * 100).toFixed(1);
      if ($("#msg")) {
        $("#msg").innerHTML = `
        <div class="cal-card">
          <div class="cal-top">
            <span><b>SIMULACIÓN MONTE CARLO (${N} SERIES BO${currentFormat})</b> · ${p[0].name} vs ${p[1].name}</span>
            <span class="mono"><b class="ca">${p[0].name} ${pctA}%</b> — <b class="cb">${pctB}% ${p[1].name}</b></span>
          </div>
          <div class="cal-bar"><div class="cal-bar-a" style="width:${pctA}%"></div></div>
          <div class="cal-meta">
            <span>Mapas/Serie: <b>${(totalMaps / N).toFixed(2)}</b></span>
            <span>Rondas/Serie: <b>${(rd / N).toFixed(1)}</b></span>
            <span>Tasa Overtime: <b>${(ot / totalMaps * 100).toFixed(1)}%</b></span>
          </div>
        </div>`;
      }
    };
  }

  if ($("#swapBtn")) {
    $("#swapBtn").onclick = () => {
      const a = $("#ta").selectedIndex;
      $("#ta").selectedIndex = $("#tb").selectedIndex;
      $("#tb").selectedIndex = a;
      applyDynamicTeamColors();
      if ($("#go")) $("#go").click();
    };
  }

  $("#ta").onchange = () => { applyDynamicTeamColors(); if ($("#go")) $("#go").click(); };
  $("#tb").onchange = () => { applyDynamicTeamColors(); if ($("#go")) $("#go").click(); };

  if ($("#resetDbBtn")) {
    $("#resetDbBtn").onclick = () => {
      TEAMS = JSON.parse(JSON.stringify(DEFAULT_TEAMS));
      if (typeof window.reapplyCustomTeams === "function") window.reapplyCustomTeams();
      saveTeams();
      applyDynamicTeamColors();
      renderDatabase();
      if ($("#go")) $("#go").click();
    };
  }

  document.querySelectorAll("#regionTabs .tab-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll("#regionTabs .tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeRegion = btn.dataset.reg;
      renderDatabase();
    };
  });

  if ($("#dbSearch")) {
    $("#dbSearch").oninput = e => {
      searchQuery = e.target.value;
      renderDatabase();
    };
  }

  syncMapSelector();
  for (const t of Object.keys(TEAMS)) {
    $("#ta").add(new Option(t, t));
    $("#tb").add(new Option(t, t));
  }
  $("#tb").selectedIndex = 6;
  applyDynamicTeamColors();
  updateDynamicCounters();
  renderDatabase();
  if ($("#go")) $("#go").click();
  _bootDone = true;
}