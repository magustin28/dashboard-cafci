import { parseFechaAPI } from "./utils.js";

// ── Lógica de "Mi Portfolio" ────────────────────────────────────────────────────────────────
// Antes vivía toda dentro de PortfolioTab.jsx (~90 líneas entre el filtro y el cálculo de TNA).
// Son funciones puras: reciben las suscripciones y la planilla y devuelven las posiciones listas
// para pintar. Sacarlas del componente deja la vista con el JSX y permite probarlas sin render.

/** Filtros propios de la pestaña: buscador por nombre del fondo + moneda. */
export function filtrarCartera(portfolio, { q, moneda } = {}) {
  const texto = (q || "").trim().toLowerCase();
  return portfolio.filter((i) => {
    if (moneda && i.moneda !== moneda) return false;
    if (texto && !i.fondo_nombre.toLowerCase().includes(texto)) return false;
    return true;
  });
}

/**
 * Agrupa las suscripciones del mismo fondo (mismo nombre + moneda) en una sola posición.
 * Precio promedio ponderado de cada grupo:
 *  - precio_compra: sobre las cuotapartes DISPONIBLES → es la base de costo FIFO (no se toca)
 *  - precio_suscripcion: lo que se MUESTRA en la tabla. Si ya no quedan cuotapartes (posición
 *    totalmente rescatada) usa el ponderado de lo COMPRADO, para que no quede en 0.
 */
export function agruparCartera(portfolio) {
  const grouped = {};
  portfolio.forEach((item) => {
    const key = `${item.fondo_nombre}__${item.moneda}`;
    if (!grouped[key]) {
      grouped[key] = {
        ...item,
        _suscripciones: [],
        cuotapartes_disponibles: 0,
        _cpPonderadoNum: 0, // Σ (cuotapartes disponibles × precio) → ponderado de lo que TENÉS
        _cantComprada: 0, // Σ cantidad (lo comprado original: no baja con los rescates)
        _cantPonderadaNum: 0, // Σ (cantidad × precio) → ponderado de lo COMPRADO
        fecha_compra: null,
      };
    }
    const cp = parseFloat(item.cuotapartes_disponibles);
    const precio = parseFloat(item.precio_compra);
    const cant = parseFloat(item.cantidad);
    grouped[key].cuotapartes_disponibles += cp;
    grouped[key]._cpPonderadoNum += cp * precio;
    if (!isNaN(cant)) {
      grouped[key]._cantComprada += cant;
      grouped[key]._cantPonderadaNum += cant * precio;
    }
    grouped[key]._suscripciones.push(item);
  });

  return Object.values(grouped).map((g) => {
    const cpTotal = g.cuotapartes_disponibles;
    const precioPond = cpTotal > 0 ? g._cpPonderadoNum / cpTotal : 0;
    const precioPondComprado = g._cantComprada > 0 ? g._cantPonderadaNum / g._cantComprada : 0;
    return {
      ...g,
      precio_compra: precioPond,
      precio_suscripcion: cpTotal > 0 ? precioPond : precioPondComprado,
    };
  });
}

/**
 * Enriquece cada posición con su fila de la planilla (match por nombre) y los cálculos de
 * rendimiento. TNA/TEM/TEA se ponderan por cuotapartes de cada suscripción individual; si la
 * posición no trae el detalle de suscripciones se usa el fallback con fecha_compra.
 */
