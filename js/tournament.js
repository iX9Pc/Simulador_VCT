// ===== MÓDULO DE TORNEOS VCT 2027 (GRUPOS, CALENDARIO, BRACKET BO3/BO5 Y MVP) =====
(function () {
  const tEsc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const TOURNAMENT_PRESETS = {
    masters16: {
      id: "masters16",
      name: "VCT Champions / Masters (16 Equipos)",
      size: 16,
      groups: 4,
      qualifyPerGroup: 2,
      groupFmt: 3,
      playoffFmt: 3,
      finalFmt: 5,
      regionFilter: "ALL",
      desc: "4 grupos de 4 (Round-Robin Bo3) · Top 2 avanza a Playoffs de 8 (Cuartos/Semis Bo3 · Gran Final Bo5)"
    },
    masters8: {
      id: "masters8",
      name: "VCT Masters Compacto (8 Equipos)",
      size: 8,
      groups: 2,
      qualifyPerGroup: 2,
      groupFmt: 3,
      playoffFmt: 3,
      finalFmt: 5,
      regionFilter: "ALL",
      desc: "2 grupos de 4 (Round-Robin Bo3) · Top 2 avanza a Semifinales Bo3 y Gran Final Bo5"
    },
    americas6: {
      id: "americas6",
      name: "Liga VCT Americas (6 Equipos)",
      size: 6,
      groups: 1,
      qualifyPerGroup: 4,
      groupFmt: 3,
      playoffFmt: 3,
      finalFmt: 5,
      regionFilter: "AMERICAS",
      desc: "Liga todos contra todos (5 jornadas Bo3) · Top 4 juega Playoffs (Semis Bo3 · Gran Final Bo5)"
    },
    emea6: {
      id: "emea6",
      name: "Liga VCT EMEA (6 Equipos)",
      size: 6,
      groups: 1,
      qualifyPerGroup: 4,
      groupFmt: 3,
      playoffFmt: 3,
      finalFmt: 5,
      regionFilter: "EMEA",
      desc: "Liga todos contra todos (5 jornadas Bo3) · Top 4 juega Playoffs (Semis Bo3 · Gran Final Bo5)"
    },
    china6: {
      id: "china6",
      name: "Liga VCT China (6 Equipos)",
      size: 6,
      groups: 1,
      qualifyPerGroup: 4,
      groupFmt: 3,
      playoffFmt: 3,
      finalFmt: 5,
      regionFilter: "CHINA",
      desc: "Liga todos contra todos (5 jornadas Bo3) · Top 4 juega Playoffs (Semis Bo3 · Gran Final Bo5)"
    }
  };

  let T = null;
  let activeSubTab = "groups"; // groups | schedule | bracket | stats
  let setupPreset = "masters16";
  let selectedTeams = [];
  let trackedFriends = new Set(["Sentinels", "FUT Esports"]);
  let showSetupPicker = false;

  function getAllTeamsSortedByOvr() {
    return Object.keys(TEAMS).sort((a, b) => parseFloat(getTeamOvr(b)) - parseFloat(getTeamOvr(a)));
  }

  function defaultSelectionForPreset(presetId) {
    const cfg = TOURNAMENT_PRESETS[presetId];
    const all = getAllTeamsSortedByOvr();
    if (cfg.regionFilter !== "ALL") {
      const regTeams = all.filter(t => TEAM_META[t] && TEAM_META[t].reg === cfg.regionFilter);
      if (regTeams.length >= cfg.size) return regTeams.slice(0, cfg.size);
    }
    // Selección equilibrada por región para torneos internacionales
    const byReg = { AMERICAS: [], EMEA: [], PACIFIC: [], CHINA: [] };
    all.forEach(t => {
      const r = (TEAM_META[t] && TEAM_META[t].reg) || "AMERICAS";
      if (byReg[r]) byReg[r].push(t);
    });
    const picked = [];
    const order = ["AMERICAS", "EMEA", "PACIFIC", "CHINA"];
    let guard = 0;
    while (picked.length < cfg.size && guard < 100) {
      guard++;
      for (const r of order) {
        if (picked.length >= cfg.size) break;
        if (byReg[r].length) picked.push(byReg[r].shift());
      }
    }
    return picked;
  }

  // Simula una serie oficial de torneo siempre con veto 1v1 + 7 pasos ("AUTO")
  function simTournamentSeries(teamAName, teamBName, fmt) {
    const pA = { name: teamAName, players: TEAMS[teamAName], coach: COACH[teamAName] };
    const pB = { name: teamBName, players: TEAMS[teamBName], coach: COACH[teamBName] };
    const vetoData = runCoachVeto(pA, pB, fmt, "AUTO");
    const needed = Math.ceil(fmt / 2);
    const maps = [];
    const seriesScore = [0, 0];

    for (let i = 0; i < vetoData.scheduledMaps.length; i++) {
      if (seriesScore[0] >= needed || seriesScore[1] >= needed) break;
      const m = simMatch(pA, pB, vetoData.scheduledMaps[i]);
      maps.push(m);
      if (m.sc[0] > m.sc[1]) seriesScore[0]++;
      else seriesScore[1]++;
    }

    return {
      format: fmt,
      vetoData,
      maps,
      seriesScore,
      revealedMaps: maps.length,
      activeTab: fmt > 1 ? "SERIES" : 0
    };
  }

  // Algoritmo round-robin (método del círculo) para 4 o 6 equipos
  function generateRoundRobin(teamList, groupKey, fmt) {
    const list = teamList.slice();
    const n = list.length;
    const rounds = n - 1;
    const fixed = list[0];
    const rot = list.slice(1);
    const matches = [];

    for (let r = 0; r < rounds; r++) {
      const pairs = [[fixed, rot[0]]];
      for (let i = 1; i < n / 2; i++) {
        pairs.push([rot[i], rot[n - 1 - i]]);
      }
      pairs.forEach(([a, b], idx) => {
        matches.push({
          id: `G-${groupKey}-R${r + 1}-${idx + 1}`,
          stage: "group",
          groupKey,
          roundNum: r + 1,
          label: `${groupKey === "LIGA" ? "Liga" : "Grupo " + groupKey} · Jornada ${r + 1}`,
          teamA: a,
          teamB: b,
          fmt,
          played: false,
          scoreA: 0,
          scoreB: 0,
          winner: null,
          series: null
        });
      });
      rot.unshift(rot.pop());
    }
    return matches;
  }

  function createTournament(presetId, customTeams = null, randomizeDraw = false) {
    const cfg = TOURNAMENT_PRESETS[presetId] || TOURNAMENT_PRESETS.masters16;
    let pool = (customTeams && customTeams.length === cfg.size)
      ? customTeams.slice()
      : defaultSelectionForPreset(presetId);

    if (randomizeDraw) {
      pool = pool.slice().sort(() => Math.random() - 0.5);
    } else {
      pool = pool.slice().sort((a, b) => parseFloat(getTeamOvr(b)) - parseFloat(getTeamOvr(a)));
    }

    // Snake seeding en grupos para equilibrar niveles (1->A, 2->B, 3->C, 4->D, 5->D...)
    const groupNames = cfg.groups === 1 ? ["LIGA"] : ["A", "B", "C", "D"].slice(0, cfg.groups);
    const groups = groupNames.map(k => ({ key: k, teams: [] }));

    pool.forEach((teamName, i) => {
      const band = Math.floor(i / cfg.groups);
      const pos = i % cfg.groups;
      const gIdx = (band % 2 === 0) ? pos : (cfg.groups - 1 - pos);
      groups[gIdx].teams.push(teamName);
    });

    const groupMatches = [];
    groups.forEach(g => {
      groupMatches.push(...generateRoundRobin(g.teams, g.key, cfg.groupFmt));
    });

    // Construir estructura del Bracket de Playoffs
    const playoffs = [];
    if (cfg.size === 16) {
      playoffs.push(
        { id: "PO-QF1", stage: "playoff", roundKey: "QF", roundLabel: "Cuartos de Final", label: "Cuartos 1 (1°A vs 2°B)", teamA: null, teamB: null, fmt: cfg.playoffFmt, played: false, scoreA: 0, scoreB: 0, winner: null, series: null, nextId: "PO-SF1", nextSlot: 0 },
        { id: "PO-QF2", stage: "playoff", roundKey: "QF", roundLabel: "Cuartos de Final", label: "Cuartos 2 (1°C vs 2°D)", teamA: null, teamB: null, fmt: cfg.playoffFmt, played: false, scoreA: 0, scoreB: 0, winner: null, series: null, nextId: "PO-SF1", nextSlot: 1 },
        { id: "PO-QF3", stage: "playoff", roundKey: "QF", roundLabel: "Cuartos de Final", label: "Cuartos 3 (1°B vs 2°A)", teamA: null, teamB: null, fmt: cfg.playoffFmt, played: false, scoreA: 0, scoreB: 0, winner: null, series: null, nextId: "PO-SF2", nextSlot: 0 },
        { id: "PO-QF4", stage: "playoff", roundKey: "QF", roundLabel: "Cuartos de Final", label: "Cuartos 4 (1°D vs 2°C)", teamA: null, teamB: null, fmt: cfg.playoffFmt, played: false, scoreA: 0, scoreB: 0, winner: null, series: null, nextId: "PO-SF2", nextSlot: 1 },
        { id: "PO-SF1", stage: "playoff", roundKey: "SF", roundLabel: "Semifinales",      label: "Semifinal 1",            teamA: null, teamB: null, fmt: cfg.playoffFmt, played: false, scoreA: 0, scoreB: 0, winner: null, series: null, nextId: "PO-GF",  nextSlot: 0 },
        { id: "PO-SF2", stage: "playoff", roundKey: "SF", roundLabel: "Semifinales",      label: "Semifinal 2",            teamA: null, teamB: null, fmt: cfg.playoffFmt, played: false, scoreA: 0, scoreB: 0, winner: null, series: null, nextId: "PO-GF",  nextSlot: 1 },
        { id: "PO-GF",  stage: "playoff", roundKey: "GF", roundLabel: "Gran Final",       label: "Gran Final (Bo5)",       teamA: null, teamB: null, fmt: cfg.finalFmt,   played: false, scoreA: 0, scoreB: 0, winner: null, series: null, nextId: null,     nextSlot: null }
      );
    } else {
      const sf1Label = cfg.groups === 2 ? "Semifinal 1 (1°A vs 2°B)" : "Semifinal 1 (1° vs 4°)";
      const sf2Label = cfg.groups === 2 ? "Semifinal 2 (1°B vs 2°A)" : "Semifinal 2 (2° vs 3°)";
      playoffs.push(
        { id: "PO-SF1", stage: "playoff", roundKey: "SF", roundLabel: "Semifinales", label: sf1Label,           teamA: null, teamB: null, fmt: cfg.playoffFmt, played: false, scoreA: 0, scoreB: 0, winner: null, series: null, nextId: "PO-GF", nextSlot: 0 },
        { id: "PO-SF2", stage: "playoff", roundKey: "SF", roundLabel: "Semifinales", label: sf2Label,           teamA: null, teamB: null, fmt: cfg.playoffFmt, played: false, scoreA: 0, scoreB: 0, winner: null, series: null, nextId: "PO-GF", nextSlot: 1 },
        { id: "PO-GF",  stage: "playoff", roundKey: "GF", roundLabel: "Gran Final",  label: "Gran Final (Bo5)", teamA: null, teamB: null, fmt: cfg.finalFmt,   played: false, scoreA: 0, scoreB: 0, winner: null, series: null, nextId: null,    nextSlot: null }
      );
    }

    T = {
      cfg,
      groups,
      groupMatches,
      playoffs,
      playoffsSeeded: false,
      champion: null,
      runnerUp: null
    };
    selectedTeams = pool.slice();
    renderTournament();
  }

  function computeGroupStandings(groupKey) {
    const grp = T.groups.find(g => g.key === groupKey);
    const table = {};
    grp.teams.forEach(t => {
      table[t] = { team: t, pj: 0, g: 0, p: 0, mw: 0, ml: 0, rw: 0, rl: 0, pts: 0 };
    });

    T.groupMatches.filter(m => m.groupKey === groupKey && m.played).forEach(m => {
      const a = table[m.teamA], b = table[m.teamB];
      a.pj++; b.pj++;
      a.mw += m.scoreA; a.ml += m.scoreB;
      b.mw += m.scoreB; b.ml += m.scoreA;
      if (m.series && m.series.maps) {
        m.series.maps.forEach(mp => {
          a.rw += mp.sc[0]; a.rl += mp.sc[1];
          b.rw += mp.sc[1]; b.rl += mp.sc[0];
        });
      }
      if (m.winner === m.teamA) { a.g++; a.pts += 3; b.p++; }
      else { b.g++; b.pts += 3; a.p++; }
    });

    return Object.values(table).sort((x, y) => {
      if (y.pts !== x.pts) return y.pts - x.pts;
      const mdX = x.mw - x.ml, mdY = y.mw - y.ml;
      if (mdY !== mdX) return mdY - mdX;
      const rdX = x.rw - x.rl, rdY = y.rw - y.rl;
      if (rdY !== rdX) return rdY - rdX;
      return parseFloat(getTeamOvr(y.team)) - parseFloat(getTeamOvr(x.team));
    });
  }

  function trySeedPlayoffs() {
    if (!T || T.playoffsSeeded) return;
    if (T.groupMatches.some(m => !m.played)) return;

    const byKey = {};
    T.groups.forEach(g => { byKey[g.key] = computeGroupStandings(g.key); });

    const setSlot = (id, a, b) => {
      const m = T.playoffs.find(x => x.id === id);
      if (m) { m.teamA = a; m.teamB = b; }
    };

    if (T.cfg.size === 16) {
      setSlot("PO-QF1", byKey.A[0].team, byKey.B[1].team);
      setSlot("PO-QF2", byKey.C[0].team, byKey.D[1].team);
      setSlot("PO-QF3", byKey.B[0].team, byKey.A[1].team);
      setSlot("PO-QF4", byKey.D[0].team, byKey.C[1].team);
    } else if (T.cfg.groups === 2) {
      setSlot("PO-SF1", byKey.A[0].team, byKey.B[1].team);
      setSlot("PO-SF2", byKey.B[0].team, byKey.A[1].team);
    } else {
      const L = byKey.LIGA;
      setSlot("PO-SF1", L[0].team, L[3].team);
      setSlot("PO-SF2", L[1].team, L[2].team);
    }
    T.playoffsSeeded = true;
  }

  function findMatchById(id) {
    if (!T) return null;
    return T.groupMatches.find(m => m.id === id) || T.playoffs.find(m => m.id === id) || null;
  }

  function executeMatch(m) {
    if (!m || m.played || !m.teamA || !m.teamB) return false;
    const s = simTournamentSeries(m.teamA, m.teamB, m.fmt);
    m.series = s;
    m.scoreA = s.seriesScore[0];
    m.scoreB = s.seriesScore[1];
    m.winner = m.scoreA > m.scoreB ? m.teamA : m.teamB;
    m.played = true;

    if (m.stage === "group") {
      trySeedPlayoffs();
    } else if (m.stage === "playoff") {
      if (m.nextId) {
        const nextM = T.playoffs.find(x => x.id === m.nextId);
        if (nextM) {
          if (m.nextSlot === 0) nextM.teamA = m.winner;
          else nextM.teamB = m.winner;
        }
      } else {
        T.champion = m.winner;
        T.runnerUp = m.winner === m.teamA ? m.teamB : m.teamA;
      }
    }
    return true;
  }

  function computeTournamentPlayers() {
    const allPlayed = [...T.groupMatches, ...T.playoffs].filter(m => m.played && m.series);
    const agg = {};

    allPlayed.forEach(match => {
      match.series.maps.forEach(mp => {
        const ms = computeStatsForMatch(mp, mp.rounds.length);
        const rLen = mp.rounds.length;
        for (const id in ms) {
          const s = ms[id];
          const tName = mp.teams[s.ti].name;
          const pName = s.u.p.n;
          const key = tName + "::" + pName;
          if (!agg[key]) {
            agg[key] = {
              team: tName,
              player: pName,
              role: s.u.p.r,
              maps: 0,
              rounds: 0,
              k: 0, d: 0, a: 0, fb: 0, fd: 0, cl: 0, kastRounds: 0,
              agents: {}
            };
          }
          const rec = agg[key];
          rec.maps++;
          rec.rounds += rLen;
          rec.k += s.k;
          rec.d += s.d;
          rec.a += s.a;
          rec.fb += s.fb;
          rec.fd += s.fd;
          rec.cl += s.cl;
          rec.kastRounds += s.kastRounds;
          if (s.u.agent) rec.agents[s.u.agent] = (rec.agents[s.u.agent] || 0) + 1;
        }
      });
    });

    return Object.values(agg).map(rec => {
      const rds = Math.max(1, rec.rounds);
      const acs = Math.round((rec.k * 150 + rec.a * 40 + rec.cl * 100) / rds + 90);
      const kast = Math.round((rec.kastRounds / rds) * 100);
      const kpr = rec.k / rds, dpr = rec.d / rds, apr = rec.a / rds;
      const rating = Number((0.32 + (kpr * 0.72) + ((1 - dpr) * 0.42) + (apr * 0.28) + ((kast / 100) * 0.26) + ((rec.fb - rec.fd) / rds) * 0.35 + (rec.cl / rds) * 0.5).toFixed(2));
      const kd = (rec.k / Math.max(1, rec.d)).toFixed(2);
      const topAgents = Object.entries(rec.agents).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]).join(", ");
      return { ...rec, acs, kast, rating, kd, topAgents };
    }).sort((a, b) => b.rating - a.rating || b.acs - a.acs);
  }

  // ===== ACCIONES GLOBALES EXPUESTAS =====
  window.tSelectPreset = function (presetId) {
    setupPreset = presetId;
    selectedTeams = defaultSelectionForPreset(presetId);
    createTournament(presetId, selectedTeams, false);
  };

  window.tToggleSetupPicker = function () {
    showSetupPicker = !showSetupPicker;
    renderTournament();
  };

  window.tToggleTeamInSetup = function (teamName) {
    const cfg = TOURNAMENT_PRESETS[setupPreset];
    if (selectedTeams.includes(teamName)) {
      selectedTeams = selectedTeams.filter(x => x !== teamName);
    } else if (selectedTeams.length < cfg.size) {
      selectedTeams.push(teamName);
    }
    renderTournament();
  };

  window.tToggleFriend = function (teamName) {
    if (trackedFriends.has(teamName)) trackedFriends.delete(teamName);
    else trackedFriends.add(teamName);
    renderTournament();
  };

  window.tStartCustom = function (randomize) {
    const cfg = TOURNAMENT_PRESETS[setupPreset];
    if (selectedTeams.length !== cfg.size) return;
    showSetupPicker = false;
    activeSubTab = "groups";
    createTournament(setupPreset, selectedTeams, !!randomize);
  };

  window.tSwitchTab = function (tab) {
    activeSubTab = tab;
    renderTournament();
  };

  window.tSimMatch = function (matchId) {
    const m = findMatchById(matchId);
    if (!m) return;
    executeMatch(m);
    renderTournament();
  };

  window.tWatchMatch = function (matchId, autoPlay) {
    const m = findMatchById(matchId);
    if (!m || !m.teamA || !m.teamB) return;
    if (!m.played) executeMatch(m);
    renderTournament();
    if (typeof window.loadExternalSeriesIntoViewer === "function") {
      window.loadExternalSeriesIntoViewer(
        m.teamA,
        m.teamB,
        m.series,
        !!autoPlay,
        `${T.cfg.name} · ${m.label} (Bo${m.fmt})`
      );
    }
  };

  window.tSimNextMatch = function () {
    if (!T) return;
    const nextG = T.groupMatches.find(m => !m.played);
    if (nextG) {
      executeMatch(nextG);
      renderTournament();
      return;
    }
    trySeedPlayoffs();
    const nextP = T.playoffs.find(m => !m.played && m.teamA && m.teamB);
    if (nextP) {
      executeMatch(nextP);
      if (activeSubTab === "groups") activeSubTab = "bracket";
      renderTournament();
    }
  };

  window.tSimCurrentRound = function () {
    if (!T) return;
    const pendingG = T.groupMatches.filter(m => !m.played);
    if (pendingG.length) {
      const minR = Math.min(...pendingG.map(m => m.roundNum));
      pendingG.filter(m => m.roundNum === minR).forEach(m => executeMatch(m));
      if (T.playoffsSeeded && activeSubTab === "groups") activeSubTab = "bracket";
      renderTournament();
      return;
    }
    trySeedPlayoffs();
    const pendingP = T.playoffs.filter(m => !m.played && m.teamA && m.teamB);
    if (pendingP.length) {
      const targetKey = pendingP[0].roundKey;
      pendingP.filter(m => m.roundKey === targetKey).forEach(m => executeMatch(m));
      activeSubTab = "bracket";
      renderTournament();
    }
  };

  window.tSimAll = function () {
    if (!T) return;
    T.groupMatches.forEach(m => { if (!m.played) executeMatch(m); });
    trySeedPlayoffs();
    let safety = 0;
    while (safety++ < 10) {
      const ready = T.playoffs.filter(m => !m.played && m.teamA && m.teamB);
      if (!ready.length) break;
      ready.forEach(m => executeMatch(m));
    }
    activeSubTab = "bracket";
    renderTournament();
  };

  // ===== RENDER DE VISTAS =====
  function renderGroupTablesHTML() {
    return `<div class="t-groups-grid ${T.groups.length === 1 ? 'single-league' : ''}">` + T.groups.map(g => {
      const rows = computeGroupStandings(g.key);
      const qCut = T.cfg.qualifyPerGroup;
      const title = g.key === "LIGA" ? "TABLA GENERAL DE LIGA" : `GRUPO ${g.key}`;
      return `<div class="t-group-card">
        <div class="t-group-head">
          <b class="mono">${title}</b>
          <span class="mono mut" style="font-size:10.5px">TOP ${qCut} CLASIFICA A PLAYOFFS</span>
        </div>
        <div class="sc">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th style="text-align:left">Equipo</th>
                <th>PJ</th>
                <th>G-P</th>
                <th>MAP</th>
                <th>DIF M</th>
                <th>DIF R</th>
                <th>PTS</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((r, idx) => {
                const isQual = idx < qCut;
                const isFriend = trackedFriends.has(r.team);
                const md = r.mw - r.ml;
                const rd = r.rw - r.rl;
                return `<tr class="${isFriend ? 't-friend-row' : ''}">
                  <td class="mono ${isQual ? 'kd-pos' : 'mut'}"><b>${idx + 1}</b></td>
                  <td style="text-align:left">
                    <div class="t-team-cell">
                      ${renderTeamLogo(r.team, "mini-team-logo")}
                      <b>${tEsc(r.team)}</b>
                      ${isFriend ? '<span class="t-friend-tag mono">SEGUIMIENTO</span>' : ""}
                    </div>
                  </td>
                  <td class="mono">${r.pj}</td>
                  <td class="mono"><b>${r.g}-${r.p}</b></td>
                  <td class="mono mut">${r.mw}-${r.ml}</td>
                  <td class="mono ${md > 0 ? 'kd-pos' : md < 0 ? 'kd-neg' : 'mut'}">${md > 0 ? "+" + md : md}</td>
                  <td class="mono ${rd > 0 ? 'kd-pos' : rd < 0 ? 'kd-neg' : 'mut'}">${rd > 0 ? "+" + rd : rd}</td>
                  <td class="mono"><b>${r.pts}</b></td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>`;
    }).join("") + `</div>`;
  }

  function renderMatchRowHTML(m) {
    const isFriend = trackedFriends.has(m.teamA) || trackedFriends.has(m.teamB);
    const aName = m.teamA || "Por definir";
    const bName = m.teamB || "Por definir";
    const ready = !!(m.teamA && m.teamB);
    const scoreTxt = m.played
      ? `<b class="${m.winner === m.teamA ? 'kd-pos' : 'mut'}">${m.scoreA}</b> : <b class="${m.winner === m.teamB ? 'kd-pos' : 'mut'}">${m.scoreB}</b>`
      : `<span class="mut">VS</span>`;
    const mapDetail = m.played && m.series
      ? `<span class="mono mut t-map-mini">${m.series.maps.map(x => `${x.mapName.slice(0, 3).toUpperCase()} ${x.sc[0]}-${x.sc[1]}`).join(" · ")}</span>`
      : `<span class="mono mut t-map-mini">BO${m.fmt} · Veto Oficial</span>`;

    const actions = !ready
      ? `<span class="mono mut" style="font-size:10.5px">ESPERANDO CRUCE</span>`
      : m.played
        ? `<button type="button" class="t-btn-sm mono" onclick="tWatchMatch('${m.id}', false)">Boxscore</button>
           <button type="button" class="t-btn-sm mono" onclick="tWatchMatch('${m.id}', true)">Replay Vivo</button>`
        : `<button type="button" class="t-btn-sm mono" onclick="tSimMatch('${m.id}')">Simular</button>
           <button type="button" class="t-btn-sm mono t-btn-live" onclick="tWatchMatch('${m.id}', true)">En Vivo</button>`;

    return `<div class="t-match-row ${isFriend ? 't-friend-border' : ''}">
      <div class="t-m-meta mono">
        <span>${tEsc(m.label)}</span>
        <span class="t-fmt-tag">BO${m.fmt}</span>
      </div>
      <div class="t-m-teams">
        <span class="t-m-side left ${m.played && m.winner === m.teamA ? 'is-win' : ''}">
          ${m.teamA ? renderTeamLogo(m.teamA, "mini-team-logo") : ""}
          <b>${tEsc(aName)}</b>
        </span>
        <span class="t-m-score mono">${scoreTxt}</span>
        <span class="t-m-side right ${m.played && m.winner === m.teamB ? 'is-win' : ''}">
          <b>${tEsc(bName)}</b>
          ${m.teamB ? renderTeamLogo(m.teamB, "mini-team-logo") : ""}
        </span>
      </div>
      <div class="t-m-foot">
        ${mapDetail}
        <div class="t-m-actions">${actions}</div>
      </div>
    </div>`;
  }

  function renderScheduleHTML() {
    const maxGroupRound = Math.max(...T.groupMatches.map(m => m.roundNum));
    let html = `<div class="t-schedule-wrap">`;

    for (let r = 1; r <= maxGroupRound; r++) {
      const rMatches = T.groupMatches.filter(m => m.roundNum === r);
      const playedCnt = rMatches.filter(m => m.played).length;
      html += `<details class="t-round-block" ${playedCnt < rMatches.length || r === maxGroupRound ? "open" : ""}>
        <summary class="t-round-sum mono">
          <span>FASE DE GRUPOS · JORNADA ${r}</span>
          <span class="mut">${playedCnt} / ${rMatches.length} SERIES JUGADAS</span>
        </summary>
        <div class="t-match-list">${rMatches.map(renderMatchRowHTML).join("")}</div>
      </details>`;
    }

    const poPlayed = T.playoffs.filter(m => m.played).length;
    html += `<details class="t-round-block" ${T.playoffsSeeded ? "open" : ""}>
      <summary class="t-round-sum mono">
        <span>PLAYOFFS (ELIMINACIÓN DIRECTA · BO3 / GRAN FINAL BO5)</span>
        <span class="mut">${poPlayed} / ${T.playoffs.length} SERIES JUGADAS</span>
      </summary>
      <div class="t-match-list">${T.playoffs.map(renderMatchRowHTML).join("")}</div>
    </details></div>`;
    return html;
  }

  function renderBracketHTML() {
    const cols = [];
    const qfs = T.playoffs.filter(m => m.roundKey === "QF");
    const sfs = T.playoffs.filter(m => m.roundKey === "SF");
    const gf = T.playoffs.filter(m => m.roundKey === "GF");

    if (qfs.length) cols.push({ title: "CUARTOS DE FINAL · BO3", matches: qfs });
    cols.push({ title: "SEMIFINALES · BO3", matches: sfs });
    cols.push({ title: "GRAN FINAL · BO5", matches: gf });

    const renderBracketCard = m => {
      const ready = !!(m.teamA && m.teamB);
      const isFriend = trackedFriends.has(m.teamA) || trackedFriends.has(m.teamB);
      const slotHTML = (name, score, isWin) => `<div class="tb-slot ${isWin ? 'is-win' : ''}">
        <span class="tb-team">${name ? renderTeamLogo(name, "mini-team-logo") : ""}<span>${tEsc(name || "TBD")}</span></span>
        <span class="mono tb-sc">${m.played ? score : "-"}</span>
      </div>`;

      const btns = !ready
        ? `<span class="mono mut" style="font-size:10px">PENDIENTE</span>`
        : m.played
          ? `<button type="button" class="t-btn-sm mono" onclick="tWatchMatch('${m.id}', false)">Boxscore</button>
             <button type="button" class="t-btn-sm mono" onclick="tWatchMatch('${m.id}', true)">Replay</button>`
          : `<button type="button" class="t-btn-sm mono" onclick="tSimMatch('${m.id}')">Simular</button>
             <button type="button" class="t-btn-sm mono t-btn-live" onclick="tWatchMatch('${m.id}', true)">En Vivo</button>`;

      return `<div class="tb-card ${isFriend ? 't-friend-border' : ''}">
        <div class="tb-head mono"><span>${tEsc(m.label)}</span><span>BO${m.fmt}</span></div>
        ${slotHTML(m.teamA, m.scoreA, m.played && m.winner === m.teamA)}
        ${slotHTML(m.teamB, m.scoreB, m.played && m.winner === m.teamB)}
        <div class="tb-foot">${btns}</div>
      </div>`;
    };

    return `<div class="t-bracket-grid cols-${cols.length}">
      ${cols.map(c => `<div class="tb-col">
        <div class="tb-col-title mono">${c.title}</div>
        <div class="tb-col-body">${c.matches.map(renderBracketCard).join("")}</div>
      </div>`).join("")}
    </div>`;
  }

  function renderStatsHTML() {
    const players = computeTournamentPlayers();
    if (!players.length) {
      return `<p class="mut mono" style="font-size:12px">Simula al menos una serie del torneo para generar el ranking de jugadores y candidatos a MVP.</p>`;
    }
    const top = players.slice(0, 20);
    return `<div class="sc">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th style="text-align:left">Jugador</th>
            <th style="text-align:left">Equipo</th>
            <th style="text-align:left">Agentes</th>
            <th>MAP</th>
            <th>R 2.0</th>
            <th>ACS</th>
            <th>K/D</th>
            <th>KAST</th>
            <th>FB</th>
            <th>CL</th>
          </tr>
        </thead>
        <tbody>
          ${top.map((p, idx) => {
            const ratCls = p.rating >= 1.18 ? "rat-elite" : p.rating >= 1.02 ? "rat-good" : "mut";
            return `<tr>
              <td class="mono mut">${idx + 1}</td>
              <td style="text-align:left"><b>${tEsc(p.player)}</b> <small class="mut">${getRoleIcon(p.role)}</small></td>
              <td style="text-align:left">
                <span class="t-team-cell">${renderTeamLogo(p.team, "mini-team-logo")}<span>${tEsc(p.team)}</span></span>
              </td>
              <td style="text-align:left" class="mono mut" style="font-size:11px">${tEsc(p.topAgents)}</td>
              <td class="mono">${p.maps}</td>
              <td class="mono ${ratCls}"><b>${p.rating.toFixed(2)}</b></td>
              <td class="mono"><b>${p.acs}</b></td>
              <td class="mono">${p.kd}</td>
              <td class="mono">${p.kast}%</td>
              <td class="mono">${p.fb}</td>
              <td class="mono">${p.cl}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>`;
  }

  function renderSetupPickerHTML() {
    const cfg = TOURNAMENT_PRESETS[setupPreset];
    const all = getAllTeamsSortedByOvr();
    const okCount = selectedTeams.length === cfg.size;

    return `<div class="t-setup-drawer">
      <div class="t-setup-top">
        <span class="mono">SELECCIÓN DE PARTICIPANTES (${selectedTeams.length} / ${cfg.size}) · Clic en el nombre para incluir/quitar · Clic en [SEGUIR] para marcar equipos de amigos</span>
        <div class="btn-group">
          <button type="button" class="t-btn-sm mono" ${okCount ? "" : "disabled"} onclick="tStartCustom(false)">Aplicar (Seed OVR)</button>
          <button type="button" class="t-btn-sm mono" ${okCount ? "" : "disabled"} onclick="tStartCustom(true)">Aplicar (Sorteo Aleatorio)</button>
        </div>
      </div>
      <div class="t-picker-grid">
        ${all.map(name => {
          const isIn = selectedTeams.includes(name);
          const isF = trackedFriends.has(name);
          const reg = (TEAM_META[name] && TEAM_META[name].reg) || "";
          return `<div class="t-pick-item ${isIn ? 'is-in' : ''}">
            <button type="button" class="t-pick-main" onclick="tToggleTeamInSetup('${name}')">
              ${renderTeamLogo(name, "mini-team-logo")}
              <span><b>${tEsc(name)}</b><small class="mono mut">${reg} · OVR ${getTeamOvr(name)}</small></span>
            </button>
            <button type="button" class="t-pick-follow mono ${isF ? 'is-f' : ''}" onclick="tToggleFriend('${name}')" title="Marcar equipo para seguimiento con amigos">
              ${isF ? "SIGUIENDO" : "SEGUIR"}
            </button>
          </div>`;
        }).join("")}
      </div>
    </div>`;
  }

  function renderTournament() {
    const root = document.getElementById("torneo");
    if (!root || !T) return;

    const totalMatches = T.groupMatches.length + T.playoffs.length;
    const playedMatches = T.groupMatches.filter(m => m.played).length + T.playoffs.filter(m => m.played).length;
    const allDone = !!T.champion;

    let champBanner = "";
    if (T.champion) {
      const players = computeTournamentPlayers();
      const champMvp = players.find(p => p.team === T.champion) || players[0];
      champBanner = `<div class="t-champ-banner">
        <div class="t-champ-left">
          ${renderTeamLogo(T.champion, "score-logo-sm")}
          <div>
            <span class="duel-badge">CAMPEÓN · ${tEsc(T.cfg.name)}</span>
            <div class="t-champ-name">${tEsc(T.champion)}</div>
            <small class="mono mut">SUBCAMPEÓN: ${tEsc(T.runnerUp)} · DT CAMPEÓN: ${tEsc(COACH[T.champion].n)}</small>
          </div>
        </div>
        ${champMvp ? `<div class="t-champ-mvp mono">
          <small style="color:var(--gold)">MVP DEL TORNEO</small>
          <b>${tEsc(champMvp.player)} (${tEsc(champMvp.team)})</b>
          <span>RATING ${champMvp.rating.toFixed(2)} · ACS ${champMvp.acs} · K/D ${champMvp.kd} · ${champMvp.maps} MAPAS</span>
        </div>` : ""}
      </div>`;
    }

    const phaseStatus = T.champion
      ? "TORNEO FINALIZADO"
      : T.playoffsSeeded
        ? "PLAYOFFS EN CURSO (BO3 / FINAL BO5)"
        : "FASE DE GRUPOS (ROUND-ROBIN BO3)";

    let bodyHTML = "";
    if (activeSubTab === "groups") bodyHTML = renderGroupTablesHTML();
    else if (activeSubTab === "schedule") bodyHTML = renderScheduleHTML();
    else if (activeSubTab === "bracket") bodyHTML = renderBracketHTML();
    else bodyHTML = renderStatsHTML();

    root.innerHTML = `
      <div class="box-head">
        <div>
          <h2>Modo Torneos VCT 2027 (Grupos, Calendario &amp; Playoffs Bo3/Bo5)</h2>
          <small class="mut">${tEsc(T.cfg.desc)}</small>
        </div>
        <span class="mono mut" style="font-size:11px">${phaseStatus} · ${playedMatches}/${totalMatches} SERIES</span>
      </div>

      <div class="t-toolbar">
        <div class="tac-group">
          <span class="tac-label">Torneo</span>
          <select class="map-select mono" onchange="tSelectPreset(this.value)" aria-label="Elegir formato de torneo">
            ${Object.values(TOURNAMENT_PRESETS).map(p => `<option value="${p.id}" ${p.id === setupPreset ? "selected" : ""}>${p.name}</option>`).join("")}
          </select>
          <button type="button" class="mono" onclick="tToggleSetupPicker()">${showSetupPicker ? "Cerrar Equipos" : "Equipos / Amigos"}</button>
          <button type="button" class="mono" onclick="tStartCustom(true)">Nuevo Sorteo</button>
        </div>

        <div class="btn-group">
          <button type="button" class="mono" ${allDone ? "disabled" : ""} onclick="tSimNextMatch()">+1 Serie</button>
          <button type="button" class="mono" ${allDone ? "disabled" : ""} onclick="tSimCurrentRound()">Simular Jornada</button>
          <button type="button" class="p" ${allDone ? "disabled" : ""} onclick="tSimAll()">Simular Torneo</button>
        </div>
      </div>

      ${showSetupPicker ? renderSetupPickerHTML() : ""}
      ${champBanner}

      <div class="series-tabs" style="margin-top:10px">
        <button type="button" class="series-tab ${activeSubTab === 'groups' ? 'active' : ''}" onclick="tSwitchTab('groups')">GRUPOS Y TABLA</button>
        <button type="button" class="series-tab ${activeSubTab === 'schedule' ? 'active' : ''}" onclick="tSwitchTab('schedule')">CALENDARIO (${playedMatches}/${totalMatches})</button>
        <button type="button" class="series-tab ${activeSubTab === 'bracket' ? 'active' : ''}" onclick="tSwitchTab('bracket')">BRACKET PLAYOFFS</button>
        <button type="button" class="series-tab ${activeSubTab === 'stats' ? 'active' : ''}" onclick="tSwitchTab('stats')">RANKING MVP</button>
      </div>

      ${bodyHTML}
    `;
  }

  // Inicializar torneo por defecto al cargar la app
  selectedTeams = defaultSelectionForPreset(setupPreset);
  createTournament(setupPreset, selectedTeams, false);
})();