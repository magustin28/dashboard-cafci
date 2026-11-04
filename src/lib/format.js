// ── Formato de números, moneda y fechas ──────────────────────────────────────────────────────
// Estas funciones estaban repetidas (con diferencias mínimas) en HistorialModal, InformeModal,
// FondoPanel, PortfolioTab, FondosTable y TopTab. Centralizarlas evita que el mismo dato se vea
// distinto según la pantalla.

export const VERDE = "#16a34a";
export const ROJO = "#dc2626";

/** Símbolo de la moneda con espacio final: las tablas muestran "$ 1.234,56" / "U$S 1.234,56". */
export function simboloMoneda(mon) {
  return mon === "ARS" ? "$ " : "U$S ";
}

/** Número con separador de miles es-AR. Sin valor o no numérico → "—". */
export function numero(v, minDec = 2, maxDec = minDec) {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : parseFloat(v);
  if (isNaN(n)) return "—";
  return n.toLocaleString("es-AR", { minimumFractionDigits: minDec, maximumFractionDigits: maxDec });
}

/** Cuotapartes: 4 decimales fijos. */
export const cuotapartes = (v) => numero(v, 4, 4);

/** Precio de una cuotaparte: de 4 a 6 decimales (los fondos publican hasta 6). */
export const precioCuotaparte = (v) => numero(v, 4, 6);

/**
 * Importe con símbolo de moneda. Por defecto usa el valor absoluto y sin signo, que es como lo
 * muestran las tablas; `signo` antepone + / − (el cero queda sin signo) y `dec` fija los decimales
 * (4 en el panel de detalle, donde se muestran valores de cuotaparte).
 */
export function moneda(v, mon, { absoluto = true, signo = false, dec = 2 } = {}) {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : parseFloat(v);
  if (isNaN(n)) return "—";
  const marca = signo && n !== 0 ? (n > 0 ? "+" : "-") : "";
  const valor = absoluto ? Math.abs(n) : n;
  return marca + simboloMoneda(mon) +
    valor.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

/**
 * Porcentaje con decimales fijos y signo + si es positivo. `agrupado` usa el separador de miles
 * es-AR (lo usa el panel de detalle); las tablas van sin agrupar para que la columna quede alineada.
 */
export function porcentaje(v, dec = 2, { signo = true, agrupado = false } = {}) {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : parseFloat(v);
  if (isNaN(n)) return "—";
  const texto = agrupado
    ? n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec })
    : n.toFixed(dec);
  return (signo && n > 0 ? "+" : "") + texto + "%";
}

/** Clase CSS de color según el signo: "pos", "neg" o "zero" (ver table.css). */
export function claseSigno(v) {
  const n = typeof v === "number" ? v : parseFloat(v);
  if (isNaN(n) || n === 0) return "zero";
  return n > 0 ? "pos" : "neg";
}

/** Color de texto para una variación: verde desde 0, rojo si es negativa. */
export function colorVariacion(v) {
  const n = typeof v === "number" ? v : parseFloat(v);
  if (isNaN(n)) return undefined;
  return n >= 0 ? VERDE : ROJO;
}

/** "2026-10-26" → "26/10/26". Si no es ISO, devuelve el valor tal cual. */
export function fechaCorta(iso) {
  const [y, m, d] = String(iso || "").split("-");
  return d ? `${d}/${m}/${y.slice(2)}` : (iso || "");
}

/** ISO (2026-10-26) o DD/MM/AA o DD/MM/AAAA → "DD/MM/AAAA". */
export function fechaCompleta(valor) {
  if (!valor) return "—";
  const v = String(valor);
  if (v.includes("-")) {
    const [y, m, d] = v.split("-");
    return `${d}/${m}/${y}`;
  }
  const p = v.split("/");
  if (p.length === 3) {
    const anio = p[2].length === 2 ? "20" + p[2] : p[2];
    return `${p[0]}/${p[1]}/${anio}`;
  }
  return v;
}

/** Fecha de hoy como "DD/MM/AAAA". */
export function hoyCompleta() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}
