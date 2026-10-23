// ─────────────────────────────────────────────────────────────
//  Tests de las utilidades puras del dashboard (src/lib/utils.js).
//  Correr:  npm test        (runner de Node, sin dependencias nuevas)
//
//  Foco en getTabGroup: agrupa por "Código de Clasificación" (columna 23 de la
//  fila que arma useFondos) y usa el título de la categoría (columna 12) como
//  respaldo. Antes agrupaba SOLO por el título con regex: si CAFCI renombraba
//  una categoría, esos fondos caían en "Otros" sin que nadie se enterara.
// ─────────────────────────────────────────────────────────────
import test from "node:test";
import assert from "node:assert/strict";
import {
  getTabGroup, CLASIF_MAP, filterRows, cacheVencida, CACHE_TTL_MS,
  parseFechaAPI, fmtMoney, fmtPat, fmtPct,
  formatFechaLabel, cnvLink, toast, formatPlazoLiq,
} from "./utils.js";

// Fila como la arma useFondos: objeto con nombres estables (categoria + clasificacion)
function fila(categoria, codigo) {
  const f = { categoria };
  if (codigo !== undefined) f.clasificacion = codigo;
  return f;
}

// Captura los avisos de consola mientras corre fn (y los restaura siempre)
function capturandoWarn(fn) {
  const avisos = [];
  const original = console.warn;
  console.warn = (msg) => avisos.push(String(msg));
  try {
    fn();
  } finally {
    console.warn = original;
  }
  return avisos;
}

test("getTabGroup: agrupa por Código de Clasificación (los 10 códigos de CAFCI)", () => {
  const esperado = {
    1: "Renta Variable", 2: "Renta Fija", 3: "Mercado Dinero", 4: "Renta Mixta",
    5: "PyME", 6: "Retorno Total", 7: "Otros", 8: "Otros", 9: "Otros", 10: "Otros",
  };
  for (const [codigo, grupo] of Object.entries(esperado)) {
    assert.equal(
      getTabGroup(fila("cualquier título", Number(codigo))),
      grupo,
      `código ${codigo}`
    );
  }
  // El mapa debe cubrir del 1 al 10 (si CAFCI agrega uno, este test obliga a revisarlo)
  for (let c = 1; c <= 10; c++) assert.ok(CLASIF_MAP[c], `falta el código ${c} en CLASIF_MAP`);
});

test("getTabGroup: el código manda sobre el título (resiste un renombre de CAFCI)", () => {
  // Título que el regex NO reconoce (no empieza con "renta fija")
  const titulo = "Fondos de Renta Fija Peso Argentina";
  assert.equal(getTabGroup(fila(titulo, 2)), "Renta Fija", "con código debe ir a su familia real");
  assert.equal(getTabGroup(fila(titulo)), "Otros", "sin código cae en Otros (comportamiento anterior)");
});

test("getTabGroup: el código funciona también si viene como texto", () => {
  assert.equal(getTabGroup(fila("Renta Fija Peso Argentina", "2")), "Renta Fija");
  assert.equal(getTabGroup(fila("Renta Variable Peso Argentina", "1")), "Renta Variable");
});

test("getTabGroup: código desconocido → avisa por consola y usa el respaldo por título", () => {
  const avisos = capturandoWarn(() => {
    assert.equal(getTabGroup(fila("Renta Variable Peso Argentina", 99)), "Renta Variable");
  });
  assert.equal(avisos.length, 1, "debe emitir exactamente un aviso");
  assert.match(avisos[0], /Código de clasificación desconocido: 99/);
});

test("getTabGroup: entradas raras no rompen", () => {
  assert.equal(getTabGroup(null), "Otros");
  assert.equal(getTabGroup(undefined), "Otros");
  assert.equal(getTabGroup([]), "Otros");
  assert.equal(getTabGroup(""), "Otros");
});

test("getTabGroup: acepta una categoría suelta (compatibilidad con el respaldo)", () => {
  assert.equal(getTabGroup("Mercado de Dinero Peso Argentina"), "Mercado Dinero");
  assert.equal(getTabGroup("Fondos Liquidos, con rescate en efectivo"), "Mercado Dinero");
  assert.equal(getTabGroup("Renta Fija Dolar Estadounidense"), "Renta Fija");
  assert.equal(getTabGroup("Renta Variable Dolar Estadounidense Billete"), "Renta Variable");
  assert.equal(getTabGroup("Renta Mixta Peso Argentina"), "Renta Mixta");
  assert.equal(getTabGroup("Retorno Total Peso Argentina"), "Retorno Total");
  assert.equal(getTabGroup("PyMes Peso Argentina"), "PyME");
  assert.equal(getTabGroup("Infraestructura Peso Argentina"), "Otros");
  assert.equal(getTabGroup("Fondos en Proceso de Liquidacion"), "Otros");
});

