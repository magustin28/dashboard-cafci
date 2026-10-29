import { useState, useEffect, useMemo } from 'react';
import { useAuth } from './context/useAuth';
import { useFondos } from './hooks/useFondos';
import { getTabGroup, filterRows, formatFechaLabel } from './lib/utils';

import Header from './components/Header';
import FilterBar from './components/FilterBar';
import Tabs from './components/Tabs';
import KPIs from './components/KPIs';
import FondosTable from './components/FondosTable';
import PortfolioTab from './components/PortfolioTab';
import SuscripcionModal from './components/SuscripcionModal';
import RescateModal from './components/RescateModal';
import HistorialModal from './components/HistorialModal';
import FondoPanel    from './components/FondoPanel';
import TopTab        from './components/TopTab';
import { IconRefreshCw, IconStar, IconAlertTriangle } from './components/Icons';

export default function App() {
  const { user, authReady, favs } = useAuth();
  const { raw, apiFecha, fechas, loading, error, refs, fetchData, forceRefresh, fechaCargada } = useFondos();

  // Al volver del login con Google la página se recarga y se pierde el dispatch de cafci:tab que
  // usaba el login por contraseña: AuthModal deja el tab destino en sessionStorage y acá se toma
  // como pestaña inicial (se limpia sola cuando el usuario cambia de pestaña, en switchTab).
  const [activeTab, setActiveTab] = useState(() => sessionStorage.getItem('cafci_post_login_tab') || 'Todos');
  const [fondoPanel, setFondoPanel] = useState(null);
  const [q, setQ]                 = useState('');
  const [moneda, setMoneda]       = useState('');
  const [region, setRegion]       = useState('');
  const [horizonte, setHorizonte] = useState('');

  // Modals
  const [suscModal,  setSuscModal]  = useState(null); // { fondo, moneda } | null
  const [rescModal,  setRescModal]  = useState(null);
  const [histModal,  setHistModal]  = useState(null); // fondoNombre | null

  // La fecha pedida vive como ESTADO y no se lee window.location.search en cada render: así se
  // puede cambiar de día sin recargar. Antes un pushState solo no re-renderizaba, y la única forma
  // de ver otra fecha era abrir `?fecha=…` en una pestaña nueva con window.open.
  const [search, setSearch] = useState(window.location.search);
  const fechaParam = new URLSearchParams(search).get('fecha');

  useEffect(() => { fetchData(fechaParam); }, [fechaParam, fetchData]);

  useEffect(() => {
    if (apiFecha) {
      // apiFecha puede venir como YYYY-MM-DD o DD/MM/YYYY
      let label = apiFecha;
      if (apiFecha.includes('-')) {
        const [y, m, d] = apiFecha.split('-');
        label = `${d}/${m}/${y}`;
      }
      document.title = `Dashboard CAFCI - ${label}`;
    } else {
      document.title = 'Dashboard CAFCI';
    }
  }, [apiFecha]);

  // Listen for tab switch events from Header
  useEffect(() => {
    const handler = (e) => setActiveTab(e.detail);
    window.addEventListener('cafci:tab', handler);
    return () => window.removeEventListener('cafci:tab', handler);
  }, []);



  // El tab "Mi Portfolio" existe sólo con sesión Y fuera del histórico (Tabs.jsx lo esconde en los
  // dos casos). Si la sesión se cae estando ahí (logout en otra pestaña, token vencido) o si se pasa
  // a una fecha histórica, activeTab queda apuntando a un tab invisible y App renderizaba
  // PortfolioTab igual: ahí se veía el mensaje "Iniciá sesión para ver tu portafolio" o el portafolio
  // en una fecha vieja sin botón para volver. Se deriva el tab efectivo —y al volver a los datos
  // actuales se restaura solo— en vez de resetear con un effect: el lint del proyecto no permite
  // setState dentro de un effect.
  const esHistorica = !!fechaParam;
  const tabActual =
    activeTab === 'Mi Portfolio' && (esHistorica || !user) ? 'Todos' : activeTab;

  const filtered = useMemo(() => {
    if (!raw.length) return [];
    const rows = raw.filter(r => {
      if (tabActual === 'Favoritos') return false; // se muestra con favFiltered
      return tabActual === 'Todos' || getTabGroup(r) === tabActual;
    });
    return filterRows(rows, { q, moneda, region, horizonte });
  }, [raw, tabActual, q, moneda, region, horizonte]);

  // Los favoritos pasan por la MISMA función de filtros que el resto de las pestañas. Antes este
  // memo sólo miraba `favs`: el buscador y los selects se veían en la barra pero no filtraban
  // nada (tipear el nombre de un fondo no hacía efecto).
  const favFiltered = useMemo(
    () => filterRows(raw.filter(r => favs.includes(r.fondo)), { q, moneda, region, horizonte }),
    [raw, favs, q, moneda, region, horizonte]
  );

  const isPortfolio = tabActual === 'Mi Portfolio';
  const isFavoritos = tabActual === 'Favoritos';
  const isTop       = tabActual === 'Top 10';
  const hasFilters  = q || moneda || region || horizonte;

  const clearFilters = () => { setQ(''); setMoneda(''); setRegion(''); setHorizonte(''); };
  const switchTab = (tab) => {
    sessionStorage.removeItem('cafci_post_login_tab'); // ya se usó como pestaña inicial
    setActiveTab(tab);
    clearFilters();
  };

  // Cambiar de fecha sin recargar: se actualiza la URL con pushState (así el botón Atrás del
  // navegador también funciona y el link queda copiable) y el estado dispara el re-render.
  // null = datos actuales. Se cierra el panel de detalle porque guarda una fila de la fecha vieja.
  const irA = (fecha) => {
    const qs = fecha ? `?fecha=${fecha}` : '';
    window.history.pushState({}, '', qs || window.location.pathname);
    setSearch(qs);
    setFondoPanel(null);
  };

  // Consulta en curso de OTRA fecha: mientras dure, la zona de datos (KPIs + filtros + tabla) va
  // tapada por el overlay del final. Se apaga solo cuando la vista pintada alcanza lo pedido, así
  // que un refresco de la MISMA fecha no lo dispara: ahí el feedback sigue yendo en el botón
  // Actualizar, como antes. fechaCargada = qué vista está pintada (null = los datos actuales).
  const consultando = loading && fechaCargada !== fechaParam;

  // Al cerrar sesión, volver a la pestaña principal
  useEffect(() => {
    const handler = () => setActiveTab('Todos');
    window.addEventListener('cafci:logout', handler);
    return () => window.removeEventListener('cafci:logout', handler);
  }, []);

  // Pantalla completa SÓLO cuando todavía no hay ningún dato que mostrar (primera carga). Si ya hay
  // datos, una consulta de OTRA fecha se avisa tapando únicamente la zona de datos (ver el overlay
  // del final): antes cualquier consulta histórica reemplazaba la app entera por un spinner y no se
  // podía volver atrás hasta que terminara.
  if (loading && raw.length === 0) {
    return (
      <div id="loader-overlay" style={{ display: 'flex' }}>
        <div className="spinner"></div>
        <span id="loader-msg">
          {fechaParam ? `Consultando los datos del ${formatFechaLabel(fechaParam)}…` : 'Consultando la API…'}
        </span>
        <span id="loader-sub">
          {fechaParam
            ? 'Consultando datos históricos de la API.'
            : 'Esto puede tardar hasta 30 segundos si el servidor está iniciando.'}
        </span>
      </div>
    );
  }

  if (!authReady) {
    return (
      <div id="loader-overlay" style={{ display: 'flex' }}>
        <div className="spinner"></div>
        <span id="loader-msg">Conectando con la API…</span>
        <span id="loader-sub">Esto puede tardar hasta 30 segundos si el servidor está iniciando.</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="wrap">
        <div className="table-wrap">
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ marginBottom: 12, color: 'var(--red)' }}><IconAlertTriangle size={32} strokeWidth={1.75} /></div>
            <p>No se pudieron cargar los datos.<br /><small>{error}</small></p>
            <button className="btn-retry" onClick={() => fetchData(fechaParam)}><IconRefreshCw size={13} /> Reintentar</button>
          </div>
        </div>
      </div>
    );
  }

  const tableData = isFavoritos ? favFiltered : filtered;

  return (
    <div className="wrap">
      {/* Con una consulta de otra fecha en curso, apiFecha todavía es el de la vista anterior: al
          volver a los datos actuales el header mostraba la fecha vieja con el semáforo en rojo y
          "hace N días" mientras ya estaba cargando la actual. Se pasa null y queda
          "Actualizado: Cargando…" con el punto neutro. En un refresco de la misma fecha no aplica
          (consultando es false) y la fecha se ve como siempre. */}
      <Header
        apiFecha={consultando ? null : apiFecha}
        totalFondos={raw.length}
        fechas={fechas}
        fechaParam={fechaParam}
        onReload={() => forceRefresh(fechaParam)}
        loading={loading}
        consultando={consultando}
        onVolverHoy={() => irA(null)}
        onElegirFecha={irA}
      />

      <Tabs raw={raw} activeTab={tabActual} onSwitch={switchTab} esFechaHistorica={esHistorica} />

      {/* Zona de datos: es la única parte que se tapa mientras se consulta OTRA fecha. El header y
          las tabs quedan afuera justamente para poder seguir usando "Histórico: … ✕" y cambiar de
          pestaña durante la consulta. */}
      <div className="data-region">
        {!isPortfolio && !isTop && (
          <KPIs filtered={isFavoritos ? favFiltered : filtered} />
        )}

        {/* La barra vive en components/FilterBar.jsx: en el celular se pliega detrás del botón
            "Filtros" (una fila de 44px en lugar de las cuatro que ocupaba) y en escritorio se ve
            igual que antes. */}
        {!isPortfolio && !isTop && (
          <FilterBar
            q={q} setQ={setQ}
            moneda={moneda} setMoneda={setMoneda}
            region={region} setRegion={setRegion}
            horizonte={horizonte} setHorizonte={setHorizonte}
            hasFilters={hasFilters} clearFilters={clearFilters}
          />
        )}

        {isFavoritos && !user && (
          <div className="favs-banner">
            <span><IconStar size={13} /> Tus favoritos se guardan sólo en este navegador.</span>
            {' '}<a href="#" onClick={e => { e.preventDefault(); window.dispatchEvent(new CustomEvent('cafci:openauth')); }}>Iniciá sesión con Google</a>
            <span> para guardarlos en tu cuenta y acceder desde cualquier dispositivo.</span>
          </div>
        )}

        {isTop ? (
          <TopTab
            raw={raw}
            refs={{ ...refs, apiFecha }}
            onOpenSuscripcion={(fondo, mon) => setSuscModal({ fondo, moneda: mon })}
            onFondoClick={(row) => setFondoPanel(row)}
          />
        ) : isPortfolio ? (
          <>
            <PortfolioTab
              raw={raw}
              apiFecha={apiFecha}
              refs={refs}
              onOpenSuscripcion={(fondo, mon) => setSuscModal({ fondo: fondo || '', moneda: mon || 'ARS' })}
              onOpenRescate={(fondo, mon) => setRescModal({ fondo, moneda: mon })}
              onOpenHistorial={(fondo, mon) => setHistModal({ fondo, moneda: mon || 'ARS' })}
              onFondoClick={(row) => setFondoPanel(row)}
            />
            {/* FAB */}
            {user && (
              <button className="fab-add" onClick={() => setSuscModal({ fondo: '', moneda: 'ARS' })} title="Agregar suscripción">
                <span className="fab-icon">+</span>
              </button>
            )}
          </>
        ) : (
          <FondosTable
            filtered={tableData}
            activeTab={tabActual}
            refs={{ ...refs, apiFecha }}
            onOpenSuscripcion={(fondo, mon) => setSuscModal({ fondo, moneda: mon })}
            onFondoClick={(row) => setFondoPanel(row)}
          />
        )}

        {/* Consulta de OTRA fecha en curso: se tapa la zona de datos (KPIs + filtros + tabla) y el
            header y las tabs quedan libres para volver con "Histórico: … ✕" o cambiar de pestaña. */}
        {consultando && (
          <div className="data-overlay">
            <div className="data-overlay-box">
              <div className="spinner"></div>
              <span className="data-overlay-msg">
                {/* En la vuelta a los datos actuales fechaParam ya es null: ahí no hay fecha que
                    mostrar (formatFechaLabel(null) rompería) y el mensaje cambia. */}
                {fechaParam
                  ? `Consultando los datos del ${formatFechaLabel(fechaParam)}…`
                  : 'Volviendo a los datos actuales…'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {suscModal && (
        <SuscripcionModal
          fondoInicial={suscModal.fondo}
          monedaInicial={suscModal.moneda}
          raw={raw}
          onClose={(refresh) => { setSuscModal(null); if (refresh) setActiveTab('Mi Portfolio'); }}
        />
      )}
      {rescModal && (
        <RescateModal
          fondoInicial={rescModal.fondo}
          monedaInicial={rescModal.moneda}
          onClose={(refresh) => { setRescModal(null); if (refresh) setActiveTab('Mi Portfolio'); }}
        />
      )}
      {histModal && (
        <HistorialModal
          fondoNombre={histModal.fondo}
          moneda={histModal.moneda}
          raw={raw}
          onClose={() => setHistModal(null)}
        />
      )}
      {fondoPanel && (
        <FondoPanel
          fondo={fondoPanel}
          refs={refs}
          apiFecha={apiFecha}
          onClose={() => setFondoPanel(null)}
        />
      )}
    </div>
  );
}
