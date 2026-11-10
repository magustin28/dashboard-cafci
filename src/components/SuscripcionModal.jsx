import { useState } from "react";
import { useAuth } from "../context/useAuth";
import { moneda as fmtMoneda, nombreMoneda } from "../lib/format";
import { useModalClose } from "../hooks/useModalClose";
import { IconChevronDown, IconLock, IconX } from "./Icons";

export default function SuscripcionModal({ fondoInicial, monedaInicial, raw, onClose }) {
  const { addSuscripcion } = useAuth();
  const [fondo, setFondo] = useState(fondoInicial || "");
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
  // La moneda la fija el fondo: no se elige nunca. El raw trae el par fondo + moneda y en los datos
  // cada nombre de fondo existe con UNA sola moneda (verificado contra la API: 4.293 fondos, 0 con
  // más de una), así que el campo se completa solo al elegir el fondo y queda fijo.
  const monedasDelFondo = fondo
    ? [
        ...new Set(
          raw
            .filter((r) => r.fondo === fondo)
            .map((r) => r.moneda)
            .filter(Boolean),
        ),
      ]
    : [];
  // Bloqueado manda la moneda que vino por parámetro; en blanco, la del fondo elegido. Sin fondo
  // elegido no hay moneda que mostrar: el campo queda vacío y sin leyendas de ayuda.
  const moneda = bloqueado ? monedaInicial || "ARS" : monedasDelFondo[0] || monedaInicial || "ARS";
  const monedaVisible = bloqueado || monedasDelFondo.length > 0 ? nombreMoneda(moneda) : "";
  // Cierre animado (hooks/useModalClose.js). requestClose(true) al guardar: el hook reenvía el
  // argumento, así el padre sigue enterándose de que hay que refrescar el portfolio.
  // ESC: en el modal en blanco, con un fondo ya elegido, el primer ESC lo borra en vez de cerrar:
  // es la forma rápida de deshacer la selección sin perder cantidad, precio y fecha.
  const { closing, requestClose } = useModalClose(onClose, {
    alEscape: () => {
      if (!bloqueado && fondo) {
        setFondo("");
        return true;
      }
      return false;
    },
  });

  const cant = parseFloat(cantidad);
  const prec = parseFloat(precio);
  const total = !isNaN(cant) && !isNaN(prec) && cant > 0 && prec > 0 ? cant * prec : null;

  const submit = async () => {
    if (!fondo) return setError("Ingresá el nombre del fondo.");
    // El fondo tiene que salir de la lista: la moneda se deriva de ahí. Si no, se guardaría con la
    // moneda por defecto, que es justo lo que se quiere evitar.
    if (raw.length && !monedasDelFondo.length) return setError("Elegí un fondo de la lista.");
    if (!fecha) return setError("Ingresá la fecha de compra.");
    if (isNaN(cant) || cant <= 0) return setError("Ingresá una cantidad válida.");
    if (isNaN(prec) || prec <= 0) return setError("Ingresá un precio válido.");
    setLoading(true);
    const result = await addSuscripcion({ fondoNombre: fondo, moneda, fechaCompra: fecha, cantidad: cant, precioCompra: prec });
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
              <div className="modal-fondo-wrap">
                <span className="modal-fondo-input">
                  <input
                    type="text"
                    value={fondo}
                    onChange={(e) => setFondo(e.target.value)}
                    placeholder="Nombre del fondo"
                    list="fondos-datalist"
                    autoComplete="off"
                  />
                  {/* La flecha del datalist la dibuja el navegador recién al pasar el mouse (y cada
                      navegador la hace distinto), así que el campo no parecía un desplegable: se
                      oculta la nativa y se dibuja la de Lucide, siempre visible, igual que los
                      selects (components/Select.jsx). La flecha es pointer-events: none, así el
                      clic llega al input y sigue abriendo la lista. */}
                  <span className="modal-fondo-chev">
                    <IconChevronDown size={12} />
                  </span>
                </span>
                {/* Borra el fondo elegido sin cerrar el modal: antes había que seleccionar todo el
                    texto y borrarlo, porque ESC cierra. */}
                <button
                  type="button"
                  className="modal-clear-btn"
                  onClick={() => setFondo("")}
                  disabled={!fondo}
                  title="Borrar el fondo elegido"
                  aria-label="Borrar el fondo elegido"
                >
                  <IconX size={13} />
                </button>
              </div>
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
            {/* La moneda nunca se elige: la fija el fondo. Sin fondo elegido el campo queda vacío y
                se completa solo (sin leyendas: eran largas y no aportaban información). */}
            <label>Moneda {monedaVisible && <IconLock size={11} />}</label>
            <input type="text" value={monedaVisible} readOnly placeholder="ej: ARS/USD/USB" />
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
              Inversión total: <strong className="susc-total">{fmtMoneda(total, moneda)}</strong>
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
