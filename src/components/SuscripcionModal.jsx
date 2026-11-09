import { useState } from "react";
import { useAuth } from "../context/useAuth";
import { moneda as fmtMoneda, nombreMoneda } from "../lib/format";
import { useModalClose } from "../hooks/useModalClose";
import { IconLock, IconX } from "./Icons";

export default function SuscripcionModal({ fondoInicial, monedaInicial, raw, onClose }) {
  const { addSuscripcion } = useAuth();
  const [fondo, setFondo] = useState(fondoInicial || "");
  const [moneda, setMoneda] = useState(monedaInicial || "ARS");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [cantidad, setCantidad] = useState("");
  const [precio, setPrecio] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Fondo y moneda identifican la posición donde se carga la compra. Cuando el modal se abre desde
  // un fondo concreto (acción de fila, historial) vienen preseleccionados y quedan fijos: así no se
  // puede cargar la suscripción en otro fondo/otra moneda por error. Sólo son editables cuando se
  // abre "en blanco" (botón + de Agregar suscripción, que llega con fondo vacío).
  const bloqueado = Boolean(fondoInicial);
  // En el modal en blanco la moneda tampoco se elige: se deriva del fondo que se elige (el raw trae
  // el par fondo + moneda), así una compra en pesos no se puede cargar como si fuera de un fondo en
  // dólares. Mientras no haya un fondo elegido no hay moneda que mostrar: el campo queda bloqueado.
  // Si el nombre elegido existe con más de una moneda (o no está en la lista) se deja elegir.
  const monedasDelFondo = fondo
    ? [...new Set(raw.filter((r) => r.fondo === fondo).map((r) => r.moneda).filter(Boolean))]
    : [];
  const monedaFija = bloqueado || monedasDelFondo.length === 1;
  // Valor efectivo del campo: si el fondo fija una sola moneda se usa esa; si tiene varias se
  // respeta la elegida siempre que siga existiendo, si no la primera. Con el modal bloqueado manda
  // la moneda que vino por parámetro. Así el select nunca queda con un value fuera de su lista.
  const monedaValor = bloqueado
    ? moneda
    : monedasDelFondo.length === 1
      ? monedasDelFondo[0]
      : monedasDelFondo.length > 1
        ? (monedasDelFondo.includes(moneda) ? moneda : monedasDelFondo[0])
        : moneda;
  // Cierre animado (hooks/useModalClose.js). requestClose(true) al guardar: el hook reenvía el
  // argumento, así el padre sigue enterándose de que hay que refrescar el portfolio.
  const { closing, requestClose } = useModalClose(onClose);

  const cant = parseFloat(cantidad);
  const prec = parseFloat(precio);
  const total = !isNaN(cant) && !isNaN(prec) && cant > 0 && prec > 0 ? cant * prec : null;

  const submit = async () => {
    if (!fondo) return setError("Ingresá el nombre del fondo.");
    if (!fecha) return setError("Ingresá la fecha de compra.");
    if (isNaN(cant) || cant <= 0) return setError("Ingresá una cantidad válida.");
    if (isNaN(prec) || prec <= 0) return setError("Ingresá un precio válido.");
    setLoading(true);
    const result = await addSuscripcion({ fondoNombre: fondo, moneda: monedaValor, fechaCompra: fecha, cantidad: cant, precioCompra: prec });
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
        <h2 className="modal-title">Agregar suscripción</h2>
        <p className="modal-subtitle">Registrá una compra de cuotapartes</p>

        <div className="modal-field">
          {/* La leyenda va en el mismo renglón del título: antes ocupaba una línea aparte debajo
              del input y se perdía. Sólo el Fondo la lleva; Moneda muestra el candado solo. */}
          <label>
            Fondo {bloqueado && <IconLock size={11} />}
            {bloqueado && <span className="modal-hint-inline">Fijado al fondo que estás viendo.</span>}
          </label>
          {bloqueado ? (
            <input type="text" value={fondo} readOnly />
          ) : (
            <>
              <input
                type="text"
                value={fondo}
                onChange={(e) => setFondo(e.target.value)}
                placeholder="Nombre del fondo"
                list="fondos-datalist"
                autoComplete="off"
              />
              <datalist id="fondos-datalist">
                {raw.map((r, i) => (
                  <option key={i} value={r.fondo} />
                ))}
              </datalist>
            </>
          )}
        </div>

        <div className="modal-row">
          <div className="modal-field">
            {/* La moneda nunca se elige con una lista: la fija el fondo. Llega por parámetro cuando
                el modal se abre desde una posición y se deriva del fondo en el modal en blanco. */}
            <label>
              Moneda {monedaFija && <IconLock size={11} />}
              {!monedaFija && !fondo && <span className="modal-hint-inline">Se completa al elegir el fondo.</span>}
            </label>
            {monedaFija ? (
              <input type="text" value={nombreMoneda(monedaValor)} readOnly />
            ) : !fondo ? (
              <input type="text" value="" placeholder="Se completa al elegir el fondo" readOnly />
            ) : (
              <select value={monedaValor} onChange={(e) => setMoneda(e.target.value)}>
                {(monedasDelFondo.length > 1 ? monedasDelFondo : ["ARS", "USD", "USB"]).map((m) => (
                  <option key={m} value={m}>{nombreMoneda(m)}</option>
                ))}
              </select>
            )}
          </div>
          <div className="modal-field">
            <label>Fecha de suscripción</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
        </div>

        <div className="modal-row">
          <div className="modal-field">
            <label>Cuotapartes suscriptas</label>
            <input type="number" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="ej: 1250.50" min={0} step="any" />
          </div>
          <div className="modal-field">
            <label>Precio por cuotaparte</label>
            <input type="number" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="ej: 1250.4832" min={0} step="any" />
          </div>
        </div>

        <div className="modal-calc">
          {total !== null ? (
            <>
              Inversión total: <strong className="susc-total">{fmtMoneda(total, monedaValor)}</strong>
            </>
          ) : (
            "Completá cantidad y precio para ver el total."
          )}
        </div>

        {error && <p className="modal-error">{error}</p>}
        <button className="modal-submit" onClick={submit} disabled={loading}>
          {loading ? "Guardando…" : "Guardar suscripción"}
        </button>
      </div>
    </div>
  );
}
