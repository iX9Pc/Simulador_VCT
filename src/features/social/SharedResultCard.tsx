import { useEffect } from "react";
import { useSocialStore } from "../../stores/useSocialStore.ts";
import { exportSnapshotPNG } from "./shareUtils.ts";
import type { CompactPlayerRow } from "./shareUtils.ts";

function MiniBoxRows({ rows }: { rows: CompactPlayerRow[] }) {
  return (
    <>
      {rows.map((p, i) => (
        <tr key={`${p[0]}-${i}`}>
          <td style={{ textAlign: "left" }}>
            <b>{p[0]}</b>
          </td>
          <td style={{ textAlign: "left", color: "var(--mut)" }} className="mono">
            {p[1]}
          </td>
          <td className="mono">
            <b>{p[2]}</b>
          </td>
          <td className="mono">{p[3]}</td>
          <td className="mono">
            {p[4]}/{p[5]}/{p[6]}
          </td>
          <td className="mono">{p[7]}%</td>
        </tr>
      ))}
    </>
  );
}

export function SharedResultCard() {
  const sharedSnap = useSocialStore((s) => s.sharedSnap);
  const syncSharedHash = useSocialStore((s) => s.syncSharedHash);
  const closeSharedSnap = useSocialStore((s) => s.closeSharedSnap);

  useEffect(() => {
    const onHash = () => syncSharedHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [syncSharedHash]);

  if (!sharedSnap) return null;

  const mapsStr = sharedSnap.maps.map((m) => `${m[0]} ${m[1]}-${m[2]}`).join(" · ");

  return (
    <div className="shared-card">
      <div className="box-head">
        <div>
          <span className="duel-badge">RESULTADO COMPARTIDO POR LINK</span>
          <h2 style={{ marginTop: "6px" }}>
            <span style={{ color: sharedSnap.ca }}>{sharedSnap.a}</span> {sharedSnap.sa} :{" "}
            {sharedSnap.sb} <span style={{ color: sharedSnap.cb }}>{sharedSnap.b}</span>
          </h2>
          <small className="mono" style={{ color: "var(--mut)" }}>
            BO{sharedSnap.f} · {mapsStr} · {sharedSnap.d} · MVP: {sharedSnap.mvp[0]} (
            {sharedSnap.mvp[2]} R2.0)
          </small>
        </div>

        <div className="btn-group">
          <button
            type="button"
            className="t-btn-sm mono t-btn-live"
            onClick={() => exportSnapshotPNG(sharedSnap)}
          >
            Descargar PNG
          </button>
          <button type="button" className="t-btn-sm mono" onClick={closeSharedSnap}>
            Cerrar
          </button>
        </div>
      </div>

      <div className="t-groups-grid">
        <div className="t-group-card">
          <div className="t-group-head">
            <b style={{ color: sharedSnap.ca }}>{sharedSnap.a}</b>
          </div>
          <div className="sc">
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Jugador</th>
                  <th style={{ textAlign: "left" }}>Agente</th>
                  <th>R2.0</th>
                  <th>ACS</th>
                  <th>K/D/A</th>
                  <th>KAST</th>
                </tr>
              </thead>
              <tbody>
                <MiniBoxRows rows={sharedSnap.p0} />
              </tbody>
            </table>
          </div>
        </div>

        <div className="t-group-card">
          <div className="t-group-head">
            <b style={{ color: sharedSnap.cb }}>{sharedSnap.b}</b>
          </div>
          <div className="sc">
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Jugador</th>
                  <th style={{ textAlign: "left" }}>Agente</th>
                  <th>R2.0</th>
                  <th>ACS</th>
                  <th>K/D/A</th>
                  <th>KAST</th>
                </tr>
              </thead>
              <tbody>
                <MiniBoxRows rows={sharedSnap.p1} />
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}