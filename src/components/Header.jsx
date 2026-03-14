import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import AuthModal from './AuthModal';
import { formatFechaLabel } from '../lib/utils';

export default function Header({ apiFecha, totalFondos, fechas, fechaParam, onReload }) {
  const { user, logout } = useAuth();
  const [showAuth, setShowAuth]     = useState(false);
  const [menuOpen, setMenuOpen]     = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const pickerRef = useRef(null);
  const menuRef   = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(false);
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const label = user?.email?.split('@')[0] || '';

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

          {/* Date picker */}
          {fechas.length > 0 && (
            <div className="date-picker-wrap" ref={pickerRef}>
              <button className="date-picker-btn" onClick={() => setPickerOpen(o => !o)}>
                📅 Ver fecha anterior <span className="date-arrow">▾</span>
              </button>
              {pickerOpen && (
                <div className="date-picker-dropdown open">
                  {fechas.map(f => (
                    <div key={f} className="date-option"
                      onClick={() => { setPickerOpen(false); window.open(`?fecha=${f}`, '_blank'); }}>
                      {formatFechaLabel(f)}
                    </div>
                  ))}
                </div>
              )}
            </div>
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

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  );
}
