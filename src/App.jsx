import { useState, useEffect, useMemo } from 'react';
import { useAuth } from './context/useAuth';
import { useFondos } from './hooks/useFondos';
import { getTabGroup, filterRows } from './lib/utils';

import Header from './components/Header';
import Tabs from './components/Tabs';
import KPIs from './components/KPIs';
import FondosTable from './components/FondosTable';
import PortfolioTab from './components/PortfolioTab';
import SuscripcionModal from './components/SuscripcionModal';
import RescateModal from './components/RescateModal';
import HistorialModal from './components/HistorialModal';
import FondoPanel    from './components/FondoPanel';
import TopTab        from './components/TopTab';

export default function App() {
  const { user, authReady, favs } = useAuth();
  const { raw, apiFecha, fechas, loading, error, refs, fetchData, forceRefresh } = useFondos();

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

  const fechaParam = new URLSearchParams(window.location.search).get('fecha');

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



  // El tab "Mi Portfolio" sólo existe con sesión (Tabs.jsx lo esconde). Si la sesión se cae justo
  // cuando estábamos parados ahí (logout en otra pestaña, token vencido), activeTab queda apuntando
  // a un tab invisible y App seguía renderizando PortfolioTab: el único caso en el que se veía el
  // mensaje "Iniciá sesión para ver tu portafolio". Se deriva el tab efectivo en vez de resetear con
  // un effect (el lint del proyecto no permite setState dentro de un effect).
  const tabActual = !user && activeTab === 'Mi Portfolio' ? 'Todos' : activeTab;

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

  // Al cerrar sesión, volver a la pestaña principal
  useEffect(() => {
    const handler = () => setActiveTab('Todos');
    window.addEventListener('cafci:logout', handler);
    return () => window.removeEventListener('cafci:logout', handler);
  }, []);

  if (loading && fechaParam) {
    const [y, m, d] = fechaParam.split('-');
    const fechaLabel = `${d}/${m}/${y}`;
    return (
      <div id="loader-overlay" style={{ display: 'flex' }}>
        <div className="spinner"></div>
        <span id="loader-msg">Cargando datos del {fechaLabel}…</span>
        <span id="loader-sub">Consultando datos históricos de la API.</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div id="loader-overlay" style={{ display: 'flex' }}>
        <div className="spinner"></div>
        <span id="loader-msg">Consultando la API…</span>
        <span id="loader-sub">Esto puede tardar hasta 30 segundos si el servidor está iniciando.</span>
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
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠</div>
            <p>No se pudieron cargar los datos.<br /><small>{error}</small></p>
            <button className="btn-retry" onClick={() => fetchData(fechaParam)}>↻ Reintentar</button>
          </div>
        </div>
      </div>
    );
  }

  const tableData = isFavoritos ? favFiltered : filtered;

  return (
    <div className="wrap">
      <Header
        apiFecha={apiFecha}
        totalFondos={raw.length}
        fechas={fechas}
        fechaParam={fechaParam}
        onReload={() => forceRefresh(fechaParam)}
      />

      <Tabs raw={raw} activeTab={tabActual} onSwitch={switchTab} />

      {!isPortfolio && !isTop && (
        <KPIs filtered={isFavoritos ? favFiltered : filtered} />
      )}

      {!isPortfolio && !isTop && (
        <div className="filter-bar">
          <div className="search-wrap">
            <span className="search-icon">⌕</span>
            <input type="search" placeholder="Buscar fondo o sociedad gerente…" autoComplete="off"
              value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <select value={moneda} onChange={e => setMoneda(e.target.value)}>
            <option value="">Todas las monedas</option>
            <option value="ARS">ARS — Pesos</option>
            <option value="USD">USD — Dólar</option>
            <option value="USB">USB — Dólar Billete</option>
          </select>
          <select value={region} onChange={e => setRegion(e.target.value)}>
            <option value="">Todas las regiones</option>
            <option value="Arg">Argentina</option>
            <option value="Glo">Global</option>
            <option value="Latam">Latinoamérica</option>
            <option value="Bra">Brasil</option>
            <option value="Eur">Europa</option>
          </select>
          <select value={horizonte} onChange={e => setHorizonte(e.target.value)}>
            <option value="">Todos los horizontes</option>
            <option value="Cor">Corto plazo</option>
            <option value="Med">Mediano plazo</option>
            <option value="Lar">Largo plazo</option>
            <option value="Flex">Flexible</option>
            <option value="Sasig">Sasig</option>
          </select>
          <button className="btn-clear" disabled={!hasFilters} onClick={clearFilters}>✕ Limpiar filtros</button>
        </div>
      )}

      {isFavoritos && !user && (
        <div className="favs-banner">
          <span>⭐ Tus favoritos se guardan sólo en este navegador.</span>
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
