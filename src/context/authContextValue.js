import { createContext } from 'react';

// El contexto vive en su propio archivo por dos motivos:
//  - AuthContext.jsx sólo exporta el componente (regla react-refresh/only-export-components)
//  - useAuth.js puede importarlo sin crear un ciclo de imports
// Nombre "authContextValue" a propósito: no puede diferir de AuthContext.jsx sólo por
// mayúsculas (Windows es case-insensitive y git se confunde con eso).
export const AuthContext = createContext(null);
