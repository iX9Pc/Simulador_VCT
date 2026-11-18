# VCT Sim: cómo publicarlo en Vercel

Es una página estática (un solo archivo `index.html`). No necesita build, servidor ni variables de entorno.

Archivos:
- `index.html`: el simulador completo (stats, equipos, coaches y motor).
- `vercel.json`: configuración mínima (URLs limpias y `noindex` para que Google no lo indexe).

## Opción A: con GitHub (recomendada)
1. Crea un repositorio nuevo en github.com (puede ser privado).
2. Sube `index.html` y `vercel.json` (botón "Add file > Upload files").
3. Entra a vercel.com, inicia sesión con GitHub y pulsa **Add New > Project**.
4. Importa el repositorio. Deja **Framework Preset: Other** y no cambies nada más.
5. Pulsa **Deploy**. En unos 30 segundos tendrás un link tipo `tu-proyecto.vercel.app` para pasar a tus amigos.

Cada vez que cambies `index.html` en GitHub, Vercel republica solo.

## Opción B: con la terminal (sin GitHub)
```bash
npm i -g vercel
cd vercel-deploy
vercel          # primera vez: crea el proyecto (responde Enter a todo)
vercel --prod   # publica en el link final
```

## Cómo editar stats
Abre `index.html` y busca `const TEAMS` (jugadores) y `const COACH` (entrenadores). Cada jugador es:
`P(nombre, rol, AIM, FD, CLU, ENT, UTI, IGL, CONF, CONS, POT)`.
`const EXP=1.5` controla qué tan parejos son los duelos: más alto, más gana el favorito.

## Tema legal
No uses logos ni imágenes oficiales. La página ya incluye un aviso de proyecto de fans. Si algún día lo vuelves público o comercial, cambia los nombres por ficticios.
