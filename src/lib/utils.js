export const API_BASE = "https://api-cafci-x8m6.onrender.com";
export const API_URL = API_BASE + "/api/fondos";
export const API_FECHAS = API_BASE + "/api/fechas";

export const REG_MAP = { Arg: "Argentina", Glo: "Global", Latam: "Latam", Bra: "Brasil", Eur: "Europa" };
export const HOR_MAP = { Cor: "Corto", Med: "Mediano", Lar: "Largo", Flex: "Flexible", Sasig: "Sasig" };

// "Código de Clasificación" del Excel de CAFCI → pestaña. Es la forma robusta de agrupar: el
// código no depende de cómo se titule la categoría (con el regex anterior, un renombre de
// título mandaba esos fondos a "Otros" en silencio). Verificado contra la planilla del
// 16/10/2026: 1=Renta Variable, 2=Renta Fija, 3=Mercado de Dinero, 4=Renta Mixta, 5=PyME,
// 6=Retorno Total; 7..10 (Infraestructura, Fondos Cerrados, ASG, RG900) → "Otros".
export const CLASIF_MAP = {
  1: "Renta Variable", 2: "Renta Fija", 3: "Mercado Dinero", 4: "Renta Mixta",
  5: "PyME", 6: "Retorno Total", 7: "Otros", 8: "Otros", 9: "Otros", 10: "Otros",
};

export const TAB_GROUPS = [
  { id: "Todos", label: "Todos", match: () => true },
  { id: "Mercado Dinero", label: "Mercado de Dinero", match: (c) => /mercado de dinero|fondos l[íi]quidos/i.test(c) },
  { id: "Renta Fija", label: "Renta Fija", match: (c) => /^renta fija/i.test(c) },
  { id: "Renta Variable", label: "Renta Variable", match: (c) => /^renta variable/i.test(c) },
  { id: "Renta Mixta", label: "Renta Mixta", match: (c) => /^renta mixta/i.test(c) },
  { id: "Retorno Total", label: "Retorno Total", match: (c) => /^retorno total/i.test(c) },
  { id: "PyME", label: "PyME", match: (c) => /pyme|pymes/i.test(c) },
  { id: "Otros", label: "Otros", match: null },
];

// Acepta la fila completa (usa el Código de Clasificación) o una categoría suelta (compatibilidad)
export function getTabGroup(row) {
  const categoria = typeof row === "string" ? row : (row && row[12]) || "";
  const codigo = typeof row === "object" && row ? row[23] : null;

  if (codigo != null) {
    const grupo = CLASIF_MAP[codigo];
    if (grupo) return grupo;
    console.warn(`[cafci] Código de clasificación desconocido: ${codigo} (categoría "${categoria}")`);
  }

  // Respaldo por nombre de categoría (comportamiento anterior)
  for (const g of TAB_GROUPS) {
    if (g.id === "Todos" || g.match === null) continue;
    if (g.match(categoria)) return g.id;
  }
  return "Otros";
}

export function cnvLink(cnvCode, cafciCode) {
  const q = encodeURIComponent(cafciCode);
  const w = encodeURIComponent(cnvCode);
  return `https://estadisticas.cafci.org.ar/fondos/${q}?clase=${w}`;
}

export function parseFechaAPI(str) {
  if (!str) return null;
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00`);
  const dmy4 = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (dmy4) return new Date(`${dmy4[3]}-${dmy4[2]}-${dmy4[1]}T00:00:00`);
  const dmy2 = str.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (dmy2) return new Date(`20${dmy2[3]}-${dmy2[2]}-${dmy2[1]}T00:00:00`);
  return null;
}

export function fmtMoney(v, mon) {
  if (v === null || isNaN(v)) return "—";
  const pfx = mon === "ARS" ? "$" : "U$S ";
  const a = Math.abs(v);
  if (a >= 1e9) return pfx + (v / 1e9).toFixed(2) + "MM";
  if (a >= 1e6) return pfx + (v / 1e6).toFixed(2) + "M";
  if (a >= 1e3) return pfx + (v / 1e3).toFixed(1) + "K";
  return pfx + v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtPat(v) {
  if (v === null || v === undefined) return "—";
  const n = parseFloat(v);
  if (isNaN(n) || n <= 0) return "—";
  if (n >= 1e12) return "$" + (n / 1e12).toFixed(2) + "B";
  if (n >= 1e9) return "$" + (n / 1e9).toFixed(2) + "MM";
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
  return "$" + n.toLocaleString("es-AR");
}

export function fmtPct(v, d = 2) {
  if (v === null || v === undefined || isNaN(v)) return null;
  return { value: parseFloat(v), display: (parseFloat(v) > 0 ? "+" : "") + parseFloat(v).toFixed(d) + "%" };
}

export function formatFechaLabel(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// Aviso flotante para mostrar errores en pantalla. Existe porque varias operaciones contra
// Supabase fallaban en silencio (sin `error` chequeado) y el usuario no se enteraba.
export function toast(msg) {
  if (typeof document === "undefined") return;
  let el = document.getElementById("cafci-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "cafci-toast";
    el.style.cssText =
      "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:9999;" +
      "max-width:min(560px,92vw);padding:10px 16px;border-radius:8px;font-size:13px;line-height:1.4;" +
      "background:#7f1d1d;color:#fff;border:1px solid #ef4444;text-align:center;" +
      "box-shadow:0 6px 20px rgba(0,0,0,.35);transition:opacity .25s";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = "1";
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.style.opacity = "0"; }, 6000);
}