export function enriquecerCartera(portfolio, raw, apiFecha) {
  const fechaAPI = parseFechaAPI(apiFecha);
  return agruparCartera(portfolio)
    .sort((a, b) => a.fondo_nombre.localeCompare(b.fondo_nombre, "es"))
    .map((item) => {
      const match = raw.find((r) => r.fondo === item.fondo_nombre);
      // Costo basado en cuotapartes DISPONIBLES (refleja la posición actual tras los rescates)
      const cpDisponibles = parseFloat(item.cuotapartes_disponibles);
      const costoTotal = cpDisponibles * parseFloat(item.precio_compra);
      const valorMilCp = match ? parseFloat(match.valor) : null;
      const precioActual = valorMilCp !== null && !isNaN(valorMilCp) ? valorMilCp / 1000 : null;
      const vActual = precioActual !== null ? cpDisponibles * precioActual : null;
      const rendPct = vActual !== null && costoTotal > 0 ? ((vActual - costoTotal) / costoTotal) * 100 : null;
      const varDiariaPct = match ? parseFloat(match.valorVarPct) : null;
      const rendImporte = vActual !== null ? Math.round((vActual - costoTotal) * 100) / 100 : null;
      // TNA/TEM/TEA ponderadas por cuotapartes de cada suscripción individual
      let tna = null,
        tem = null,
        tea = null;
      if (vActual !== null && precioActual !== null && costoTotal > 0 && fechaAPI && item._suscripciones?.length) {
        let sumCp = 0,
          sumTna = 0,
          sumTem = 0,
          sumTea = 0;
        item._suscripciones.forEach((susc) => {
          const cp = parseFloat(susc.cuotapartes_disponibles);
          if (cp <= 0.000001 || !susc.fecha_compra) return;
          const dias = Math.round((fechaAPI - new Date(susc.fecha_compra + "T00:00:00")) / (1000 * 60 * 60 * 24));
          if (dias <= 0) return;
          const costo_i = cp * parseFloat(susc.precio_compra);
          const vActual_i = cp * precioActual;
          const rend_i = vActual_i - costo_i;
          const tna_i = (rend_i / costo_i / dias) * 360 * 100;
          const tea_i = (Math.pow(1 + tna_i / 100 / 365, 365) - 1) * 100;
          const tem_i = (Math.pow(1 + tea_i / 100, 1 / 12) - 1) * 100;
          sumCp += cp;
          sumTna += cp * tna_i;
          sumTem += cp * tem_i;
          sumTea += cp * tea_i;
        });
        if (sumCp > 0) {
          tna = sumTna / sumCp;
          tem = sumTem / sumCp;
          tea = sumTea / sumCp;
        }
      } else if (vActual !== null && costoTotal > 0 && fechaAPI && item.fecha_compra) {
        // Fallback para una suscripción única sin _suscripciones
        const dias = Math.round((fechaAPI - new Date(item.fecha_compra + "T00:00:00")) / (1000 * 60 * 60 * 24));
        if (dias > 0) {
          tna = (rendImporte / costoTotal / dias) * 360 * 100;
          tea = (Math.pow(1 + tna / 100 / 365, 365) - 1) * 100;
          tem = (Math.pow(1 + tea / 100, 1 / 12) - 1) * 100;
        }
      }
      return { ...item, match, costoTotal, precioActual, vActual, rendPct, varDiariaPct, rendImporte, tna, tem, tea };
    });
}

/** Separa las posiciones con tenencia (cuotapartes > 0) de las totalmente rescatadas. */
export function dividirTenencias(enriched) {
  const actual = enriched.filter((i) => parseFloat(i.cuotapartes_disponibles) > 0.000001);
  const historico = enriched.filter((i) => parseFloat(i.cuotapartes_disponibles) <= 0.000001);
  return { actual, historico };
}

/** Totales y porcentajes de rendimiento de la tenencia actual, para las tarjetas KPI. */
export function resumenCartera(tenenciaActual) {
  const totalARS = tenenciaActual.filter((i) => i.moneda === "ARS").reduce((s, i) => s + i.costoTotal, 0);
  const totalUSD = tenenciaActual.filter((i) => i.moneda !== "ARS").reduce((s, i) => s + i.costoTotal, 0);
  const vARS = tenenciaActual.filter((i) => i.moneda === "ARS" && i.vActual !== null).reduce((s, i) => s + i.vActual, 0);
  const vUSD = tenenciaActual.filter((i) => i.moneda !== "ARS" && i.vActual !== null).reduce((s, i) => s + i.vActual, 0);
  const rendARS = tenenciaActual.filter((i) => i.moneda === "ARS" && i.rendImporte !== null).reduce((s, i) => s + i.rendImporte, 0);
  const rendUSD = tenenciaActual.filter((i) => i.moneda !== "ARS" && i.rendImporte !== null).reduce((s, i) => s + i.rendImporte, 0);
  const rendARSpct = totalARS > 0 && vARS > 0 ? ((vARS - totalARS) / totalARS) * 100 : null;
  const rendUSDpct = totalUSD > 0 && vUSD > 0 ? ((vUSD - totalUSD) / totalUSD) * 100 : null;
  const clsARS = rendARS > 0 ? "g" : rendARS < 0 ? "r" : "y";
  const clsUSD = rendUSD > 0 ? "g" : rendUSD < 0 ? "r" : "y";
  return { totalARS, totalUSD, vARS, vUSD, rendARS, rendUSD, rendARSpct, rendUSDpct, clsARS, clsUSD };
}
