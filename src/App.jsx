import { useState, useEffect, useMemo } from 'react';
import { useAuth } from './context/AuthContext';
import { useFondos } from './hooks/useFondos';
import { getTabGroup } from './lib/utils';

import Header from './components/Header';
import Tabs from './components/Tabs';
import KPIs from './components/KPIs';
import FondosTable from './components/FondosTable';
import PortfolioTab from './components/PortfolioTab';
import SuscripcionModal from './components/SuscripcionModal';
import RescateModal from './components/RescateModal';
import HistorialModal from './components/HistorialModal';
import FondoPanel    from './components/FondoPanel';

const SORT_MAP = {
  var_d_desc: ['var_d', -1], var_d_asc: ['var_d', 1],
  var_anio_desc: ['var_anio', -1], var_anio_asc: ['var_anio', 1],
  var_12_desc: ['var_12', -1], var_12_asc: ['var_12', 1],
  pat_desc: ['pat', -1], pat_asc: ['pat', 1],
};

export default function App() {
  const { user, authReady, favs } = useAuth();
  const { raw, apiFecha, fechas, loading, error, refs, fetchData, forceRefresh } = useFondos();

  const [activeTab, setActiveTab] = useState('Todos');
  const [fondoPanel, setFondoPanel] = useState(null);
  const [q, setQ]                 = useState('');
  const [moneda, setMoneda]       = useState('');
  const [region, setRegion]       = useState('');
  const [horizonte, setHorizonte] = useState('');
  const [sort, setSort]           = useState('');

  // Modals
  const [suscModal,  setSuscModal]  = useState(null); // { fondo, moneda } | null
  const [rescModal,  setRescModal]  = useState(null);
  const [histModal,  setHistModal]  = useState(null); // fondoNombre | null

  const fechaParam = new URLSearchParams(window.location.search).get('fecha');

  useEffect(() => { fetchData(fechaParam); }, []);

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

  // Switch to Mi Portfolio after login
  useEffect(() => {
    if (user && activeTab !== 'Mi Portfolio') {
      // don't auto-switch, let user stay where they are
    }
  }, [user]);

  const filtered = useMemo(() => {
    if (!raw.length) return [];
    let rows = raw.filter(r => {
      if (activeTab === 'Favoritos') return false; // handled separately
      if (activeTab !== 'Todos' && getTabGroup(r[12]) !== activeTab) return false;
      if (moneda && r[2] !== moneda) return false;
      if (region && r[3] !== region) return false;
      if (horizonte && r[4] !== horizonte) return false;
      if (q) {
        const hay = (r[1] || '').toLowerCase() + ' ' + (r[11] || '').toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
    return rows;
  }, [raw, activeTab, q, moneda, region, horizonte]);


  const favFiltered = useMemo(() => raw.filter(r => favs.includes(r[1])), [raw, favs]);

  const isPortfolio = activeTab === 'Mi Portfolio';
  const isFavoritos = activeTab === 'Favoritos';
  const hasFilters  = q || moneda || region || horizonte || sort;

  const clearFilters = () => { setQ(''); setMoneda(''); setRegion(''); setHorizonte(''); setSort(''); };
  const switchTab = (tab) => { setActiveTab(tab); clearFilters(); };
  const handleLogout = () => { logout(); setActiveTab('Todos'); };
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

      <Tabs raw={raw} activeTab={activeTab} onSwitch={switchTab} />

      {!isPortfolio && (
        <KPIs filtered={isFavoritos ? favFiltered : filtered} />
      )}

      {!isPortfolio && (
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
          <span>⭐ Tus favoritos se guardan solo en este navegador.</span>
          {' '}<a href="#" onClick={e => { e.preventDefault(); window.dispatchEvent(new CustomEvent('cafci:openauth')); }}>Solicitá acceso</a>
          <span> para guardarlos en tu cuenta y acceder desde cualquier dispositivo.</span>
        </div>
      )}

      {isPortfolio ? (
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
          activeTab={activeTab}
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
          onOpenSuscripcion={(fondo, mon) => setSuscModal({ fondo: fondo || '', moneda: mon || 'ARS' })}
          onOpenRescate={(fondo, mon) => setRescModal({ fondo, moneda: mon })}
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
