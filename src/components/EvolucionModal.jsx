import { useMemo, useState } from "react";
import { useModalClose } from "../hooks/useModalClose";
import { useSerie } from "../hooks/useSerie";
import SerieChart from "./SerieChart";
import { IconX } from "./Icons";
import { moneda, porcentaje, fechaCorta, colorVariacion } from "../lib/format";

const RANGOS = [
  { id: "1m", label: "1M", dias: 30 },
  { id: "3m", label: "3M", dias: 90 },
  { id: "6m", label: "6M", dias: 180 },
  { id: "1a", label: "1A", dias: 365 },
  { id: "todo", label: "Todo", dias: null },
];

// Vista de evolución: gráfico grande + tabla de puntos del fondo elegido.
// Se abre desde el panel de detalle (FondoPanel) y pide la serie al endpoint
// GET /api/serie/:cafci. El rango se filtra en el cliente (los puntos ya están).
export default function EvolucionModal({ fondo, onClose }) {
  const { closing, requestClose } = useModalClose(onClose);
  const { serie, loading, error } = useSerie(fondo?.cafci);
  const [rango, setRango] = useState("1a");

  const todos = useMemo(() => serie?.puntos || [], [serie]);

  const puntos = useMemo(() => {
    const r = RANGOS.find((x) => x.id === rango);
    if (!r || r.dias === null || todos.length === 0) return todos;
    const ultimo = new Date(todos[todos.length - 1].fecha);
    const desde = new Date(ultimo);
    desde.setDate(desde.getDate() - r.dias);
    return todos.filter((p) => new Date(p.fecha) >= desde);
  }, [todos, rango]);

  // Variación de cada punto contra el anterior de la serie COMPLETA (no del rango),
  // para que el primer punto del rango también muestre su variación real.
  const variaciones = useMemo(() => {
    const mapa = new Map();
    for (let i = 1; i < todos.length; i++) {
      const prev = todos[i - 1].valor;
      const act = todos[i].valor;
      mapa.set(todos[i].fecha, prev ? ((act - prev) / prev) * 100 : null);
    }
    return mapa;
  }, [todos]);

  const total = puntos.length >= 2 ? ((puntos[puntos.length - 1].valor - puntos[0].valor) / puntos[0].valor) * 100 : null;
  const mon = serie?.moneda || fondo?.moneda || "ARS";

  return (
    <div className={`modal-overlay ${closing ? "closing" : ""}`} onClick={requestClose}>
      <div className="modal modal-wide serie-modal" onClick={(e) => e.stopPropagation()}>
        <div className="serie-head">
          <div>
            <div className="serie-title">Evolución del valor</div>
            <div className="serie-sub">
              {serie?.fondo || fondo?.fondo || "—"}
              {serie?.cafci ? ` · CAFCI ${serie.cafci}` : ""}
              {total !== null ? ` · ${porcentaje(total, 2)} en el rango` : ""}
            </div>
          </div>
          <button className="serie-close" onClick={requestClose} aria-label="Cerrar">
            <IconX size={16} />
          </button>
        </div>

        <div className="serie-rangos">
          {RANGOS.map((r) => (
            <button key={r.id} className={`serie-rango ${rango === r.id ? "active" : ""}`} onClick={() => setRango(r.id)}>
              {r.label}
            </button>
          ))}
        </div>

        {loading && <div className="serie-estado">Cargando la serie…</div>}
        {error && <div className="serie-estado">No se pudo cargar la serie ({error.message}).</div>}
        {!loading && !error && puntos.length < 2 && <div className="serie-estado">No hay suficientes datos para este rango.</div>}

        {!loading && !error && puntos.length >= 2 && (
          <>
            <SerieChart puntos={puntos} height={300} />
            <div className="serie-tabla-wrap">
              <table className="serie-tabla">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th style={{ textAlign: "right" }}>Valor</th>
                    <th style={{ textAlign: "right" }}>Variación</th>
                  </tr>
                </thead>
                <tbody>
                  {puntos
                    .slice()
                    .reverse()
                    .map((p) => {
                      const v = variaciones.get(p.fecha);
                      return (
                        <tr key={p.fecha}>
                          <td>{fechaCorta(p.fecha)}</td>
                          <td className="num">{moneda(p.valor, mon, { dec: 4 })}</td>
                          <td className="num" style={{ color: colorVariacion(v) }}>
                            {v === null || v === undefined ? "—" : porcentaje(v, 2)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
