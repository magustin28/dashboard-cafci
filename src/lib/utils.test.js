// ─────────────────────────────────────────────────────────────
//  Tests de las utilidades puras del dashboard (src/lib/utils.js).
//  Correr:  npm test        (runner de Node, sin dependencias nuevas)
//
//  Foco en getTabGroup: agrupa por "Código de Clasificación" (columna 23 de la
//  fila que arma useFondos) y usa el título de la categoría (columna 12) como
//  respaldo: si CAFCI renombra una categoría, esos fondos no caen en "Otros".
// ─────────────────────────────────────────────────────────────
import test from "node:test";
import assert from "node:assert/strict";
import {
  getTabGroup,
  CLASIF_MAP,
  filterRows,
  cacheVencida,
  CACHE_TTL_MS,
  parseFechaAPI,
  fmtMoney,
  fmtPat,
  fmtPatM,
  cnvLink,
  toast,
  formatPlazoLiq,
  diasDesdeFecha,
  estadoFrescura,
  diasHabilesDeAtraso,
  nombreBaseFondo,
  nombreClase,
  claveGrupoFondo,
  contarFondos,
  agruparFondos,
  agruparPorGerente,
  agruparFondosPorPatrimonio,
  treemapSquarified,
  colorVariacion,
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
    1: "Renta Variable",
    2: "Renta Fija",
    3: "Mercado Dinero",
    4: "Renta Mixta",
    5: "PyME",
    6: "Retorno Total",
    7: "Otros",
    8: "Otros",
    9: "Otros",
    10: "Otros",
  };
  for (const [codigo, grupo] of Object.entries(esperado)) {
    assert.equal(getTabGroup(fila("cualquier título", Number(codigo))), grupo, `código ${codigo}`);
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

test("fmtPat: usa el símbolo de la moneda (U$S para USD)", () => {
  assert.equal(fmtPat(3.2e9, "USD"), "U$S 3.20MM");
  assert.equal(fmtPat(2.5e6, "USD"), "U$S 2.50M");
  assert.match(fmtPat(5000, "USD"), /^U\$S 5[.,]000$/);
  // Sin moneda sigue siendo ARS (comportamiento previo de las tablas).
  assert.equal(fmtPat(3.2e9), "$3.20MM");
});

test("fmtPatM: expresa el patrimonio siempre en millones (M)", () => {
  assert.match(fmtPatM(22500), /^\$0[.,]02 M$/, "22.500 → 0,02 M (ya no queda un número crudo)");
  assert.match(fmtPatM(438100000), /^\$438[.,]1 M$/);
  assert.match(fmtPatM(43810000000), /^\$43[.,]810 M$/);
  assert.match(fmtPatM(1.23e12, "USD"), /^U\$S 1[.,]230[.,]000 M$/);
  assert.match(fmtPatM(5000), /^\$>0\.01 M$/, "5.000 → >0.01 M (no llega al mínimo de 0.01 M)");
  assert.equal(fmtPatM(null), "—");
  assert.equal(fmtPatM(0), "—");
});

test("diasDesdeFecha: cuenta días calendario y normaliza la hora", () => {
  const hoy = new Date("2026-10-23T09:00:00");
  assert.equal(diasDesdeFecha("2026-10-23", hoy), 0);
  assert.equal(diasDesdeFecha("2026-10-22", hoy), 1);
  assert.equal(diasDesdeFecha("22/10/2026", hoy), 1);
  assert.equal(diasDesdeFecha("16/10/26", hoy), 7);
  // Ayer a las 23:50 sigue siendo 1 día (no 0): se comparan fechas, no instantes.
  assert.equal(diasDesdeFecha("2026-10-22", new Date("2026-10-23T23:50:00")), 1);
});

test("diasDesdeFecha: entradas vacías o inválidas → null", () => {
  assert.equal(diasDesdeFecha(""), null);
  assert.equal(diasDesdeFecha(null), null);
  assert.equal(diasDesdeFecha("no es fecha"), null);
});

test("estadoFrescura: al día, atrasado y viejo", () => {
  assert.equal(estadoFrescura(null), null);
  assert.equal(estadoFrescura(0), "al-dia");
  assert.equal(estadoFrescura(1), "al-dia");
  assert.equal(estadoFrescura(2), "atrasado");
  assert.equal(estadoFrescura(9), "atrasado");
  assert.equal(estadoFrescura(10), "viejo");
});

test("diasHabilesDeAtraso: el fin de semana no infla la cuenta (lunes con la planilla del viernes)", () => {
  const lunes = new Date("2026-10-26T09:00:00");
  assert.equal(diasHabilesDeAtraso("2026-10-23", lunes), 0, "la del viernes es lo esperado un lunes");
  assert.equal(diasHabilesDeAtraso("2026-10-22", lunes), 1, "se salteó el viernes");
  assert.equal(diasHabilesDeAtraso("2026-10-21", lunes), 2, "se salteó jueves y viernes");
});

test("diasHabilesDeAtraso: en días de semana espera la planilla del día anterior", () => {
  const miercoles = new Date("2026-10-21T10:00:00");
  assert.equal(diasHabilesDeAtraso("2026-10-20", miercoles), 0, "la del martes es lo esperado");
  assert.equal(diasHabilesDeAtraso("2026-10-21", miercoles), 0, "más nueva que lo esperado → 0");
  assert.equal(diasHabilesDeAtraso("2026-10-19", miercoles), 1, "se salteó el martes");
  // Sábado y domingo también miran al viernes
  assert.equal(diasHabilesDeAtraso("2026-10-23", new Date("2026-10-24T12:00:00")), 0, "sábado");
  assert.equal(diasHabilesDeAtraso("2026-10-23", new Date("2026-10-25T12:00:00")), 0, "domingo");
});

test("diasHabilesDeAtraso: una caída larga del cron llega a 'viejo'", () => {
  const lunes = new Date("2026-10-26T09:00:00");
  const atraso = diasHabilesDeAtraso("2026-10-05", lunes);
  assert.equal(atraso, 14, "del lunes 5/10 al viernes 23/10 hay 14 días hábiles");
  assert.equal(estadoFrescura(atraso), "viejo");
});

test("diasHabilesDeAtraso: entradas inválidas → null", () => {
  assert.equal(diasHabilesDeAtraso(""), null);
  assert.equal(diasHabilesDeAtraso(null), null);
  assert.equal(diasHabilesDeAtraso("no es fecha"), null);
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

// ── Agrupación por clase ──────────────────────────────────────────────────────
// CAFCI publica una fila por clase: "BAVSA Renta Balanceado IX - Clase A" y "… - Clase B" son el
// MISMO fondo con distinto código CNV. La tabla los agrupa para no mostrar 3-4 filas por fondo.

test("nombreBaseFondo: saca el sufijo de clase con guion, en guion largo y sin guion", () => {
  assert.equal(nombreBaseFondo("BAVSA Renta Balanceado IX - Clase A"), "BAVSA Renta Balanceado IX");
  assert.equal(nombreBaseFondo("BAVSA Renta Balanceado IX – Clase B"), "BAVSA Renta Balanceado IX", "guion largo");
  assert.equal(nombreBaseFondo("BAVSA Renta Balanceado IX — Clase C"), "BAVSA Renta Balanceado IX", "guion em");
  assert.equal(nombreBaseFondo("Fondo Compass Clase D"), "Fondo Compass", "sin guion");
  assert.equal(nombreBaseFondo("Premier Renta Fija"), "Premier Renta Fija", "sin clase: no cambia");
  assert.equal(nombreBaseFondo(""), "");
  assert.equal(nombreBaseFondo(null), "");
});

test("nombreClase: devuelve la clase completa, con el régimen legal pegado incluido", () => {
  assert.equal(nombreClase("BAVSA Renta Balanceado IX - Clase A"), "Clase A");
  assert.equal(nombreClase("Fondo Compass Clase D"), "Clase D", "sin guion");
  assert.equal(nombreClase("Premier Renta Fija"), "", "sin clase");
  assert.equal(nombreClase(null), "");
});

test("claveGrupoFondo: mismo nombre base + misma moneda = mismo grupo; distinta moneda = otro grupo", () => {
  const a = { fondo: "BAVSA Renta Balanceado IX - Clase A", moneda: "ARS" };
  const b = { fondo: "BAVSA Renta Balanceado IX - Clase B", moneda: "ARS" };
  const c = { fondo: "BAVSA Renta Balanceado IX - Clase A", moneda: "USD" };
  assert.equal(claveGrupoFondo(a), claveGrupoFondo(b), "dos clases en ARS agrupan juntas");
  assert.notEqual(claveGrupoFondo(a), claveGrupoFondo(c), "el mismo fondo en USD es otro grupo");
  assert.equal(claveGrupoFondo(null), "|");
});

test("contarFondos: cuenta fondos (grupos), no filas de clase", () => {
  const rows = [
    { fondo: "BAVSA Renta Balanceado IX - Clase A", moneda: "ARS" },
    { fondo: "BAVSA Renta Balanceado IX - Clase B", moneda: "ARS" },
    { fondo: "BAVSA Renta Balanceado IX - Clase C", moneda: "ARS" },
    { fondo: "Premier Renta Fija", moneda: "ARS" },
  ];
  assert.equal(rows.length, 4, "son 4 filas (clases)");
  assert.equal(contarFondos(rows), 2, "pero sólo 2 fondos: BAVSA (3 clases) y Premier");
  assert.equal(contarFondos([]), 0);
  assert.equal(contarFondos(null), 0);
});

test("agruparFondos: agrupa por nombre base + moneda y elige la mejor clase por Var. Diaria", () => {
  const rows = [
    { fondo: "BAVSA Renta Balanceado IX - Clase A", moneda: "ARS", valorVarPct: "0.1", cnv: "1" },
    { fondo: "BAVSA Renta Balanceado IX - Clase B", moneda: "ARS", valorVarPct: "0.35", cnv: "2" },
    { fondo: "BAVSA Renta Balanceado IX - Clase C", moneda: "ARS", valorVarPct: "0.2", cnv: "3" },
    { fondo: "Premier Renta Fija", moneda: "ARS", valorVarPct: "0.05", cnv: "4" },
  ];
  const grupos = agruparFondos(rows);
  assert.equal(grupos.length, 2, "dos fondos");
  const bavsa = grupos.find((g) => g.nombre === "BAVSA Renta Balanceado IX");
  assert.ok(bavsa);
  assert.equal(bavsa.n, 3, "tres clases");
  assert.equal(bavsa.clases.length, 3);
  assert.equal(bavsa.mejor.valorVarPct, "0.35", "gana la clase con mayor Var. Diaria");
  assert.equal(bavsa.mejor.cnv, "2");
  const premier = grupos.find((g) => g.nombre === "Premier Renta Fija");
  assert.equal(premier.n, 1, "una sola clase: no se agrupa");
});

test("agruparFondos: una clase sin dato de Var. Diaria no gana por descarte", () => {
  const rows = [
    { fondo: "Fondo X - Clase A", moneda: "ARS", valorVarPct: "0.2" },
    { fondo: "Fondo X - Clase B", moneda: "ARS", valorVarPct: null },
  ];
  const g = agruparFondos(rows)[0];
  assert.equal(g.mejor.valorVarPct, "0.2", "el null no se queda con el primer puesto");
});

test("agruparFondos: no mezcla ARS con USD aunque el nombre base sea el mismo", () => {
  const rows = [
    { fondo: "Fondo Y - Clase A", moneda: "ARS", valorVarPct: "0.1" },
    { fondo: "Fondo Y - Clase A", moneda: "USD", valorVarPct: "0.2" },
  ];
  assert.equal(agruparFondos(rows).length, 2, "monedas distintas son grupos distintos");
});

test("agruparFondos: el 0 (sin movimientos) no le gana a una clase negativa", () => {
  const rows = [
    { fondo: "Fondo Z - Clase A", moneda: "ARS", valorVarPct: "0" },
    { fondo: "Fondo Z - Clase B", moneda: "ARS", valorVarPct: "-0.05" },
    { fondo: "Fondo Z - Clase C", moneda: "ARS", valorVarPct: "-0.12" },
  ];
  const g = agruparFondos(rows)[0];
  assert.equal(g.mejor.valorVarPct, "-0.05", "se muestra la menos negativa, no el 0");
});

test("agruparFondos: un positivo sí le gana al 0", () => {
  const rows = [
    { fondo: "Fondo W - Clase A", moneda: "ARS", valorVarPct: "0" },
    { fondo: "Fondo W - Clase B", moneda: "ARS", valorVarPct: "0.02" },
  ];
  assert.equal(agruparFondos(rows)[0].mejor.valorVarPct, "0.02");
});

test("agruparFondos: si todas son 0 se queda la primera", () => {
  const rows = [
    { fondo: "Fondo V - Clase A", moneda: "ARS", valorVarPct: "0" },
    { fondo: "Fondo V - Clase B", moneda: "ARS", valorVarPct: "0.0" },
  ];
  assert.equal(agruparFondos(rows)[0].mejor.valorVarPct, "0", "todas sin movimientos: la primera");
});

// ── Texto legal pegado a la clase (casos reales de la planilla de CAFCI) ──
// Muchas clases traen el régimen legal detrás del nombre: "Clase B Art. 11 Decreto 99/2019 y mod",
// "Clase B Ley N° 27.743". Antes el corte exigía que "Clase X" cerrara el nombre, así que esos
// fondos quedaban sin agrupar. Caso testigo: "1822 Raices Dólares Plus".

test("nombreBaseFondo: corta aunque después de la clase venga texto legal", () => {
  assert.equal(nombreBaseFondo("1822 Raices Dólares Plus - Clase B Art. 11 Decreto 99/2019 y mod"), "1822 Raices Dólares Plus");
  assert.equal(nombreBaseFondo("1822 Raices Dólares Plus - Clase B Ley N° 27.743"), "1822 Raices Dólares Plus");
  assert.equal(nombreBaseFondo("SBS Acciones Brasil - Clase Ley N° 27.743"), "SBS Acciones Brasil");
  assert.equal(nombreBaseFondo("MEGAQM Acciones- Clase Ley Nº 27.743"), "MEGAQM Acciones", "sin espacio antes del guion");
});

test("claveGrupoFondo: dos clases del mismo fondo con distinto texto legal agrupan juntas", () => {
  const a = { fondo: "1822 Raices Dólares Plus - Clase B Art. 11 Decreto 99/2019 y mod", moneda: "ARS" };
  const b = { fondo: "1822 Raices Dólares Plus - Clase B Ley N° 27.743", moneda: "ARS" };
  assert.equal(claveGrupoFondo(a), claveGrupoFondo(b), "es el mismo fondo en la misma moneda");
});

test("nombreClase: incluye el régimen legal pegado (dos clases D quedan distinguibles)", () => {
  assert.equal(nombreClase("Abierto Momentum Pymes - Clase D"), "Clase D");
  assert.equal(
    nombreClase("Abierto Momentum Pymes - Clase D Ley N° 27.743"),
    "Clase D Ley N° 27.743",
    "la extensión legal forma parte del nombre de la clase",
  );
  assert.notEqual(nombreClase("Abierto Momentum Pymes - Clase D"), nombreClase("Abierto Momentum Pymes - Clase D Ley N° 27.743"));
  assert.equal(nombreClase("1822 Raices Dólares Plus - Clase B Art. 11 Decreto 99/2019 y mod"), "Clase B Art. 11 Decreto 99/2019 y mod");
  assert.equal(nombreClase("SBS Acciones Brasil - Clase Ley N° 27.743"), "Clase Ley N° 27.743");
});

test("agruparPorGerente: suma patrimonio y promedia la variación ponderada por patrimonio", () => {
  const rows = [
    { socGerente: "GALILEO", patrimonio: "100", valorVarPct: "1" },
    { socGerente: "GALILEO", patrimonio: "300", valorVarPct: "3" },
    { socGerente: "BALANZ", patrimonio: "200", valorVarPct: "-2" },
  ];
  const g = agruparPorGerente(rows);
  assert.equal(g.length, 2, "dos gerentes distintos");
  assert.equal(g[0].gerente, "GALILEO", "ordenado por patrimonio descendente");
  assert.equal(g[0].patrimonio, 400);
  assert.equal(g[0].n, 2);
  assert.equal(g[0].varPct, 2.5, "(1*100 + 3*300) / 400 = 2.5");
  assert.equal(g[1].gerente, "BALANZ");
  assert.equal(g[1].varPct, -2);
});

test("agruparPorGerente: sin gerente cae en '—' y no suma patrimonio inválido", () => {
  const g = agruparPorGerente([
    { socGerente: "", patrimonio: "50", valorVarPct: "2" },
    { patrimonio: null, valorVarPct: "5" },
  ]);
  assert.equal(g.length, 1, "las dos filas sin gerente forman un solo grupo");
  assert.equal(g[0].gerente, "—");
  assert.equal(g[0].patrimonio, 50, "sólo suma patrimonio válido");
  assert.equal(g[0].varPct, 2, "la fila sin patrimonio no pondera");
});

test("agruparFondosPorPatrimonio: agrupa por fondo base y suma patrimonio con variación ponderada", () => {
  const rows = [
    { fondo: "Compass Renta Fija - Clase F", moneda: "ARS", patrimonio: "100", valorVarPct: "1" },
    { fondo: "Compass Renta Fija - Clase E", moneda: "ARS", patrimonio: "300", valorVarPct: "-2" },
    { fondo: "Compass Renta Fija - Clase D", moneda: "ARS", patrimonio: "100", valorVarPct: "0" },
    { fondo: "Otro Fondo - Clase A", moneda: "ARS", patrimonio: "50", valorVarPct: "0.5" },
  ];
  const g = agruparFondosPorPatrimonio(rows);
  assert.equal(g.length, 2, "dos fondos base distintos");
  assert.equal(g[0].nombre, "Compass Renta Fija", "ordenado por patrimonio descendente");
  assert.equal(g[0].n, 3, "las tres clases del mismo fondo se agrupan");
  assert.equal(g[0].patrimonio, 500, "suma el patrimonio de las clases");
  assert.equal(g[0].varPct, -1, "(1*100 + -2*300 + 0*100) / 500 = -1");
  assert.equal(g[1].nombre, "Otro Fondo");
  assert.equal(g[1].n, 1);
  assert.equal(g[1].patrimonio, 50);
});

test("agruparFondosPorPatrimonio: lista vacía o nula devuelve []", () => {
  assert.deepEqual(agruparFondosPorPatrimonio(null), []);
  assert.deepEqual(agruparFondosPorPatrimonio([]), []);
});

test("agruparFondosPorPatrimonio: sin patrimonio válido deja varPct null", () => {
  const g = agruparFondosPorPatrimonio([{ fondo: "Solo - Clase A", moneda: "ARS", patrimonio: "", valorVarPct: "1" }]);
  assert.equal(g[0].patrimonio, 0);
  assert.equal(g[0].varPct, null);
});

test("treemapSquarified: reparte toda el área y no se sale del contenedor", () => {
  const rects = treemapSquarified([{ value: 60 }, { value: 25 }, { value: 10 }, { value: 5 }], 100, 60);
  assert.equal(rects.length, 4);
  let area = 0;
  for (const r of rects) {
    assert.ok(r.x >= -0.001 && r.y >= -0.001, "x/y no negativos");
    assert.ok(r.x + r.w <= 100.001, "no se pasa del ancho");
    assert.ok(r.y + r.h <= 60.001, "no se pasa del alto");
    assert.ok(r.w >= -0.001 && r.h >= -0.001, "dimensiones no negativas");
    area += r.w * r.h;
  }
  assert.ok(Math.abs(area - 6000) < 1, `área total ≈ 6000 (fue ${area})`);
});

test("treemapSquarified: descarta ítems sin valor", () => {
  const rects = treemapSquarified([{ value: 0 }, { value: -3 }, { value: 10 }], 100, 100);
  assert.equal(rects.length, 1);
  assert.equal(rects[0].value, 10);
});

test("colorVariacion: verde si sube, rojo si baja y gris sin dato", () => {
  assert.ok(colorVariacion(2, 4).startsWith("rgba(5,150,105"), "positivo → verde");
  assert.ok(colorVariacion(-2, 4).startsWith("rgba(220,38,38"), "negativo → rojo");
  assert.ok(colorVariacion(null, 4).startsWith("rgba(115,115,115"), "sin dato → gris");
});
