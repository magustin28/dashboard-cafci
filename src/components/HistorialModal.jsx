import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { sb } from '../lib/supabase';

export default function HistorialModal({ fondoNombre, moneda, onOpenSuscripcion, onOpenRescate, onClose }) {
  const { user } = useAuth();
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState({});
  const [editSusc, setEditSusc] = useState(null);   // { id, fecha_compra, cantidad, precio_compra }
  const [editResc, setEditResc] = useState(null);   // { id, fecha_rescate, precio_rescate }
  const [saving, setSaving]     = useState(false);

  // Cerrar con ESC
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') { if (editSusc || editResc) { setEditSusc(null); setEditResc(null); } else onClose(); } };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, editSusc, editResc]);

  const reload = async () => {
    if (!user) return;
    const [{ data: suscs }, { data: rescates }] = await Promise.all([
      sb.from('suscripciones').select('*').eq('user_id', user.id).eq('fondo_nombre', fondoNombre).order('fecha_compra', { ascending: true }),
      sb.from('rescates').select('*, rescate_detalle(*)').eq('user_id', user.id).eq('fondo_nombre', fondoNombre).order('fecha_rescate', { ascending: true }),
    ]);
    setData({ suscs: suscs || [], rescates: rescates || [] });
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      await reload();
      setLoading(false);
    })();
  }, [user, fondoNombre]);

  const fmtDate   = (d) => { const [y, m, day] = d.split('-'); return `${day}/${m}/${y.slice(2)}`; };
  const fmtCp     = (v) => parseFloat(v).toLocaleString('es-AR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  const fmtPrecio = (v) => parseFloat(v).toLocaleString('es-AR', { minimumFractionDigits: 4, maximumFractionDigits: 6 });

  // ── Acciones suscripciones ──────────────────────────────────────
  const deleteSusc = async (id) => {
    if (!confirm('¿Eliminar esta suscripción? Esta acción es irreversible.')) return;
    await sb.from('suscripciones').delete().eq('id', id).eq('user_id', user.id);
    await reload();
  };

  const saveSusc = async () => {
    if (!editSusc) return;
    setSaving(true);
    const cant  = parseFloat(editSusc.cantidad);
    const prec  = parseFloat(editSusc.precio_compra);
    await sb.from('suscripciones').update({
      fecha_compra:  editSusc.fecha_compra,
      cantidad:      cant,
      precio_compra: prec,
      // Mantenemos cuotapartes_disponibles proporcional si cambió la cantidad
    }).eq('id', editSusc.id).eq('user_id', user.id);
    setSaving(false);
    setEditSusc(null);
    await reload();
  };

  // ── Acciones rescates ───────────────────────────────────────────
  const deleteResc = async (id) => {
    if (!confirm('¿Eliminar este rescate? Esta acción es irreversible y no restaura las cuotapartes.')) return;
    await sb.from('rescate_detalle').delete().eq('rescate_id', id);
    await sb.from('rescates').delete().eq('id', id).eq('user_id', user.id);
    await reload();
  };

  const saveResc = async () => {
    if (!editResc) return;
    setSaving(true);
    const prec = parseFloat(editResc.precio_rescate);
    // Recalcular importe_venta y rendimiento
    const resc = data.rescates.find(r => r.id === editResc.id);
    const importeVenta = parseFloat(resc.cuotapartes_rescatadas) * prec;
    const rendimiento  = importeVenta - parseFloat(resc.costo_total);
    await sb.from('rescates').update({
      fecha_rescate:  editResc.fecha_rescate,
      precio_rescate: prec,
      importe_venta:  Math.round(importeVenta * 100) / 100,
      rendimiento:    Math.round(rendimiento * 100) / 100,
    }).eq('id', editResc.id).eq('user_id', user.id);
    setSaving(false);
    setEditResc(null);
    await reload();
  };

  if (!data && loading) {
    return (
      <div className="modal-overlay" style={{ display: 'flex' }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="modal modal-wide">
          <button className="modal-close" onClick={onClose}>✕</button>
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--text2)' }}>Cargando...</div>
        </div>
      </div>
    );
  }

  const { suscs, rescates } = data || { suscs: [], rescates: [] };
  const mon = suscs[0]?.moneda || rescates[0]?.moneda || 'ARS';
  const pfx = mon === 'ARS' ? '$ ' : 'U$S ';
  const fmt = (v) => pfx + Math.abs(parseFloat(v)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const totalInvertido  = suscs.reduce((s, x) => s + parseFloat(x.cantidad) * parseFloat(x.precio_compra), 0);
  const totalRescatadoV = rescates.reduce((s, x) => s + parseFloat(x.importe_venta), 0);
  const totalRescatadoC = rescates.reduce((s, x) => s + parseFloat(x.costo_total), 0);
  const ganRealizada    = totalRescatadoV - totalRescatadoC;
  const cpDisp          = suscs.reduce((s, x) => s + parseFloat(x.cuotapartes_disponibles), 0);

  const tnasValidas = rescates
    .filter(r => r.rescate_detalle?.length === 1 && r.rescate_detalle[0].dias > 0)
    .map(r => (parseFloat(r.rendimiento) / parseFloat(r.costo_total)) / r.rescate_detalle[0].dias * 360 * 100);
  const tnaPromedio = tnasValidas.length ? tnasValidas.reduce((a, b) => a + b, 0) / tnasValidas.length : null;

  const pctSpan = (v) => {
    if (v === null || v === undefined) return <span style={{ color: 'var(--text2)' }}>—</span>;
    const n = parseFloat(v);
    const col = n > 0 ? 'var(--pos)' : n < 0 ? 'var(--neg)' : 'var(--text2)';
    return <span style={{ color: col }}>{n > 0 ? '+' : ''}{n.toFixed(2)}%</span>;
  };

  const th = (label, center = false) => (
    <th style={{ textAlign: center ? 'center' : 'right', whiteSpace: 'nowrap' }}>{label}</th>
  );
  const td = (content, center = false) => (
    <td style={{ textAlign: center ? 'center' : 'right' }}>{content}</td>
  );

  // Botones de acción reutilizables
  const ActionBtns = ({ onEdit, onDelete }) => (
    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
      <button onClick={onEdit} title="Editar"
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, opacity: 0.5, padding: '2px 4px', transition: 'opacity 0.15s' }}
        onMouseOver={e => e.currentTarget.style.opacity = 1}
        onMouseOut={e => e.currentTarget.style.opacity = 0.5}>✏️</button>
      <button onClick={onDelete} title="Eliminar"
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, opacity: 0.5, padding: '2px 4px', transition: 'opacity 0.15s' }}
        onMouseOver={e => e.currentTarget.style.opacity = 1}
        onMouseOut={e => e.currentTarget.style.opacity = 0.5}>🗑</button>
    </td>
  );

  // Input inline compacto
  const InlineInput = ({ type = 'text', value, onChange, style = {} }) => (
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
      style={{ width: '100%', fontSize: 11, padding: '2px 4px', border: '1px solid var(--accent)', borderRadius: 4, background: 'var(--bg)', color: 'var(--text1)', ...style }} />
  );

  return (
    <div className="modal-overlay" style={{ display: 'flex' }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-wide" style={{ maxWidth: 1150, width: '95vw' }}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <h2 className="modal-title" style={{ marginBottom: 4 }}>{fondoNombre}</h2>
            <p className="modal-subtitle">Historial de movimientos</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginTop: 4, marginRight: 32 }}>
            <button className="btn-port-action btn-susc" onClick={() => onOpenSuscripcion && onOpenSuscripcion(fondoNombre, moneda)} title="Nueva suscripción" style={{ fontSize: 12, padding: '4px 10px' }}>+ Suscripción</button>
            <button className="btn-port-action btn-resc" onClick={() => onOpenRescate && onOpenRescate(fondoNombre, moneda)} title="Nuevo rescate" style={{ fontSize: 12, padding: '4px 10px' }}>− Rescate</button>
          </div>
        </div>

        {/* Summary */}
        <div className="hist-summary">
          <div className="hist-kpi"><div className="hist-kpi-label">Invertido total</div><div className="hist-kpi-val">{fmt(totalInvertido)}</div></div>
          <div className="hist-kpi"><div className="hist-kpi-label">Rescatado (venta)</div><div className="hist-kpi-val">{fmt(totalRescatadoV)}</div></div>
          <div className="hist-kpi">
            <div className="hist-kpi-label">Gan./Pérd. realizada</div>
            <div className="hist-kpi-val" style={{ color: ganRealizada >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
              {ganRealizada >= 0 ? '+' : ''}{fmt(ganRealizada)}
            </div>
          </div>
          {tnaPromedio !== null && (
            <div className="hist-kpi"><div className="hist-kpi-label">TNA promedio</div><div className="hist-kpi-val" style={{ color: 'var(--pos)' }}>{tnaPromedio.toFixed(2)}%</div></div>
          )}
          <div className="hist-kpi"><div className="hist-kpi-label">CP disponibles</div><div className="hist-kpi-val">{fmtCp(cpDisp)}</div></div>
        </div>

        {/* ── Suscripciones ── */}
        <div className="hist-section-title">📥 Suscripciones <span className="hist-count">{suscs.length}</span></div>
        <div style={{ display: 'inline-block', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <table className="hist-table hist-table-susc" style={{ width: 'auto', minWidth: 0 }}>
            <thead><tr>
              <th style={{ textAlign: 'center', width: 60 }}>Acciones</th>
              <th style={{ textAlign: 'left' }}>Fecha</th>
              {th('Cuotapartes')}
              {th('P. Suscrip.')}
              {th('Importe Suscrip.')}
              {th('CP Disponibles')}
            </tr></thead>
            <tbody>
              {suscs.length === 0
                ? <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text2)', padding: 16 }}>Sin suscripciones</td></tr>
                : suscs.map(s => {
                  const disp    = parseFloat(s.cuotapartes_disponibles);
                  const isEditing = editSusc?.id === s.id;
                  return (
                    <tr key={s.id} style={{ background: isEditing ? 'rgba(22,163,74,0.05)' : undefined }}>
                      <ActionBtns
                        onEdit={() => setEditSusc(isEditing ? null : { id: s.id, fecha_compra: s.fecha_compra, cantidad: s.cantidad, precio_compra: s.precio_compra })}
                        onDelete={() => deleteSusc(s.id)}
                      />
                      {isEditing ? (
                        <>
                          <td><InlineInput type="date" value={editSusc.fecha_compra} onChange={v => setEditSusc(p => ({ ...p, fecha_compra: v }))} /></td>
                          <td><InlineInput type="number" value={editSusc.cantidad} onChange={v => setEditSusc(p => ({ ...p, cantidad: v }))} /></td>
                          <td><InlineInput type="number" value={editSusc.precio_compra} onChange={v => setEditSusc(p => ({ ...p, precio_compra: v }))} /></td>
                          <td colSpan={2} style={{ textAlign: 'center' }}>
                            <button onClick={saveSusc} disabled={saving} style={{ marginRight: 6, padding: '3px 10px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                              {saving ? '…' : '✓ Guardar'}
                            </button>
                            <button onClick={() => setEditSusc(null)} style={{ padding: '3px 10px', background: 'none', border: '1px solid var(--border2)', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                              Cancelar
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ textAlign: 'left', color: 'var(--text2)' }}>{fmtDate(s.fecha_compra)}</td>
                          {td(fmtCp(s.cantidad))}
                          {td(fmtPrecio(s.precio_compra))}
                          {td(fmt(parseFloat(s.cantidad) * parseFloat(s.precio_compra)))}
                          {td(<span style={{ color: disp > 0 ? 'var(--pos)' : 'var(--text2)' }}>{fmtCp(disp)}</span>)}
                        </>
                      )}
                    </tr>
                  );
                })
              }
            </tbody>
          </table>
        </div>

        {/* ── Rescates ── */}
        <div className="hist-section-title" style={{ marginTop: 16 }}>📤 Rescates <span className="hist-count">{rescates.length}</span></div>
        <div className="hist-tbl-wrap">
          <table className="hist-table">
            <thead><tr>
              <th style={{ textAlign: 'center', width: 60 }}>Acciones</th>
              <th style={{ textAlign: 'left' }}>Fecha</th>
              {th('CP Rescatadas')}
              {th('P. Suscrip. Pond.')}
              {th('P. Rescate')}
              {th('Importe Rescate')}
              {th('Importe Suscrip.')}
              {th('Gan./Pérd.')}
              {th('Rend%')}
              {th('Días', true)}
              {th('TNA', true)}
              <th></th>
            </tr></thead>
            <tbody>
              {rescates.length === 0
                ? <tr><td colSpan={12} style={{ textAlign: 'center', color: 'var(--text2)', padding: 16 }}>Sin rescates registrados</td></tr>
                : rescates.flatMap(r => {
                  const detalles    = r.rescate_detalle || [];
                  const esCompuesto = detalles.length > 1;
                  const rendPos     = parseFloat(r.rendimiento) >= 0;
                  const rendPct     = parseFloat(r.costo_total) > 0 ? parseFloat(r.rendimiento) / parseFloat(r.costo_total) * 100 : null;
                  const totalCp     = detalles.reduce((s, d) => s + parseFloat(d.cuotapartes_consumidas), 0);
                  const precPond    = totalCp > 0 ? detalles.reduce((s, d) => s + parseFloat(d.cuotapartes_consumidas) * parseFloat(d.precio_compra), 0) / totalCp : 0;
                  const isEditing   = editResc?.id === r.id;

                  let diasStr = '—', tnaNode = <span style={{ color: 'var(--text2)' }}>—</span>;
                  if (!esCompuesto && detalles[0]?.dias > 0) {
                    diasStr = detalles[0].dias;
                    const tna = (parseFloat(r.rendimiento) / parseFloat(r.costo_total)) / detalles[0].dias * 360 * 100;
                    tnaNode = pctSpan(tna);
                  }

                  const isExp = expanded[r.id];
                  const rows = [
                    <tr key={r.id} style={{ background: isEditing ? 'rgba(22,163,74,0.05)' : undefined }}>
                      <ActionBtns
                        onEdit={() => setEditResc(isEditing ? null : { id: r.id, fecha_rescate: r.fecha_rescate, precio_rescate: r.precio_rescate })}
                        onDelete={() => deleteResc(r.id)}
                      />
                      {isEditing ? (
                        <>
                          <td><InlineInput type="date" value={editResc.fecha_rescate} onChange={v => setEditResc(p => ({ ...p, fecha_rescate: v }))} /></td>
                          {td(fmtCp(r.cuotapartes_rescatadas))}
                          {td(fmtPrecio(precPond))}
                          <td><InlineInput type="number" value={editResc.precio_rescate} onChange={v => setEditResc(p => ({ ...p, precio_rescate: v }))} /></td>
                          <td colSpan={7} style={{ textAlign: 'left', paddingLeft: 8 }}>
                            <button onClick={saveResc} disabled={saving} style={{ marginRight: 6, padding: '3px 10px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                              {saving ? '…' : '✓ Guardar'}
                            </button>
                            <button onClick={() => setEditResc(null)} style={{ padding: '3px 10px', background: 'none', border: '1px solid var(--border2)', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                              Cancelar
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ textAlign: 'left', color: 'var(--text2)' }}>{fmtDate(r.fecha_rescate)}</td>
                          {td(fmtCp(r.cuotapartes_rescatadas))}
                          {td(fmtPrecio(precPond))}
                          {td(fmtPrecio(r.precio_rescate))}
                          {td(fmt(r.importe_venta))}
                          {td(fmt(r.costo_total))}
                          {td(<span style={{ color: rendPos ? 'var(--pos)' : 'var(--neg)' }}>{rendPos ? '+' : ''}{fmt(r.rendimiento)}</span>)}
                          {td(pctSpan(rendPct))}
                          {td(diasStr, true)}
                          {td(tnaNode, true)}
                          <td style={{ textAlign: 'center' }}>{esCompuesto && (
                            <button className="btn-hist-expand"
                              onClick={() => setExpanded(prev => ({ ...prev, [r.id]: !prev[r.id] }))}>
                              {detalles.length} mov {isExp ? '▴' : '▾'}
                            </button>
                          )}</td>
                        </>
                      )}
                    </tr>
                  ];

                  if (esCompuesto && isExp) {
                    rows.push(
                      <tr key={`${r.id}-det`}>
                        <td colSpan={12} style={{ padding: 0 }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                            <thead><tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                              {['','Tramo','CP','P. Suscrip.','P. Rescate','Importe Rescate','Importe Suscrip.','Gan./Pérd.','Rend%','Días','TNA',''].map((h, i) => (
                                <th key={i} style={{ textAlign: i <= 1 ? 'left' : i >= 9 ? 'center' : 'right', padding: '6px 8px', color: 'var(--text2)', fontSize: 10, paddingLeft: i === 1 ? 28 : 8 }}>{h}</th>
                              ))}
                            </tr></thead>
                            <tbody>
                              {detalles.map((d, di) => {
                                const dRendPct = parseFloat(d.costo) > 0 ? parseFloat(d.rendimiento) / parseFloat(d.costo) * 100 : null;
                                const dTna     = d.dias > 0 ? (parseFloat(d.rendimiento) / parseFloat(d.costo)) / d.dias * 360 * 100 : null;
                                return (
                                  <tr key={di} style={{ background: 'rgba(255,255,255,0.02)', fontSize: 11 }}>
                                    <td></td>
                                    <td style={{ paddingLeft: 28, color: 'var(--text2)' }}>↳ FIFO</td>
                                    <td style={{ textAlign: 'right', padding: '6px 8px' }}>{fmtCp(d.cuotapartes_consumidas)}</td>
                                    <td style={{ textAlign: 'right', padding: '6px 8px' }}>{fmtPrecio(d.precio_compra)}</td>
                                    <td style={{ textAlign: 'right', padding: '6px 8px' }}>{fmtPrecio(d.precio_rescate)}</td>
                                    <td style={{ textAlign: 'right', padding: '6px 8px' }}>{fmt(d.venta)}</td>
                                    <td style={{ textAlign: 'right', padding: '6px 8px' }}>{fmt(d.costo)}</td>
                                    <td style={{ textAlign: 'right', padding: '6px 8px', color: parseFloat(d.rendimiento) >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{parseFloat(d.rendimiento) >= 0 ? '+' : ''}{fmt(d.rendimiento)}</td>
                                    <td style={{ textAlign: 'right', padding: '6px 8px' }}>{pctSpan(dRendPct)}</td>
                                    <td style={{ textAlign: 'center', padding: '6px 8px' }}>{d.dias}</td>
                                    <td style={{ textAlign: 'center', padding: '6px 8px' }}>{pctSpan(dTna)}</td>
                                    <td></td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    );
                  }
                  return rows;
                })
              }
            </tbody>
          </table>
        </div>
        <div className="hist-footer-note">Los rescates se procesaron con método FIFO.</div>
        <div className="hist-footer-note" style={{ marginTop: 4, color: 'var(--text2)' }}>Para modificar la cantidad de un rescate, eliminá el rescate y cargalo nuevamente.</div>
      </div>
    </div>
  );
}
