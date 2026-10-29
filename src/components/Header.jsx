import { useState, useEffect, useCallback } from 'react';
import AuthModal from './AuthModal';
import UserMenu from './UserMenu';
import DatePickerModal from './DatePickerModal';
import Logo from './Logo';
import HeaderMeta from './HeaderMeta';
import { IconCalendar, IconRefreshCw, IconChevronDown } from './Icons';

export default function Header({
  apiFecha, totalFondos, fechas, fechaParam,
  onReload, loading = false, consultando = false,
  onVolverHoy, onElegirFecha,
}) {
  const [showAuth, setShowAuth]       = useState(false);
  const [pickerOpen, setPickerOpen]   = useState(false);
  // Cierre animado del modal de fechas: el hook vive adentro de DatePickerModal, acá sólo
  // hace falta un onClose estable. useCallback evita que el componente reciba una función nueva
  // en cada render del Header (eso re-registraría el listener de ESC del modal sin necesidad).
  const cerrarPicker = useCallback(() => setPickerOpen(false), []);

  // Abrir el modal de login cuando lo pide otra parte de la app. El banner de la pestaña Favoritos
  // ("Iniciá sesión con Google") despacha cafci:openauth y hasta ahora nadie lo escuchaba, así que
  // el link —y antes el "Solicitá acceso"— no abrían nada. El modal vive acá, así que el listener
  // va acá: es el mismo patrón de cafci:tab / cafci:logout.
  useEffect(() => {
    const handler = () => setShowAuth(true);
    window.addEventListener('cafci:openauth', handler);
    return () => window.removeEventListener('cafci:openauth', handler);
  }, []);

  return (
    <>
      <header>
        <Logo />
        <div className="header-meta">
          <HeaderMeta apiFecha={apiFecha} totalFondos={totalFondos} fechaParam={fechaParam}
            onVolverHoy={onVolverHoy} />

          {/* Los tres controles van juntos en .header-acciones para que en el celular ocupen una
              fila completa, en tres columnas iguales (ver @media de styles/utils.css). En escritorio
              es un flex más con el mismo gap de .header-meta, así que no cambia nada. */}
          <div className="header-acciones">
            {/* Trigger del selector de fechas. Se renderiza SIEMPRE, aunque las fechas todavía no
                hayan llegado: antes aparecía recién cuando respondía /api/fechas, así que en un hard
                refresh (sin caché y con el cold start de Render de por medio) el botón aparecía tarde
                y el header se reacomodaba. Las fechas se piden en paralelo (ver useFondos) y el modal
                muestra el aviso mientras tanto. */}
            {/* El texto va en spans propios (.btn-label) con dos versiones: "Ver fecha anterior" en
                escritorio y "Fecha" en el celular, que es lo que entra en un tercio de la fila. Así
                los tres controles del header quedan con ícono + texto y la misma forma (antes fecha
                y actualizar eran sólo ícono y la cuenta avatar + iniciales). El corto se oculta en
                escritorio desde styles/layout.css y el aria-label repite el texto para lectores de
                pantalla. */}
            <button className="date-picker-btn" aria-label="Ver fecha anterior"
              title="Ver datos de otra fecha" onClick={() => setPickerOpen(true)}>
              <IconCalendar size={12} /> <span className="btn-label btn-label-largo">Ver fecha anterior</span><span className="btn-label btn-label-corto">Fecha</span>
              <span className="date-arrow"><IconChevronDown size={12} /></span>
            </button>

            {/* Mientras consulta la API el botón queda bloqueado y muestra el spinner: es el feedback
                del refresco, que no desmonta la app. Si la consulta en curso es de OTRA fecha dice
                "Consultando…" en vez de "Actualizando…": no es un refresco de lo que ya se ve. */}
            <button className="btn-refresh" onClick={onReload} disabled={loading} aria-busy={loading}
              aria-label={loading ? 'Consultando…' : 'Actualizar la API'}
              title={loading ? 'Consultando la API…' : 'Volver a consultar la API'}>
              {loading
                ? <><span className="btn-spinner" aria-hidden="true"></span><span className="btn-label">{consultando ? 'Consultando…' : 'Actualizando…'}</span></>
                : <><IconRefreshCw size={13} /> <span className="btn-label">Actualizar</span></>}
            </button>

            {/* Auth: el menú de usuario vive en components/UserMenu.jsx (avatar, nombre y dropdown). */}
            <UserMenu onOpenAuth={() => setShowAuth(true)} />
          </div>
        </div>
      </header>

      {/* Modal selector de fecha histórica: el componente vive en components/DatePickerModal.jsx.
          onElegirFecha cambia la fecha en esta misma pestaña (App actualiza la URL y el estado). */}
      {pickerOpen && (
        <DatePickerModal
          fechas={fechas}
          esHistorica={!!fechaParam}
          onElegir={onElegirFecha}
          onClose={cerrarPicker}
        />
      )}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  );
}
