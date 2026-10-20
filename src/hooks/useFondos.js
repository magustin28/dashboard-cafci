import { useState, useCallback } from "react";
import { API_BASE, API_URL, API_FECHAS } from "../lib/utils";

// v3: las filas pasaron de array posicional a OBJETO con nombres estables, y se sumó plazoLiq
const CACHE_KEY = "cafci_data_cache_v3";
const CACHE_FECHA = "cafci_data_fecha_v3";

// Nombres estables → encabezado en el Excel (sólo para la respuesta completa / respaldo)
const EXCEL = {
  cnv: "Codigo CNV",
  fondo: "Fondo",
  moneda: "Moneda Fondo",
  region: "Clasificación_Región",
  horizonte: "Clasificación_Horizonte",
  patrimonio: "Patrimonio_Actual",
  socGerente: "Sociedad Gerente",
  cafci: "Código CAFCI",
  valor: "Valor (mil cuotapartes)_Actual",
  valorVarPct: "Valor (mil cuotapartes)_Variac. %",
  socDepositaria: "Sociedad Depositaria",
  honSD: "Honorarios Adm. SD",
  honSG: "Honorarios Adm. SG",
  minimoInversion: "Mínimo de Inversión",
  valorReexp: "Valor (mil cuotapartes)_Reexp.Pesos",
  clasificacion: "Código de Clasificación",
  plazoLiq: "Plazo Liq.",
};

// Los que llevan la fecha de referencia dentro de la clave (sólo en el formato completo)
const EXCEL_CON_FECHA = {
  varMes:        (r) => `Variacion cuotaparte %_${r.variacion_fecha1}`,
  varAnio:       (r) => `Variacion cuotaparte %_${r.variacion_fecha2}`,
  varAnual:      (r) => `Variacion cuotaparte %_${r.variacion_fecha3}`,
  patrimonioAnt: (r) => `Patrimonio_${r.patrimonio_fecha_anterior}`,
  valorAnt:      (r) => `Valor (mil cuotapartes)_${r.valor_fecha_anterior}`,
};

function saveCache(rows, fecha, refs) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ rows, fecha, refs }));
    sessionStorage.setItem(CACHE_FECHA, fecha || "");
  } catch (e) {
    console.warn("[cafci] no se pudo cachear en sessionStorage:", e);
  }
}

function loadCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function useFondos() {
  const cached = loadCache();
  // Si hay fechaParam en la URL (consulta histórica), ignorar el cache
  const hasFechaParam = !!new URLSearchParams(window.location.search).get("fecha");
  const useCache = cached && !hasFechaParam;
  const [raw, setRaw] = useState(useCache ? cached.rows : []);
  const [apiFecha, setApiFecha] = useState(useCache ? cached.fecha : null);
  const [fechas, setFechas] = useState([]);
  const [loading, setLoading] = useState(!useCache);
  const [error, setError] = useState(null);
  const [refs, setRefs] = useState(useCache ? cached.refs : {});

  const loadFechas = useCallback(async () => {
    try {
      const res = await fetch(API_FECHAS);
      const data = await res.json();
      setFechas(data.slice(0, -1).reverse());
    } catch (e) {
      console.warn("No se pudieron cargar fechas:", e);
    }
  }, []);

  const fetchData = useCallback(
    async (fechaParam = null) => {
      const MAX = 7;
      // ?fields=slim → 22 campos con nombres estables (ver README de la API)
      const url = fechaParam
        ? `${API_BASE}/api/fondos/${fechaParam}?fields=slim`
        : `${API_URL}?fields=slim`;

      // Use cache on reload (only for main page, not historical)
      if (!fechaParam && loadCache()) {
        setLoading(false);
        loadFechas();
        return;
      }

      setLoading(true);
      setError(null);

      for (let attempt = 1; attempt <= MAX; attempt++) {
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error("HTTP " + res.status);
          const data = await res.json();

          const r = data.datos.referencias || {};
          // En la respuesta slim, `campos` trae el orden de los 22 valores de cada fondo
          const campos = data.datos.campos;
          const pos = campos ? Object.fromEntries(campos.map((c, i) => [c, i])) : null;

          // Lee un campo de un fondo: por posición (slim) o por el encabezado del Excel
          // (respuesta completa). Así el cliente funciona con las dos versiones de la API.
          const leer = (f, nombre) => {
            if (pos) return f[pos[nombre]] ?? null;
            const clave = EXCEL[nombre] || (EXCEL_CON_FECHA[nombre] && EXCEL_CON_FECHA[nombre](r));
            return clave ? f[clave] ?? null : null;
          };

          // Fecha anterior: en slim ya viene en `referencias`; en el formato completo se
          // deduce de la clave tipo "Patrimonio_DD/MM/YY"
          const fechaAnterior = r.patrimonio_fecha_anterior
            || (Object.keys(data.datos.listado_fondos?.[0]?.fondos?.[0] || {})
                  .find((k) => k.startsWith("Patrimonio_") && k !== "Patrimonio_Actual") || "")
                 .replace("Patrimonio_", "");

          // Calcular fecha inicio de año: 01/01/YY donde YY = año de variacion_fecha2 + 1
          const fechaInicioAnio = (() => {
            const f2 = r.variacion_fecha2 || "";
            const parts = f2.split("/");
            if (parts.length === 3) {
              const yr = parseInt(parts[2], 10) + 1;
              return `01/01/${String(yr).padStart(2, "0")}`;
            }
            return "01/01/26";
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

          // Las filas son OBJETOS con nombres estables (los mismos 22 del payload slim + la
          // categoría). Así ninguna parte de la UI depende de posiciones ni del Excel.
          const rows = [];
          (data.datos.listado_fondos || []).forEach((cat) => {
            const categoria = cat.categoria_fondo || "";
            (cat.fondos || []).forEach((f) => {
              rows.push({
                cnv:             leer(f, "cnv") || "",
                fondo:           leer(f, "fondo") || "",
                moneda:          leer(f, "moneda") || "",
                region:          leer(f, "region") || "",
                horizonte:       leer(f, "horizonte") || "",
                varMes:          leer(f, "varMes"),
                varAnio:         leer(f, "varAnio"),
                varAnual:        leer(f, "varAnual"),
                patrimonio:      leer(f, "patrimonio"),
                socGerente:      leer(f, "socGerente") || "",
                cafci:           leer(f, "cafci") || "",
                valor:           leer(f, "valor"),
                valorVarPct:     leer(f, "valorVarPct"),
                // ── campos para el panel de detalle ──
                socDepositaria:  leer(f, "socDepositaria") || "",
                honSD:           leer(f, "honSD"),
                honSG:           leer(f, "honSG"),
                minimoInversion: leer(f, "minimoInversion"),
                patrimonioAnt:   leer(f, "patrimonioAnt"),
                valorAnt:        leer(f, "valorAnt"),
                valorReexp:      leer(f, "valorReexp"),
                clasificacion:   leer(f, "clasificacion"),
                plazoLiq:        leer(f, "plazoLiq"),
                categoria,
              });
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
            // El cold start de Render puede tardar ~1 min: backoff más largo que antes (2,5s/5s)
            await new Promise((r) => setTimeout(r, Math.min(3000 * attempt, 15000)));
          }
        }
      }
    },
    [loadFechas],
  );

  // Force refresh ignores cache
  const forceRefresh = useCallback(
    async (fechaParam = null) => {
      sessionStorage.removeItem(CACHE_KEY);
      sessionStorage.removeItem(CACHE_FECHA);
      setLoading(true);
      await fetchData(fechaParam);
    },
    [fetchData],
  );

  return { raw, apiFecha, fechas, loading, error, refs, fetchData, forceRefresh };
}
