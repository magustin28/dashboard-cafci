# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Tests

```bash
npm test        # node --test (runner de Node, sin dependencias nuevas)
```

`src/lib/utils.test.js` cubre las utilidades puras de `src/lib/utils.js`:

- `getTabGroup`: agrupa por **Código de Clasificación** (columna 23 de la fila de `useFondos`) con el título de la categoría (columna 12) como respaldo, incluido el aviso por consola cuando aparece un código desconocido. Hay un test que verifica que un **renombre de categoría** de CAFCI no manda los fondos a "Otros".
- `parseFechaAPI`, `fmtMoney`, `fmtPat`, `fmtPct`, `formatFechaLabel` y `cnvLink`.

No valida render ni consultas a Supabase (eso requiere un test end-to-end con la base).
