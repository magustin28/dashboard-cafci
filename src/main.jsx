import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from './context/AuthContext'
import App from './App.jsx'

// ── Estilos divididos por módulo ──
import './styles/base.css'        // variables, reset, tipografía
import './styles/layout.css'      // header, kpis, tabs, filter-bar
import './styles/auth.css'        // auth button, user menu, favs banner
import './styles/buttons.css'     // portfolio action buttons
import './styles/modals.css'      // historial, rescate, FAB, modal base
import './styles/portfolio.css'   // portfolio table
import './styles/table.css'       // table, badges, fav, cnv, empty
import './styles/pagination.css'  // paginación
import './styles/utils.css'       // animaciones, date picker, skeleton, error
import './styles/informe.css'     // informe modal / PDF

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)

// ── PWA: service worker ──
// Sólo en producción: en dev el SW cachearía el HTML y pelearía con el HMR de Vite (recargás y seguís
// viendo la versión cacheada). El archivo (public/sw.js) sale al build con el precache inyectado por
// scripts/pwa-precache.mjs, y BASE_URL es el base de vite.config.js → /dashboard-cafci/sw.js.
// Si el registro falla, la app sigue funcionando igual: la PWA es una mejora, no un requisito.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch((err) => console.warn('No se pudo registrar el service worker:', err));
  });
}
