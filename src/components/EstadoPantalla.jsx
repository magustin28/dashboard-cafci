// Estados de pantalla que App.jsx armaba inline: carga a pantalla completa, error con reintento y
// el overlay que tapa sólo la zona de datos mientras se consulta otra fecha. Eran tres bloques
// casi iguales dentro del render; acá quedan separados y con el texto como prop.
import { IconAlertTriangle, IconRefreshCw } from "./Icons";

/** Pantalla completa de carga (primer arranque o espera de sesión). */
export function LoaderOverlay({ mensaje = "Conectando con la API…", sub = "Esto puede tardar hasta 30 segundos si el servidor está iniciando." }) {
  return (
    <div id="loader-overlay">
      <div className="spinner"></div>
      <span id="loader-msg">{mensaje}</span>
      {sub && <span id="loader-sub">{sub}</span>}
    </div>
  );
}

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
