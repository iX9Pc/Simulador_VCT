// ===== MÓDULO P6.4: SONIDO TÁCTICO LIGERO (WEB AUDIO API + SILENCIO GLOBAL) =====
(function () {
  const SFX_KEY = "vct_sim_sfx";
  let ctx = null;
  let enabled = true;
  let lastClickAt = 0;

  try {
    const saved = localStorage.getItem(SFX_KEY);
    if (saved === "off") enabled = false;
  } catch (e) {}

  function ensureContext() {
    if (!enabled) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function tone(freq, dur, type = "sine", vol = 0.06, delay = 0, freqEnd = null) {
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

  function noiseBurst(dur = 0.03, vol = 0.035, hpFreq = 1800, delay = 0) {
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

  const VCTSound = {
    isEnabled() { return enabled; },

    setEnabled(flag) {
      enabled = !!flag;
      try { localStorage.setItem(SFX_KEY, enabled ? "on" : "off"); } catch (e) {}
      updateToggleBtn();
      if (enabled) this.uiClick(true);
    },

    toggle() {
      this.setEnabled(!enabled);
    },

    uiClick(force = false) {
      const now = performance.now();
      if (!force && now - lastClickAt < 55) return;
      lastClickAt = now;
      tone(760, 0.028, "triangle", 0.03, 0, 420);
    },

    kill(isFb = false) {
      noiseBurst(0.026, isFb ? 0.045 : 0.03, 2200, 0);
      tone(isFb ? 1040 : 860, 0.055, "sine", isFb ? 0.065 : 0.048, 0, isFb ? 1320 : 640);
    },

    plant() {
      tone(1240, 0.06, "square", 0.035, 0);
      tone(1240, 0.06, "square", 0.035, 0.11);
      tone(1560, 0.08, "triangle", 0.04, 0.22);
    },

    defuse() {
      tone(440, 0.09, "sine", 0.05, 0);
      tone(660, 0.14, "sine", 0.055, 0.08);
    },

    clutch() {
      tone(523.25, 0.11, "triangle", 0.055, 0);
      tone(659.25, 0.12, "triangle", 0.06, 0.09);
      tone(783.99, 0.20, "sine", 0.065, 0.18);
    },

    ace() {
      tone(523.25, 0.09, "triangle", 0.06, 0);
      tone(659.25, 0.09, "triangle", 0.06, 0.08);
      tone(783.99, 0.11, "triangle", 0.065, 0.16);
      tone(1046.5, 0.24, "sine", 0.075, 0.25);
    },

    timeout() {
      tone(340, 0.08, "sine", 0.045, 0);
      tone(290, 0.11, "sine", 0.045, 0.10);
    },

    roundEnd() {
      tone(260, 0.07, "triangle", 0.045, 0, 180);
      tone(520, 0.09, "sine", 0.035, 0.05);
    },

    mapEnd() {
      tone(330, 0.14, "triangle", 0.06, 0);
      tone(440, 0.14, "triangle", 0.06, 0.11);
      tone(659.25, 0.28, "sine", 0.07, 0.22);
    }
  };

  function iconSVG(on) {
    return on
      ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`
      : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;
  }

  function updateToggleBtn() {
    const btn = document.getElementById("sfxToggle");
    if (!btn) return;
    btn.classList.toggle("is-muted", !enabled);
    btn.setAttribute("aria-pressed", String(enabled));
    btn.innerHTML = `${iconSVG(enabled)}<span>${enabled ? "SFX ON" : "SFX OFF"}</span>`;
  }

  function mountHeaderToggle() {
    if (document.getElementById("sfxToggle")) {
      updateToggleBtn();
      return;
    }
    const themeBtn = document.getElementById("themeToggle");
    if (!themeBtn || !themeBtn.parentNode) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "sfxToggle";
    btn.className = "theme-btn sfx-btn mono";
    btn.title = "Activar o silenciar efectos de sonido tácticos";
    btn.onclick = () => VCTSound.toggle();
    themeBtn.parentNode.insertBefore(btn, themeBtn);
    updateToggleBtn();
  }

  // Click táctico sutil en controles de UI (excluyendo el botón de silencio)
  document.addEventListener("click", e => {
    const btn = e.target && e.target.closest ? e.target.closest("button, summary") : null;
    if (!btn || btn.id === "sfxToggle" || btn.disabled) return;
    VCTSound.uiClick();
  }, { passive: true });

  window.VCTSound = VCTSound;
  mountHeaderToggle();
})();