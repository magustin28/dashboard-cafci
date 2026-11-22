# Decisiones de arquitectura — Dashboard CAFCI

> Documento **versionado**: registra las decisiones de fondo y el porqué de cada una. El detalle
> cronológico de cada cambio (mediciones, incidentes, pasos) está en la bitácora local
> (`docs/bitacora.md`, no se versiona).
>
> Formato: **Decisión / Por qué / Consecuencia**. Cuando una decisión se revisa, se agrega la
> entrada nueva en la bitácora y se actualiza acá el estado.

## 1. Los datos llegan por una API propia, no por consulta directa a Supabase

**Decisión:** el dashboard consume `GET /api/fondos?fields=slim` de la API en Render; no lee la
tabla de planillas desde el navegador.

**Por qué:** la planilla completa son 5,53 MB de jsonb (848 KB en slim) y la clave que la lee
saltea RLS, así que no puede viajar al cliente. La API baja el Excel de CAFCI una vez al día, lo
guarda en Supabase y sirve el payload liviano. El dashboard cachea la respuesta en
`sessionStorage` por 60 minutos.

**Consecuencia:** si Render está dormido (plan free) la primera carga espera el cold start; el
skeleton y el aviso de estado lo explican. Si la API cambia el payload, el dashboard se adapta
con el fallback local (ver decisión 2).

## 2. El mapa de ids de CAFCI vive en Supabase y se reemplaza en cada refresco

**Decisión:** la ficha de cada fondo en el sitio de CAFCI se arma con dos ids
(`/fondos/{idFondo}?clase={idClase}`); el `idClase` es el Código CAFCI de la planilla y el
`idFondo` no viene en el Excel. Se baja del catálogo público `consulta-de-fondos.json` y se
guarda en la tabla `cafci_ids` (una sola fila, upsert).

**Por qué:** usar el código CNV en el lugar del idFondo abría otro fondo (1810 Ahorro → Delta
Pesos). El catálogo cambia cuando CAFCI suma fondos, así que se refresca con la descarga diaria
y a demanda con `POST /api/ids/refrescar`; el ETag evita bajarlo si no cambió.

**Consecuencia:** el payload slim agrega `idFondo` al final de cada fila; si el mapa no está
disponible, el dashboard usa su copia local `src/lib/cafciIds.js` (`npm run ids` la regenera).
Las clases sin ficha pública no muestran el botón ↗.

## 3. Skeleton de pantalla en lugar de spinner

**Decisión:** mientras llega la primera respuesta se muestra un skeleton con la forma real de la
pantalla (header, KPIs, tabla), no un spinner centrado.

**Por qué:** el cold start de Render puede tardar varios segundos y el spinner no explicaba qué
estaba pasando. El skeleton conserva el layout (usa el mismo `<header>` sticky) y anuncia el
estado con `role="status"`.

**Consecuencia:** `.skeleton` y el shimmer viven en `skeleton.css`, con `prefers-reduced-motion`
para dejar las cajas quietas. El overlay de consulta conserva su spinner.

## 4. PWA escrita a mano, sin dependencias, con precache por contenido

**Decisión:** manifest y service worker propios (`public/`), sin `vite-plugin-pwa`.

**Por qué:** la app sólo necesita el app shell; un plugin sumaba configuración y dependencias
para lo mismo. Los assets llevan hash en el nombre, así que la lista del precache no se puede
escribir a mano: la arma `scripts/pwa-precache.mjs` leyendo `dist/` después del build.

**Consecuencia:** el nombre del caché lleva hash del contenido de la lista, así cada deploy
estrena caché y no quedan versiones viejas colgadas. El SW no cachea `/api/*` (los datos son
intradiarios) y se registra sólo en producción.

## 5. Estilos estáticos en CSS, dinámicos inline

**Decisión:** los estilos que no dependen de los datos pasan a clases en `src/styles/`; los que
sí (posición de tooltips, color según el dato, `zIndex` por prop) quedan inline.

**Por qué:** la auditoría encontró ~195 estilos inline en 13 archivos. Los estáticos repetidos
hacían ruido en el JSX y bloqueaban el trabajo por lotes de CSS.

**Consecuencia:** el trabajo se hizo en 4 lotes y el verde único quedó en `#059669`. El criterio
"estático → CSS, dinámico → inline" se aplica en cada cambio nuevo.

## 6. Formato del repo con Prettier propio y fin de línea LF

**Decisión:** Prettier como devDependency con `.prettierrc.json` propio (`printWidth` 150,
comillas dobles, `endOfLine: "lf"`), `.gitattributes` con `eol=lf` y `core.autocrlf false` local.

**Por qué:** el formato dependía del editor de cada uno; un guardado reformateaba el archivo
entero (caso real: 93 líneas de ruido por 3 de cambio real).

**Consecuencia:** `npm run format` escribe y `npm run format:check` sólo verifica. El chequeo
está dentro de `npm run check`, así que un archivo sin formatear no se commitea.

## 7. Validación única (`npm run check`) y también en el deploy

**Decisión:** `scripts/check.mjs` corre lint, `format:check`, tests y build; el workflow de Pages
corre ese mismo script antes de publicar.

**Por qué:** cuatro comandos sueltos se olvidan; un solo comando es la puerta de entrada y además
evita el build duplicado en CI.

**Consecuencia:** un push con lint, formato, test o build roto no llega a producción.

## 8. Tests con el runner de Node, sobre la lógica pura

**Decisión:** `node --test` sin framework, con la lógica extraída a `src/lib/` (`utils`, `format`,
`portfolio`, `historial`).

**Por qué:** no sumar dependencias para tests; lo que se puede probar sin navegador ni base es la
lógica de cálculo y agrupación.

**Consecuencia:** no hay tests de render ni de consultas a Supabase; eso requiere un end-to-end
con la base.
