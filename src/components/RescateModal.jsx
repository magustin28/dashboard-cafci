import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function RescateModal({ fondoInicial, monedaInicial, onClose }) {
  const { portfolio, addRescate } = useAuth();
  const [fondo,    setFondo]    = useState(fondoInicial || '');
  const [moneda,   setMoneda]   = useState(monedaInicial || 'ARS');
  const [fecha,    setFecha]    = useState(new Date().toISOString().slice(0, 10));
  const [cantidad, setCantidad] = useState('');
  const [precio,   setPrecio]   = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  // Cerrar con ESC — stopPropagation para no disparar modales de fondo
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handler, true); // capture phase
    return () => document.removeEventListener('keydown', handler, true);
  }, [onClose]);


  const cant = parseFloat(cantidad);
  const prec = parseFloat(precio);
  const pfx  = moneda === 'ARS' ? '$ ' : 'U$S ';

  const disponibles = portfolio
    .filter(s => s.fondo_nombre === fondo)
    .reduce((s, x) => s + parseFloat(x.cuotapartes_disponibles), 0);

  // FIFO preview
  let preview = null;
  if (fondo && !isNaN(cant) && !isNaN(prec) && cant > 0 && prec > 0) {
    const suscsFifo = portfolio
      .filter(s => s.fondo_nombre === fondo && parseFloat(s.cuotapartes_disponibles) > 0)
      .sort((a, b) => new Date(a.fecha_compra) - new Date(b.fecha_compra));
    let restante = cant, costoTotal = 0;
    for (const s of suscsFifo) {
      if (restante <= 0) break;
      const consumidas = Math.min(restante, parseFloat(s.cuotapartes_disponibles));
      costoTotal += consumidas * parseFloat(s.precio_compra);
      restante -= consumidas;
    }
    const importeVenta = cant * prec;
    const rendimiento  = importeVenta - costoTotal;
    const rendPct      = costoTotal > 0 ? rendimiento / costoTotal * 100 : 0;
    preview = { importeVenta, costoTotal, rendimiento, rendPct };
  }

  const fmt = v => pfx + Math.abs(v).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const submit = async () => {
    if (!fondo)               return setError('Ingresá el nombre del fondo.');
    if (!fecha)               return setError('Ingresá la fecha del rescate.');
    if (isNaN(cant) || cant <= 0) return setError('Ingresá una cantidad válida.');
    if (isNaN(prec) || prec <= 0) return setError('Ingresá un precio válido.');
    setLoading(true);
    const result = await addRescate({ fondoNombre: fondo, moneda, fechaRescate: fecha, cuotapartesRescatadas: cant, precioRescate: prec });
    setLoading(false);
    if (result.ok) onClose(true);
    else setError(result.msg);
  };

  return (
    <div className="modal-overlay modal-overlay-top" style={{ display: 'flex' }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <button className="modal-close" onClick={() => onClose()}>✕</button>
        <h2 className="modal-title">Registrar rescate</h2>
        <p className="modal-subtitle">Vendé cuotapartes — se aplica método FIFO</p>

        <div className="modal-field">
          <label>Fondo</label>
          <input type="text" value={fondo} onChange={e => setFondo(e.target.value)}
            placeholder="Nombre del fondo" list="fondos-datalist" autoComplete="off" />
          <div className="resc-disponibles">
            {fondo && (disponibles > 0
              ? `Disponibles: ${disponibles.toLocaleString('es-AR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} cuotapartes`
              : 'Sin cuotapartes disponibles para este fondo.')}
          </div>
        </div>

        <div className="modal-row">
          <div className="modal-field">
            <label>Moneda</label>
            <select value={moneda} onChange={e => setMoneda(e.target.value)}>
              <option value="ARS">ARS — Pesos</option>
              <option value="USD">USD — Dólar</option>
              <option value="USB">USB — Dólar Billete</option>
            </select>
          </div>
          <div className="modal-field">
            <label>Fecha de rescate</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
        </div>

        <div className="modal-row">
          <div className="modal-field">
            <label>Cuotapartes a rescatar</label>
            <input type="number" value={cantidad} onChange={e => setCantidad(e.target.value)}
              placeholder="ej: 500.00" min={0} step="any" />
          </div>
          <div className="modal-field">
            <label>Precio de rescate (por cuotaparte)</label>
            <input type="number" value={precio} onChange={e => setPrecio(e.target.value)}
              placeholder="ej: 1380.00" min={0} step="any" />
          </div>
        </div>

        {preview && (
          <div className="resc-preview">
            <div className="resc-preview-row"><span>Importe venta</span><span>{fmt(preview.importeVenta)}</span></div>
            <div className="resc-preview-row"><span>Costo (FIFO)</span><span>{fmt(preview.costoTotal)}</span></div>
            <div className="resc-preview-row" style={{ fontWeight: 600, borderTop: '1px solid var(--border2)', paddingTop: 6, marginTop: 2 }}>
              <span>Rendimiento</span>
              <span className={preview.rendimiento >= 0 ? 'pos' : 'neg'}>
                {preview.rendimiento >= 0 ? '+' : '-'}{fmt(preview.rendimiento)} ({preview.rendimiento >= 0 ? '+' : ''}{preview.rendPct.toFixed(2)}%)
              </span>
            </div>
          </div>
        )}

        {error && <p className="modal-error">{error}</p>}
        <button className="modal-submit" onClick={submit} disabled={loading}>
          {loading ? 'Procesando…' : 'Confirmar rescate'}
        </button>
      </div>
    </div>
  );
}
