# Dashboard CAFCI

Dashboard web para consultar los fondos comunes de inversión de Argentina con la planilla diaria
que publica CAFCI. Muestra la tabla del día con filtros, favoritos, "Mi Portfolio" (suscripciones
y rescates), informe PDF y el link a la ficha de cada fondo en el sitio de CAFCI.

- **Producción:** https://magustin28.github.io/dashboard-cafci/
- **API:** https://api-cafci-x8m6.onrender.com/ — repo [`api-cafci`](https://github.com/magustin28/api-cafci)
- **Desarrollo:** http://localhost:5173/dashboard-cafci/

## Stack

- React 19 + Vite 7 (JavaScript, sin TypeScript)
- Supabase: login con Google y tablas propias del usuario
- API propia en Render (Node/Express) que baja el Excel de CAFCI una vez al día
- PWA escrita a mano (manifest + service worker + precache)
- Tests con `node --test`, formato con Prettier y deploy en GitHub Pages

## Cómo correr

```bash
npm install
npm run dev
```

El dev server escucha en toda la red local (`server.host` en `vite.config.js`), así que también se
puede probar desde el celular con la URL "Network" que imprime Vite. La base de Vite es
`/dashboard-cafci/` porque en Pages el sitio vive en un subpath.

No hace falta configurar variables de entorno: la URL y la clave _publishable_ de Supabase están
en `src/lib/supabase.js`. Esa clave es pública por diseño; el RLS del proyecto es el que protege
los datos (sin sesión no se ve ninguna fila).

## Scripts

| Script                                    | Qué hace                                                               |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| `npm run dev`                             | Dev server con HMR                                                     |
| `npm run build`                           | `vite build` + inyecta el precache en `dist/sw.js`                     |
| `npm run preview`                         | Sirve `dist/` (localhost es contexto seguro: ahí sí se registra el SW) |
| `npm run check`                           | Validación completa: lint + formato + tests + build                    |
| `npm run lint`                            | ESLint                                                                 |
| `npm run format` / `npm run format:check` | Prettier (escribe / sólo verifica)                                     |
| `npm test`                                | `node --test`                                                          |
| `npm run ids`                             | Regenera `src/lib/cafciIds.js` (mapa `idClase → idFondo`)              |

## Estructura

```
src/
├── components/   # pantallas y piezas de UI (tablas, modales, header, skeleton)
├── context/      # AuthContext + useAuth
├── hooks/        # useFondos (datos + caché), useModalClose
├── lib/          # supabase, utils, format, portfolio, historial, informePdf, cafciIds
└── styles/       # CSS por área (base, layout, table, modals, skeleton, ...)
scripts/          # check.mjs, pwa-precache.mjs, generar-ids.mjs, generar-iconos.ps1
public/           # manifest, sw.js, iconos y favicon
.github/workflows # deploy.yml (GitHub Pages)
```

## Datos

Los datos salen de la API propia (`GET /api/fondos?fields=slim`), no de Supabase directo: el
navegador recibe un payload liviano (~850 KB) con la planilla del día y el `idFondo` que necesita
el link a CAFCI. El dashboard guarda la respuesta en `sessionStorage` por 60 minutos, así que
cambiar de pestaña no vuelve a pedirla. El semáforo del header indica la frescura del dato
contando días hábiles: un lunes no marca atraso por el fin de semana.

Mientras llega la primera respuesta se muestra un skeleton con la forma de la pantalla. Si la API
no responde, se muestra el error con el botón de reintento.

## Tests

`npm test` corre con el runner de Node (sin dependencias nuevas) sobre la lógica pura de
`src/lib/`: `utils.test.js`, `format.test.js`, `portfolio.test.js` e `historial.test.js`. No cubre
render ni consultas a Supabase: eso requiere un test end-to-end con la base.

## Validación y deploy

`npm run check` es la puerta única: lint, `format:check`, tests y build. El workflow
`.github/workflows/deploy.yml` corre ese script antes de publicar en Pages, así que un commit con
lint, formato, tests o build roto no llega a producción. El deploy se dispara con cada push a
`main`.

## Documentación

- [`docs/decisiones.md`](docs/decisiones.md) — decisiones de fondo y por qué se tomó cada una.
- `docs/bitacora.md` — bitácora cronológica del desarrollo (local, no se versiona).
- No hay `CHANGELOG.md`: el historial del proyecto son los commits (Conventional Commits) y
  `git log`.
