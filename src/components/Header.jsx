import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import AuthModal from './AuthModal';
import { formatFechaLabel } from '../lib/utils';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function Header({ apiFecha, totalFondos, fechas, fechaParam, onReload }) {
  const { user, logout } = useAuth();
  const [showAuth, setShowAuth]       = useState(false);
  const [menuOpen, setMenuOpen]       = useState(false);
  const [pickerOpen, setPickerOpen]   = useState(false);
  const [anioSel, setAnioSel]         = useState(null);

  const menuRef = useRef(null);

  // Agrupar fechas por año y mes
  const grouped = useMemo(() => {
    const map = {};
    fechas.forEach(f => {
      // f viene como YYYY-MM-DD
      const [y, m] = f.split('-');
      if (!map[y]) map[y] = {};
      if (!map[y][m]) map[y][m] = [];
      map[y][m].push(f);
    });
    return map;
  }, [fechas]);

  const anios = useMemo(() => Object.keys(grouped).sort((a, b) => b - a), [grouped]);

  // Seleccionar el año más reciente por defecto
  useEffect(() => {
    if (anios.length && !anioSel) setAnioSel(anios[0]);
  }, [anios]);

  // Cerrar con ESC
  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e) => { if (e.key === 'Escape') setPickerOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [pickerOpen]);

  // Cerrar menu usuario con clic fuera
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const label = user?.email?.split('@')[0] || '';

  const mesesDelAnio = anioSel && grouped[anioSel]
    ? Object.keys(grouped[anioSel]).sort((a, b) => b - a)
    : [];

  return (
    <>
      <header>
        <div className="logo">
          <span className="logo-badge">CAFCI</span>
          <h1>Fondos Comunes de Inversión &mdash; Argentina</h1>
        </div>
        <div className="header-meta">
          <div className="meta-item">
            <span className="meta-dot"></span>
            {fechaParam
              ? <span style={{ color: 'var(--yellow)', fontWeight: 600 }}>📅 Histórico: {formatFechaLabel(fechaParam)}</span>
              : <span>Actualizado: {apiFecha || 'Cargando…'}</span>
            }
          </div>
          {totalFondos > 0 && (
            <div className="meta-item">{totalFondos.toLocaleString('es-AR')} fondos totales</div>
          )}

          {/* Date picker trigger */}
          {fechas.length > 0 && (
            <button className="date-picker-btn" onClick={() => setPickerOpen(true)}>
              📅 Ver fecha anterior <span className="date-arrow">▾</span>
            </button>
          )}

          <button className="btn-refresh" onClick={onReload}>↻ Actualizar</button>

          {/* Auth */}
          <div className="auth-wrap" ref={menuRef}>
            {user ? (
              <>
                <button className="btn-auth logged-in" onClick={() => setMenuOpen(o => !o)}>
                  <span className="auth-avatar">{label[0]?.toUpperCase()}</span>
                  {label} <span className="auth-arrow">▾</span>
                </button>
                {menuOpen && (
                  <div className="user-menu open">
                    <div className="user-menu-header">
                      <strong>{label}</strong>{user.email}
                    </div>
                    <button className="user-menu-item" onClick={() => { setMenuOpen(false); window.dispatchEvent(new CustomEvent('cafci:tab', { detail: 'Mi Portfolio' })); }}>
                      📊 Mi Portfolio
                    </button>
                    <button className="user-menu-item danger" onClick={() => { setMenuOpen(false); logout(); window.dispatchEvent(new CustomEvent('cafci:logout')); }}>
                      ↩ Cerrar sesión
                    </button>
                  </div>
                )}
              </>
            ) : (
              <button className="btn-auth" onClick={() => setShowAuth(true)}>
                <span className="auth-icon">⎆</span> Ingresar
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Modal selector de fecha histórica */}
      {pickerOpen && (
        <div className="modal-overlay" style={{ display: 'flex', zIndex: 700 }}
          onClick={e => { if (e.target === e.currentTarget) setPickerOpen(false); }}>
          <div className="modal" style={{ maxWidth: 520, width: '95vw' }}>
            <button className="modal-close" onClick={() => setPickerOpen(false)}>✕</button>
            <h2 className="modal-title" style={{ marginBottom: 4 }}>📅 Fechas históricas</h2>
            <p className="modal-subtitle">Seleccioná una fecha para ver los datos de ese día</p>

            {/* Selector de año */}
            {anios.length > 1 && (
              <div style={{ display: 'flex', gap: 8, margin: '16px 0 12px' }}>
                {anios.map(a => (
                  <button key={a} onClick={() => setAnioSel(a)}
                    style={{
                      padding: '5px 16px', borderRadius: 20, border: '1px solid var(--border2)',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      background: anioSel === a ? 'var(--accent)' : 'transparent',
                      color: anioSel === a ? '#fff' : 'var(--text2)',
                      transition: 'all 0.15s'
                    }}>
                    {a}
                  </button>
                ))}
              </div>
            )}

            {/* Grilla por mes */}
            <div style={{ maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
              {mesesDelAnio.map(m => (
                <div key={m} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.06em', color: 'var(--text2)', marginBottom: 8 }}>
                    {MESES[parseInt(m, 10) - 1]}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {grouped[anioSel][m].map(f => {
                      const [, , d] = f.split('-');
                      return (
                        <button key={f}
                          onClick={() => { setPickerOpen(false); window.open(`?fecha=${f}`, '_blank'); }}
                          style={{
                            padding: '5px 12px', borderRadius: 6,
                            border: '1px solid var(--border2)',
                            background: 'var(--bg2)', color: 'var(--text)',
                            fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
                            cursor: 'pointer', transition: 'all 0.15s',
                            fontVariantNumeric: 'tabular-nums'
                          }}
                          onMouseOver={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
                          onMouseOut={e => { e.currentTarget.style.background = 'var(--bg2)'; e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border2)'; }}>
                          {d}/{m}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  );
}
