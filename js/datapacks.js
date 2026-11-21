// ===== MÓDULO P6.3: PACKS DE DATOS COMPLETOS (.JSON IMPORT / EXPORT / PERSISTENCIA) =====
(function () {
  const PACK_KEY = "vct_sim_active_datapack_v1";
  const dEsc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function replaceObj(target, source) {
    if (!target || !source || typeof source !== "object") return;
    for (const k in target) delete target[k];
    Object.assign(target, clone(source));
  }

  // Guardar copia limpia de la base oficial al arrancar antes de aplicar cualquier pack
  const OFFICIAL_SNAPSHOT = {
    teamMeta: clone(TEAM_META),
    teams: clone(DEFAULT_TEAMS),
    coaches: clone(COACH),
    agents: clone(AGENTS),
    playerAgents: clone(PLAYER_AGENTS),
    hushMastery: clone(HUSH_MASTERY),
    activeMapPool: Object.keys(MAP_POOL),
    academies: (window.DATA && window.DATA.academies) ? clone(window.DATA.academies) : null
  };

  let activePackMeta = null;
  let draftMeta = {
    name: "VCT 2027 Custom Pack",
    season: "2027",
    author: "Comunidad"
  };

  function validatePack(raw) {
    if (!raw || typeof raw !== "object") return { ok: false, err: "El archivo JSON está vacío o mal formado." };
    const pack = raw.pack && typeof raw.pack === "object" ? raw.pack : raw;
    if (!pack.teams || typeof pack.teams !== "object") {
      return { ok: false, err: "Falta el bloque 'teams' en el pack de datos." };
    }
    const teamNames = Object.keys(pack.teams);
    if (teamNames.length < 2) {
      return { ok: false, err: "El pack debe contener al menos 2 equipos." };
    }
    for (const name of teamNames) {
      const entry = pack.teams[name];
      const players = Array.isArray(entry) ? entry : (entry && entry.players);
      if (!Array.isArray(players) || players.length < 5) {
        return { ok: false, err: `El equipo "${name}" necesita al menos 5 jugadores.` };
      }
    }
    return { ok: true, pack };
  }

  function applyPackToRuntime(pack, persist = true) {
    const newMeta = {};
    const newTeams = {};
    const newCoaches = {};

    for (const tName in pack.teams) {
      const entry = pack.teams[tName];
      const players = Array.isArray(entry) ? entry : entry.players;
      newMeta[tName] = {
        reg: (entry && entry.reg) || "AMERICAS",
        color: (entry && entry.color) || "#E5484D",
        logo: (entry && entry.logo) || (tName.toLowerCase().replace(/\s+/g, "") + ".png"),
        code: (entry && entry.code) || tName.slice(0, 3).toUpperCase(),
        logoCls: (entry && entry.logoCls) || ""
      };
      newTeams[tName] = players.map(p => ({
        n: String(p.n || "Player"),
        r: String(p.r || "Flex"),
        aim: Number(p.aim) || 80,
        fd: Number(p.fd) || 80,
        clutch: Number(p.clutch) || 80,
        entry: Number(p.entry) || 80,
        util: Number(p.util) || 80,
        igl: Number(p.igl) || 70,
        conf: Number(p.conf) || 78,
        cons: Number(p.cons) || 80,
        pot: Number(p.pot) || 85,
        sub: p.sub ? 1 : 0
      }));

      const c = (pack.coaches && pack.coaches[tName]) || null;
      newCoaches[tName] = c
        ? {
            n: String(c.n || "Coach"),
            macro: Number(c.macro) || 82,
            micro: Number(c.micro) || 82,
            adapt: Number(c.adapt) || 82,
            dev: Number(c.dev) || 82,
            disc: Number(c.disc) || 82
          }
        : { n: "HeadCoach", macro: 82, micro: 82, adapt: 82, dev: 82, disc: 82 };
    }

    replaceObj(TEAM_META, newMeta);
    replaceObj(DEFAULT_TEAMS, newTeams);
    replaceObj(TEAMS, newTeams);
    replaceObj(COACH, newCoaches);

    if (pack.agents && typeof pack.agents === "object" && Object.keys(pack.agents).length >= 5) {
      replaceObj(AGENTS, pack.agents);
    }
    if (pack.playerAgents && typeof pack.playerAgents === "object") {
      replaceObj(PLAYER_AGENTS, pack.playerAgents);
    }
    if (pack.hushMastery && typeof pack.hushMastery === "object") {
      replaceObj(HUSH_MASTERY, pack.hushMastery);
    }
    if (Array.isArray(pack.activeMapPool) && pack.activeMapPool.length === 7 && typeof setActiveMapPool === "function") {
      setActiveMapPool(pack.activeMapPool);
    }
    if (pack.academies && window.DATA) {
      window.DATA.academies = clone(pack.academies);
    }

    activePackMeta = {
      name: (pack.meta && pack.meta.name) || "Pack Personalizado",
      season: (pack.meta && pack.meta.season) || "Custom",
      author: (pack.meta && pack.meta.author) || "Usuario",
      teamsCount: Object.keys(newTeams).length,
      playersCount: Object.values(newTeams).reduce((s, arr) => s + arr.length, 0),
      agentsCount: Object.keys(AGENTS).length
    };

    if (persist) {
      try {
        localStorage.setItem(PACK_KEY, JSON.stringify(pack));
        if (typeof saveTeams === "function") saveTeams();
      } catch (e) {}
    }
  }

  function buildCurrentPackObject() {
    const teamsOut = {};
    for (const tName in TEAMS) {
      const m = TEAM_META[tName] || { reg: "AMERICAS", color: "#E5484D", logo: "vct.png", code: tName.slice(0, 3).toUpperCase(), logoCls: "" };
      teamsOut[tName] = {
        reg: m.reg,
        color: m.color,
        logo: m.logo,
        code: m.code,
        logoCls: m.logoCls || "",
        players: clone(TEAMS[tName])
      };
    }

    return {
      format: "vct-sim-datapack",
      version: 1,
      meta: {
        name: (draftMeta.name || "VCT Custom Pack").trim(),
        season: (draftMeta.season || "2027").trim(),
        author: (draftMeta.author || "Comunidad").trim(),
        exportedAt: new Date().toISOString()
      },
      activeMapPool: Object.keys(MAP_POOL),
      teams: teamsOut,
      coaches: clone(COACH),
      agents: clone(AGENTS),
      playerAgents: clone(PLAYER_AGENTS),
      hushMastery: clone(HUSH_MASTERY),
      academies: (window.DATA && window.DATA.academies) ? clone(window.DATA.academies) : null
    };
  }

  function refreshAllViewsAfterPackChange() {
    if (typeof window.refreshTeamSelects === "function") window.refreshTeamSelects();
    if (typeof syncMapSelector === "function") syncMapSelector();
    if (typeof window.tSelectPreset === "function") {
      const cnt = Object.keys(TEAMS).length;
      window.tSelectPreset(cnt >= 16 ? "masters16" : cnt >= 8 ? "masters8" : "americas6");
    }
    const goBtn = document.getElementById("go");
    if (goBtn) goBtn.click();
    renderDataPackBar();
  }

  // ===== ACCIONES GLOBALES =====
  window.dpUpdateField = function (field, val) {
    draftMeta[field] = val;
  };

  window.dpExportPack = function () {
    const pack = buildCurrentPackObject();
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const slug = (pack.meta.name || "vct-pack").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const a = document.createElement("a");
    a.href = url;
    a.download = `vct-pack-${slug || "custom"}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  window.dpImportPack = function () {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = ".json,application/json";
    inp.onchange = e => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          const res = validatePack(parsed);
          if (!res.ok) {
            alert("Pack inválido: " + res.err);
            return;
          }
          applyPackToRuntime(res.pack, true);
          refreshAllViewsAfterPackChange();
          alert(`Pack cargado: ${activePackMeta.name} (${activePackMeta.teamsCount} equipos · ${activePackMeta.playersCount} jugadores · ${activePackMeta.agentsCount} agentes).`);
        } catch (err) {
          alert("Error leyendo el archivo .json: " + err.message);
        }
      };
      reader.readAsText(file);
    };
    inp.click();
  };

  window.dpRestoreOfficial = function () {
    if (!confirm("¿Restaurar la base oficial VCT 2027 (equipos, coaches, agentes y map pool)?")) return;
    try { localStorage.removeItem(PACK_KEY); } catch (e) {}

    replaceObj(TEAM_META, OFFICIAL_SNAPSHOT.teamMeta);
    replaceObj(DEFAULT_TEAMS, OFFICIAL_SNAPSHOT.teams);
    replaceObj(TEAMS, OFFICIAL_SNAPSHOT.teams);
    replaceObj(COACH, OFFICIAL_SNAPSHOT.coaches);
    replaceObj(AGENTS, OFFICIAL_SNAPSHOT.agents);
    replaceObj(PLAYER_AGENTS, OFFICIAL_SNAPSHOT.playerAgents);
    replaceObj(HUSH_MASTERY, OFFICIAL_SNAPSHOT.hushMastery);
    if (typeof setActiveMapPool === "function") setActiveMapPool(OFFICIAL_SNAPSHOT.activeMapPool);
    if (window.DATA && OFFICIAL_SNAPSHOT.academies) window.DATA.academies = clone(OFFICIAL_SNAPSHOT.academies);
    if (typeof window.reapplyCustomTeams === "function") window.reapplyCustomTeams();
    if (typeof saveTeams === "function") saveTeams();

    activePackMeta = null;
    refreshAllViewsAfterPackChange();
  };

  function renderDataPackBar() {
    const dbSec = document.getElementById("database");
    if (!dbSec) return;

    let host = document.getElementById("datapack-panel");
    if (!host) {
      host = document.createElement("div");
      host.id = "datapack-panel";
      host.className = "dp-panel";
      const controls = dbSec.querySelector(".db-controls");
      if (controls) dbSec.insertBefore(host, controls);
      else dbSec.appendChild(host);
    }

    const statusBadge = activePackMeta
      ? `<span class="dp-active-pill mono">PACK ACTIVO: <b>${dEsc(activePackMeta.name)}</b> (${dEsc(activePackMeta.season)} · ${activePackMeta.teamsCount} EQ · ${activePackMeta.playersCount} PROS)</span>`
      : `<span class="dp-active-pill is-official mono">BASE OFICIAL VCT 2027 (${Object.keys(TEAMS).length} EQ · ${Object.keys(AGENTS).length} AGENTES)</span>`;

    host.innerHTML = `
      <div class="dp-top">
        <div>
          <b class="mono" style="font-size:11.5px">PACKS DE DATOS (.JSON) · ROSTERS, COACHES, AGENTES Y MAP POOL</b>
          <div style="margin-top:4px">${statusBadge}</div>
        </div>
        <div class="btn-group">
          <button type="button" class="t-btn-sm mono t-btn-live" onclick="dpImportPack()">Importar Pack (.json)</button>
          <button type="button" class="t-btn-sm mono" onclick="dpExportPack()">Exportar Pack Actual (.json)</button>
          ${activePackMeta ? `<button type="button" class="t-btn-sm mono mgr-end-btn" onclick="dpRestoreOfficial()">Restaurar Oficial</button>` : ""}
        </div>
      </div>
      <div class="dp-meta-row">
        <label class="dp-field"><span class="tac-label">Nombre del Pack</span>
          <input type="text" class="search-input mono" style="min-width:170px;padding:4px 8px;font-size:11.5px" value="${dEsc(draftMeta.name)}" oninput="dpUpdateField('name',this.value)">
        </label>
        <label class="dp-field"><span class="tac-label">Temporada</span>
          <input type="text" class="search-input mono" style="min-width:85px;width:95px;padding:4px 8px;font-size:11.5px" value="${dEsc(draftMeta.season)}" oninput="dpUpdateField('season',this.value)">
        </label>
        <label class="dp-field"><span class="tac-label">Autor</span>
          <input type="text" class="search-input mono" style="min-width:120px;padding:4px 8px;font-size:11.5px" value="${dEsc(draftMeta.author)}" oninput="dpUpdateField('author',this.value)">
        </label>
        <small class="mut" style="align-self:flex-end;font-size:11px">Comparte el archivo .json para jugar temporadas retro o ligas personalizadas en Partida Rápida, Torneos y Manager.</small>
      </div>`;
  }

  // ===== AUTO-CARGA DE PACK GUARDADO AL ARRANCAR (ANTES DE UI.JS / MANAGER.JS) =====
  try {
    const rawSaved = localStorage.getItem(PACK_KEY);
    if (rawSaved) {
      const parsed = JSON.parse(rawSaved);
      const res = validatePack(parsed);
      if (res.ok) applyPackToRuntime(res.pack, false);
    }
  } catch (e) {}

  window.VCTDataPacks = {
    getActiveMeta: () => activePackMeta,
    renderBar: renderDataPackBar
  };

  renderDataPackBar();
})();