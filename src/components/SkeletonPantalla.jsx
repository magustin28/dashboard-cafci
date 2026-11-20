/**
 * Pantalla de carga con SKELETON: en lugar del spinner centrado dibuja la estructura real de la
 * app (header, tabs, KPIs, filtros y tabla) con cajas grises animadas. Al llegar los datos el
 * layout no salta, porque las cajas ya ocupan el mismo lugar que el contenido.
 *
 * El mensaje real va en una franja debajo del header, como status: es el aviso del cold start de
 * Render ("puede tardar hasta 30 segundos"), que se perdería con un skeleton mudo. Las cajas van
 * con aria-hidden: para lectores de pantalla lo único relevante es el mensaje.
 *
 * Props:
 *   mensaje  texto principal del estado (ej. "Consultando la API…")
 *   sub      aclaración opcional (ej. la del cold start); se omite si no viene
 */

const FILAS = 8;

export default function SkeletonPantalla({ mensaje = "Consultando la API…", sub }) {
  return (
    <div className="wrap" aria-busy="true">
      <header className="sk-header">
        <div className="sk sk-logo" />
        <div className="sk-meta">
          <div className="sk sk-line" />
          <div className="sk sk-line sk-line-corta" />
        </div>
        <div className="sk-acciones">
          <div className="sk sk-btn" />
          <div className="sk sk-btn" />
          <div className="sk sk-btn sk-btn-sesion" />
        </div>
      </header>

      <p className="sk-aviso" role="status" aria-live="polite">
        <span className="sk-punto" aria-hidden="true" />
        <span className="sk-aviso-msg">{mensaje}</span>
        {sub && <span className="sk-aviso-sub">{sub}</span>}
      </p>

      <div className="sk-tabs" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="sk sk-tab" />
        ))}
      </div>

      <div className="sk-kpis" aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="sk-kpi">
            <div className="sk sk-kpi-label" />
            <div className="sk sk-kpi-val" />
            <div className="sk sk-kpi-sub" />
          </div>
        ))}
      </div>

      <div className="sk-filtros" aria-hidden="true">
        <div className="sk sk-buscador" />
        <div className="sk sk-select" />
        <div className="sk sk-select" />
        <div className="sk sk-select" />
      </div>

      <div className="sk-tabla" aria-hidden="true">
        <div className="sk-thead">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="sk sk-th" />
          ))}
        </div>
        {Array.from({ length: FILAS }, (_, f) => (
          <div key={f} className="sk-fila">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="sk sk-td" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
