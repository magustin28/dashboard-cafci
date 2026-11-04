// Generación del PDF del informe: abre una ventana nueva con el HTML ya renderizado en pantalla
// (#informe-content) y su propia hoja de estilos de impresión. Vivía dentro de InformeModal y
// ocupaba ~50 líneas del componente; acá queda separada del estado y del JSX.
//
// No usa el service worker ni librerías: window.open + document.write sobre una ventana en blanco.
// El usuario imprime/guarda desde el diálogo del navegador (Ctrl+P / "Guardar como PDF").

const ESTILOS_PDF = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; background: white; padding: 24px 32px; font-size: 12px; }
    .inf-header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 16px; border-bottom: 3px solid #16a34a; margin-bottom: 24px; }
    .inf-title { font-size: 20px; font-weight: 700; }
    .inf-subtitle { font-size: 11px; color: #6b7280; margin-top: 3px; }
    .inf-logo { font-size: 15px; font-weight: 700; display: flex; align-items: center; gap: 6px; }
    .inf-section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #16a34a; border-bottom: 2px solid #dcfce7; padding-bottom: 4px; margin: 22px 0 12px; page-break-after: avoid; }
    .inf-kpis-grid { display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px; }
    .inf-kpis-row { display: flex; gap: 10px; }
    .inf-kpi { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 14px; min-width: 150px; }
    .inf-kpi-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; font-weight: 600; margin-bottom: 3px; }
    .inf-kpi-val { font-size: 14px; font-weight: 700; }
    .inf-table { width: 100%; border-collapse: collapse; font-size: 8.5px; margin-bottom: 6px; }
    .inf-table thead th { background: #f3f4f6; color: #374151; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; padding: 5px 7px; text-align: right; white-space: nowrap; border-bottom: 2px solid #e5e7eb; }
    .inf-table thead th:first-child { text-align: left; }
    .inf-table tbody tr { border-bottom: 1px solid #f3f4f6; }
    .inf-table tbody tr:last-child { border-bottom: 2px solid #e5e7eb; }
    .inf-table td { padding: 5px 7px; text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; color: #374151; }
    .inf-table td:first-child { text-align: left; }
    .inf-table-susc { width: auto !important; display: inline-block; }
    .inf-table-susc thead th { padding: 5px 16px 5px 10px; }
    .inf-table-susc td { padding: 5px 16px 5px 10px; }
    .inf-fondo-block { margin-bottom: 14px; page-break-inside: avoid; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 12px; }
    .inf-fondo-name { font-size: 12px; font-weight: 600; margin-bottom: 5px; display: flex; align-items: center; gap: 7px; }
    .inf-mon-badge { font-size: 9px; font-weight: 700; background: #dcfce7; color: #16a34a; border-radius: 3px; padding: 1px 5px; }
    .inf-sub-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin: 7px 0 4px; }
    .inf-empty { font-size: 11px; color: #9ca3af; padding: 6px 0; font-style: italic; }
    .inf-footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 9px; color: #9ca3af; text-align: center; }
    @media print {
      body { padding: 0; }
      .inf-fondo-block { page-break-inside: avoid; }
      .inf-section-title { page-break-after: avoid; }
    }
`;

/**
 * Abre el informe en una ventana nueva lista para imprimir o guardar como PDF.
 * Devuelve false si no hay contenido renderizado o el navegador bloqueó la ventana.
 */
export function abrirInformePDF(id = "informe-content") {
  const el = document.getElementById(id);
  if (!el) return false;
  const html = el.innerHTML;
  const win = window.open("", "_blank");
  if (!win) return false;
  win.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Informe Portafolio CAFCI</title>
  <style>${ESTILOS_PDF}</style>
</head>
<body>${html}</body>
</html>`);
  win.document.close();
  win.focus();
  return true;
}
