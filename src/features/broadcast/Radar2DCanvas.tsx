import { useCallback, useEffect, useRef, useState } from "react";
import type { MatchResult } from "../../core/index.ts";
import { VCTSound } from "../../lib/sound.ts";
import { useUiStore } from "../../stores/useUiStore.ts";
import {
  buildRoundChoreography,
  drawRadarFrame,
  getRadarThemeColors,
  subscribeMapAsset
} from "./radar2dEngine.ts";
import type { RadarThemeColors, RoundPlan } from "./radar2dEngine.ts";

interface Radar2DCanvasProps {
  match: MatchResult;
  maxR: number;
  isAutoPlaying: boolean;
  jumpSignal: { roundNum: number; seq: number } | null;
}

export function Radar2DCanvas({
  match,
  maxR,
  isAutoPlaying,
  jumpSignal
}: Radar2DCanvasProps) {
  const theme = useUiStore((s) => s.theme);

  const [roundNum, setRoundNum] = useState(maxR);
  const [navReadyTick, setNavReadyTick] = useState(0);
  const [plan, setPlan] = useState<RoundPlan | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [displayTime, setDisplayTime] = useState(0);
  const [colors, setColors] = useState<RadarThemeColors>(() => getRadarThemeColors());

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const planRef = useRef<RoundPlan | null>(null);
  const timeRef = useRef(0);
  const playingRef = useRef(false);
  const speedRef = useRef<1 | 2>(1);
  const rafIdRef = useRef<number | null>(null);
  const lastTsRef = useRef(0);
  const lastUiTickRef = useRef(-1);
  const pendingAutoPlayRef = useRef(false);
  const builtWithNavRef = useRef(false);
  const prevMatchRef = useRef<MatchResult | null>(null);
  const prevMaxRRef = useRef(maxR);

  speedRef.current = speed;

  const stopLoop = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    playingRef.current = false;
    setPlaying(false);
  }, []);

  const renderCanvas = useCallback((p: RoundPlan | null, t: number) => {
    if (!canvasRef.current || !p) return;
    const c = drawRadarFrame(canvasRef.current, p, t);
    setColors(c);
  }, []);

  const startLoop = useCallback(() => {
    const p = planRef.current;
    if (!p || !builtWithNavRef.current) return;
    if (timeRef.current >= p.duration - 0.05) {
      timeRef.current = 0;
      setDisplayTime(0);
    }
    playingRef.current = true;
    setPlaying(true);
    lastTsRef.current = 0;

    const tick = (ts: number) => {
      const curPlan = planRef.current;
      if (!playingRef.current || !curPlan) return;
      if (!lastTsRef.current) lastTsRef.current = ts;
      const dt = Math.min(0.1, (ts - lastTsRef.current) / 1000) * speedRef.current;
      lastTsRef.current = ts;
      const prevT = timeRef.current;
      const nextT = Math.min(curPlan.duration, prevT + dt);
      timeRef.current = nextT;

      if (VCTSound.isEnabled()) {
        for (const ev of curPlan.events) {
          if (ev.t > prevT && ev.t <= nextT) VCTSound.kill(ev.fb);
        }
        if (curPlan.plantTime !== null && curPlan.plantTime > prevT && curPlan.plantTime <= nextT) {
          VCTSound.plant();
        }
        if (
          curPlan.defuseTime !== null &&
          curPlan.defuseTime > prevT &&
          curPlan.defuseTime <= nextT
        ) {
          VCTSound.defuse();
        }
      }

      if (canvasRef.current) drawRadarFrame(canvasRef.current, curPlan, nextT);

      const dec = Math.floor(nextT * 10);
      if (dec !== lastUiTickRef.current || nextT >= curPlan.duration) {
        lastUiTickRef.current = dec;
        setDisplayTime(nextT);
      }

      if (nextT >= curPlan.duration) {
        if (VCTSound.isEnabled()) {
          const R = curPlan.round;
          if (R.hl.some((h) => h.t === "ace")) VCTSound.ace();
          else if (R.cl && R.cl.won && R.cl.x >= 2) VCTSound.clutch();
          else VCTSound.roundEnd();
        }
        stopLoop();
        return;
      }

      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);
  }, [stopLoop]);

  // Sincronizar ronda cuando cambia el mapa o avanza maxR
  useEffect(() => {
    const isSameMap = prevMatchRef.current === match;
    const grew = isSameMap && maxR > prevMaxRRef.current;
    prevMatchRef.current = match;
    prevMaxRRef.current = maxR;

    pendingAutoPlayRef.current = !isAutoPlaying && grew;
    setRoundNum(maxR);
  }, [match, maxR, isAutoPlaying]);

  // Saltar a ronda específica desde timeline o matriz de economía
  useEffect(() => {
    if (!jumpSignal) return;
    const clamped = Math.max(1, Math.min(maxR, jumpSignal.roundNum));
    pendingAutoPlayRef.current = true;
    setRoundNum(clamped);
  }, [jumpSignal, maxR]);

  // Construir coreografía cuando cambia mapa, ronda o al cargarse el navmesh
  useEffect(() => {
    stopLoop();
    const safeR = Math.max(1, Math.min(maxR, roundNum));
    const R = match.rounds[safeR - 1];
    if (!R) return;

    const { entry, unsubscribe } = subscribeMapAsset(match.mapName, () => {
      setNavReadyTick((t) => t + 1);
    });

    const hasNav = Boolean(entry.ready && entry.nav);
    builtWithNavRef.current = hasNav;

    const built = buildRoundChoreography(match, R, hasNav ? entry.nav : null);
    planRef.current = built;
    setPlan(built);

    const shouldPlay = pendingAutoPlayRef.current && hasNav && !isAutoPlaying;
    const initTime = pendingAutoPlayRef.current ? 0 : built.duration;
    timeRef.current = initTime;
    lastUiTickRef.current = Math.floor(initTime * 10);
    setDisplayTime(initTime);

    requestAnimationFrame(() => {
      renderCanvas(built, initTime);
      if (shouldPlay) {
        pendingAutoPlayRef.current = false;
        startLoop();
      }
    });

    return () => {
      unsubscribe();
      stopLoop();
    };
  }, [match, roundNum, maxR, navReadyTick, isAutoPlaying, renderCanvas, startLoop, stopLoop]);

  // Redibujar al cambiar tema dark/light
  useEffect(() => {
    if (planRef.current) {
      renderCanvas(planRef.current, timeRef.current);
    }
  }, [theme, renderCanvas]);

  const stepRound = (delta: number) => {
    const next = Math.max(1, Math.min(maxR, roundNum + delta));
    if (next === roundNum) return;
    pendingAutoPlayRef.current = true;
    setRoundNum(next);
  };

  const togglePlay = () => {
    if (playingRef.current) stopLoop();
    else startLoop();
  };

  const restart = () => {
    stopLoop();
    timeRef.current = 0;
    lastUiTickRef.current = 0;
    setDisplayTime(0);
    renderCanvas(planRef.current, 0);
    startLoop();
  };

  const toggleSpeed = () => {
    setSpeed((prev) => (prev === 1 ? 2 : 1));
  };

  const handleScrub = (val: string) => {
    const p = planRef.current;
    if (!p) return;
    stopLoop();
    const nextT = (Number(val) / 1000) * p.duration;
    timeRef.current = nextT;
    lastUiTickRef.current = Math.floor(nextT * 10);
    setDisplayTime(nextT);
    renderCanvas(p, nextT);
  };

  if (!plan) return null;

  const R = plan.round;
  let phaseTxt = `${plan.strategy} · SITE ${plan.targetSite.id}`;
  let phaseCls = "mut";
  if (displayTime >= plan.duration - 0.05) {
    phaseTxt = `RONDA PARA ${match.teams[R.win].name.toUpperCase()}`;
    phaseCls = R.win === 0 ? "ca" : "cb";
  } else if (plan.defuseTime !== null && displayTime >= plan.defuseTime) {
    phaseTxt = "SPIKE DESACTIVADA";
    phaseCls = "kd-pos";
  } else if (plan.plantTime !== null && displayTime >= plan.plantTime) {
    phaseTxt = `SPIKE PLANTADA · SITE ${plan.targetSite.id}`;
    phaseCls = "kd-neg";
  } else if (displayTime >= 2.2) {
    phaseTxt = `${plan.strategy} → SITE ${plan.targetSite.id}`;
    phaseCls = "stat-elite";
  }

  const alive0 = Object.values(plan.actors).filter(
    (a) => a.ti === 0 && displayTime < a.deadAt
  ).length;
  const alive1 = Object.values(plan.actors).filter(
    (a) => a.ti === 1 && displayTime < a.deadAt
  ).length;
  const side0 = plan.atkTi === 0 ? "ATK" : "DEF";
  const side1 = plan.atkTi === 1 ? "ATK" : "DEF";
  const happened = plan.events.filter((e) => e.t <= displayTime);
  const scrubVal = Math.round((displayTime / Math.max(0.1, plan.duration)) * 1000);

  return (
    <div id="radar2d-host">
      <div className="box r2d-box">
        <div className="box-head">
          <div className="box-title-wrap">
            <h2>Visor Táctico 2D · {match.mapName}</h2>
            <span className="econ-pill">
              R{R.n} [{R.before[0]}-{R.before[1]}]
            </span>
          </div>
          <span
            className={`mono r2d-phase ${phaseCls}`}
            style={phaseCls === "mut" ? { color: "var(--mut)" } : undefined}
          >
            {phaseTxt}
          </span>
        </div>

        <div className="r2d-subbar mono">
          <div className="r2d-alive">
            <span style={{ color: colors.a }}>
              {match.teams[0].name} ({side0}): <b>{alive0}</b>
            </span>
            <span style={{ color: "var(--mut)" }}>VS</span>
            <span style={{ color: colors.b }}>
              <b>{alive1}</b> :({side1}) {match.teams[1].name}
            </span>
          </div>
          <span style={{ color: "var(--mut)" }}>
            {displayTime.toFixed(1)}s / {plan.duration.toFixed(1)}s
          </span>
        </div>

        <div className="r2d-canvas-wrap">
          <canvas ref={canvasRef} className="r2d-canvas" />
        </div>

        <div className="r2d-controls">
          <div className="btn-group">
            <button
              type="button"
              className="t-btn-sm mono"
              onClick={() => stepRound(-1)}
              disabled={roundNum <= 1}
              title="Ronda anterior"
            >
              ◄
            </button>
            <span className="mono r2d-rcount">
              R{roundNum}/{maxR}
            </span>
            <button
              type="button"
              className="t-btn-sm mono"
              onClick={() => stepRound(1)}
              disabled={roundNum >= maxR}
              title="Ronda siguiente"
            >
              ►
            </button>
          </div>
          <div className="btn-group">
            <button
              type="button"
              className={`t-btn-sm mono ${playing ? "live-active" : ""}`}
              onClick={togglePlay}
            >
              {playing ? "PAUSA" : "PLAY"}
            </button>
            <button type="button" className="t-btn-sm mono" onClick={restart}>
              REINICIAR
            </button>
            <button type="button" className="t-btn-sm mono" onClick={toggleSpeed}>
              {speed}X
            </button>
          </div>
        </div>

        <input
          type="range"
          className="r2d-scrub"
          min={0}
          max={1000}
          value={scrubVal}
          aria-label="Línea de tiempo de la ronda"
          onChange={(e) => handleScrub(e.target.value)}
        />

        <div className="r2d-feed mono">
          {!happened.length ? (
            <span style={{ color: "var(--mut)" }}>
              Plan atacante: {plan.strategy} · Desplegando utilidad de apertura.
            </span>
          ) : (
            happened.slice(-3).map((e, i) => {
              const ka = plan.actors[e.k];
              const va = plan.actors[e.v];
              return (
                <div key={`${e.t}-${i}`} className="r2d-feed-row">
                  <span style={{ color: "var(--mut)" }}>{e.t.toFixed(1)}s</span>
                  <b style={{ color: ka?.ti ? colors.b : colors.a }}>{ka?.name}</b>
                  <span>→</span>
                  <span style={{ color: va?.ti ? colors.b : colors.a }}>{va?.name}</span>
                  {e.fb && <span className="k-tag k-fb">FB</span>}
                  {e.tr && <span className="k-tag k-tr">TR</span>}
                  <span className="econ-pill" style={{ marginLeft: "auto", fontSize: "9px" }}>
                    {e.tacTag || "DUELO"}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}