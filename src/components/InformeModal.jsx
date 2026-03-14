import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { sb } from '../lib/supabase';

export default function InformeModal({ enriched, apiFecha, onClose }) {
  const { user } = useAuth();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  // Cerrar con ESC
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);


  useEffect(() => {
    if (!user || !enriched?.length) return;
    (async () => {
      const fondos = enriched.map(i => i.fondo_nombre);
      const [{ data: suscs }, { data: rescates }] = await Promise.all([
        sb.from('suscripciones').select('*')
          .eq('user_id', user.id).in('fondo_nombre', fondos)
          .order('fecha_compra', { ascending: true }),
        sb.from('rescates').select('*, rescate_detalle(*)')
          .eq('user_id', user.id).in('fondo_nombre', fondos)
          .order('fecha_rescate', { ascending: true }),
      ]);
      setData({ suscs: suscs || [], rescates: rescates || [] });
      setLoading(false);
    })();
  }, [user, enriched]);

  const fmtDate   = (d) => { const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; };
  const fmtCp     = (v) => parseFloat(v).toLocaleString('es-AR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  const fmtPrecio = (v) => parseFloat(v).toLocaleString('es-AR', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
  const fmtMon    = (v, mon) => (mon === 'ARS' ? '$ ' : 'U$S ') + Math.abs(parseFloat(v)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtMonSigned = (v, mon) => (parseFloat(v) >= 0 ? '+' : '-') + (mon === 'ARS' ? '$ ' : 'U$S ') + Math.abs(parseFloat(v)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtPct    = (v) => v === null || isNaN(v) ? '—' : (v > 0 ? '+' : '') + parseFloat(v).toFixed(2) + '%';
  const todayRaw  = new Date();
  const today     = String(todayRaw.getDate()).padStart(2,'0') + '/' + String(todayRaw.getMonth()+1).padStart(2,'0') + '/' + todayRaw.getFullYear();
  const fechaData = (() => {
    if (!apiFecha) return today;
    if (apiFecha.includes('-')) {
      const [y, m, d] = apiFecha.split('-');
      return `${d.padStart(2,'0')}/${m.padStart(2,'0')}/${y}`;
    }
    // DD/MM/YY or DD/MM/YYYY — normalize to full year
    const parts = apiFecha.split('/');
    if (parts.length === 3) {
      const yr = parts[2].length === 2 ? '20' + parts[2] : parts[2];
      return `${parts[0].padStart(2,'0')}/${parts[1].padStart(2,'0')}/${yr}`;
    }
    return apiFecha;
  })();

  const handlePrint = () => {
    const el = document.getElementById('informe-content');
    if (!el) return;
    const html = el.innerHTML;
    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Informe Portafolio CAFCI</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; background: white; padding: 16px 20px; font-size: 12px; }
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
  </style>
</head>
<body>${html}</body>
</html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.onafterprint = () => win.close(); }, 600);
  };

  const Logo = () => (
    <svg width="26" height="26" viewBox="0 0 32 32" style={{ verticalAlign: 'middle', marginRight: 6 }}>
      <rect width="32" height="32" rx="6" fill="#16a34a"/>
      <line x1="8" y1="7" x2="8" y2="10" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      <rect x="5.5" y="10" width="5" height="7" rx="1" fill="white" opacity="0.6"/>
      <line x1="8" y1="17" x2="8" y2="21" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="16" y1="8" x2="16" y2="12" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      <rect x="13.5" y="12" width="5" height="9" rx="1" fill="white"/>
      <line x1="16" y1="21" x2="16" y2="25" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="24" y1="5" x2="24" y2="9" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      <rect x="21.5" y="9" width="5" height="12" rx="1" fill="white"/>
      <line x1="24" y1="21" x2="24" y2="26" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );

  const renderInforme = () => {
    if (loading) return <div style={{ textAlign: 'center', padding: 40 }}>Cargando datos…</div>;
    const { suscs, rescates } = data;

    // KPIs
    const totalARS = enriched.filter(i => i.moneda === 'ARS').reduce((s, i) => s + i.costoTotal, 0);
    const totalUSD = enriched.filter(i => i.moneda !== 'ARS').reduce((s, i) => s + i.costoTotal, 0);
    const vARS     = enriched.filter(i => i.moneda === 'ARS' && i.vActual !== null).reduce((s, i) => s + i.vActual, 0);
    const vUSD     = enriched.filter(i => i.moneda !== 'ARS' && i.vActual !== null).reduce((s, i) => s + i.vActual, 0);
    const rendARS  = vARS - totalARS;
    const rendUSD  = vUSD - totalUSD;

    return (
      <div id="informe-content">

        {/* ── Header: título izquierda, logo+nombre derecha ── */}
        <div className="inf-header">
          <div className="inf-meta">
            <div className="inf-title">Informe de Portafolio</div>
            <div className="inf-subtitle">Datos al {fechaData} · Generado el {today} · {user.email}</div>
          </div>
          <div className="inf-logo">
            <Logo /> Dashboard CAFCI
          </div>
        </div>

        {/* ── KPIs: ARS fila 1, USD fila 2, Posiciones al final ── */}
        <div className="inf-section-title">Resumen — {enriched.length} fondos</div>
        <div className="inf-kpis-grid">
          {/* Fila ARS */}
          {totalARS > 0 && (
            <div className="inf-kpis-row">
              <div className="inf-kpi">
                <div className="inf-kpi-label">Invertido ARS</div>
                <div className="inf-kpi-val">{fmtMon(totalARS, 'ARS')}</div>
              </div>
              <div className="inf-kpi">
                <div className="inf-kpi-label">Valor Actual ARS</div>
                <div className="inf-kpi-val" style={{ color: vARS >= totalARS ? '#16a34a' : '#dc2626' }}>{fmtMon(vARS, 'ARS')}</div>
              </div>
              <div className="inf-kpi">
                <div className="inf-kpi-label">Rendimiento ARS</div>
                <div className="inf-kpi-val" style={{ color: rendARS >= 0 ? '#16a34a' : '#dc2626' }}>
                  {fmtMonSigned(rendARS, 'ARS')} ({fmtPct(totalARS > 0 ? rendARS / totalARS * 100 : null)})
                </div>
              </div>
            </div>
          )}
          {/* Fila USD */}
          {totalUSD > 0 && (
            <div className="inf-kpis-row">
              <div className="inf-kpi">
                <div className="inf-kpi-label">Invertido USD</div>
                <div className="inf-kpi-val">{fmtMon(totalUSD, 'USD')}</div>
              </div>
              <div className="inf-kpi">
                <div className="inf-kpi-label">Valor Actual USD</div>
                <div className="inf-kpi-val" style={{ color: vUSD >= totalUSD ? '#16a34a' : '#dc2626' }}>{fmtMon(vUSD, 'USD')}</div>
              </div>
              <div className="inf-kpi">
                <div className="inf-kpi-label">Rendimiento USD</div>
                <div className="inf-kpi-val" style={{ color: rendUSD >= 0 ? '#16a34a' : '#dc2626' }}>
                  {fmtMonSigned(rendUSD, 'USD')} ({fmtPct(totalUSD > 0 ? rendUSD / totalUSD * 100 : null)})
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Posiciones actuales ── */}
        <div className="inf-section-title">Posiciones Actuales</div>
        <table className="inf-table">
          <thead><tr>
            <th style={{ textAlign: 'left' }}>Fondo</th>
            <th>Mon.</th>
            <th>CP Disponibles</th>
            <th>P. Suscrip.</th>
            <th>Importe Suscrip.</th>
            <th>Valor Actual</th>
            <th>Rend. %</th>
            <th>TNA</th>
            <th>TEA</th>
          </tr></thead>
          <tbody>
            {enriched.map(item => (
              <tr key={item.id}>
                <td style={{ textAlign: 'left' }}>{item.fondo_nombre}</td>
                <td style={{ textAlign: 'center' }}>{item.moneda}</td>
                <td>{fmtCp(item.cuotapartes_disponibles)}</td>
                <td>{fmtPrecio(item.precio_compra)}</td>
                <td>{item.costoTotal != null ? fmtMon(item.costoTotal, item.moneda) : '—'}</td>
                <td style={{ color: item.vActual >= item.costoTotal ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                  {item.vActual != null ? fmtMon(item.vActual, item.moneda) : '—'}
                </td>
                <td style={{ color: item.rendPct >= 0 ? '#16a34a' : '#dc2626' }}>{fmtPct(item.rendPct)}</td>
                <td style={{ color: item.tna >= 0 ? '#16a34a' : '#dc2626' }}>{fmtPct(item.tna)}</td>
                <td style={{ color: item.tea >= 0 ? '#16a34a' : '#dc2626' }}>{fmtPct(item.tea)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── Historial por fondo: suscrip + rescates juntos ── */}
        <div className="inf-section-title">Historial por Fondo</div>
        {enriched.map(item => {
          const fondoSuscs   = suscs.filter(s => s.fondo_nombre === item.fondo_nombre);
          const fondoRescates = rescates.filter(r => r.fondo_nombre === item.fondo_nombre);

          return (
            <div key={item.fondo_nombre} className="inf-fondo-block">
              <div className="inf-fondo-name">
                {item.fondo_nombre}
                <span className="inf-mon-badge">{item.moneda}</span>
              </div>

              {/* Suscripciones */}
              <div className="inf-sub-title">Suscripciones</div>
              {fondoSuscs.length === 0
                ? <div className="inf-empty">Sin suscripciones registradas</div>
                : (
                  <table className="inf-table inf-table-susc">
                    <thead><tr>
                      <th style={{ textAlign: 'left' }}>Fecha</th>
                      <th>Cuotapartes</th>
                      <th>P. Suscrip.</th>
                      <th>Importe</th>
                      <th>CP Disponibles</th>
                    </tr></thead>
                    <tbody>
                      {fondoSuscs.map(s => (
                        <tr key={s.id}>
                          <td style={{ textAlign: 'left' }}>{fmtDate(s.fecha_compra)}</td>
                          <td>{fmtCp(s.cantidad)}</td>
                          <td>{fmtPrecio(s.precio_compra)}</td>
                          <td>{fmtMon(parseFloat(s.cantidad) * parseFloat(s.precio_compra), item.moneda)}</td>
                          <td style={{ color: parseFloat(s.cuotapartes_disponibles) > 0 ? '#16a34a' : '#6b7280' }}>
                            {fmtCp(s.cuotapartes_disponibles)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              }

              {/* Rescates — solo si hay */}
              {fondoRescates.length > 0 && (
                <>
                  <div className="inf-sub-title" style={{ marginTop: 10 }}>Rescates</div>
                  <table className="inf-table">
                    <thead><tr>
                      <th style={{ textAlign: 'left' }}>Fecha</th>
                      <th>CP Rescatadas</th>
                      <th>P. Suscrip. Pond.</th>
                      <th>P. Rescate</th>
                      <th>Importe Rescate</th>
                      <th>Importe Suscrip.</th>
                      <th>Gan./Pérd.</th>
                      <th>Rend%</th>
                      <th>Días</th>
                      <th>TNA</th>
                    </tr></thead>
                    <tbody>
                      {fondoRescates.map(r => {
                        const detalles = r.rescate_detalle || [];
                        const totalCp  = detalles.reduce((s, d) => s + parseFloat(d.cuotapartes_consumidas), 0);
                        const precPond = totalCp > 0 ? detalles.reduce((s, d) => s + parseFloat(d.cuotapartes_consumidas) * parseFloat(d.precio_compra), 0) / totalCp : 0;
                        const rendPos  = parseFloat(r.rendimiento) >= 0;
                        const rendPct  = parseFloat(r.costo_total) > 0 ? parseFloat(r.rendimiento) / parseFloat(r.costo_total) * 100 : null;
                        const dias     = detalles.length === 1 ? detalles[0].dias : null;
                        const tna      = dias > 0 ? (parseFloat(r.rendimiento) / parseFloat(r.costo_total)) / dias * 360 * 100 : null;
                        return (
                          <tr key={r.id}>
                            <td style={{ textAlign: 'left' }}>{fmtDate(r.fecha_rescate)}</td>
                            <td>{fmtCp(r.cuotapartes_rescatadas)}</td>
                            <td>{fmtPrecio(precPond)}</td>
                            <td>{fmtPrecio(r.precio_rescate)}</td>
                            <td>{fmtMon(r.importe_venta, item.moneda)}</td>
                            <td>{fmtMon(r.costo_total, item.moneda)}</td>
                            <td style={{ color: rendPos ? '#16a34a' : '#dc2626' }}>
                              {rendPos ? '+' : ''}{fmtMon(r.rendimiento, item.moneda)}
                            </td>
                            <td style={{ color: rendPos ? '#16a34a' : '#dc2626' }}>{fmtPct(rendPct)}</td>
                            <td style={{ textAlign: 'center' }}>{dias ?? '—'}</td>
                            <td style={{ color: tna >= 0 ? '#16a34a' : '#dc2626' }}>{fmtPct(tna)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          );
        })}

        <div className="inf-footer">
          Informe generado automáticamente por Dashboard CAFCI · {today} · Los datos corresponden a información provista por CAFCI.
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="modal-overlay informe-overlay" style={{ display: 'flex', alignItems: 'flex-start', overflowY: 'auto', padding: '20px' }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="informe-modal" style={{ maxWidth: 1200 }}>
          <div className="informe-actions no-print">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Previsualización del informe</span>
              {loading && <span style={{ fontSize: 12, color: 'var(--text2)' }}>Cargando datos…</span>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-informe-print" onClick={handlePrint} disabled={loading}>
                🖨 Imprimir / Guardar PDF
              </button>
              <button className="modal-close" style={{ position: 'static', fontSize: 16 }} onClick={onClose}>✕</button>
            </div>
          </div>
          <div className="informe-paper">
            {renderInforme()}
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          #root > * { display: none !important; }
          #root .informe-overlay { display: block !important; }
          .informe-overlay {
            position: static !important;
            background: none !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          .informe-modal {
            box-shadow: none !important;
            border: none !important;
            max-width: 100% !important;
            border-radius: 0 !important;
          }
          .no-print { display: none !important; }
          .informe-paper {
            padding: 16px !important;
            box-shadow: none !important;
            background: white !important;
            color: black !important;
          }
          .inf-table { font-size: 9px !important; }
          .inf-table th, .inf-table td { padding: 4px 5px !important; }
          .inf-fondo-block { page-break-inside: avoid; }
          .inf-section-title { page-break-after: avoid; }
          .inf-kpi-val { font-size: 13px !important; }
        }
      `}</style>
    </>
  );
}
