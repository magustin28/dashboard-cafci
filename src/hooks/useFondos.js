import { useState, useCallback } from 'react';
import { API_BASE, API_URL, API_FECHAS } from '../lib/utils';

const CACHE_KEY   = 'cafci_data_cache';
const CACHE_FECHA = 'cafci_data_fecha';

function saveCache(rows, fecha, refs) {
  try {
    sessionStorage.setItem(CACHE_KEY,   JSON.stringify({ rows, fecha, refs }));
    sessionStorage.setItem(CACHE_FECHA, fecha || '');
  } catch {}
}

function loadCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function useFondos() {
  const cached = loadCache();
  // Si hay fechaParam en la URL (consulta histórica), ignorar el cache
  const hasFechaParam = !!new URLSearchParams(window.location.search).get('fecha');
  const useCache = cached && !hasFechaParam;
  const [raw, setRaw]           = useState(useCache ? cached.rows : []);
  const [apiFecha, setApiFecha] = useState(useCache ? cached.fecha : null);
  const [fechas, setFechas]     = useState([]);
  const [loading, setLoading]   = useState(!useCache);
  const [error, setError]       = useState(null);
  const [refs, setRefs]         = useState(useCache ? cached.refs : {});

  const loadFechas = useCallback(async () => {
    try {
      const res  = await fetch(API_FECHAS);
      const data = await res.json();
      setFechas(data.slice(0, -1).reverse());
    } catch (e) {
      console.warn('No se pudieron cargar fechas:', e);
    }
  }, []);

  const fetchData = useCallback(async (fechaParam = null) => {
    const MAX = 3;
    const url = fechaParam ? `${API_BASE}/api/fondos/${fechaParam}` : API_URL;

    // Use cache on reload (only for main page, not historical)
    if (!fechaParam && cached) {
      setLoading(false);
      loadFechas();
      return;
    }

    setLoading(true);
    setError(null);

    for (let attempt = 1; attempt <= MAX; attempt++) {
      try {
        const res  = await fetch(url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();

        const r = data.datos.referencias;
        // Detectar fecha anterior (clave tipo "Patrimonio_DD/MM/YY")
        const patrimonioKeys = Object.keys(data.datos.listado_fondos?.[0]?.fondos?.[0] || {})
          .filter(k => k.startsWith('Patrimonio_') && k !== 'Patrimonio_Actual');
        const fechaAnterior = patrimonioKeys.length > 0
          ? patrimonioKeys[0].replace('Patrimonio_', '')
          : '';
        // Calcular fecha inicio de año: 01/01/YY donde YY = año de variacion_fecha2 + 1
        const fechaInicioAnio = (() => {
          const f2 = r.variacion_fecha2 || '';
          const parts = f2.split('/');
          if (parts.length === 3) {
            const yr = parseInt(parts[2], 10) + 1;
            return `01/01/${String(yr).padStart(2,'0')}`;
          }
          return '01/01/26';
        })();

        const newRefs = {
          fecha1: r.variacion_fecha1,
          fecha2: r.variacion_fecha2,
          fecha3: r.variacion_fecha3,
          fechaAnterior,
          fechaInicioAnio,
        };
        setRefs(newRefs);
        setApiFecha(data.fecha || null);

        const rows = [];
        (data.datos.listado_fondos || []).forEach((cat) => {
          const catNombre = cat.categoria_fondo || '';
          (cat.fondos || []).forEach((f) => {
            rows.push([
              f['Codigo CNV']                              || '',   // [0]
              f['Fondo']                                   || '',   // [1]
              f['Moneda Fondo']                            || '',   // [2]
              f['Clasificación_Región']                    || '',   // [3]
              f['Clasificación_Horizonte']                 || '',   // [4]
              f[`Variacion cuotaparte %_${r.variacion_fecha1}`] ?? null, // [5]
              f[`Variacion cuotaparte %_${r.variacion_fecha2}`] ?? null, // [6]
              f[`Variacion cuotaparte %_${r.variacion_fecha3}`] ?? null, // [7]
              null,                                                 // [8]
              f['Patrimonio_Actual']                       ?? null, // [9]
              null,                                                 // [10]
              f['Sociedad Gerente']                        || '',   // [11]
              catNombre,                                            // [12]
              f['Código CAFCI']                            || '',   // [13]
              f['Valor (mil cuotapartes)_Actual']          ?? null, // [14]
              f['Valor (mil cuotapartes)_Variac. %']       ?? null, // [15]
              // ── campos para el panel de detalle ──
              f['Sociedad Depositaria']                    || '',   // [16]
              f['Honorarios Adm. SD']                     ?? null, // [17]
              f['Honorarios Adm. SG']                     ?? null, // [18]
              f['Mínimo de Inversión']                    ?? null, // [19]
              f[`Patrimonio_${fechaAnterior}`]  ?? null, // [20] patrimonio anterior
              f[`Valor (mil cuotapartes)_${fechaAnterior}`] ?? null, // [21] valor anterior
              f['Valor (mil cuotapartes)_Reexp.Pesos']    ?? null, // [22]
            ]);
          });
        });

        setRaw(rows);
        setLoading(false);
        if (!fechaParam) {
          saveCache(rows, data.fecha, newRefs);
          loadFechas();
        }
        return;
      } catch (e) {
        if (attempt === MAX) {
          setError(e.message);
          setLoading(false);
        } else {
          await new Promise(r => setTimeout(r, 2500 * attempt));
        }
      }
    }
  }, [loadFechas]);

  // Force refresh ignores cache
  const forceRefresh = useCallback(async (fechaParam = null) => {
    sessionStorage.removeItem(CACHE_KEY);
    sessionStorage.removeItem(CACHE_FECHA);
    setLoading(true);
    await fetchData(fechaParam);
  }, [fetchData]);

  return { raw, apiFecha, fechas, loading, error, refs, fetchData, forceRefresh };
}
