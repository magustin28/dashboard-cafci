import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AuthModal({ onClose }) {
  const { login } = useAuth();
  const [mode, setMode]       = useState('login');
  const [email, setEmail]     = useState('');
  const [pass, setPass]       = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const [remember, setRemember] = useState(true);
  // Cerrar con ESC
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const isLogin = mode === 'login';

  const submit = async () => {
    if (!isLogin) return;
    setLoading(true);
    setError('');
    const result = await login(email, pass, remember);
    setLoading(false);
    if (result.ok) {
      onClose();
      window.dispatchEvent(new CustomEvent('cafci:tab', { detail: 'Mi Portafolio' }));
    } else {
      setError(result.msg);
    }
  };

  return (
    <div className="modal-overlay" style={{ display: 'flex' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" data-mode={mode}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="modal-logo">
          <span className="logo-badge" style={{ fontSize: 12, padding: '5px 12px' }}>CAFCI</span>
        </div>
        <h2 className="modal-title">{isLogin ? 'Iniciar sesión' : 'Crear cuenta'}</h2>
        <p className="modal-subtitle">Accedé a tu portafolio personal de FCI</p>

        <div className="modal-field">
          <label>Email</label>
          <input type="email" placeholder="tu@email.com" autoComplete="email"
            value={email} onChange={e => setEmail(e.target.value)}
            disabled={!isLogin} style={{ opacity: isLogin ? 1 : 0.5 }}
            onKeyDown={e => e.key === 'Enter' && submit()} />
        </div>
        <div className="modal-field">
          <label>Contraseña</label>
          <input type="password" placeholder="••••••••" autoComplete="current-password"
            value={pass} onChange={e => setPass(e.target.value)}
            disabled={!isLogin} style={{ opacity: isLogin ? 1 : 0.5 }}
            onKeyDown={e => e.key === 'Enter' && submit()} />
        </div>

        {error && <p className="modal-error" style={{ color: '#ef4444' }}>{error}</p>}
        {isLogin && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 8px' }}>
            <input type="checkbox" id="remember-me" checked={remember} onChange={e => setRemember(e.target.checked)} style={{ cursor: 'pointer', width: 14, height: 14 }} />
            <label htmlFor="remember-me" style={{ fontSize: 13, color: 'var(--text2)', cursor: 'pointer', userSelect: 'none' }}>Recordar sesión</label>
          </div>
        )}

        <button className="modal-submit" onClick={submit}
          disabled={!isLogin || loading}
          style={{ opacity: isLogin ? 1 : 0.5, cursor: isLogin ? 'pointer' : 'not-allowed' }}>
          {loading ? 'Ingresando…' : isLogin ? 'Entrar' : 'Registrarse'}
        </button>

        <p className="modal-toggle">
          {isLogin
            ? <>¿No tenés cuenta? <a href="#" onClick={e => { e.preventDefault(); setMode('register'); setError(''); }}>Registrate</a></>
            : <>¿Ya tenés cuenta? <a href="#" onClick={e => { e.preventDefault(); setMode('login'); setError(''); }}>Iniciá sesión</a></>
          }
        </p>
        {!isLogin && <p className="modal-error" style={{ color: '#ef4444' }}>El registro es privado. Contactá al administrador.</p>}
        <p className="modal-note">Acceso privado. Sesión gestionada con Supabase.</p>
      </div>
    </div>
  );
}
