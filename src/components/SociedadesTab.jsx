import { useEffect, useMemo, useRef, useState } from 'react';
import { agruparPorGerente, agruparFondosPorPatrimonio, nombreClase, treemapSquarified, colorVariacion, fmtPat, fmtPatM } from '../lib/utils';
import { IconBuilding2, IconX } from './Icons';
import { useModalClose } from '../hooks/useModalClose';

// Mide el contenedor para recalcular el treemap con el tamaño REAL en píxeles (responsive sin
// trucos de CSS): así los bloques quedan bien tanto en escritorio como en el celular.
function useElementSize() {
  const ref = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      setSize({ w: Math.round(cr.width), h: Math.round(cr.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}

// Variación con signo y 2 decimales ("+0.12%" / "-0.96%" / "—" si no hay dato).
function formatearPct(v) {
  const n = typeof v === 'number' ? v : parseFloat(v);
  if (v === null || v === undefined || v === '' || isNaN(n)) return '—';
  return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
}

// Un treemap por moneda: los bloques son las sociedades gerentes, con área = patrimonio sumado.
// Al pasar el mouse se muestra un tooltip con el detalle; al hacer click se abre el modal de la
// sociedad gerente (GerenteModal) con la lista de fondos.
function TreemapGerentes({ rows, titulo, moneda }) {
  const [ref, size] = useElementSize();
  const [tip, setTip] = useState(null); // { x, y, g } del tooltip flotante
  const [abierto, setAbierto] = useState(null); // grupo (gerente) con el modal abierto

  const gerentes = useMemo(
    () => agruparPorGerente(rows).filter((g) => g.patrimonio > 0),
    [rows]
  );
  const total = useMemo(
    () => gerentes.reduce((s, g) => s + g.patrimonio, 0),
    [gerentes]
  );
  // Máximo |variación| para escalar la intensidad del color de todos los bloques del panel.
  const maxAbs = useMemo(
    () => gerentes.reduce((m, g) => Math.max(m, Math.abs(g.varPct || 0)), 0),
    [gerentes]
  );
  const rects = useMemo(() => {
    if (size.w <= 0 || size.h <= 0) return [];
    return treemapSquarified(
      gerentes.map((g) => ({
        value: g.patrimonio,
        gerente: g.gerente,
        n: g.n,
        varPct: g.varPct,
        patrimonio: g.patrimonio,
        g, // el grupo completo (con sus fondos) para el tooltip y el modal
      })),
      size.w,
      size.h
    );
  }, [gerentes, size.w, size.h]);

  // El tooltip se posiciona junto al cursor y se corre si chocaría con el borde de la ventana.
  const moverTip = (e, g) => {
    const W = 260;
    const H = 130;
    const x = Math.min(e.clientX + 14, window.innerWidth - W - 12);
    const y = Math.min(e.clientY + 14, window.innerHeight - H - 12);
    setTip({ x, y, g });
  };

  return (
    <>
      <div className="table-wrap">
        <div className="tm-head">
          <span className="tm-title"><IconBuilding2 size={13} /> {titulo}</span>
          <span className={`badge ${moneda === 'ARS' ? 'badge-ars' : 'badge-usd'}`}>{moneda}</span>
          <span className="tm-total">
            {gerentes.length.toLocaleString('es-AR')} gerentes · Total: <strong>{fmtPat(total, moneda)}</strong>
          </span>
        </div>
        <div className="tm-canvas" ref={ref}>
          {gerentes.length === 0 ? (
            <div className="tm-empty">No hay datos disponibles para {moneda}.</div>
          ) : (
            rects.map((r, i) => {
              // Bloques muy chicos: se muestra sólo el nombre, sin patrimonio ni variación.
              const chico = r.w < 56 || r.h < 30;
              return (
                <button
                  type="button"
                  key={i}
                  className={`tm-block${chico ? ' tm-small' : ''}`}
                  style={{
                    left: `${r.x}px`,
                    top: `${r.y}px`,
                    width: `${r.w}px`,
                    height: `${r.h}px`,
                    background: colorVariacion(r.varPct, maxAbs),
                  }}
                  onClick={() => { setTip(null); setAbierto(r.g); }}
                  onMouseEnter={(e) => moverTip(e, r.g)}
                  onMouseMove={(e) => moverTip(e, r.g)}
                  onMouseLeave={() => setTip(null)}
                  aria-label={`${r.gerente}: ${fmtPat(r.patrimonio, moneda)}`}
                >
                  <span className="tm-name">{r.gerente}</span>
                  {!chico && <span className="tm-val">{fmtPat(r.patrimonio, moneda)}</span>}
                  {!chico && r.varPct != null && (
                    <span className="tm-pct">{formatearPct(r.varPct)}</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Tooltip flotante: position:fixed lo saca del recorte del canvas (overflow:hidden) y lo
          dibuja junto al cursor. pointer-events:none para que no se interponga con el clic. */}
      {tip && (
        <div className="tm-tip" style={{ left: tip.x, top: tip.y }}>
          <div className="tm-tip-name">{tip.g.gerente}</div>
          <div className="tm-tip-row">
            <span>Patrimonio</span>
            <strong>{fmtPat(tip.g.patrimonio, moneda)}</strong>
          </div>
          <div className="tm-tip-row">
            <span>Fondos</span>
            <strong>{tip.g.n}</strong>
          </div>
          <div className="tm-tip-row">
            <span>Var. diaria pond.</span>
            <strong style={{ color: colorVariacion(tip.g.varPct, maxAbs) }}>{formatearPct(tip.g.varPct)}</strong>
          </div>
          <div className="tm-tip-hint">Click para ver el detalle</div>
        </div>
      )}

      {abierto && (
        <GerenteModal g={abierto} moneda={moneda} onClose={() => setAbierto(null)} />
      )}
    </>
  );
}

// Alto fijo de cada fila del listado (px). Se usa para calcular cuántos fondos caben en la ventana.
const ROW_H = 40;

// Modal de detalle de una sociedad gerente: nombre como título, patrimonio total administrado,
// variación ponderada por patrimonio y la lista de fondos ordenada por mayor patrimonio. La lista
// muestra sólo los fondos que entran en la ventana (sin scroll): se mide el alto disponible con
// ResizeObserver y se calcula la cantidad de filas que caben.
function GerenteModal({ g, moneda, onClose }) {
  const { closing, requestClose } = useModalClose(onClose);
  const listRef = useRef(null);
  // Tooltip de fila: { x, y, f } con el fondo bajo el cursor (se posiciona junto al puntero).
  const [hover, setHover] = useState(null);
  // Arranca con todos los fondos para que la lista llene el alto y la medición pueda recortar;
  // después el ResizeObserver ajusta el número exacto que entra en la ventana.
  const [n, setN] = useState(() => (g.fondos || []).length || 1);

  // Fondos ordenados por patrimonio (mayor primero).
  const fondos = useMemo(() => agruparFondosPorPatrimonio(g.fondos || []), [g]);

  // Máximo |variación| de los fondos para colorear la variación de cada fila.
  const maxAbs = useMemo(
    () => fondos.reduce((m, f) => Math.max(m, Math.abs(f.varPct || 0)), 0),
    [fondos]
  );

  // Mide el alto del listado y calcula cuántos fondos caben (sin scroll).
  useEffect(() => {
    const el = listRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const h = Math.round(entries[0].contentRect.height);
      setN(Math.max(1, Math.floor(h / ROW_H)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Posiciona el tooltip de la fila junto al cursor (mismo criterio que el tooltip del treemap),
  // corriéndolo si chocaría con el borde de la ventana. Sólo se muestra cuando el fondo agrupa 2+
  // clases: en un fondo de una sola clase la fila ya muestra todo y el popup sería redundante.
  const moverHover = (e, f) => {
    if (!f || f.n <= 1) return;
    const W = 340;
    const H = Math.min(22 * (f.clases.length + 2) + 28, window.innerHeight - 24);
    const x = Math.max(8, Math.min(e.clientX + 14, window.innerWidth - W - 12));
    const y = Math.max(8, Math.min(e.clientY + 14, window.innerHeight - H - 12));
    setHover({ x, y, f });
  };

  const visibles = fondos.slice(0, n);
  const ocultos = Math.max(0, fondos.length - n);

  return (
    <div className={`modal-overlay${closing ? ' closing' : ''}`} onClick={requestClose}>
      <div className="modal modal-gerente" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={requestClose} aria-label="Cerrar">
          <IconX size={16} />
        </button>
        <div className="modal-head">
          <div className="modal-title">{g.gerente}</div>
          <div className="modal-subtitle">Sociedad gerente · {moneda}</div>
        </div>
        <div className="modal-kpis">
          <div className="modal-kpi">
            <span className="modal-kpi-label">Patrimonio administrado</span>
            <span className="modal-kpi-val">{fmtPatM(g.patrimonio, moneda)}</span>
          </div>
          <div className="modal-kpi">
            <span className="modal-kpi-label">Var. Diaria ponderada</span>
            <span className="modal-kpi-val" style={{ color: colorVariacion(g.varPct, maxAbs) }}>
              {formatearPct(g.varPct)}
            </span>
          </div>
        </div>
        <div className="gm-list-head">
          <span>Fondo</span>
          <span>Patrimonio</span>
          <span>Var. diaria</span>
        </div>
        <div className="gm-list" ref={listRef}>
          {visibles.map((f) => {
            // Nombre a mostrar: si el fondo agrupa varias clases, el nombre base + badge; si tiene
            // una sola clase, el nombre completo de esa clase (así no se pierde la letra).
            const nombre = f.n > 1 ? f.nombre : (f.clases[0] && f.clases[0].fondo) || f.nombre;
            // Detalle por clase en el tooltip (title): cada clase con su patrimonio y variación.
            const detalle =
              f.n > 1
                ? f.clases
                    .map(
                      (c) =>
                        `${nombreClase(c.fondo) || c.fondo} · ${fmtPatM(c.patrimonio, moneda)} · ${formatearPct(c.valorVarPct)}`
                    )
                    .join('\n')
                : nombre;
            return (
              <div
                className="gm-row"
                key={f.key}
                aria-label={detalle}
                onMouseEnter={(e) => moverHover(e, f)}
                onMouseMove={(e) => moverHover(e, f)}
                onMouseLeave={() => setHover(null)}
              >
                <span className="gm-row-name">
                  <span className="gm-row-fund">{nombre}</span>
                  {f.n > 1 && <span className="gm-row-badge">{f.n} clases</span>}
                </span>
                <span className="gm-row-pat">{fmtPatM(f.patrimonio, moneda)}</span>
                <span className="gm-row-var" style={{ color: colorVariacion(f.varPct, maxAbs) }}>
                  {formatearPct(f.varPct)}
                </span>
              </div>
            );
          })}
        </div>
        <div className="gm-note">
          {ocultos > 0
            ? `Mostrando ${n} de ${fondos.length} fondos (ordenados por patrimonio).`
            : `${fondos.length} fondos.`}
        </div>
      </div>

      {/* Tooltip de la fila: mismo estilo que el tooltip flotante del treemap (.tm-tip). Lista las
          clases del fondo como tabla (fondo · patrimonio · variación), ordenadas por patrimonio y
          con el top 3 numerado. Va como hijo del overlay (hermano de .modal-gerente) para que el
          overflow:hidden del modal no lo recorte. */}
      {hover && (
        <div className="tm-tip gm-tip" style={{ left: hover.x, top: hover.y }}>
          <div className="tm-tip-name">
            {hover.f.n > 1
              ? `${hover.f.nombre} · ${hover.f.n} clases`
              : (hover.f.clases[0] && hover.f.clases[0].fondo) || hover.f.nombre}
          </div>
          {hover.f.n > 1 && (
            <table className="gm-tip-table">
              <thead>
                <tr>
                  <th>Fondo</th>
                  <th>Patrimonio</th>
                  <th>Var.</th>
                </tr>
              </thead>
              <tbody>
                {[...hover.f.clases]
                  .sort((a, b) => (parseFloat(b.patrimonio) || 0) - (parseFloat(a.patrimonio) || 0))
                  .map((c, i) => (
                    <tr key={i}>
                      <td className="gm-tip-fondo">
                        <span className="gm-tip-rank">{i < 3 ? `${i + 1}.` : ''}</span>
                        <span className="gm-tip-fondo-txt">{nombreClase(c.fondo) || c.fondo}</span>
                      </td>
                      <td className="gm-tip-pat">{fmtPatM(c.patrimonio, moneda)}</td>
                      <td className="gm-tip-var" style={{ color: colorVariacion(c.valorVarPct, maxAbs) }}>
                        {formatearPct(c.valorVarPct)}
                      </td>
                    </tr>
                  ))}
                <tr className="gm-tip-total">
                  <td>Total</td>
                  <td className="gm-tip-pat">{fmtPatM(hover.f.patrimonio, moneda)}</td>
                  <td className="gm-tip-var" style={{ color: colorVariacion(hover.f.varPct, maxAbs) }}>
                    {formatearPct(hover.f.varPct)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// Pestaña completa: un treemap para pesos y otro para dólares. El patrimonio no se suma entre
// monedas porque ARS y USD son productos distintos (distinto valor de cuotaparte).
export default function SociedadesTab({ raw }) {
  const ars = useMemo(() => (raw || []).filter((r) => r.moneda === 'ARS'), [raw]);
  const usd = useMemo(
    () => (raw || []).filter((r) => r.moneda === 'USD' || r.moneda === 'USB'),
    [raw]
  );
  return (
    <div className="tab-stack">
      <TreemapGerentes rows={ars} titulo="Sociedades Gerentes — Pesos" moneda="ARS" />
      <TreemapGerentes rows={usd} titulo="Sociedades Gerentes — Dólares" moneda="USD" />
    </div>
  );
}
