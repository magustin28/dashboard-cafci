export const API_BASE = "https://api-cafci-x8m6.onrender.com";
export const API_URL = API_BASE + "/api/fondos";
export const API_FECHAS = API_BASE + "/api/fechas";

export const REG_MAP = { Arg: "Argentina", Glo: "Global", Latam: "Latam", Bra: "Brasil", Eur: "Europa" };
export const HOR_MAP = { Cor: "Corto", Med: "Mediano", Lar: "Largo", Flex: "Flexible", Sasig: "Sasig" };

// "Código de Clasificación" del Excel de CAFCI → pestaña. Es la forma robusta de agrupar: el
// código no depende de cómo se titule la categoría (con el regex anterior, un renombre de
// título mandaba esos fondos a "Otros" en silencio). Verificado contra la planilla del
// 16/10/2026: 1=Renta Variable, 2=Renta Fija, 3=Mercado de Dinero, 4=Renta Mixta, 5=PyME,
// 6=Retorno Total; 7..10 (Infraestructura, Fondos Cerrados, ASG, RG900) → "Otros".
export const CLASIF_MAP = {
  1: "Renta Variable", 2: "Renta Fija", 3: "Mercado Dinero", 4: "Renta Mixta",
  5: "PyME", 6: "Retorno Total", 7: "Otros", 8: "Otros", 9: "Otros", 10: "Otros",
};

export const TAB_GROUPS = [
  { id: "Todos", label: "Todos", match: () => true },
  { id: "Mercado Dinero", label: "Mercado de Dinero", match: (c) => /mercado de dinero|fondos l[íi]quidos/i.test(c) },
  { id: "Renta Fija", label: "Renta Fija", match: (c) => /^renta fija/i.test(c) },
  { id: "Renta Variable", label: "Renta Variable", match: (c) => /^renta variable/i.test(c) },
  { id: "Renta Mixta", label: "Renta Mixta", match: (c) => /^renta mixta/i.test(c) },
  { id: "Retorno Total", label: "Retorno Total", match: (c) => /^retorno total/i.test(c) },
  { id: "PyME", label: "PyME", match: (c) => /pyme|pymes/i.test(c) },
  { id: "Otros", label: "Otros", match: null },
];

// Acepta la fila completa (usa clasificación/categoría) o una categoría suelta (compatibilidad)
export function getTabGroup(row) {
  const categoria = typeof row === "string" ? row : (row && row.categoria) || "";
  const codigo = typeof row === "object" && row ? row.clasificacion : null;

  if (codigo != null) {
    const grupo = CLASIF_MAP[codigo];
    if (grupo) return grupo;
    console.warn(`[cafci] Código de clasificación desconocido: ${codigo} (categoría "${categoria}")`);
  }

  // Respaldo por nombre de categoría (comportamiento anterior)
  for (const g of TAB_GROUPS) {
    if (g.id === "Todos" || g.match === null) continue;
    if (g.match(categoria)) return g.id;
  }
  return "Otros";
}

// Vencimiento de la caché de datos del dashboard (sessionStorage, ver hooks/useFondos.js).
// Antes no vencía nunca: con la pestaña abierta se seguía mostrando la planilla guardada y ni se
// consultaba la API. 1 hora de TTL es el balance elegido: evita esperar la consulta (~3 s) en
// recargas seguidas y, como máximo, muestra la planilla anterior durante 1 hora.
export const CACHE_TTL_MS = 60 * 60 * 1000;

export function cacheVencida(ts, ahora = Date.now(), ttl = CACHE_TTL_MS) {
  // Sin marca de tiempo (cachés guardadas antes de este cambio) → se considera vencida
  if (typeof ts !== "number" || ts <= 0) return true;
  return ahora - ts > ttl;
}

// Filtros de la barra superior: buscador (nombre del fondo o sociedad gerente) + los selects de
// moneda/región/horizonte. Viven acá y no dentro de App.jsx porque el tab "Favoritos" armaba su
// propia lista a mano: mostraba el input de búsqueda pero nunca aplicaba `q` ni los selects
// (tipear el nombre no hacía nada). Ahora las dos pestañas usan exactamente la misma función.
export function filterRows(rows, { q, moneda, region, horizonte } = {}) {
  const texto = (q || "").trim().toLowerCase();
  return rows.filter((r) => {
    if (moneda && r.moneda !== moneda) return false;
    if (region && r.region !== region) return false;
    if (horizonte && r.horizonte !== horizonte) return false;
    if (texto) {
      const hay = `${r.fondo || ""} ${r.socGerente || ""}`.toLowerCase();
      if (!hay.includes(texto)) return false;
    }
    return true;
  });
}

export function cnvLink(cnvCode, cafciCode) {
  const q = encodeURIComponent(cafciCode);
  const w = encodeURIComponent(cnvCode);
  return `https://estadisticas.cafci.org.ar/fondos/${q}?clase=${w}`;
}

