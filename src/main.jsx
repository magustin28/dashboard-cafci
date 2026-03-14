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