test("parseFechaAPI: acepta ISO, DD/MM/AAAA y DD/MM/AA", () => {
  const esperado = new Date("2026-10-14T00:00:00").getTime();
  assert.equal(parseFechaAPI("2026-10-14").getTime(), esperado);
  assert.equal(parseFechaAPI("2026-10-14T00:00:00Z").getTime(), esperado);
  assert.equal(parseFechaAPI("14/10/2026").getTime(), esperado);
  assert.equal(parseFechaAPI("14/10/26").getTime(), esperado);
});

test("parseFechaAPI: entradas vacías o inválidas → null", () => {
  assert.equal(parseFechaAPI(null), null);
  assert.equal(parseFechaAPI(undefined), null);
  assert.equal(parseFechaAPI(""), null);
  assert.equal(parseFechaAPI("14-10-2026"), null);
  assert.equal(parseFechaAPI("cualquiera"), null);
});

test("fmtMoney: null o no numérico → guion; abrevia MM/M/K", () => {
  assert.equal(fmtMoney(null, "ARS"), "—");
  assert.equal(fmtMoney(undefined, "ARS"), "—");
  assert.equal(fmtMoney(NaN, "ARS"), "—");
  assert.equal(fmtMoney(1.5e9, "ARS"), "$1.50MM");
  assert.equal(fmtMoney(2.5e6, "USD"), "U$S 2.50M");
  assert.equal(fmtMoney(1500, "ARS"), "$1.5K");
  assert.match(fmtMoney(123.45, "ARS"), /^\$123[.,]45$/);
});

test("fmtPat: patrimonios inválidos → guion; abrevia B/MM/M", () => {
  assert.equal(fmtPat(null), "—");
  assert.equal(fmtPat(undefined), "—");
  assert.equal(fmtPat("cualquiera"), "—");
  assert.equal(fmtPat(0), "—");
  assert.equal(fmtPat(-5), "—");
  assert.equal(fmtPat(3.2e12), "$3.20B");
  assert.equal(fmtPat(1.5e9), "$1.50MM");
  assert.equal(fmtPat(2.5e6), "$2.50M");
  assert.match(fmtPat(5000), /^\$5[.,]000$/);
  assert.equal(fmtPat("790407962"), "$790.41M"); // string, como llega del jsonb
});

test("fmtPct: devuelve {value, display} y null si no es número", () => {
  assert.equal(fmtPct(null), null);
  assert.equal(fmtPct(undefined), null);
  assert.equal(fmtPct("x"), null);
  assert.deepEqual(fmtPct("1.5"), { value: 1.5, display: "+1.50%" });
  assert.deepEqual(fmtPct(1.234), { value: 1.234, display: "+1.23%" });
  assert.deepEqual(fmtPct(-1.234), { value: -1.234, display: "-1.23%" });
  assert.deepEqual(fmtPct(0), { value: 0, display: "0.00%" });
  assert.deepEqual(fmtPct(1.2345, 1), { value: 1.2345, display: "+1.2%" });
});

test("formatFechaLabel: ISO → DD/MM/AAAA", () => {
  assert.equal(formatFechaLabel("2026-10-14"), "14/10/2026");
  assert.equal(formatFechaLabel("2026-01-03"), "03/01/2026");
});

test("cnvLink: arma el link a CAFCI con los códigos codificados", () => {
  assert.equal(cnvLink(1901, "6419"), "https://estadisticas.cafci.org.ar/fondos/6419?clase=1901");
  assert.equal(cnvLink("19 1", "64/19"), "https://estadisticas.cafci.org.ar/fondos/64%2F19?clase=19%201");
});

test("toast: fuera del navegador no rompe", () => {
  assert.doesNotThrow(() => toast("mensaje de prueba"));
});

test("formatPlazoLiq: convierte los días de la planilla a la forma de mostrar", () => {
  assert.equal(formatPlazoLiq(0), "Inmediato");
  assert.equal(formatPlazoLiq(1), "24 hs hábiles");
  assert.equal(formatPlazoLiq(2), "48 hs hábiles");
  assert.equal(formatPlazoLiq(3), "72 hs hábiles");
  assert.equal(formatPlazoLiq(5), "5 días hábiles");
  assert.equal(formatPlazoLiq(10), "10 días hábiles");
  assert.equal(formatPlazoLiq("2"), "48 hs hábiles"); // el Excel puede traerlo como texto
});

