// Estados de pantalla que App.jsx armaba inline: error con reintento y el overlay que tapa sólo
// la zona de datos mientras se consulta otra fecha. La carga del primer arranque pasó a
// components/SkeletonPantalla.jsx (estructura de la app con cajas grises en vez de un spinner).
import { IconAlertTriangle, IconRefreshCw } from "./Icons";

/** Error de carga con botón para reintentar. */
export function ErrorState({ error, onRetry }) {
  return (
    <div className="wrap">
      <div className="table-wrap">
        <div className="err-box">
          <div className="err-icon">
            <IconAlertTriangle size={32} strokeWidth={1.75} />
          </div>
          <p>
            No se pudieron cargar los datos.
            <br />
            <small>{error}</small>
          </p>
          <button className="btn-retry" onClick={onRetry}>
            <IconRefreshCw size={13} /> Reintentar
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Overlay de consulta en curso. Tapa sólo la zona de datos: el header y las tabs quedan libres
 * para volver con el chip "Histórico: … ✕" o cambiar de pestaña mientras llega la respuesta.
 */
export function DataOverlay({ mensaje }) {
  return (
    <div className="data-overlay">
      <div className="data-overlay-box">
        <div className="spinner"></div>
        <span className="data-overlay-msg">{mensaje}</span>
      </div>
    </div>
  );
}
