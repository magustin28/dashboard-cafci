// scripts/pwa-precache.mjs — inyecta en dist/sw.js la lista de archivos a precachear.
//
// Por qué existe: los assets del build llevan hash en el nombre (index-DnWwWUpo.js), así que la
// lista del precache no se puede escribir a mano; este script la arma leyendo dist/ después de
// `vite build` y la mete en el sw.js copiado desde public/. También reemplaza el nombre del caché
// por uno con hash de la lista, así cada deploy estrena caché y no quedan versiones viejas colgadas.
//
// Se corre solo: package.json → "build": "vite build && node scripts/pwa-precache.mjs".
//
// Uso manual:  node scripts/pwa-precache.mjs      (requiere haber construido antes)

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, posix } from "node:path";

const DIST = "dist";
const SW = join(DIST, "sw.js");

// Qué entra al precache: el shell de la app. Los iconos y el favicon van aparte porque el navegador
// los pide al instalar la PWA y conviene que ya estén cacheados.
const INCLUIR = [/^index\.html$/, /^favicon\.svg$/, /^manifest\.webmanifest$/, /^icons\/.*\.png$/, /^assets\/.*\.(js|css)$/];

function archivosDe(dir, prefijo = "") {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    const rel = prefijo ? posix.join(prefijo, nombre) : nombre;
    return statSync(ruta).isDirectory() ? archivosDe(ruta, rel) : [rel];
  });
}

const incluidos = archivosDe(DIST)
  .filter((rel) => INCLUIR.some((re) => re.test(rel)))
  .sort();

if (incluidos.length === 0) {
  console.error(`✖ pwa-precache: no se encontró nada para precachear en ${DIST}/ (¿corriste el build?)`);
  process.exit(1);
}

const sw = readFileSync(SW, "utf8");
// El hash va sobre la lista CON el contenido de cada archivo. Sólo con los nombres alcanzaba para los
// assets del build (llevan hash en el nombre), pero no para los de nombre fijo: al regenerar los PNG
// de public/icons/ el nombre del caché quedaba igual y las PWA ya instaladas seguían con los iconos
// viejos (comprobado: dos builds con iconos distintos dieron el mismo "cafci-0e6259b2").
const huella = incluidos
  .map(
    (rel) =>
      `${rel}:${createHash("sha1")
        .update(readFileSync(join(DIST, rel)))
        .digest("hex")
        .slice(0, 8)}`,
  )
  .join("|");
const version = "cafci-" + createHash("sha1").update(huella).digest("hex").slice(0, 8);

const lista = "[" + incluidos.map((rel) => `"./${rel}"`).join(", ") + "]";
const conLista = sw.replace(/\/\* __PRECACHE__ \*\/ \[[^\]]*\]/, `/* __PRECACHE__ */ ${lista}`);
const conVersion = conLista.replace(/\/\* __CACHE__ \*\/ "[^"]*"/, `/* __CACHE__ */ "${version}"`);

// Si el sw.js de public/ cambió de forma y estos marcadores ya no están, mejor fallar el build que
// deployar un service worker con el precache incompleto sin que nadie se entere.
if (conLista === sw || conVersion === conLista) {
  console.error(`✖ pwa-precache: no encontré los marcadores __PRECACHE__ / __CACHE__ en ${SW}`);
  process.exit(1);
}

writeFileSync(SW, conVersion);
console.log(`✔ pwa-precache: ${incluidos.length} archivos en "${version}"`);
for (const rel of incluidos) console.log(`  ${rel}`);
