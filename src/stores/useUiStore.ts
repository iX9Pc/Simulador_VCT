import { create } from "zustand";
import { STORAGE_KEYS } from "../core/index.ts";
import { VCTSound } from "../lib/sound.ts";

export type ThemeMode = "dark" | "light";

function getInitialTheme(): ThemeMode {
  if (typeof document !== "undefined") {
    const attr = document.documentElement.getAttribute("data-theme");
    if (attr === "light" || attr === "dark") return attr;
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // noop
  }
  return "dark";
}

function applyThemeToDom(theme: ThemeMode): void {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", theme);
  }
  try {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  } catch {
    // noop
  }
}

interface UiState {
  theme: ThemeMode;
  sfxEnabled: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setSfxEnabled: (enabled: boolean) => void;
  toggleSfx: () => void;
}

const initialTheme = getInitialTheme();
applyThemeToDom(initialTheme);

export const useUiStore = create<UiState>((set, get) => ({
  theme: initialTheme,
  sfxEnabled: VCTSound.isEnabled(),

  setTheme: (theme) => {
    applyThemeToDom(theme);
    set({ theme });
  },

  toggleTheme: () => {
    const next: ThemeMode = get().theme === "light" ? "dark" : "light";
    applyThemeToDom(next);
    set({ theme: next });
  },

  setSfxEnabled: (enabled) => {
    VCTSound.setEnabled(enabled);
    set({ sfxEnabled: VCTSound.isEnabled() });
  },

  toggleSfx: () => {
    const next = VCTSound.toggle();
    set({ sfxEnabled: next });
  }
}));