import { useAuth } from '../context/useAuth';
import { cnvLink } from '../lib/utils';
import { IconChartColumn, IconTrophy, IconInfo, IconPlus } from './Icons';

function PctCell({ v, decimals = 3 }) {
  if (v === null || v === undefined || v === '') return <span className="td-mono zero">—</span>;
  const n = parseFloat(v);
  if (isNaN(n)) return <span className="td-mono zero">—</span>;
  const cls = n > 0 ? 'pos' : n < 0 ? 'neg' : 'zero';
  return <span className={`td-mono ${cls}`}>{n > 0 ? '+' : ''}{n.toFixed(decimals)}%</span>;
}

function PatCell({ v }) {
  if (!v) return <span className="td-mono zero">—</span>;
  const n = parseFloat(v);
  if (isNaN(n) || n <= 0) return <span className="td-mono zero">—</span>;
  if (n >= 1e9)  return <span className="td-mono">{'$' + (n / 1e9).toFixed(2) + 'MM'}</span>;
  if (n >= 1e6)  return <span className="td-mono">{'$' + (n / 1e6).toFixed(2) + 'M'}</span>;
  return <span className="td-mono">{'$' + n.toLocaleString('es-AR')}</span>;
}

function TopTable({ rows, refs, onOpenSuscripcion, onFondoClick, moneda }) {
  const { user, favs, toggleFav } = useAuth();

  if (rows.length === 0) {
    return (
      <div className="empty-favs" style={{ padding: '32px 0' }}>
        <div className="empty-icon"><IconChartColumn size={32} strokeWidth={1.5} /></div>
        <p>No hay datos disponibles para {moneda}.</p>
      </div>
    );
  }

  return (
    <div className="tbl-scroll">
      <table id="main-table">
        <thead>
          <tr>
            <th style={{ width: 36, textAlign: 'center' }}>#</th>
            <th style={{ width: 64, textAlign: 'center' }}>Acciones</th>
            <th style={{ minWidth: 240, textAlign: 'left' }}>Fondo</th>
            <th>
              <div className="th-var-inner">
                <div className="th-var-left">
                  <span className="th-var-title">Var. Diaria %</span>
                  <span className="th-date">{(refs?.fechaAnterior || '').trim()}</span>
                </div>
              </div>
            </th>
            <th>TNA</th>
            <th>
              <div className="th-var-inner">
                <div className="th-var-left">
                  <span className="th-var-title">Var. Año %</span>
                  <span className="th-date">{refs?.fechaInicioAnio || '01/01/26'}</span>
                </div>
              </div>
            </th>
            <th>
              <div className="th-var-inner">
                <div className="th-var-left">
                  <span className="th-var-title">Var. 12m %</span>
                  <span className="th-date">{(refs?.fecha3 || '').trim()}</span>
                </div>
              </div>
            </th>
            <th>Patrimonio</th>
            <th style={{ minWidth: 160 }}>Sociedad Gerente</th>
            <th>CAFCI</th>
          </tr>
        </thead>
        <tbody className="fade-up">
          {rows.map((r, i) => {
            const isFaved = favs.includes(r.fondo);
            const varD = parseFloat(r.valorVarPct);
            const tna = !isNaN(varD) ? varD * 360 : null;
            return (
              <tr key={i}>
                <td style={{ textAlign: 'center', fontWeight: 700, color: i === 0 ? '#f59e0b' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : 'var(--text2)', fontSize: 13 }}>
                  {i + 1}
                </td>
                <td style={{ verticalAlign: 'middle' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, width: 52, margin: '0 auto' }}>
                    <button
                      className={`btn-fav${isFaved ? ' active' : ''}`}
                      onClick={() => toggleFav(r.fondo)}
                      title={isFaved ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                      style={{ fontSize: 13 }}>★</button>
                    <button
                      className="btn-port-action btn-info"
                      onClick={() => onFondoClick && onFondoClick(r)}
                      title="Ver detalle del fondo"><IconInfo size={13} /></button>
                    {user ? (
                      <button
                        className="btn-port-action btn-susc"
                        onClick={() => onOpenSuscripcion(r.fondo, r.moneda)}
                        title="Agregar a mi portfolio"
                        style={{ gridColumn: 'span 2' }}><IconPlus size={13} /></button>
                    ) : <span />}
                  </div>
                </td>
                <td className="td-fondo">{r.fondo || '—'}</td>
                <td style={{ textAlign: 'center' }}>
                  <PctCell v={r.valorVarPct} />
                </td>
                <td style={{ textAlign: 'center' }}>
                  {tna !== null
                    ? <span className={`td-mono ${tna > 0 ? 'pos' : tna < 0 ? 'neg' : 'zero'}`}>
                        {tna > 0 ? '+' : ''}{tna.toFixed(2)}%
                      </span>
                    : <span className="td-mono zero">—</span>
                  }
                </td>
                <td style={{ textAlign: 'center' }}><PctCell v={r.varAnio} decimals={2} /></td>
                <td style={{ textAlign: 'center' }}><PctCell v={r.varAnual} decimals={2} /></td>
                <td><PatCell v={r.patrimonio} /></td>
                <td className="td-gerente">{r.socGerente || '—'}</td>
                <td>
                  <a className="btn-cnv" href={cnvLink(r.cafci || '', r.cnv || '')} target="_blank" rel="noopener" title="Ver en CAFCI">↗</a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function TopTab({ raw, refs, onOpenSuscripcion, onFondoClick }) {
  const parseVar = (r) => {
    const v = parseFloat(r.valorVarPct);
    return isNaN(v) ? -Infinity : v;
  };

  const top10ARS = [...raw]
    .filter(r => r.moneda === 'ARS' && r.valorVarPct != null && !isNaN(parseFloat(r.valorVarPct)) && /clase\s+a$/i.test(r.fondo || ''))
    .sort((a, b) => parseVar(b) - parseVar(a))
    .slice(0, 10);

  const top10USD = [...raw]
    .filter(r => (r.moneda === 'USD' || r.moneda === 'USB') && r.valorVarPct != null && !isNaN(parseFloat(r.valorVarPct)) && /clase\s+a$/i.test(r.fondo || ''))
    .sort((a, b) => parseVar(b) - parseVar(a))
    .slice(0, 10);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* ARS */}
      <div className="table-wrap">
        <div style={{ padding: '10px 16px 8px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}><IconTrophy size={13} /> Top 10 — Pesos</span>
          <span className="badge badge-ars">ARS</span>
          <span style={{ fontSize: 11, color: 'var(--text2)', marginLeft: 'auto' }}>Ordenado por variación diaria</span>
        </div>
        <TopTable
          rows={top10ARS}
          refs={refs}
          onOpenSuscripcion={onOpenSuscripcion}
          onFondoClick={onFondoClick}
          moneda="ARS"
        />
      </div>

      {/* USD */}
      <div className="table-wrap">
        <div style={{ padding: '10px 16px 8px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}><IconTrophy size={13} /> Top 10 — Dólares</span>
          <span className="badge badge-usd">USD</span>
          <span className="badge badge-usb" style={{ marginLeft: 4 }}>USB</span>
          <span style={{ fontSize: 11, color: 'var(--text2)', marginLeft: 'auto' }}>Ordenado por variación diaria</span>
        </div>
        <TopTable
          rows={top10USD}
          refs={refs}
          onOpenSuscripcion={onOpenSuscripcion}
          onFondoClick={onFondoClick}
          moneda="USD"
        />
      </div>

    </div>
  );
}