export function parseFechaAPI(str) {
  if (!str) return null;
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00`);
  const dmy4 = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (dmy4) return new Date(`${dmy4[3]}-${dmy4[2]}-${dmy4[1]}T00:00:00`);
  const dmy2 = str.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (dmy2) return new Date(`20${dmy2[3]}-${dmy2[2]}-${dmy2[1]}T00:00:00`);
  return null;
}

export function fmtMoney(v, mon) {
  if (v === null || isNaN(v)) return "—";
  const pfx = mon === "ARS" ? "$" : "U$S ";
  const a = Math.abs(v);
  if (a >= 1e9) return pfx + (v / 1e9).toFixed(2) + "MM";
  if (a >= 1e6) return pfx + (v / 1e6).toFixed(2) + "M";
  if (a >= 1e3) return pfx + (v / 1e3).toFixed(1) + "K";
  return pfx + v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtPat(v) {
  if (v === null || v === undefined) return "—";
  const n = parseFloat(v);
  if (isNaN(n) || n <= 0) return "—";
  if (n >= 1e12) return "$" + (n / 1e12).toFixed(2) + "B";
  if (n >= 1e9) return "$" + (n / 1e9).toFixed(2) + "MM";
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
  return "$" + n.toLocaleString("es-AR");
}

export function fmtPct(v, d = 2) {
  if (v === null || v === undefined || isNaN(v)) return null;
  return { value: parseFloat(v), display: (parseFloat(v) > 0 ? "+" : "") + parseFloat(v).toFixed(d) + "%" };
}

export function formatFechaLabel(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// Días calendario transcurridos desde la fecha de la planilla hasta hoy (0 = hoy).
// Acepta lo mismo que parseFechaAPI (ISO y DD/MM/AAAA o DD/MM/AA) y devuelve null si no se
// puede parsear. Se normalizan las dos fechas a medianoche para contar días calendario: si no,
// "ayer 23:50" daría 0 días porque todavía no pasaron 24 horas.
export function diasDesdeFecha(fecha, hoy = new Date()) {
  const d = parseFechaAPI(fecha);
  if (!d) return null;
  const a = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((a - b) / 86400000);
}

// ¿Sábado o domingo? (getDay: 0 = domingo, 6 = sábado)
function esFinDeSemana(fecha) {
  const d = fecha.getDay();
  return d === 0 || d === 6;
}

// Último día hábil ANTERIOR a `hoy`: lunes → el viernes anterior; sábado/domingo → el viernes.
// Es la planilla más nueva que se puede esperar a esta hora: CAFCI publica los cierres a la noche
// y el cron de la API corre de lunes a viernes (ver README de la API).
function ultimoDiaHabil(hoy = new Date()) {
  const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  do {
    d.setDate(d.getDate() - 1);
  } while (esFinDeSemana(d));
  return d;
}

// Días HÁBILES de atraso de la planilla contra el último día hábil esperado.
//   0     → al día (o más nueva que lo esperado): un lunes, la planilla del viernes da 0
//   N > 0 → se saltearon N actualizaciones esperadas del cron
// Se cuentan días hábiles y no calendario a propósito: contando calendario, todos los lunes el
// dato del viernes daba 3 y el semáforo quedaba en ámbar sin que nada estuviera roto. Devuelve
// null si la fecha no se puede parsear.
export function diasHabilesDeAtraso(fecha, hoy = new Date()) {
  const planilla = parseFechaAPI(fecha);
  if (!planilla) return null;
  const fin = ultimoDiaHabil(hoy);
  const cursor = new Date(planilla.getFullYear(), planilla.getMonth(), planilla.getDate());
  let atraso = 0;
  while (cursor < fin) {
    cursor.setDate(cursor.getDate() + 1);
    if (!esFinDeSemana(cursor)) atraso++;
  }
  return atraso;
}

// Estado de frescura del dato, para el semáforo del header. Recibe los DÍAS HÁBILES de atraso
// (ver diasHabilesDeAtraso), no los días calendario. Umbrales holgados a propósito: 1 día de
// gracia porque CAFCI publica la planilla del día a la noche, ámbar desde 2 actualizaciones
// salteadas y rojo recién a las 10 (~2 semanas de caída del cron).
//   null       → no hay fecha (todavía cargando)
//   'al-dia'   → 0-1 día hábil de atraso
//   'atrasado' → 2-9 días hábiles
//   'viejo'    → 10 días hábiles o más
export function estadoFrescura(dias) {
  if (dias === null || dias === undefined) return null;
  if (dias <= 1) return "al-dia";
  if (dias <= 9) return "atrasado";
  return "viejo";
}

// "Plazo Liq." viene del Excel expresado en DÍAS. Cómo se muestra:
//   0 → Inmediato · 1..3 → 24/48/72 hs hábiles · 4..98 → N días hábiles
//   99, 999, 9999, 99999, negativos y cualquier valor >= 99 → No aplica
// (Medido sobre la planilla del 16/10/2026: los valores reales son -1, 0, 1, 2, 3, 5, 10,
//  999, 9999 y 99999.)
export function formatPlazoLiq(v) {
  if (v === null || v === undefined || v === "") return "—";
  const n = parseFloat(v);
  if (isNaN(n) || n < 0) return "No aplica";
  if (n === 0) return "Inmediato";
  if (n <= 3) return `${n * 24} hs hábiles`;
  if (n < 99) return `${n} días hábiles`;
  return "No aplica";
}

// Aviso flotante para mostrar errores en pantalla. Existe porque varias operaciones contra
// Supabase fallaban en silencio (sin `error` chequeado) y el usuario no se enteraba.
export function toast(msg) {
  if (typeof document === "undefined") return;
  let el = document.getElementById("cafci-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "cafci-toast";
    el.style.cssText =
      "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:9999;" +
      "max-width:min(560px,92vw);padding:10px 16px;border-radius:8px;font-size:13px;line-height:1.4;" +
      "background:#7f1d1d;color:#fff;border:1px solid #ef4444;text-align:center;" +
      "box-shadow:0 6px 20px rgba(0,0,0,.35);transition:opacity .25s";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = "1";
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.style.opacity = "0"; }, 6000);
}
