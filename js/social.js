// ===== MÓDULO P4: PERSISTENCIA (HISTORIAL + FORMA), EQUIPOS CUSTOM Y COMPARTIR (LINK / PNG) =====
(function () {
  const KEYS = {
    history: "vct_sim_history_v1",
    form: "vct_sim_form_v1",
    formEnabled: "vct_sim_form_enabled_v1",
    customTeams: "vct_sim_custom_teams_v1"
  };

  const sEsc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function readLS(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeLS(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  // ===== ESTADO PERSISTENTE =====
  let HISTORY = readLS(KEYS.history, []);
  let FORM_DATA = readLS(KEYS.form, { players: {}, teams: {} });
  let FORM_ENABLED = readLS(KEYS.formEnabled, true);
  let CUSTOM_TEAMS = readLS(KEYS.customTeams, {});
  let activeSocialTab = "history"; // history | form | custom

  // Borrador del creador de equipos personalizados
  const DEFAULT_DRAFT_SLOTS = [
    { n: "Player1", r: "Duelista",    aim: 90, fd: 88, clutch: 83, entry: 91, util: 75, igl: 62, conf: 82, cons: 81, pot: 90, agents: "Jett, Raze, Neon" },
    { n: "Player2", r: "Flex",        aim: 87, fd: 82, clutch: 84, entry: 84, util: 84, igl: 68, conf: 80, cons: 82, pot: 88, agents: "Yoru, KAY/O, Fade" },
    { n: "Player3", r: "Iniciador",   aim: 85, fd: 76, clutch: 85, entry: 76, util: 90, igl: 72, conf: 81, cons: 85, pot: 87, agents: "Sova, Fade, Tejo" },
    { n: "Player4", r: "Controlador", aim: 85, fd: 75, clutch: 86, entry: 74, util: 91, igl: 86, conf: 82, cons: 86, pot: 87, agents: "Omen, Viper, Miks" },
    { n: "Player5", r: "Centinela",   aim: 88, fd: 78, clutch: 89, entry: 75, util: 84, igl: 68, conf: 83, cons: 87, pot: 88, agents: "Cypher, Chamber, Veto" }
  ];

  let customDraft = {
    name: "",
    code: "CUS",
    reg: "AMERICAS",
    color: "#10B981",
    coach: { n: "HeadCoach", macro: 84, micro: 84, adapt: 84, dev: 84, disc: 85 },
    slots: JSON.parse(JSON.stringify(DEFAULT_DRAFT_SLOTS))
  };

  // ===== 1. APLICAR EQUIPOS PERSONALIZADOS AL MOTOR =====
  function injectCustomTeamIntoRuntime(name, obj) {
    TEAM_META[name] = {
      reg: obj.reg || "AMERICAS",
      color: obj.color || "#10B981",
      logo: "__custom__" + (obj.code || name.slice(0, 3).toUpperCase()),
      code: (obj.code || name.slice(0, 3)).toUpperCase(),
      logoCls: "",
      custom: true
    };
    TEAMS[name] = obj.players.map(p => ({ ...p }));
    DEFAULT_TEAMS[name] = obj.players.map(p => ({ ...p }));
    COACH[name] = { ...obj.coach };
    if (obj.agentPools && typeof PLAYER_AGENTS === "object") {
      for (const pName in obj.agentPools) {
        if (obj.agentPools[pName] && obj.agentPools[pName].length) {
          PLAYER_AGENTS[pName] = obj.agentPools[pName];
        }
      }
    }
  }

  window.reapplyCustomTeams = function () {
    for (const name in CUSTOM_TEAMS) {
      injectCustomTeamIntoRuntime(name, CUSTOM_TEAMS[name]);
    }
    if (typeof window.refreshTeamSelects === "function") window.refreshTeamSelects();
  };

  // ===== 2. FORMA PERSISTENTE (HOOK PARA ENGINE.JS) =====
  window.getPersistentFormBonus = function (playerName) {
    if (!FORM_ENABLED) return 0;
    const rec = FORM_DATA.players && FORM_DATA.players[playerName];
    if (!rec) return 0;
    // Clamp realista entre -4% y +4%
    return Math.max(-0.04, Math.min(0.04, rec.bonus || 0));
  };

  function updatePersistentFormFromSeries(series) {
    if (!series || !series.maps || !series.maps.length) return;
    const S = computeSeriesStats(series);
    const t0Name = series.maps[0].teams[0].name;
    const t1Name = series.maps[0].teams[1].name;
    const winIdx = series.seriesScore[0] > series.seriesScore[1] ? 0 : 1;

    // Actualizar racha de equipos (últimos 5)
    [t0Name, t1Name].forEach((tName, idx) => {
      if (!FORM_DATA.teams[tName]) FORM_DATA.teams[tName] = { w: 0, l: 0, streak: [] };
      const tf = FORM_DATA.teams[tName];
      const won = idx === winIdx;
      if (won) tf.w++; else tf.l++;
      tf.streak.push(won ? "W" : "L");
      if (tf.streak.length > 5) tf.streak.shift();
    });

    // Actualizar forma individual según Rating 2.0 (con decaimiento hacia 0)
    for (const id in S) {
      const s = S[id];
      const pName = s.u.p.n;
      const tName = series.maps[0].teams[s.ti].name;
      const rating = parseFloat(s.rating) || 1.0;
      const prev = FORM_DATA.players[pName] || { team: tName, bonus: 0, matches: 0, lastRating: 1.0, avgRating: 1.0 };
      const delta = (rating - 1.04) * 0.055;
      const nextBonus = Math.max(-0.04, Math.min(0.04, prev.bonus * 0.65 + delta));
      const newMatches = prev.matches + 1;
      const avgRating = ((prev.avgRating * prev.matches) + rating) / newMatches;

      FORM_DATA.players[pName] = {
        team: tName,
        bonus: Number(nextBonus.toFixed(4)),
        matches: newMatches,
        lastRating: rating,
        avgRating: Number(avgRating.toFixed(2))
      };
    }

    writeLS(KEYS.form, FORM_DATA);
  }

  // ===== 3. REGISTRO DE HISTORIAL =====
  function buildCompactSnapshot(series) {
    const M0 = series.maps[0];
    const tA = M0.teams[0].name;
    const tB = M0.teams[1].name;
    const S = computeSeriesStats(series);
    const list0 = Object.values(S).filter(s => s.ti === 0).sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));
    const list1 = Object.values(S).filter(s => s.ti === 1).sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));
    const winIdx = series.seriesScore[0] > series.seriesScore[1] ? 0 : 1;
    const mvp = (winIdx === 0 ? list0[0] : list1[0]) || list0[0];

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 16).replace("T", " ");

    return {
      id: "H-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      v: 1,
      d: dateStr,
      f: series.format,
      a: tA,
      ca: (TEAM_META[tA] && TEAM_META[tA].color) || "#E5484D",
      b: tB,
      cb: (TEAM_META[tB] && TEAM_META[tB].color) || "#38BDF8",
      sa: series.seriesScore[0],
      sb: series.seriesScore[1],
      maps: series.maps.map(m => [m.mapName, m.sc[0], m.sc[1]]),
      mvp: [mvp.u.p.n, winIdx === 0 ? tA : tB, mvp.rating, mvp.acs, `${mvp.k}/${mvp.d}/${mvp.a}`],
      p0: list0.map(s => [s.u.p.n, (s.agents && s.agents[0]) || s.u.agent || "-", s.rating, s.acs, s.k, s.d, s.a, s.kast]),
      p1: list1.map(s => [s.u.p.n, (s.agents && s.agents[0]) || s.u.agent || "-", s.rating, s.acs, s.k, s.d, s.a, s.kast])
    };
  }

  window.recordCompletedSeries = function (series) {
    if (!series || series._recorded || !series.maps || !series.maps.length) return;
    series._recorded = true;

    const snap = buildCompactSnapshot(series);
    HISTORY.unshift(snap);
    if (HISTORY.length > 40) HISTORY = HISTORY.slice(0, 40);
    writeLS(KEYS.history, HISTORY);

    updatePersistentFormFromSeries(series);
    renderSocialSection();
  };

  // ===== 4. COMPARTIR POR LINK (#res=...) Y EXPORTAR IMAGEN PNG =====
  function encodeSharePayload(snap) {
    const clean = {
      v: 1, d: snap.d, f: snap.f, a: snap.a, ca: snap.ca, b: snap.b, cb: snap.cb,
      sa: snap.sa, sb: snap.sb, maps: snap.maps, mvp: snap.mvp, p0: snap.p0, p1: snap.p1
    };
    const json = JSON.stringify(clean);
    const bytes = new TextEncoder().encode(json);
    let bin = "";
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function decodeSharePayload(str) {
    try {
      let b64 = str.replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const json = new TextDecoder().decode(bytes);
      const obj = JSON.parse(json);
      if (!obj || !obj.a || !obj.b || !Array.isArray(obj.maps)) return null;
      return obj;
    } catch (e) {
      return null;
    }
  }

  function getSnapshotByIdOrCurrent(histId) {
    if (histId) return HISTORY.find(x => x.id === histId) || null;
    if (typeof SERIES !== "undefined" && SERIES && SERIES.maps && SERIES.maps.length) {
      return buildCompactSnapshot(SERIES);
    }
    return null;
  }

  function showShareFeedback(msg) {
    const el = document.getElementById("shareFeedback");
    if (el) {
      el.textContent = msg;
      setTimeout(() => { if (el.textContent === msg) el.textContent = ""; }, 3500);
    }
  }

  window.shareSeriesLink = function (histId = null) {
    const snap = getSnapshotByIdOrCurrent(histId);
    if (!snap) return;
    const token = encodeSharePayload(snap);
    const base = location.origin === "null" ? location.href.split("#")[0] : (location.origin + location.pathname);
    const url = `${base}#res=${token}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => showShareFeedback("LINK COPIADO AL PORTAPAPELES"))
        .catch(() => {
          window.prompt("Copia este enlace de resultado:", url);
          showShareFeedback("LINK GENERADO");
        });
    } else {
      window.prompt("Copia este enlace de resultado:", url);
      showShareFeedback("LINK GENERADO");
    }
  };

  // Genera tarjeta broadcast 1200x675 en Canvas 2D y la descarga como PNG
  window.exportSeriesPNG = async function (histId = null) {
    const snap = getSnapshotByIdOrCurrent(histId);
    if (!snap) return;

    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (e) {}
    }

    const W = 1200, H = 675;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    // Fondo táctico oscuro
    ctx.fillStyle = "#0B0D11";
    ctx.fillRect(0, 0, W, H);

    // Marco exterior 1px
    ctx.strokeStyle = "#222733";
    ctx.lineWidth = 1;
    ctx.strokeRect(18.5, 18.5, W - 37, H - 37);

    // Franja superior de estado
    ctx.fillStyle = "#11141B";
    ctx.fillRect(19, 19, W - 38, 42);
    ctx.strokeStyle = "#222733";
    ctx.beginPath(); ctx.moveTo(19, 61.5); ctx.lineTo(W - 19, 61.5); ctx.stroke();

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

    // Bloque Marcador Central
    ctx.fillStyle = "#11141B";
    ctx.fillRect(36, 78, W - 72, 148);
    ctx.strokeStyle = "#333B4D";
    ctx.strokeRect(36.5, 78.5, W - 73, 148);

    // Indicadores de color de equipo (1px/2px limpio arriba)
    ctx.fillStyle = snap.ca;
    ctx.fillRect(37, 79, (W - 74) / 2 - 4, 3);
    ctx.fillStyle = snap.cb;
    ctx.fillRect(W / 2 + 4, 79, (W - 74) / 2 - 4, 3);

    // Nombres de equipos
    ctx.fillStyle = snap.ca;
    ctx.font = '700 42px "Barlow Condensed", sans-serif';
    ctx.textAlign = "left";
    ctx.fillText(snap.a.toUpperCase(), 64, 152);

    ctx.fillStyle = snap.cb;
    ctx.textAlign = "right";
    ctx.fillText(snap.b.toUpperCase(), W - 64, 152);

    // Caja de marcador numérico
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

    // Desglose de mapas
    const mapsLine = snap.maps.map(m => `${m[0].toUpperCase()}  ${m[1]}-${m[2]}`).join("    |    ");
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
    ctx.fillText(`RATING 2.0: ${snap.mvp[2]}   ·   ACS: ${snap.mvp[3]}   ·   K/D/A: ${snap.mvp[4]}`, W - 54, 268);

    // Dos tablas Boxscore lado a lado
    const drawTeamBox = (x, title, color, rows) => {
      const bw = (W - 88) / 2;
      const by = 302, bh = 312;
      ctx.fillStyle = "#11141B";
      ctx.fillRect(x, by, bw, bh);
      ctx.strokeStyle = "#222733";
      ctx.strokeRect(x + 0.5, by + 0.5, bw - 1, bh - 1);

      // Header equipo
      ctx.fillStyle = color;
      ctx.fillRect(x + 14, by + 15, 8, 8);
      ctx.font = '700 18px "Barlow Condensed", sans-serif';
      ctx.textAlign = "left";
      ctx.fillText(title.toUpperCase(), x + 30, by + 25);

      // Column headers
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

      // Filas de jugadores
      (rows || []).slice(0, 5).forEach((p, idx) => {
        const ry = by + 92 + idx * 44;
        ctx.strokeStyle = "#1D222D";
        ctx.beginPath(); ctx.moveTo(x + 10, ry + 14); ctx.lineTo(x + bw - 10, ry + 14); ctx.stroke();

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
    showShareFeedback("IMAGEN PNG DESCARGADA");
  };

  window.renderShareBarHTML = function () {
    return `<div class="share-bar">
      <div class="share-bar-left mono">
        <span>COMPARTIR RESULTADO</span>
        <span id="shareFeedback" class="kd-pos"></span>
      </div>
      <div class="btn-group">
        <button type="button" class="t-btn-sm mono" onclick="shareSeriesLink()">Copiar Link</button>
        <button type="button" class="t-btn-sm mono t-btn-live" onclick="exportSeriesPNG()">Descargar Imagen PNG</button>
      </div>
    </div>`;
  };

  // Detecta enlaces compartidos (#res=...) al cargar
  function renderSharedResultFromHash() {
    if (!location.hash || !location.hash.startsWith("#res=")) return;
    const snap = decodeSharePayload(location.hash.slice(5));
    if (!snap) return;

    const msgEl = document.getElementById("msg");
    if (!msgEl) return;

    // Guardar temporalmente para permitir exportar su PNG directo
    window._sharedSnap = snap;
    const mapsStr = snap.maps.map(m => `${m[0]} ${m[1]}-${m[2]}`).join(" · ");
    const renderMiniRows = rows => (rows || []).map(p =>
      `<tr>
        <td style="text-align:left"><b>${sEsc(p[0])}</b></td>
        <td style="text-align:left" class="mono mut">${sEsc(p[1])}</td>
        <td class="mono"><b>${sEsc(p[2])}</b></td>
        <td class="mono">${sEsc(p[3])}</td>
        <td class="mono">${p[4]}/${p[5]}/${p[6]}</td>
        <td class="mono">${p[7]}%</td>
      </tr>`
    ).join("");

    msgEl.innerHTML = `<div class="shared-card">
      <div class="box-head">
        <div>
          <span class="duel-badge">RESULTADO COMPARTIDO POR LINK</span>
          <h2 style="margin-top:6px"><span style="color:${sEsc(snap.ca)}">${sEsc(snap.a)}</span> ${snap.sa} : ${snap.sb} <span style="color:${sEsc(snap.cb)}">${sEsc(snap.b)}</span></h2>
          <small class="mono mut">BO${snap.f} · ${sEsc(mapsStr)} · ${sEsc(snap.d)} · MVP: ${sEsc(snap.mvp[0])} (${sEsc(snap.mvp[2])} R2.0)</small>
        </div>
        <div class="btn-group">
          <button type="button" class="t-btn-sm mono t-btn-live" onclick="exportSharedSnapPNG()">Descargar PNG</button>
          <button type="button" class="t-btn-sm mono" onclick="closeSharedBanner()">Cerrar</button>
        </div>
      </div>
      <div class="t-groups-grid">
        <div class="t-group-card">
          <div class="t-group-head"><b style="color:${sEsc(snap.ca)}">${sEsc(snap.a)}</b></div>
          <div class="sc"><table><thead><tr><th style="text-align:left">Jugador</th><th style="text-align:left">Agente</th><th>R2.0</th><th>ACS</th><th>K/D/A</th><th>KAST</th></tr></thead><tbody>${renderMiniRows(snap.p0)}</tbody></table></div>
        </div>
        <div class="t-group-card">
          <div class="t-group-head"><b style="color:${sEsc(snap.cb)}">${sEsc(snap.b)}</b></div>
          <div class="sc"><table><thead><tr><th style="text-align:left">Jugador</th><th style="text-align:left">Agente</th><th>R2.0</th><th>ACS</th><th>K/D/A</th><th>KAST</th></tr></thead><tbody>${renderMiniRows(snap.p1)}</tbody></table></div>
        </div>
      </div>
    </div>`;
  }

  window.exportSharedSnapPNG = function () {
    if (!window._sharedSnap) return;
    HISTORY.unshift(window._sharedSnap);
    const tmpId = window._sharedSnap.id || "SHARED-TMP";
    window._sharedSnap.id = tmpId;
    window.exportSeriesPNG(tmpId);
    HISTORY.shift();
  };

  window.closeSharedBanner = function () {
    const msgEl = document.getElementById("msg");
    if (msgEl) msgEl.innerHTML = "";
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
  };

  // ===== 5. ACCIONES DE HISTORIAL, FORMA Y EQUIPOS PERSONALIZADOS =====
  window.sSwitchTab = function (tab) {
    activeSocialTab = tab;
    renderSocialSection();
  };

  window.sToggleFormMode = function () {
    FORM_ENABLED = !FORM_ENABLED;
    writeLS(KEYS.formEnabled, FORM_ENABLED);
    renderSocialSection();
  };

  window.sResetForm = function () {
    FORM_DATA = { players: {}, teams: {} };
    writeLS(KEYS.form, FORM_DATA);
    renderSocialSection();
  };

  window.sClearHistory = function () {
    HISTORY = [];
    writeLS(KEYS.history, HISTORY);
    renderSocialSection();
  };

  window.sRematch = function (histId) {
    const h = HISTORY.find(x => x.id === histId);
    if (!h || !TEAMS[h.a] || !TEAMS[h.b]) return;
    $("#ta").value = h.a;
    $("#tb").value = h.b;
    applyDynamicTeamColors();
    currentFormat = h.f || 3;
    document.querySelectorAll("#formatGroup .seg-btn").forEach(b => {
      b.classList.toggle("active", parseInt(b.dataset.fmt, 10) === currentFormat);
    });
    $("#go").click();
    const outEl = document.getElementById("out");
    if (outEl) outEl.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Creador de Equipos Personalizados
  window.sUpdateDraftField = function (field, val) {
    customDraft[field] = val;
  };

  window.sUpdateCoachField = function (field, val) {
    if (field === "n") customDraft.coach.n = val;
    else customDraft.coach[field] = Math.max(50, Math.min(99, parseInt(val, 10) || 82));
  };

  window.sUpdateSlotField = function (idx, field, val) {
    const slot = customDraft.slots[idx];
    if (!slot) return;
    if (field === "n" || field === "r" || field === "agents") {
      slot[field] = val;
    } else {
      slot[field] = Math.max(40, Math.min(99, parseInt(val, 10) || 80));
    }
  };

  window.sImportProToSlot = function (idx, proKey) {
    if (!proKey) return;
    const [tName, pName] = proKey.split("::");
    const found = (TEAMS[tName] || []).find(p => p.n === pName);
    if (!found) return;
    const agList = (typeof getPlayerAgents === "function") ? getPlayerAgents(found).slice(0, 4).join(", ") : "Jett, Raze";
    customDraft.slots[idx] = {
      n: found.n, r: found.r, aim: found.aim, fd: found.fd, clutch: found.clutch,
      entry: found.entry, util: found.util, igl: found.igl, conf: found.conf,
      cons: found.cons, pot: found.pot, agents: agList
    };
    renderSocialSection();
  };

  window.sSaveCustomTeam = function () {
    const cleanName = (customDraft.name || "").trim();
    if (!cleanName) {
      alert("Escribe un nombre para tu equipo personalizado.");
      return;
    }
    const cleanCode = ((customDraft.code || cleanName.slice(0, 3)).trim().toUpperCase()).slice(0, 4);
    const agentPools = {};
    const players = customDraft.slots.map((sl, i) => {
      const pName = (sl.n || ("Jugador" + (i + 1))).trim();
      const parsedAgents = (sl.agents || "").split(",").map(x => x.trim()).filter(a => AGENTS[a]);
      if (parsedAgents.length) agentPools[pName] = parsedAgents;
      return {
        n: pName,
        r: sl.r || "Flex",
        aim: Number(sl.aim) || 85,
        fd: Number(sl.fd) || 80,
        clutch: Number(sl.clutch) || 82,
        entry: Number(sl.entry) || 80,
        util: Number(sl.util) || 82,
        igl: Number(sl.igl) || 70,
        conf: Number(sl.conf) || 80,
        cons: Number(sl.cons) || 82,
        pot: Number(sl.pot) || 86,
        sub: 0
      };
    });

    const teamRecord = {
      reg: customDraft.reg || "AMERICAS",
      color: customDraft.color || "#10B981",
      code: cleanCode,
      coach: { ...customDraft.coach },
      players,
      agentPools
    };

    CUSTOM_TEAMS[cleanName] = teamRecord;
    writeLS(KEYS.customTeams, CUSTOM_TEAMS);
    injectCustomTeamIntoRuntime(cleanName, teamRecord);

    if (typeof window.refreshTeamSelects === "function") {
      window.refreshTeamSelects(cleanName);
    }
    customDraft.name = "";
    renderSocialSection();
    $("#go").click();
  };

  window.sDeleteCustomTeam = function (name) {
    if (!CUSTOM_TEAMS[name]) return;
    delete CUSTOM_TEAMS[name];
    delete TEAMS[name];
    delete DEFAULT_TEAMS[name];
    delete TEAM_META[name];
    delete COACH[name];
    writeLS(KEYS.customTeams, CUSTOM_TEAMS);
    if (typeof window.refreshTeamSelects === "function") window.refreshTeamSelects();
    renderSocialSection();
  };

  // ===== 6. RENDER DE LA SECCIÓN #social =====
  function renderHistoryTabHTML() {
    if (!HISTORY.length) {
      return `<p class="mut mono" style="font-size:12px">Todavía no hay series guardadas. Pulsa "Simular Serie" o termina un partido en Auto-Play para registrar tu historial.</p>`;
    }
    return `<div class="sc">
      <table>
        <thead>
          <tr>
            <th style="text-align:left">Fecha</th>
            <th>FMT</th>
            <th style="text-align:left">Enfrentamiento</th>
            <th>Marcador</th>
            <th style="text-align:left">Mapas</th>
            <th style="text-align:left">MVP</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${HISTORY.map(h => `<tr>
            <td style="text-align:left" class="mono mut" style="font-size:11px">${sEsc(h.d)}</td>
            <td class="mono mut">BO${h.f}</td>
            <td style="text-align:left">
              <b style="color:${sEsc(h.ca)}">${sEsc(h.a)}</b> <span class="mut">vs</span> <b style="color:${sEsc(h.cb)}">${sEsc(h.b)}</b>
            </td>
            <td class="mono"><b>${h.sa} : ${h.sb}</b></td>
            <td style="text-align:left" class="mono mut" style="font-size:11px">${sEsc(h.maps.map(m => `${m[0].slice(0, 3).toUpperCase()} ${m[1]}-${m[2]}`).join(" · "))}</td>
            <td style="text-align:left" class="mono" style="font-size:11.5px"><b>${sEsc(h.mvp[0])}</b> <span class="mut">(${sEsc(h.mvp[2])})</span></td>
            <td>
              <div class="btn-group" style="justify-content:flex-end">
                <button type="button" class="t-btn-sm mono" onclick="sRematch('${h.id}')">Revancha</button>
                <button type="button" class="t-btn-sm mono" onclick="shareSeriesLink('${h.id}')">Link</button>
                <button type="button" class="t-btn-sm mono t-btn-live" onclick="exportSeriesPNG('${h.id}')">PNG</button>
              </div>
            </td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
  }

  function renderFormTabHTML() {
    const pEntries = Object.entries(FORM_DATA.players || {})
      .map(([name, rec]) => ({ name, ...rec }))
      .sort((a, b) => b.bonus - a.bonus);

    const tEntries = Object.entries(FORM_DATA.teams || {})
      .map(([name, rec]) => ({ name, ...rec }))
      .sort((a, b) => (b.w - b.l) - (a.w - a.l));

    if (!pEntries.length) {
      return `<p class="mut mono" style="font-size:12px">Simula series para activar el seguimiento de racha W/L y forma persistente de los jugadores.</p>`;
    }

    const topHot = pEntries.slice(0, 10);
    const topCold = pEntries.slice(-8).reverse();

    const renderPlayerFormRows = list => list.map(p => {
      const pct = (p.bonus * 100).toFixed(1);
      const cls = p.bonus > 0.005 ? "kd-pos" : p.bonus < -0.005 ? "kd-neg" : "mut";
      return `<tr>
        <td style="text-align:left"><b>${sEsc(p.name)}</b></td>
        <td style="text-align:left" class="mut">${sEsc(p.team)}</td>
        <td class="mono">${p.matches}</td>
        <td class="mono">${p.avgRating.toFixed(2)}</td>
        <td class="mono ${cls}"><b>${p.bonus > 0 ? "+" : ""}${pct}%</b></td>
      </tr>`;
    }).join("");

    return `<div class="t-groups-grid">
      <div class="t-group-card">
        <div class="t-group-head"><b class="mono">RACHAS DE EQUIPOS (ÚLTIMAS 5 SERIES)</b></div>
        <div class="sc">
          <table>
            <thead><tr><th style="text-align:left">Equipo</th><th>G-P</th><th style="text-align:right">Racha</th></tr></thead>
            <tbody>
              ${tEntries.map(t => `<tr>
                <td style="text-align:left"><span class="t-team-cell">${renderTeamLogo(t.name, "mini-team-logo")}<b>${sEsc(t.name)}</b></span></td>
                <td class="mono"><b>${t.w}-${t.l}</b></td>
                <td class="mono" style="text-align:right">${t.streak.map(r => `<span class="streak-pip ${r === 'W' ? 'is-w' : 'is-l'}">${r}</span>`).join("")}</td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <div class="t-group-card">
        <div class="t-group-head"><b class="mono">ESTADO DE FORMA INDIVIDUAL (ACTIVO EN SIMULADOR: ${FORM_ENABLED ? "SÍ" : "NO"})</b></div>
        <div class="sc">
          <table>
            <thead><tr><th style="text-align:left">Jugador</th><th style="text-align:left">Equipo</th><th>SER</th><th>R2.0 MED</th><th>MOD FORMA</th></tr></thead>
            <tbody>
              ${renderPlayerFormRows(topHot)}
              ${topCold.filter(c => !topHot.includes(c)).map(c => renderPlayerFormRows([c])).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
  }

  function renderCustomTeamsTabHTML() {
    const customNames = Object.keys(CUSTOM_TEAMS);
    const proOptions = Object.keys(TEAMS).flatMap(t =>
      TEAMS[t].map(p => `<option value="${sEsc(t)}::${sEsc(p.n)}">${sEsc(p.n)} (${sEsc(t)} · ${sEsc(p.r)} · AIM ${p.aim})</option>`)
    ).join("");

    const savedBlock = customNames.length
      ? `<div class="custom-saved-list">
          ${customNames.map(name => {
            const c = CUSTOM_TEAMS[name];
            return `<div class="custom-team-pill">
              <span class="team-dot" style="background:${sEsc(c.color)}"></span>
              <b>${sEsc(name)}</b>
              <span class="mono mut">[${sEsc(c.code)} · ${sEsc(c.reg)} · OVR ${getTeamOvr(name)}]</span>
              <button type="button" class="t-btn-sm mono" onclick="sDeleteCustomTeam('${sEsc(name)}')">Eliminar</button>
            </div>`;
          }).join("")}
        </div>`
      : `<p class="mut mono" style="font-size:11.5px;margin:0 0 10px">Aún no has guardado equipos personalizados. Crea tu Dream Team o tu roster de amigos abajo.</p>`;

    return `${savedBlock}
    <div class="custom-builder">
      <div class="cb-grid-top">
        <label class="cb-field"><span class="tac-label">Nombre del Equipo</span>
          <input type="text" class="search-input" value="${sEsc(customDraft.name)}" placeholder="Ej. Team Lima / Dream Team" oninput="sUpdateDraftField('name', this.value)">
        </label>
        <label class="cb-field"><span class="tac-label">Tag (3-4 letras)</span>
          <input type="text" maxlength="4" class="search-input mono" value="${sEsc(customDraft.code)}" oninput="sUpdateDraftField('code', this.value)">
        </label>
        <label class="cb-field"><span class="tac-label">Región</span>
          <select class="map-select mono" onchange="sUpdateDraftField('reg', this.value)">
            ${["AMERICAS", "EMEA", "PACIFIC", "CHINA"].map(r => `<option value="${r}" ${customDraft.reg === r ? "selected" : ""}>${r}</option>`).join("")}
          </select>
        </label>
        <label class="cb-field"><span class="tac-label">Color</span>
          <input type="color" class="cb-color" value="${sEsc(customDraft.color)}" onchange="sUpdateDraftField('color', this.value)">
        </label>
        <label class="cb-field"><span class="tac-label">Head Coach</span>
          <input type="text" class="search-input" value="${sEsc(customDraft.coach.n)}" oninput="sUpdateCoachField('n', this.value)">
        </label>
        <label class="cb-field"><span class="tac-label">MAC / MIC / ADP</span>
          <div class="cb-inline-nums">
            <input type="number" min="50" max="99" value="${customDraft.coach.macro}" class="stat-edit" style="border-color:var(--bd)" onchange="sUpdateCoachField('macro', this.value)">
            <input type="number" min="50" max="99" value="${customDraft.coach.micro}" class="stat-edit" style="border-color:var(--bd)" onchange="sUpdateCoachField('micro', this.value)">
            <input type="number" min="50" max="99" value="${customDraft.coach.adapt}" class="stat-edit" style="border-color:var(--bd)" onchange="sUpdateCoachField('adapt', this.value)">
          </div>
        </label>
      </div>

      <div class="sc">
        <table>
          <thead>
            <tr>
              <th style="text-align:left">Copiar Pro (Opcional)</th>
              <th style="text-align:left">Nombre</th>
              <th style="text-align:left">Rol</th>
              <th style="text-align:left">Agentes (coma)</th>
              <th>AIM</th><th>FD</th><th>CLU</th><th>ENT</th><th>UTI</th><th>IGL</th><th>CONF</th><th>CONS</th><th>POT</th>
            </tr>
          </thead>
          <tbody>
            ${customDraft.slots.map((sl, idx) => `<tr>
              <td style="text-align:left">
                <select class="cb-mini-sel mono" onchange="sImportProToSlot(${idx}, this.value)">
                  <option value="">-- Elegir Pro --</option>
                  ${proOptions}
                </select>
              </td>
              <td style="text-align:left"><input type="text" class="cb-inp" value="${sEsc(sl.n)}" oninput="sUpdateSlotField(${idx},'n',this.value)"></td>
              <td style="text-align:left">
                <select class="cb-mini-sel" onchange="sUpdateSlotField(${idx},'r',this.value)">
                  ${["Duelista", "Flex", "Iniciador", "Controlador", "Centinela", "Iniciador/IGL", "Controlador/IGL", "IGL/Centinela", "Duelista/Flex"].map(r => `<option value="${r}" ${sl.r === r ? "selected" : ""}>${r}</option>`).join("")}
                </select>
              </td>
              <td style="text-align:left"><input type="text" class="cb-inp mono" style="width:150px" value="${sEsc(sl.agents)}" oninput="sUpdateSlotField(${idx},'agents',this.value)"></td>
              ${["aim", "fd", "clutch", "entry", "util", "igl", "conf", "cons", "pot"].map(k =>
                `<td class="mono"><input type="number" min="40" max="99" value="${sl[k]}" class="stat-edit" style="border-color:var(--bd)" onchange="sUpdateSlotField(${idx},'${k}',this.value)"></td>`
              ).join("")}
            </tr>`).join("")}
          </tbody>
        </table>
      </div>

      <div class="deck-actions" style="margin-top:10px">
        <small class="mut">Se guarda en tu navegador y queda disponible en Partida Rápida, Base de Datos y Torneos.</small>
        <button type="button" class="p" onclick="sSaveCustomTeam()">Guardar Equipo Personalizado</button>
      </div>
    </div>`;
  }

  function renderSocialSection() {
    const root = document.getElementById("social");
    if (!root) return;

    const customCnt = Object.keys(CUSTOM_TEAMS).length;
    let body = "";
    if (activeSocialTab === "history") body = renderHistoryTabHTML();
    else if (activeSocialTab === "form") body = renderFormTabHTML();
    else body = renderCustomTeamsTabHTML();

    root.innerHTML = `
      <div class="box-head">
        <div>
          <h2>Persistencia, Forma Acumulada &amp; Equipos Personalizados</h2>
          <small class="mut">Historial local de resultados, evolución de forma por rendimiento reciente, creador de rosters propios y exportación social.</small>
        </div>
        <div class="btn-group">
          <button type="button" class="t-btn-sm mono ${FORM_ENABLED ? 't-btn-live' : ''}" onclick="sToggleFormMode()">
            FORMA PERSISTENTE: ${FORM_ENABLED ? "ON" : "OFF"}
          </button>
          ${activeSocialTab === "history" && HISTORY.length ? `<button type="button" class="t-btn-sm mono" onclick="sClearHistory()">Limpiar Historial</button>` : ""}
          ${activeSocialTab === "form" ? `<button type="button" class="t-btn-sm mono" onclick="sResetForm()">Resetear Forma</button>` : ""}
        </div>
      </div>

      <div class="series-tabs">
        <button type="button" class="series-tab ${activeSocialTab === 'history' ? 'active' : ''}" onclick="sSwitchTab('history')">HISTORIAL (${HISTORY.length})</button>
        <button type="button" class="series-tab ${activeSocialTab === 'form' ? 'active' : ''}" onclick="sSwitchTab('form')">RACHAS Y FORMA</button>
        <button type="button" class="series-tab ${activeSocialTab === 'custom' ? 'active' : ''}" onclick="sSwitchTab('custom')">EQUIPOS PERSONALIZADOS (${customCnt})</button>
      </div>

      ${body}
    `;
  }

  // Arranque inicial: inyectar equipos custom, renderizar panel y leer link compartido
  window.reapplyCustomTeams();
  renderSocialSection();
  renderSharedResultFromHash();
})();