import { useEffect } from "react";
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

  // ESC en fase de captura y con stopPropagation: el diálogo está encima de otro modal y su
  // listener de ESC (registrado antes, en fase de burbuja) cerraría el modal de fondo.
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        requestClose();
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [requestClose]);

  return (
    <div
      className={`modal-overlay${closing ? " closing" : ""}`}
      style={{ display: "flex", zIndex }}
      onClick={(e) => { if (e.target === e.currentTarget) requestClose(); }}
    >
      <div className="modal" style={{ maxWidth: 420, textAlign: "center" }}>
        <div style={{ marginBottom: 12, color: "var(--yellow)" }}>
          <IconAlertTriangle size={32} strokeWidth={1.75} />
        </div>
        <p style={{ fontSize: 14, color: "var(--text)", marginBottom: 24, lineHeight: 1.6 }}>{mensaje}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button
            onClick={requestClose}
            style={{ padding: "8px 20px", borderRadius: 6, border: "1px solid var(--border2)", background: "none", color: "var(--text2)", cursor: "pointer", fontSize: 13 }}
          >
            Cancelar
          </button>
          <button
            onClick={async () => { await onConfirm?.(); requestClose(); }}
            style={{ padding: "8px 20px", borderRadius: 6, border: "none", background: "#dc2626", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
          >
            {textoBoton}
          </button>
        </div>
      </div>
    </div>
  );
}
