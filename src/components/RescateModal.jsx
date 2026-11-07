import { useState } from "react";
import { useAuth } from "../context/useAuth";
import { moneda as fmtMoneda, cuotapartes } from "../lib/format";
import { useModalClose } from "../hooks/useModalClose";
import { IconLock, IconX } from "./Icons";

export default function RescateModal({ fondoInicial, monedaInicial, onClose }) {
  const { portfolio, addRescate } = useAuth();
  const [fondo, setFondo] = useState(fondoInicial || "");
  const [moneda, setMoneda] = useState(monedaInicial || "ARS");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [cantidad, setCantidad] = useState("");
  const [precio, setPrecio] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // El rescate siempre sale de un fondo concreto (acción de fila o Historial), así que Fondo y
  // Moneda llegan preseleccionados y quedan fijos: se rescata de la posición que se está mirando y
  // no de otra. Cantidad y precio siguen editables (son los datos del rescate).
  const bloqueado = Boolean(fondoInicial);
  // Cierre animado (hooks/useModalClose.js). requestClose(true) al guardar: el hook reenvía el
  // argumento, así el padre sigue enterándose de que hay que refrescar el portfolio.
  const { closing, requestClose } = useModalClose(onClose);

  const cant = parseFloat(cantidad);
  const prec = parseFloat(precio);

  const disponibles = portfolio
    .filter((s) => s.fondo_nombre === fondo && s.moneda === moneda)
    .reduce((s, x) => s + parseFloat(x.cuotapartes_disponibles), 0);

  // FIFO preview
  let preview = null;
  if (fondo && !isNaN(cant) && !isNaN(prec) && cant > 0 && prec > 0) {
    const suscsFifo = portfolio
      .filter((s) => s.fondo_nombre === fondo && s.moneda === moneda && parseFloat(s.cuotapartes_disponibles) > 0)
      .sort((a, b) => new Date(a.fecha_compra) - new Date(b.fecha_compra));
    let restante = cant,
      costoTotal = 0;
    for (const s of suscsFifo) {
      if (restante <= 0) break;
      const consumidas = Math.min(restante, parseFloat(s.cuotapartes_disponibles));
      costoTotal += consumidas * parseFloat(s.precio_compra);
      restante -= consumidas;
    }
    const importeVenta = cant * prec;
    const rendimiento = importeVenta - costoTotal;
    const rendPct = costoTotal > 0 ? (rendimiento / costoTotal) * 100 : 0;
    preview = { importeVenta, costoTotal, rendimiento, rendPct };
  }

  // Formateador compartido: mismo importe que en el resto de las pantallas (lib/format.js).
  const fmt = (v) => fmtMoneda(v, moneda);

  const submit = async () => {
    if (!fondo) return setError("Ingresá el nombre del fondo.");
    if (!fecha) return setError("Ingresá la fecha del rescate.");
    if (isNaN(cant) || cant <= 0) return setError("Ingresá una cantidad válida.");
    if (isNaN(prec) || prec <= 0) return setError("Ingresá un precio válido.");
    setLoading(true);
    const result = await addRescate({ fondoNombre: fondo, moneda, fechaRescate: fecha, cuotapartesRescatadas: cant, precioRescate: prec });
    setLoading(false);
    if (result.ok) requestClose(true);
    else setError(result.msg);
  };

  return (
    <div
      className={`modal-overlay modal-overlay-top${closing ? " closing" : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div className="modal">
        <button className="modal-close" onClick={requestClose} aria-label="Cerrar">
          <IconX size={16} />
        </button>
        <h2 className="modal-title">Registrar rescate</h2>
        <p className="modal-subtitle">Vendé cuotapartes — se aplica método FIFO</p>

        <div className="modal-field">
          {/* La leyenda va en el mismo renglón del título: antes ocupaba una línea aparte debajo
              del input y se perdía. Sólo el Fondo la lleva; Moneda muestra el candado solo. */}
          <label>
            Fondo {bloqueado && <IconLock size={11} />}
            {bloqueado && <span className="modal-hint-inline">Fijado al fondo que estás viendo.</span>}
          </label>
          <input
            type="text"
            value={fondo}
            onChange={(e) => setFondo(e.target.value)}
            readOnly={bloqueado}
            placeholder="Nombre del fondo"
            list="fondos-datalist"
            autoComplete="off"
          />
          <div className="resc-disponibles">
            {fondo && (disponibles > 0 ? `Disponibles: ${cuotapartes(disponibles)} cuotapartes` : "Sin cuotapartes disponibles para este fondo.")}
          </div>
        </div>

        <div className="modal-row">
          <div className="modal-field">
            <label>Moneda {bloqueado && <IconLock size={11} />}</label>
            <select value={moneda} onChange={(e) => setMoneda(e.target.value)} disabled={bloqueado}>
              <option value="ARS">ARS — Pesos</option>
              <option value="USD">USD — Dólar</option>
              <option value="USB">USB — Dólar Billete</option>
            </select>
          </div>
          <div className="modal-field">
            <label>Fecha de rescate</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
        </div>

        <div className="modal-row">
          <div className="modal-field">
            <label>Cuotapartes rescatadas</label>
            <input type="number" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="ej: 500.00" min={0} step="any" />
          </div>
          <div className="modal-field">
            {/* Label corto, igual que en Suscripción: "Precio de rescate (por cuotaparte)" ocupaba
                dos líneas y desalineaba este input respecto de "Cuotapartes a rescatar". */}
            <label>Precio por cuotaparte</label>
            <input type="number" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="ej: 1380.00" min={0} step="any" />
          </div>
        </div>

        {preview && (
          <div className="resc-preview">
            <div className="resc-preview-row">
              <span>Importe venta</span>
              <span>{fmt(preview.importeVenta)}</span>
            </div>
            <div className="resc-preview-row">
              <span>Costo (FIFO)</span>
              <span>{fmt(preview.costoTotal)}</span>
            </div>
            <div className="resc-preview-row" style={{ fontWeight: 600, borderTop: "1px solid var(--border2)", paddingTop: 6, marginTop: 2 }}>
              <span>Rendimiento</span>
              <span className={preview.rendimiento >= 0 ? "pos" : "neg"}>
                {preview.rendimiento >= 0 ? "+" : "-"}
                {fmt(preview.rendimiento)} ({preview.rendimiento >= 0 ? "+" : ""}
                {preview.rendPct.toFixed(2)}%)
              </span>
            </div>
          </div>
        )}

        {error && <p className="modal-error">{error}</p>}
        <button className="modal-submit" onClick={submit} disabled={loading}>
          {loading ? "Procesando…" : "Confirmar rescate"}
        </button>
      </div>
    </div>
  );
}
