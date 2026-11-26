import { useState } from "react";
import type { SeriesResult } from "../../core/index.ts";
import { useDbStore } from "../../stores/useDbStore.ts";
import { buildCompactSnapshot, copyShareLink, exportSnapshotPNG } from "./shareUtils.ts";

interface ShareBarProps {
  series: SeriesResult;
}

export function ShareBar({ series }: ShareBarProps) {
  const teamMeta = useDbStore((s) => s.teamMeta);
  const [feedback, setFeedback] = useState("");

  const flash = (msg: string) => {
    setFeedback(msg);
    window.setTimeout(() => {
      setFeedback((cur) => (cur === msg ? "" : cur));
    }, 3500);
  };

  const handleCopy = async () => {
    const snap = buildCompactSnapshot(series, teamMeta);
    const msg = await copyShareLink(snap);
    flash(msg);
  };

  const handlePng = async () => {
    const snap = buildCompactSnapshot(series, teamMeta);
    await exportSnapshotPNG(snap);
    flash("IMAGEN PNG DESCARGADA");
  };

  return (
    <div className="share-bar">
      <div className="share-bar-left mono">
        <span>COMPARTIR RESULTADO</span>
        {feedback && <span className="kd-pos">{feedback}</span>}
      </div>
      <div className="btn-group">
        <button type="button" className="t-btn-sm mono" onClick={handleCopy}>
          Copiar Link
        </button>
        <button type="button" className="t-btn-sm mono t-btn-live" onClick={handlePng}>
          Descargar Imagen PNG
        </button>
      </div>
    </div>
  );
}