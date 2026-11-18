# VCT Sim
Estructura: `index.html` · `styles.css` · `js/engine.js` (motor) · `js/ui.js` (interfaz) · `data/*.json` (fuente de verdad) · `tools/calibrate.mjs`.

- Probar en local: `npx serve .` (los JSON se cargan con fetch; no abrir con doble clic).
- Calibrar balance: `node tools/calibrate.mjs` (o `node tools/calibrate.mjs 1.3` para probar otro exponente). Cruces y rangos en `data/calibration.json`.
- Actualizar datos: reemplaza `data/teams.json` con el JSON de tu script y cambia `updated`. Sube el número de `STORAGE_KEY` en `js/engine.js` para que los navegadores descarten rosters viejos.
- Vercel: sube la carpeta tal cual.
