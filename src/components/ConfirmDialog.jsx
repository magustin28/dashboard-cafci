import { useModalClose } from "../hooks/useModalClose";
import { IconAlertTriangle } from "./Icons";

/**
 * Diálogo de confirmación compartido.
 *
 * HistorialModal tenía su versión inline (con su propio useModalClose) y PortfolioTab usaba el
 * `confirm()` nativo del navegador, así que la misma acción destructiva se veía distinta según la
 * pestaña. Acá hay una sola versión, con cierre animado y capa propia en el historial.
 *
 * Se renderiza condicionalmente ({confirm && <ConfirmDialog …/>}), así que el hook sólo existe
 * mientras el diálogo está visible y no hace falta el parámetro `activo`.
 *
 * Props:
 *   mensaje     texto de la pregunta
 *   textoBoton  texto del botón que confirma (por defecto "Eliminar")
 *   onConfirm   acción a ejecutar; puede ser async (se espera antes de cerrar)
 *   onClose     desmonta el diálogo
 *   zIndex      por encima del modal que lo abrió (900 en HistorialModal)
 */
export default function ConfirmDialog({
  mensaje,
  textoBoton = "Eliminar",
  onConfirm,
  onClose,
  zIndex = 900,
}) {
  const { closing, requestClose } = useModalClose(onClose);

  return (
    <div
      className={`modal-overlay${closing ? " closing" : ""}`}
      style={{ zIndex }}
      onClick={(e) => { if (e.target === e.currentTarget) requestClose(); }}
    >
      <div className="modal modal-confirm">
        <div className="confirm-icon">
          <IconAlertTriangle size={32} strokeWidth={1.75} />
        </div>
        <p className="confirm-msg">{mensaje}</p>
        <div className="confirm-actions">
          <button className="confirm-btn" onClick={requestClose}>
            Cancelar
          </button>
          <button
            className="confirm-btn confirm-btn-danger"
            onClick={async () => { await onConfirm?.(); requestClose(); }}
          >
            {textoBoton}
          </button>
        </div>
      </div>
    </div>
  );
}