test("formatPlazoLiq: centinelas y valores raros → No aplica / guion", () => {
  assert.equal(formatPlazoLiq(-1), "No aplica");
  assert.equal(formatPlazoLiq(99), "No aplica");
  assert.equal(formatPlazoLiq(999), "No aplica");
  assert.equal(formatPlazoLiq(9999), "No aplica");
  assert.equal(formatPlazoLiq(99999), "No aplica");
  assert.equal(formatPlazoLiq(100), "No aplica");
  assert.equal(formatPlazoLiq(null), "—");
  assert.equal(formatPlazoLiq(undefined), "—");
  assert.equal(formatPlazoLiq(""), "—");
  assert.equal(formatPlazoLiq("cualquiera"), "No aplica");
});

test("filterRows: busca por nombre de fondo o de sociedad gerente (sin distinguir mayúsculas)", () => {
  const rows = [
    { fondo: "Fondo Alpha Clase A", socGerente: "GALICIA", moneda: "ARS" },
    { fondo: "Fondo Beta Clase B", socGerente: "SANTANDER", moneda: "USD" },
    { fondo: "Otro Gamma", socGerente: "GALICIA", moneda: "ARS" },
  ];
  assert.equal(filterRows(rows, { q: "alpha" }).length, 1);
  assert.equal(filterRows(rows, { q: "ALPHA" })[0].fondo, "Fondo Alpha Clase A");
  assert.equal(filterRows(rows, { q: "galicia" }).length, 2, "también matchea por sociedad gerente");
  assert.equal(filterRows(rows, { q: "  alpha  " }).length, 1, "recorta los espacios de los costados");
  assert.equal(filterRows(rows, { q: "no existe" }).length, 0);
});

test("filterRows: moneda, región y horizonte se combinan con el texto (AND)", () => {
  const rows = [
    { fondo: "Renta Fija Peso", moneda: "ARS", region: "Arg", horizonte: "Cor" },
    { fondo: "Renta Fija Dólar", moneda: "USD", region: "Arg", horizonte: "Med" },
    { fondo: "Renta Variable Global", moneda: "USD", region: "Glo", horizonte: "Lar" },
  ];
  assert.equal(filterRows(rows, { moneda: "USD" }).length, 2);
  assert.equal(filterRows(rows, { moneda: "USD", region: "Glo" }).length, 1);
  assert.equal(filterRows(rows, { moneda: "USD", horizonte: "Med" })[0].fondo, "Renta Fija Dólar");
  assert.equal(filterRows(rows, { q: "renta", moneda: "USD", region: "Glo" }).length, 1);
  assert.equal(filterRows(rows, { q: "renta", moneda: "ARS", region: "Glo" }).length, 0);
});

test("filterRows: sin filtros devuelve todo y no muta el array original", () => {
  const rows = [{ fondo: "A" }, { fondo: "B" }];
  const copia = [...rows];
  assert.equal(filterRows(rows, {}).length, 2);
  assert.equal(filterRows(rows, { q: "" }).length, 2, "q vacío no filtra");
  assert.equal(filterRows(rows).length, 2, "sin opciones tampoco");
  assert.deepEqual(rows, copia, "no debe mutar el array original");
});

test("filterRows: filas con campos faltantes no rompen", () => {
  const rows = [{}, { fondo: null, socGerente: null }, { fondo: "Renta Fija" }];
  assert.equal(filterRows(rows, { q: "renta" }).length, 1);
  assert.equal(filterRows(rows, { moneda: "ARS" }).length, 0);
});

test("cacheVencida: vence pasado el TTL y descarta la caché sin marca de tiempo", () => {
  const ahora = 1_700_000_000_000;
  assert.equal(cacheVencida(ahora, ahora), false, "recién guardada");
  assert.equal(cacheVencida(ahora - 1000, ahora), false, "hace un segundo");
  assert.equal(cacheVencida(ahora - CACHE_TTL_MS, ahora), false, "justo en el TTL todavía vale");
  assert.equal(cacheVencida(ahora - CACHE_TTL_MS - 1, ahora), true, "un ms más y venció");
  // Cachés guardadas antes de que existiera el ts (o corruptas) → vencidas
  assert.equal(cacheVencida(undefined, ahora), true);
  assert.equal(cacheVencida(null, ahora), true);
  assert.equal(cacheVencida(0, ahora), true);
  assert.equal(cacheVencida("1700000000000", ahora), true, "ts como texto no es válido");
  // Reloj desfasado hacia adelante: no vence por adelantado
  assert.equal(cacheVencida(ahora + 60_000, ahora), false);
});

test("cacheVencida: el TTL se puede acortar (parámetro)", () => {
  const ahora = 1_700_000_000_000;
  assert.equal(cacheVencida(ahora - 5000, ahora, 1000), true);
  assert.equal(cacheVencida(ahora - 500, ahora, 1000), false);
  assert.equal(CACHE_TTL_MS, 60 * 60 * 1000, "el TTL por defecto es 1 hora");
});


