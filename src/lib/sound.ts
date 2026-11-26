import { STORAGE_KEYS } from "../core/index.ts";

type WebkitWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

let ctx: AudioContext | null = null;
let enabled = true;
let lastClickAt = 0;

try {
  const saved = localStorage.getItem(STORAGE_KEYS.SFX);
  if (saved === "off") enabled = false;
} catch {
  // Ignorar errores de acceso a storage
}

function ensureContext(): AudioContext | null {
  if (!enabled || typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as WebkitWindow).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

function tone(
  freq: number,
  dur: number,
  type: OscillatorType = "sine",
  vol = 0.06,
  delay = 0,
  freqEnd: number | null = null
): void {
  const ac = ensureContext();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd !== null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
  }
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.015);
}

function noiseBurst(dur = 0.03, vol = 0.035, hpFreq = 1800, delay = 0): void {
  const ac = ensureContext();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const frames = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buf = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.setValueAtTime(hpFreq, t0);

  const gain = ac.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(ac.destination);
  src.start(t0);
}

export const VCTSound = {
  isEnabled(): boolean {
    return enabled;
  },

  setEnabled(flag: boolean): void {
    enabled = Boolean(flag);
    try {
      localStorage.setItem(STORAGE_KEYS.SFX, enabled ? "on" : "off");
    } catch {
      // noop
    }
    if (enabled) this.uiClick(true);
  },

  toggle(): boolean {
    this.setEnabled(!enabled);
    return enabled;
  },

  uiClick(force = false): void {
    const now = performance.now();
    if (!force && now - lastClickAt < 55) return;
    lastClickAt = now;
    tone(760, 0.028, "triangle", 0.03, 0, 420);
  },

  kill(isFb = false): void {
    noiseBurst(0.026, isFb ? 0.045 : 0.03, 2200, 0);
    tone(isFb ? 1040 : 860, 0.055, "sine", isFb ? 0.065 : 0.048, 0, isFb ? 1320 : 640);
  },

  plant(): void {
    tone(1240, 0.06, "square", 0.035, 0);
    tone(1240, 0.06, "square", 0.035, 0.11);
    tone(1560, 0.08, "triangle", 0.04, 0.22);
  },

  defuse(): void {
    tone(440, 0.09, "sine", 0.05, 0);
    tone(660, 0.14, "sine", 0.055, 0.08);
  },

  clutch(): void {
    tone(523.25, 0.11, "triangle", 0.055, 0);
    tone(659.25, 0.12, "triangle", 0.06, 0.09);
    tone(783.99, 0.2, "sine", 0.065, 0.18);
  },

  ace(): void {
    tone(523.25, 0.09, "triangle", 0.06, 0);
    tone(659.25, 0.09, "triangle", 0.06, 0.08);
    tone(783.99, 0.11, "triangle", 0.065, 0.16);
    tone(1046.5, 0.24, "sine", 0.075, 0.25);
  },

  timeout(): void {
    tone(340, 0.08, "sine", 0.045, 0);
    tone(290, 0.11, "sine", 0.045, 0.1);
  },

  roundEnd(): void {
    tone(260, 0.07, "triangle", 0.045, 0, 180);
    tone(520, 0.09, "sine", 0.035, 0.05);
  },

  mapEnd(): void {
    tone(330, 0.14, "triangle", 0.06, 0);
    tone(440, 0.14, "triangle", 0.06, 0.11);
    tone(659.25, 0.28, "sine", 0.07, 0.22);
  }
};

export function initGlobalClickSfx(): () => void {
  const onClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    const btn = target?.closest?.("button, summary") as HTMLButtonElement | HTMLElement | null;
    if (!btn || btn.id === "sfxToggle" || ("disabled" in btn && btn.disabled)) return;
    VCTSound.uiClick();
  };
  document.addEventListener("click", onClick, { passive: true });
  return () => document.removeEventListener("click", onClick);
}