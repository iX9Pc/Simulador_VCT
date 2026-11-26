import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { AGENTS } from "../../core/index.ts";
import { useDbStore } from "../../stores/useDbStore.ts";

export function DataPackBar() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const teams = useDbStore((s) => s.teams);
  const activePackMeta = useDbStore((s) => s.activePackMeta);
  const packDraftMeta = useDbStore((s) => s.packDraftMeta);
  const setPackDraftField = useDbStore((s) => s.setPackDraftField);
  const importDataPack = useDbStore((s) => s.importDataPack);
  const exportDataPack = useDbStore((s) => s.exportDataPack);
  const restoreOfficialData = useDbStore((s) => s.restoreOfficialData);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const res = importDataPack(parsed);
        if (!res.ok) {
          setStatusMsg({ type: "err", text: `Pack inválido: ${res.err}` });
          return;
        }
        setStatusMsg({
          type: "ok",
          text: `Pack cargado: ${res.meta.name} (${res.meta.teamsCount} equipos · ${res.meta.playersCount} jugadores · ${res.meta.agentsCount} agentes).`
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "JSON mal formado";
        setStatusMsg({ type: "err", text: `Error leyendo el archivo .json: ${message}` });
      }
    };
    reader.readAsText(file);
  };

  const handleRestore = () => {
    if (!window.confirm("¿Restaurar la base oficial VCT 2027 (equipos, coaches, agentes y map pool)?")) {
      return;
    }
    restoreOfficialData();
    setStatusMsg({ type: "ok", text: "Base oficial VCT 2027 restaurada correctamente." });
  };

  const teamCount = Object.keys(teams).length;
  const agentCount = Object.keys(AGENTS).length;

  return (
    <div id="datapack-panel" className="dp-panel">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={handleFileChange}
      />

      <div className="dp-top">
        <div>
          <b className="mono" style={{ fontSize: "11.5px" }}>
            PACKS DE DATOS (.JSON) · ROSTERS, COACHES, AGENTES Y MAP POOL
          </b>
          <div style={{ marginTop: "4px" }}>
            {activePackMeta ? (
              <span className="dp-active-pill mono">
                PACK ACTIVO: <b>{activePackMeta.name}</b> ({activePackMeta.season} ·{" "}
                {activePackMeta.teamsCount} EQ · {activePackMeta.playersCount} PROS)
              </span>
            ) : (
              <span className="dp-active-pill is-official mono">
                BASE OFICIAL VCT 2027 ({teamCount} EQ · {agentCount} AGENTES)
              </span>
            )}
          </div>
        </div>

        <div className="btn-group">
          <button
            type="button"
            className="t-btn-sm mono t-btn-live"
            onClick={() => fileInputRef.current?.click()}
          >
            Importar Pack (.json)
          </button>
          <button type="button" className="t-btn-sm mono" onClick={exportDataPack}>
            Exportar Pack Actual (.json)
          </button>
          {activePackMeta && (
            <button
              type="button"
              className="t-btn-sm mono mgr-end-btn"
              onClick={handleRestore}
            >
              Restaurar Oficial
            </button>
          )}
        </div>
      </div>

      <div className="dp-meta-row">
        <label className="dp-field">
          <span className="tac-label">Nombre del Pack</span>
          <input
            type="text"
            className="search-input mono"
            style={{ minWidth: "170px", padding: "4px 8px", fontSize: "11.5px" }}
            value={packDraftMeta.name}
            onChange={(e) => setPackDraftField("name", e.target.value)}
          />
        </label>

        <label className="dp-field">
          <span className="tac-label">Temporada</span>
          <input
            type="text"
            className="search-input mono"
            style={{ minWidth: "85px", width: "95px", padding: "4px 8px", fontSize: "11.5px" }}
            value={packDraftMeta.season}
            onChange={(e) => setPackDraftField("season", e.target.value)}
          />
        </label>

        <label className="dp-field">
          <span className="tac-label">Autor</span>
          <input
            type="text"
            className="search-input mono"
            style={{ minWidth: "120px", padding: "4px 8px", fontSize: "11.5px" }}
            value={packDraftMeta.author}
            onChange={(e) => setPackDraftField("author", e.target.value)}
          />
        </label>

        <small
          style={{
            alignSelf: "flex-end",
            fontSize: "11px",
            color: "var(--mut)"
          }}
        >
          Comparte el archivo .json para jugar temporadas retro o ligas personalizadas en Partida
          Rápida, Torneos y Manager.
        </small>
      </div>

      {statusMsg && (
        <div
          className="mono"
          style={{
            fontSize: "11px",
            color: statusMsg.type === "ok" ? "var(--ok)" : "var(--vct-red)"
          }}
        >
          {statusMsg.text}
        </div>
      )}
    </div>
  );
}