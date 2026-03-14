import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function SuscripcionModal({ fondoInicial, monedaInicial, raw, onClose }) {
  const { addSuscripcion } = useAuth();
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
  const total = !isNaN(cant) && !isNaN(prec) && cant > 0 && prec > 0 ? cant * prec : null;
  const pfx = moneda === 'ARS' ? '$ ' : 'U$S ';

  const submit = async () => {
    if (!fondo)               return setError('Ingresá el nombre del fondo.');
    if (!fecha)               return setError('Ingresá la fecha de compra.');
    if (isNaN(cant) || cant <= 0) return setError('Ingresá una cantidad válida.');
    if (isNaN(prec) || prec <= 0) return setError('Ingresá un precio válido.');
    setLoading(true);
    const result = await addSuscripcion({ fondoNombre: fondo, moneda, fechaCompra: fecha, cantidad: cant, precioCompra: prec });
    setLoading(false);
    if (result.ok) onClose(true);
    else setError(result.msg);
  };

  return (
    <div className="modal-overlay modal-overlay-top" style={{ display: 'flex' }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <button className="modal-close" onClick={() => onClose()}>✕</button>
        <h2 className="modal-title">Agregar suscripción</h2>
        <p className="modal-subtitle">Registrá una compra de cuotapartes</p>

        <div className="modal-field">
          <label>Fondo</label>
          <input type="text" value={fondo} onChange={e => setFondo(e.target.value)}
            placeholder="Nombre del fondo" list="fondos-datalist" autoComplete="off" />
          <datalist id="fondos-datalist">
            {raw.map((r, i) => <option key={i} value={r[1]} />)}
          </datalist>
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
            <label>Fecha de suscripción</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
        </div>

        <div className="modal-row">
          <div className="modal-field">
            <label>Cuotapartes suscritas</label>
            <input type="number" value={cantidad} onChange={e => setCantidad(e.target.value)}
              placeholder="ej: 1250.50" min={0} step="any" />
          </div>
          <div className="modal-field">
            <label>Precio por cuotaparte</label>
            <input type="number" value={precio} onChange={e => setPrecio(e.target.value)}
              placeholder="ej: 1250.4832" min={0} step="any" />
          </div>
        </div>

        <div className="modal-calc">
          {total !== null
            ? <>Inversión total: <strong style={{ color: 'var(--text)', fontSize: 13 }}>{pfx}{total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></>
            : 'Completá cantidad y precio para ver el total.'}
        </div>

        {error && <p className="modal-error">{error}</p>}
        <button className="modal-submit" onClick={submit} disabled={loading}>
          {loading ? 'Guardando…' : 'Guardar suscripción'}
        </button>
      </div>
    </div>
  );
}
