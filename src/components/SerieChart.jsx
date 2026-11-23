import { useId } from "react";
import { numero, fechaCorta } from "../lib/format";

// Gráfico de línea en SVG puro (sin librerías, como el resto del proyecto).
// compact = true  → sparkline sin ejes, para el panel de detalle.
// compact = false → gráfico con grilla y etiquetas, para la vista de evolución.
const ANCHO = 800;

export default function SerieChart({ puntos, compact = false, height = 280 }) {
  const idGrad = useId();
  if (!puntos || puntos.length < 2) return null;

  const alto = compact ? 44 : height;
  const pad = compact ? { top: 4, right: 2, bottom: 4, left: 2 } : { top: 12, right: 16, bottom: 30, left: 64 };
  const w = ANCHO - pad.left - pad.right;
  const h = alto - pad.top - pad.bottom;

  const valores = puntos.map((p) => p.valor);
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const rango = max - min || 1;

  const x = (i) => pad.left + (i / (puntos.length - 1)) * w;
  const y = (v) => pad.top + h - ((v - min) / rango) * h;

  const linea = puntos.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(p.valor).toFixed(2)}`).join(" ");
  const base = pad.top + h;
  const area = `${linea} L${x(puntos.length - 1).toFixed(2)},${base} L${x(0).toFixed(2)},${base} Z`;

  // Verde si el último valor está por encima del primero; rojo si está por debajo.
  const sube = puntos[puntos.length - 1].valor >= puntos[0].valor;
  const color = sube ? "var(--accent2)" : "var(--red)";

  // Etiquetas de Y: máximo y mínimo (el medio se omite para no tapar la línea).
  const etiquetasY = compact ? [] : [max, min];

  return (
    <svg
      viewBox={`0 0 ${ANCHO} ${alto}`}
      className={compact ? "serie-chart compact" : "serie-chart"}
      role="img"
      aria-label={`Evolución del valor de la cuotaparte (${puntos.length} puntos)`}
      preserveAspectRatio={compact ? "none" : "xMidYMid meet"}
      style={compact ? undefined : { maxHeight: "340px" }}
    >
      <defs>
        <linearGradient id={idGrad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.26" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {!compact && <line x1={pad.left} x2={pad.left + w} y1={y(min)} y2={y(min)} className="serie-grid" />}

      <path d={area} fill={`url(#${idGrad})`} />
      <path
        d={linea}
        fill="none"
        stroke={color}
        strokeWidth={compact ? 2 : 2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      {etiquetasY.map((v) => (
        <text key={v} x={pad.left - 8} y={y(v) + 4} className="serie-label" textAnchor="end">
          {numero(v, 2)}
        </text>
      ))}

      {!compact && (
        <>
          <text x={pad.left} y={alto - 8} className="serie-label" textAnchor="start">
            {fechaCorta(puntos[0].fecha)}
          </text>
          <text x={pad.left + w} y={alto - 8} className="serie-label" textAnchor="end">
            {fechaCorta(puntos[puntos.length - 1].fecha)}
          </text>
        </>
      )}
    </svg>
  );
}
