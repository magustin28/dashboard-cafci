import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/useAuth';
import { IconChevronDown, IconLogIn, IconLogOut, IconChartColumn } from './Icons';

/**
 * Bloque de sesión del header: si hay usuario muestra el avatar + nombre con su menú
 * desplegable; si no, el botón "Ingresar".
 *
 * El estado del menú (menuOpen), su ref y el cierre por clic fuera viven acá: el Header
 * no necesita saber nada del menú. Lo único que viene de afuera es onOpenAuth, porque el
 * AuthModal se monta en el Header (para que también lo abra el evento cafci:openauth).
 *
 * Props:
 *   onOpenAuth  función que abre el modal de login
 */
export default function UserMenu({ onOpenAuth }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const menuRef = useRef(null);

  // Cerrar el menú al hacer clic fuera de él.
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Nombre visible: el de Google si existe (user_metadata.full_name) y si no el del email.
  const label = user?.nombre || user?.email?.split('@')[0] || '';

  // Iniciales para el celular ("Augusto Martinez" → "AM"): ahí el botón ocupa un tercio de la fila
  // y no entra el nombre completo, así que se muestran avatar + iniciales. Ver styles/utils.css.
  const iniciales = label.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

  return (
    <div className="auth-wrap" ref={menuRef}>
      {user ? (
        <>
          <button className="btn-auth logged-in" onClick={() => setMenuOpen(o => !o)}>
            {/* Foto real de Google; si el proveedor no la manda, queda la inicial de siempre.
                referrerPolicy="no-referrer": las URLs de lh3.googleusercontent.com no cargan
                si el navegador manda el header Referer. */}
            {user.avatar
              ? <img className="auth-avatar" src={user.avatar} alt="" referrerPolicy="no-referrer" />
              : <span className="auth-avatar">{label[0]?.toUpperCase()}</span>}
            {/* Nombre completo en escritorio; en el celular sólo las iniciales (avatar + iniciales). */}
            <span className="auth-nombre">{label}</span>
            <span className="auth-iniciales">{iniciales}</span>
            <span className="auth-arrow"><IconChevronDown size={11} /></span>
          </button>
          {menuOpen && (
            <div className="user-menu open">
              <div className="user-menu-header">
                <strong>{label}</strong>{user.email}
              </div>
              <button className="user-menu-item" onClick={() => { setMenuOpen(false); window.dispatchEvent(new CustomEvent('cafci:tab', { detail: 'Mi Portfolio' })); }}>
                <IconChartColumn size={13} /> Mi Portfolio
              </button>
              <button className="user-menu-item danger" onClick={() => { setMenuOpen(false); logout(); window.dispatchEvent(new CustomEvent('cafci:logout')); }}>
                <IconLogOut size={13} /> Cerrar sesión
              </button>
            </div>
          )}
        </>
      ) : (
        <button className="btn-auth" onClick={onOpenAuth}>
          <IconLogIn size={13} /> Ingresar
        </button>
      )}
    </div>
  );
}
