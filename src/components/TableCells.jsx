// Celdas de tabla compartidas. Estaban duplicadas en FondosTable, TopTab y PortfolioTab con
// diferencias mínimas (decimales por defecto y escalas de patrimonio). Una sola versión evita
// que la misma columna se vea distinta según la pestaña.
import { claseSigno, simboloMoneda } from "../lib/format";
import { fmtPat, fondoLink } from "../lib/utils";

/** Porcentaje con signo y color. `decimals` = 2 por defecto (FondosTable y TopTab usan 3). */
export function PctCell({ v, decimals = 2 }) {
  const n = typeof v === "number" ? v : parseFloat(v);
  if (v === null || v === undefined || v === "" || isNaN(n)) {
    return <span className="td-mono zero">—</span>;
  }
  return (
    <span className={`td-mono ${claseSigno(n)}`}>
      {n > 0 ? "+" : ""}
      {n.toFixed(decimals)}%
    </span>
  );
}

/** Patrimonio abreviado (B / MM / M) con el formateador de lib/utils. */
export function PatCell({ v }) {
  const texto = fmtPat(v);
  if (texto === "—") return <span className="td-mono zero">—</span>;
  return <span className="td-mono">{texto}</span>;
}

/**
 * Botón ↗ a la ficha del fondo en CAFCI. El link necesita el id interno del FONDO, que la
 * planilla no trae: lo manda la API en el campo `idFondo` del payload slim y, si no viene, se
 * resuelve con el mapa local cafciIds.js (ver fondoLink en lib/utils). Si no hay id se muestra
 * "—" en vez de un link que abriría otro fondo.
 */
export function CnvCell({ cafci, idFondo }) {
  const href = fondoLink(cafci, idFondo);
  if (!href)
    return (
      <span className="td-mono zero" title="CAFCI no publica la ficha de este fondo">
        —
      </span>
    );
  return (
    <a className="btn-cnv" href={href} target="_blank" rel="noopener" title="Ver en CAFCI">
      ↗
    </a>
  );
}

/** Badge de la moneda del fondo. */
export function MonBadge({ m }) {
  const c = { ARS: "ars", USD: "usd", USB: "usb" }[m] || "reg";
  return <span className={`badge badge-${c}`}>{m}</span>;
}

/** Importe con moneda. `colored` agrega la clase pos/neg/zero y el signo + / −. */
export function MoneyCell({ v, mon, colored }) {
  const n = typeof v === "number" ? v : parseFloat(v);
  if (v === null || v === undefined || v === "" || isNaN(n)) {
    return <span className="td-mono zero">—</span>;
  }
  const cls = colored ? claseSigno(n) : "";
  const signo = colored && n !== 0 ? (n > 0 ? "+" : "-") : "";
  const valor = Math.abs(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <span className={`td-mono ${cls} nowrap`}>
      {signo}
      {simboloMoneda(mon)}
      {valor}
    </span>
  );
}

/** Valor actual de la posición: en negrita y coloreado contra el costo de compra. */
export function VActualCell({ v, costo, mon }) {
  const n = typeof v === "number" ? v : parseFloat(v);
  if (v === null || v === undefined || v === "" || isNaN(n)) {
    return <span className="td-mono zero">—</span>;
  }
  const cls = n > costo ? "pos" : n < costo ? "neg" : "zero";
  return (
    <span className={`td-mono ${cls} nowrap fw-600`}>
      {simboloMoneda(mon)}
      {n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
}
