import { Link, useLocation } from "react-router-dom";
import { useDbStore } from "../stores/useDbStore.ts";
import { useUiStore } from "../stores/useUiStore.ts";

export function Topbar() {
  const location = useLocation();
  const isManager = location.pathname.startsWith("/manager");

  const teams = useDbStore((s) => s.teams);
  const theme = useUiStore((s) => s.theme);
  const sfxEnabled = useUiStore((s) => s.sfxEnabled);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const toggleSfx = useUiStore((s) => s.toggleSfx);

  const teamNames = Object.keys(teams);
  const totalPlayers = teamNames.reduce((acc, t) => acc + teams[t].length, 0);

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link to="/" className="brand">
          <span className="brand-icon" aria-hidden="true">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2.4"
            >
              <polygon points="12 2 22 12 12 22 2 12" />
              <circle cx="12" cy="12" r="2.6" fill="#FFFFFF" stroke="none" />
            </svg>
          </span>
          <span className="brand-text">
            <span className="brand-title">VCT SIM 2027</span>
            <span className="brand-sub mono" id="brandMeta">
              {isManager
                ? `MANAGER OS · ${teamNames.length} CLUBES · 33 SEM`
                : `BROADCAST ENGINE · ${teamNames.length} CLUBES · ${totalPlayers} PROS`}
            </span>
          </span>
        </Link>

        <nav className="nav-links" aria-label="Navegación principal">
          {isManager ? (
            <Link to="/" className="nav-link">
              <span className="nav-idx">00</span> Simulador Principal
            </Link>
          ) : (
            <>
              <a href="#sim" className="nav-link">
                <span className="nav-idx">01</span> Simulador
              </a>
              <a href="#torneo" className="nav-link">
                <span className="nav-idx">02</span> Torneos
              </a>
              <a href="#social" className="nav-link">
                <span className="nav-idx">03</span> Social
              </a>
              <a href="#database" className="nav-link">
                <span className="nav-idx">04</span> Base de Datos
              </a>
              <Link to="/manager" className="nav-link nav-manager-link">
                <span className="mgr-live-pip" aria-hidden="true" />
                Modo Manager
              </Link>
            </>
          )}

          <div className="topbar-utils">
            <button
              type="button"
              id="sfxToggle"
              className={`theme-btn sfx-btn mono ${sfxEnabled ? "" : "is-muted"}`}
              aria-pressed={sfxEnabled}
              title="Activar o silenciar efectos de sonido tácticos"
              onClick={toggleSfx}
            >
              {sfxEnabled ? (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
              ) : (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              )}
              <span>{sfxEnabled ? "SFX ON" : "SFX OFF"}</span>
            </button>

            <button
              type="button"
              id="themeToggle"
              className="theme-btn mono"
              title="Alternar tema oscuro / claro"
              onClick={toggleTheme}
            >
              <span id="themeLabel">{theme.toUpperCase()}</span>
            </button>
          </div>
        </nav>
      </div>
    </header>
  );
}