const $ = s => document.querySelector(s);
    // SMART MULTI-PATH LOGO LOADER + SVG CREST FALLBACK
    window.handleLogoError = function(imgEl) {
      const file = imgEl.getAttribute("data-file");
      const code = imgEl.getAttribute("data-code") || "VCT";
      const color = imgEl.getAttribute("data-color") || "#FF4655";
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
        <rect width="80" height="80" rx="8" fill="#141A23" stroke="${color}" stroke-width="4"/>
        <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="#EEF2F7" font-family="Barlow Condensed, sans-serif" font-weight="800" font-size="24">${code}</text>
      </svg>`;
      imgEl.src = "data:image/svg+xml;utf8," + encodeURIComponent(svg);
    };

    function renderTeamLogo(teamName, cls = "") {
      const m = TEAM_META[teamName] || { logo: "vct.png", code: teamName.slice(0, 3).toUpperCase(), color: "#FF4655", logoCls: "" };
      return `<img src="${m.logo}" alt="${teamName}" class="${cls} ${m.logoCls || ""}" data-file="${m.logo}" data-code="${m.code}" data-color="${m.color}" data-step="0" onerror="handleLogoError(this)">`;
    }

    // ROLE INLINE SVG ICONS
    function getRoleIcon(roleStr) {
      const r = roleStr.toLowerCase();
      if (r.includes("duelista")) {
        return `<svg class="role-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 2L19 21L12 17L5 21L12 2Z"/></svg>`;
      }
      if (r.includes("iniciador")) {
        return `<svg class="role-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
      }
      if (r.includes("controlador")) {
        return `<svg class="role-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/></svg>`;
      }
      if (r.includes("centinela")) {
        return `<svg class="role-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
      }
      return `<svg class="role-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="12 2 22 12 12 22 2 12"/></svg>`;
    }

    function applyDynamicTeamColors() {
      const a = $("#ta").value, b = $("#tb").value;
      const metaA = TEAM_META[a] || { color: "#FF4655", reg: "VCT" };
      let colorA = metaA.color;
      const metaB = TEAM_META[b] || { color: "#00E5FF", reg: "VCT" };
      let colorB = metaB.color;

      if (a && b && Math.abs(parseInt(colorA.slice(1, 3), 16) - parseInt(colorB.slice(1, 3), 16)) < 38 &&
          Math.abs(parseInt(colorA.slice(3, 5), 16) - parseInt(colorB.slice(3, 5), 16)) < 48) {
        colorB = "#00E5FF";
      }

      document.documentElement.style.setProperty("--a", colorA);
      document.documentElement.style.setProperty("--a-soft", colorA + "24");
      document.documentElement.style.setProperty("--b", colorB);
      document.documentElement.style.setProperty("--b-soft", colorB + "24");

      $("#pickerCardA").style.setProperty("--team-color", colorA);
      $("#pickerCardB").style.setProperty("--team-color", colorB);
      $("#logoWrapA").innerHTML = renderTeamLogo(a);
      $("#logoWrapB").innerHTML = renderTeamLogo(b);

      if (a && TEAMS[a]) {
        $("#metaA").innerHTML = `<span>${metaA.reg}</span> · <span>DT ${COACH[a].n}</span> <span class="ovr-pill">OVR ${getTeamOvr(a)}</span>`;
      }
      if (b && TEAMS[b]) {
        $("#metaB").innerHTML = `<span>${metaB.reg}</span> · <span>DT ${COACH[b].n}</span> <span class="ovr-pill">OVR ${getTeamOvr(b)}</span>`;
      }
    }

    // SERIES STATE WITH FULL PROGRESSIVE ROUND-BY-ROUND / AUTO-PLAY SUPPORT ACROSS BO3 & BO5
    let SERIES = null;
    let shown = 0, liveTimer = null, currentFormat = 3;

    function stopLive() {
      if (liveTimer) {
        clearInterval(liveTimer);
        liveTimer = null;
      }
      const btn = $("#liveBtn");
      if (btn) {
        btn.classList.remove("live-active");
        btn.textContent = "▶ Auto-Play Vivo";
      }
    }

    function getLiveSeriesWins(series, currentMapIdx, currentShownRounds) {
      if (series.activeTab === "SERIES") return series.seriesScore;
      let w0 = 0, w1 = 0;
      const limit = series.revealedMaps || series.maps.length;
      for (let i = 0; i < limit; i++) {
        const m = series.maps[i];
        if (i < currentMapIdx || (i === currentMapIdx && currentShownRounds >= m.rounds.length)) {
          if (m.sc[0] > m.sc[1]) w0++;
          else w1++;
        }
      }
      return [w0, w1];
    }

    function computeStatsForMatch(M, maxRounds) {
      const S = {};
      M.teams.forEach((t, ti) => t.units.forEach((u, i) => {
        S[ti + "-" + i] = { k: 0, d: 0, a: 0, fb: 0, fd: 0, cl: 0, kastRounds: 0, u, ti };
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
          if (e.tr) {
            roundKast.add(e.v);
          }
          if (e.fb) {
            S[e.k].fb++;
            S[e.v].fd++;
          }
        });
        if (R.cl && R.cl.won) S[R.cl.id].cl++;
        roundKast.forEach(id => {
          if (S[id]) S[id].kastRounds++;
        });
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
        S[ti + "-" + i] = { k: 0, d: 0, a: 0, fb: 0, fd: 0, cl: 0, kastRounds: 0, totalRounds: 0, formSum: 0, u, ti };
      }));

      const playedCount = series.revealedMaps || series.maps.length;
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
      let txt = `1ª MITAD (${s1}): ${h1[0]}-${h1[1]}`;
      if (maxR > 12) txt += `  ·  2ª MITAD (${s2}): ${h2[0]}-${h2[1]}`;
      if (maxR > 24) txt += `  ·  OT: ${ot[0]}-${ot[1]}`;
      return txt;
    }

    window.selectSeriesTab = function(tab) {
      stopLive();
      if (!SERIES) return;
      if (tab !== "SERIES" && tab >= SERIES.revealedMaps) return;
      SERIES.activeTab = tab;
      if (tab !== "SERIES") {
        shown = SERIES.maps[tab].rounds.length;
      }
      render();
    };

    window.jumpToRound = function(rn) {
      const el = document.getElementById("round-det-" + rn);
      if (el) {
        el.open = true;
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    };

    function render() {
      if (!SERIES || !SERIES.maps.length) {
        $("#out").innerHTML = "";
        return;
      }

      const isSeriesSummary = SERIES.format > 1 && SERIES.activeTab === "SERIES";
      const currentMapIdx = isSeriesSummary ? (SERIES.revealedMaps - 1) : (SERIES.activeTab || 0);
      const M = SERIES.maps[currentMapIdx];
      const maxR = isSeriesSummary ? M.rounds.length : shown;
      const S = isSeriesSummary ? computeSeriesStats(SERIES) : computeStatsForMatch(M, maxR);
      const R = M.rounds;
      const cur = isSeriesSummary ? SERIES.seriesScore : (maxR ? R[maxR - 1].score : [0, 0]);
      const done = isSeriesSummary ? true : (maxR == R.length);
      const nm = id => S[id].u.p.n;
      const w = cur[0] > cur[1] ? 0 : 1;
      const t0 = M.teams[0], t1 = M.teams[1];

      let h = "";

      // 1v1 DUEL & 7-STEP COACH VETO PANEL
      if (SERIES.vetoData) {
        const vd = SERIES.vetoData;
        const d = vd.duel;
        h += `
        <div class="veto-panel">
          <div class="duel-banner">
            <div class="duel-left">
              <span class="duel-badge">⚔ DUELO 1v1 DE APERTURA</span>
              <span>
                DT <b>${t0.coach.n}</b> envía a <b class="ca">${d.repLeft.n}</b> <small class="mut">(${d.reasonLeft})</small>
                vs
                DT <b>${t1.coach.n}</b> envía a <b class="cb">${d.repRight.n}</b> <small class="mut">(${d.reasonRight})</small>
              </span>
            </div>
            <div class="duel-outcome">
              Gana <b>${d.winnerPlayer.n}</b> (${d.score1v1[0]}-${d.score1v1[1]}) ▸ <b>${d.winnerTeamName}</b> elige ser <b>${d.chosenRole}</b> (Equipo A: <b>${d.teamA.name}</b> · Equipo B: <b>${d.teamB.name}</b>)
            </div>
          </div>
          <div class="veto-steps-grid">
            ${vd.steps.map(st => `
              <div class="veto-step-card is-${st.type}">
                <div class="v-step-top">
                  <span>${st.actor}</span>
                  <span>${st.type === "ban" ? "BANEADO" : st.type === "decider" ? "DECIDER" : "PICK"}</span>
                </div>
                <div class="v-step-map">${st.mapName}</div>
                <div class="v-step-sub">${st.detail}</div>
              </div>
            `).join("")}
          </div>
        </div>`;
      }

      // SERIES TABS (FOR BO3 / BO5) WITH PROGRESSIVE LIVE STATE
      if (SERIES.format > 1) {
        const seriesCompletelyDone = SERIES.revealedMaps >= SERIES.maps.length && (isSeriesSummary || shown >= SERIES.maps[SERIES.maps.length - 1].rounds.length);
        const liveWins = getLiveSeriesWins(SERIES, currentMapIdx, maxR);
        h += `<div class="series-tabs">
          <button type="button" class="series-tab ${isSeriesSummary ? 'active' : ''} ${!seriesCompletelyDone ? 'unplayed' : ''}" onclick="selectSeriesTab('SERIES')" title="${seriesCompletelyDone ? 'Ver estadísticas acumuladas de toda la serie' : 'Se desbloquea al terminar la serie en vivo'}">
            ★ RESUMEN SERIE BO${SERIES.format} (${liveWins[0]}-${liveWins[1]})
          </button>`;

        SERIES.maps.forEach((mObj, idx) => {
          const isRevealed = idx < SERIES.revealedMaps;
          const isFinishedMap = idx < currentMapIdx || (idx === currentMapIdx && done) || isSeriesSummary;
          const mw = !isFinishedMap ? "var(--mut)" : (mObj.sc[0] > mObj.sc[1] ? "var(--a)" : "var(--b)");
          const scoreLabel = !isRevealed
            ? "Pendiente"
            : isFinishedMap
              ? `${mObj.sc[0]}-${mObj.sc[1]}`
              : `${maxR ? mObj.rounds[maxR - 1].score[0] : 0}-${maxR ? mObj.rounds[maxR - 1].score[1] : 0} · R${maxR}`;

          h += `<button type="button" class="series-tab ${SERIES.activeTab === idx ? 'active' : ''} ${!isRevealed ? 'unplayed' : ''}" onclick="selectSeriesTab(${idx})">
            <span class="map-win-dot" style="background:${mw}"></span>
            MAPA ${idx + 1}: ${mObj.mapName.toUpperCase()} (${scoreLabel})
          </button>`;
        });
        h += `</div>`;
      }

      const liveWins = getLiveSeriesWins(SERIES, currentMapIdx, maxR);
      const mapHeaderLabel = isSeriesSummary
        ? `RESULTADO GLOBAL SERIE BO${SERIES.format} · ${SERIES.maps.map(m => `${m.mapName} (${m.sc[0]}-${m.sc[1]})`).join(" · ")}`
        : `MAPA ${currentMapIdx + 1}/${SERIES.maps.length}: ${M.mapName.toUpperCase()} (Pick: ${M.pickedBy}) · SERIE [${liveWins[0]}-${liveWins[1]}] · ${done ? "FINAL (" + R.length + " RONDAS)" : "EN VIVO · R" + maxR + "/" + R.length}`;

      const splitSubtitle = isSeriesSummary
        ? `Rondas jugadas: ${SERIES.maps.reduce((a, m) => a + m.rounds.length, 0)} EN ${SERIES.maps.length} MAPAS`
        : getHalfSplits(M, maxR);

      h += `
      <div class="score">
        <div class="score-side">
          <div class="score-logo">${renderTeamLogo(t0.name)}</div>
          <div class="score-team">
            <span class="region-tag">${TEAM_META[t0.name].reg}</span>
            <div class="t ca">${t0.name}</div>
            <div class="score-coach">
              <span>DT: <b>${t0.coach.n}</b></span>
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
            <span class="region-tag">${TEAM_META[t1.name].reg}</span>
            <div class="t cb">${t1.name}</div>
            <div class="score-coach">
              <span class="mono">MAC ${t1.coach.macro} · ADP ${t1.coach.adapt}</span>
              <span>DT: <b>${t1.coach.n}</b></span>
            </div>
          </div>
        </div>
      </div>`;

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
          return `<div class="strip-pip ${x.win ? "sb" : "sa"}${isSpecial ? " st" : ""}" onclick="jumpToRound(${x.n})" title="Ronda ${x.n} (${x.econ[0]} vs ${x.econ[1]}) · Gana ${M.teams[x.win].name}${hasTo ? ' · ⏸ Timeout Táctico' : ''}">
            <span>${x.n}</span>
            ${hasTo ? '<span class="pip-to">⏸</span>' : ""}
          </div>`;
        }).join("");

        const h1Sides = M.leftStartsAtk ? `${t0.name} ATK / ${t1.name} DEF` : `${t0.name} DEF / ${t1.name} ATK`;
        const h2Sides = M.leftStartsAtk ? `${t0.name} DEF / ${t1.name} ATK` : `${t0.name} ATK / ${t1.name} DEF`;

        h += `<div class="timeline-wrap">
          <div class="timeline-header">
            <span>Línea de tiempo táctica (${M.mapName}) — Clic en cualquier ronda para abrir killfeed</span>
            <span>★ Borde Oro = Clutch 1v2+ / Ace · ⏸ = Timeout de Coach</span>
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
        h += `<div class="box ${ti ? "team-b-box" : "team-a-box"}">
          <div class="box-head">
            <div class="box-title-wrap">
              ${renderTeamLogo(tName, "mini-team-logo")}
              <h2 class="${ti ? "cb" : "ca"}">${tName}</h2>
            </div>
            <span class="mono mut" style="font-size:11.5px">DT ${M.teams[ti].coach.n} · Disc ${M.teams[ti].coach.disc}</span>
          </div>
          <div class="sc">
            <table>
              <thead>
                <tr>
                  <th>Jugador</th>
                  <th title="VLR Rating 2.0">R 2.0</th>
                  <th title="Average Combat Score">ACS</th>
                  <th>K</th>
                  <th>D</th>
                  <th>A</th>
                  <th>+/-</th>
                  <th title="Kill, Assist, Survived, Traded %">KAST</th>
                  <th>FB</th>
                  <th>CL</th>
                  ${done ? "<th>Forma</th>" : ""}
                </tr>
              </thead>
              <tbody>`;

        Object.values(S).filter(s => s.ti == ti).sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating)).forEach(s => {
          const f = s.u.form, ch = f > 1.04 ? "🔥" : f < .96 ? "❄️" : "·";
          const diff = s.k - s.d;
          const diffCls = diff > 0 ? "kd-pos" : diff < 0 ? "kd-neg" : "mut";
          const ratVal = parseFloat(s.rating);
          const ratCls = ratVal >= 1.18 ? "rat-elite" : ratVal >= 1.02 ? "rat-good" : "mut";
          const acsColor = s.acs >= 245 ? "var(--gold)" : s.acs >= 195 ? "var(--ok)" : "var(--mut)";
          const isIGL = s.u.p.r.includes("IGL") || s.u.p.igl >= 85;

          h += `<tr>
            <td>
              <div class="pl">
                <span class="av">${s.u.p.n.slice(0, 2).toUpperCase()}</span>
                <span>
                  <b>${s.u.p.n}${isIGL ? '<span class="igl-tag">IGL</span>' : ""}${s === mvp ? '<em class="badge">★ MVP</em>' : ""}</b>
                  <small>${getRoleIcon(s.u.p.r)} ${s.u.p.r}</small>
                </span>
              </div>
            </td>
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
            ${done ? `<td class="mono">${ch} ${(f * 100 - 100 > 0 ? "+" : "") + (f * 100 - 100).toFixed(1)}%</td>` : ""}
          </tr>`;
        });
        h += `</tbody></table></div></div>`;
      }
      h += `</div><div>`;

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
        ace: "🏆 Ace / clutch",
        cl: "🧊 CLUTCH",
        mk: "💥 MULTIKILL",
        up: "💸 Sorpresa en eco",
        to: "⏸️ Pausa táctica"
      };

      h += `<div class="box">
        <div class="box-head">
          <h2>Jugadas Clave &amp; Pizarras</h2>
          <span class="mono mut" style="font-size:11.5px">${hl.length} eventos de alto impacto</span>
        </div>
        <div class="hl-scroll">`;
      h += hl.length
        ? hl.slice().reverse().map(x => `<div class="hl ${x.t}">
            <div class="hl-head"><b>${ic[x.t] || "EVENTO"}</b><span class="mono mut" style="font-size:10.5px">${x.mapTag}</span></div>
            <div>${x.x}</div>
          </div>`).join("")
        : `<span class="mut">Todavía no hay jugadas críticas en las rondas mostradas.</span>`;
      h += `</div></div>`;

      h += `<div class="box">
        <div class="box-head">
          <h2>Telemetría de Rondas (${M.mapName})</h2>
          <span class="mono mut" style="font-size:11.5px">${maxR} / ${R.length} rondas</span>
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
              ▸ Gana <b class="${winClass}">${M.teams[x.win].name}</b>
              ${hasTo ? '<span class="k-tag k-to" style="margin-left:6px">⏸ TIMEOUT</span>' : ""}
            </span>
            <span class="econ-pill">${x.econ[0]} vs ${x.econ[1]}</span>
          </summary>
          <div class="kill-list">` +
          (hasTo ? x.timeouts.map(to => `<div class="kill-row"><span class="k-tag k-to">PAUSA TÁCTICA</span> <b>DT ${to.coach}</b> ajusta el sistema de ${to.team}</div>`).join("") : "") +
          x.ev.map(e => {
            const kTeam = e.k.startsWith("0") ? "ca" : "cb";
            const vTeam = e.v.startsWith("0") ? "ca" : "cb";
            return `<div class="kill-row">
              <b class="${kTeam}">${nm(e.k)}</b>
              <span>▸</span>
              <span class="${vTeam}">${nm(e.v)}</span>
              ${e.fb ? '<span class="k-tag k-fb">FIRST BLOOD</span>' : ""}
              ${e.tr ? '<span class="k-tag k-tr">TRADE</span>' : ""}
            </div>`;
          }).join("") +
          `</div></details>`;
      }
      h += `</div></div></div></div>`;
      $("#out").innerHTML = h;
      if (typeof renderStory === "function") renderStory(M, S, isSeriesSummary, done);
    }

    function pair() {
      const a = $("#ta").value, b = $("#tb").value;
      if (a == b) {
        $("#msg").innerHTML = `<div class="cal-card" style="border-color:var(--vct-red)"><b style="color:var(--vct-red)">Selecciona dos equipos distintos para simular el enfrentamiento.</b></div>`;
        return null;
      }
      $("#msg").innerHTML = "";
      return [
        { name: a, players: TEAMS[a], coach: COACH[a] },
        { name: b, players: TEAMS[b], coach: COACH[b] }
      ];
    }

    // ADVANCE 1 STEP IN BO1 / BO3 / BO5 PROGRESSIVELY (USED BY BOTH "+1 RONDA" AND "AUTO-PLAY VIVO")
    function stepOneRoundInSeries() {
      const p = pair();
      if (!p) {
        stopLive();
        return false;
      }

      // If no series exists or the previous series already finished all its maps, start a fresh progressive series
      const isFinishedAllMaps = SERIES && (
        SERIES.activeTab === "SERIES" ||
        (SERIES.activeTab === SERIES.maps.length - 1 &&
         SERIES.revealedMaps === SERIES.maps.length &&
         shown >= SERIES.maps[SERIES.maps.length - 1].rounds.length)
      );

      if (!SERIES || isFinishedAllMaps) {
        SERIES = buildSeries(p[0], p[1], currentFormat, true);
        shown = 1;
        render();
        return true;
      }

      const curMapIdx = typeof SERIES.activeTab === "number" ? SERIES.activeTab : 0;
      const activeM = SERIES.maps[curMapIdx];

      if (shown < activeM.rounds.length) {
        shown++;
        render();
        return true;
      }

      // Current map finished -> automatically transition to the next map in Bo3 / Bo5!
      if (curMapIdx + 1 < SERIES.maps.length) {
        SERIES.activeTab = curMapIdx + 1;
        SERIES.revealedMaps = Math.max(SERIES.revealedMaps, curMapIdx + 2);
        shown = 1;
        render();
        return true;
      }

      // All maps in the series have finished!
      stopLive();
      render();
      return false;
    }

    document.querySelectorAll("#formatGroup .seg-btn").forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll("#formatGroup .seg-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentFormat = parseInt(btn.dataset.fmt, 10) || 3;
        $("#go").click();
      };
    });

    $("#mapSel").onchange = () => {
      const v = $("#mapSel").value;
      $("#mapModInfo").textContent = v === "AUTO"
        ? "Protocolo VCT: Duelo 1v1 define Equipo A/B + Secuencia de 7 pasos de Coaches"
        : MAP_POOL[v].desc;
      $("#go").click();
    };

    $("#go").onclick = () => {
      stopLive();
      const p = pair();
      if (!p) return;
      SERIES = buildSeries(p[0], p[1], currentFormat, false);
      shown = SERIES.maps[0].rounds.length;
      render();
    };

    $("#st").onclick = () => {
      stopLive();
      stepOneRoundInSeries();
    };

    $("#liveBtn").onclick = () => {
      if (liveTimer) {
        stopLive();
        return;
      }
      const p = pair();
      if (!p) return;

      // Start or resume progressive playback across all maps in Bo1/Bo3/Bo5
      const isFinishedAllMaps = SERIES && (
        SERIES.activeTab === "SERIES" ||
        (SERIES.activeTab === SERIES.maps.length - 1 &&
         SERIES.revealedMaps === SERIES.maps.length &&
         shown >= SERIES.maps[SERIES.maps.length - 1].rounds.length)
      );

      if (!SERIES || isFinishedAllMaps) {
        SERIES = buildSeries(p[0], p[1], currentFormat, true);
        shown = 0;
      }

      const btn = $("#liveBtn");
      btn.classList.add("live-active");
      btn.textContent = "⏸ Pausar Vivo";

      liveTimer = setInterval(() => {
        const cont = stepOneRoundInSeries();
        if (!cont) {
          stopLive();
        }
      }, 340);
    };

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
      $("#msg").innerHTML = `
      <div class="cal-card">
        <div class="cal-top">
          <span><b>Calibración: ${N} series Bo${currentFormat}</b> · ${p[0].name} vs ${p[1].name}</span>
          <span class="mono"><b class="ca">${p[0].name} ${pctA}%</b> — <b class="cb">${pctB}% ${p[1].name}</b></span>
        </div>
        <div class="cal-bar">
          <div class="cal-bar-a" style="width:${pctA}%"></div>
        </div>
        <div class="cal-meta">
          <span>Mapas promedio por serie: <b>${(totalMaps / N).toFixed(2)}</b></span>
          <span>Rondas promedio por serie: <b>${(rd / N).toFixed(1)}</b></span>
          <span>Frecuencia de Overtime por mapa: <b>${(ot / totalMaps * 100).toFixed(1)}%</b></span>
        </div>
      </div>`;
    };

    $("#swapBtn").onclick = () => {
      const a = $("#ta").selectedIndex;
      $("#ta").selectedIndex = $("#tb").selectedIndex;
      $("#tb").selectedIndex = a;
      applyDynamicTeamColors();
      $("#go").click();
    };

    $("#ta").onchange = () => { applyDynamicTeamColors(); $("#go").click(); };
    $("#tb").onchange = () => { applyDynamicTeamColors(); $("#go").click(); };

    for (const t of Object.keys(TEAMS)) {
      $("#ta").add(new Option(t, t));
      $("#tb").add(new Option(t, t));
    }
    $("#tb").selectedIndex = 6; // Default matchup: Sentinels vs FUT Esports
    applyDynamicTeamColors();

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
        if (currentStarters.length >= 5) {
          currentStarters[currentStarters.length - 1].sub = 1;
        }
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
      $("#go").click();
    };

    $("#resetDbBtn").onclick = () => {
      TEAMS = JSON.parse(JSON.stringify(DEFAULT_TEAMS));
      saveTeams();
      applyDynamicTeamColors();
      renderDatabase();
      $("#go").click();
    };

    function renderDatabase() {
      const q = searchQuery.trim().toLowerCase();
      let r = `<table>
        <thead>
          <tr>
            <th>Jugador</th>
            <th>Estado / Rotación</th>
            <th>Rol</th>
            <th>AIM</th>
            <th>FD</th>
            <th>CLU</th>
            <th>ENT</th>
            <th>UTI</th>
            <th>IGL</th>
            <th>CONF</th>
            <th>CONS</th>
            <th>POT</th>
          </tr>
        </thead>
        <tbody>`;

      for (const t in TEAMS) {
        const meta = TEAM_META[t] || { reg: "VCT", color: "#FF4655" };
        if (activeRegion !== "ALL" && meta.reg !== activeRegion) continue;

        const matchingPlayers = TEAMS[t]
          .map((p, idx) => ({ p, idx }))
          .filter(({ p }) => !q || p.n.toLowerCase().includes(q) || p.r.toLowerCase().includes(q) || t.toLowerCase().includes(q));

        if (!matchingPlayers.length) continue;

        const c = COACH[t];
        const hasBench = TEAMS[t].length > 5;
        r += `<tr class="team-group-row">
          <td colspan="12" class="r">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
              ${renderTeamLogo(t, "mini-team-logo")}
              <span class="region-tag">${meta.reg}</span>
              <b style="color:var(--fg);font-size:15px">${t}</b>
              <span class="mono" style="font-size:11.5px">
                DT <b>${c.n}</b> · Macro ${c.macro} · Micro ${c.micro} · Adaptación ${c.adapt} · Desarrollo ${c.dev} · Disciplina ${c.disc} · <b>OVR ${getTeamOvr(t)}</b>
              </span>
            </div>
          </td>
        </tr>`;

        matchingPlayers.forEach(({ p, idx }) => {
          const statusBtn = hasBench
            ? `<button type="button" class="sub-swap-btn ${p.sub ? 'is-sub' : 'is-starter'}" onclick="toggleSubStatus('${t}', ${idx})" title="Haz clic para intercambiar entre Titular y Suplente">
                ${p.sub ? '⇄ 6TH SUB (Meter Titular)' : '★ TITULAR (Rotar)'}
              </button>`
            : `<span class="sub-swap-btn is-starter" style="cursor:default">★ TITULAR</span>`;

          r += `<tr>
            <td><b>${p.n}</b></td>
            <td style="text-align:left">${statusBtn}</td>
            <td class="r">${getRoleIcon(p.r)} ${p.r}</td>
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
      $("#ros").innerHTML = r;
    }

    document.querySelectorAll("#regionTabs .tab-btn").forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll("#regionTabs .tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeRegion = btn.dataset.reg;
        renderDatabase();
      };
    });

    $("#dbSearch").oninput = e => {
      searchQuery = e.target.value;
      renderDatabase();
    };

    $("#themeToggle").onclick = () => {
      const root = document.documentElement;
      const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      root.setAttribute("data-theme", next);
      $("#themeLabel").textContent = next === "dark" ? "Tema oscuro" : "Tema claro";
    };

    renderDatabase();
    $("#go").click();