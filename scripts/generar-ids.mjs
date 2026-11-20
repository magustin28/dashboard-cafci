// scripts/generar-ids.mjs — genera el mapa idClase → idFondo de CAFCI.
//
// Por qué existe: la ficha de un fondo en el sitio de estadísticas se arma con DOS códigos:
//   https://estadisticas.cafci.org.ar/fondos/{idFondo}?clase={idClase}
// La planilla diaria sólo trae el "Código CAFCI" de la CLASE (ese es el ?clase=), no el id
// interno del FONDO. Sin ese id el link se armaba con el código CNV en el lugar del idFondo y
// abría otro fondo: "1810 Ahorro" (CNV 394) caía en "Delta Pesos" (idFondo 394), cuando su
// ficha real es /fondos/304?clase=308.
//
// El idFondo lo publica el propio sitio en /consulta-de-fondos.json (~2,9 MB, ~1.200 fondos y
// ~4.900 clases). Este script lo baja y deja el mapa plano en src/lib/cafciIds.js, que la UI
// importa para armar el link. Es chico (~40 KB) y cambia poco, así que se commitea.
//
// Uso:  npm run ids
// Volver a correrlo cuando CAFCI sume fondos: si una clase no está en el mapa, su fila no
// muestra el botón ↗ (mejor eso que un link que abre el fondo equivocado).

import { writeFileSync } from "node:fs";

const URL_DATOS = "https://estadisticas.cafci.org.ar/consulta-de-fondos.json";
const SALIDA = "src/lib/cafciIds.js";
// El sitio contesta 403 si el pedido no parece un navegador.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const respuesta = await fetch(URL_DATOS, { headers: { "User-Agent": UA, Accept: "application/json" } });
if (!respuesta.ok) {
  console.error(`✖ generar-ids: ${URL_DATOS} respondió ${respuesta.status}`);
  process.exit(1);
}

const datos = await respuesta.json();
const fondos = datos.fondos || [];

// { idClase: idFondo }
const ids = {};
for (const fondo of fondos) {
  for (const clase of fondo.clases || []) {
    if (clase.id != null && fondo.id != null) ids[clase.id] = fondo.id;
  }
}

const claves = Object.keys(ids).sort((a, b) => Number(a) - Number(b));
if (claves.length === 0) {
  console.error("✖ generar-ids: el JSON no trajo fondos con clases");
  process.exit(1);
}

// Archivo de datos en una sola línea de export: se versiona y se regenera con npm run ids
// (está en .prettierignore para que Prettier no lo despliegue en 4.900 líneas).
const mapa = claves.map((clase) => `"${clase}":${ids[clase]}`).join(",");
const contenido =
  "// Generado por scripts/generar-ids.mjs — no editar a mano (se regenera con: npm run ids).\n" +
  "// Mapa idClase → idFondo de CAFCI: la planilla trae el código de la clase, pero el link\n" +
  "// /fondos/{idFondo}?clase={idClase} necesita el id interno del fondo.\n" +
  `export default {${mapa}};\n`;

writeFileSync(SALIDA, contenido);
console.log(`✔ generar-ids: ${fondos.length} fondos y ${claves.length} clases en ${SALIDA}`);
