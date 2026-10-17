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
  getTabGroup, CLASIF_MAP,
  parseFechaAPI, fmtMoney, fmtPat, fmtPct,
  formatFechaLabel, cnvLink, toast,
} from "./utils.js";

// Fila como la arma useFondos: [12] = categoría, [23] = Código de Clasificación
function fila(categoria, codigo) {
  const f = [];
  f[12] = categoria;
  if (codigo !== undefined) f[23] = codigo;
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


