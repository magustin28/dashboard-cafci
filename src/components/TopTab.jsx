import { useAuth } from '../context/useAuth';
import { cnvLink } from '../lib/utils';
import { PctCell, PatCell } from './TableCells';
import { IconChartColumn, IconTrophy, IconInfo, IconPlus } from './Icons';

function TopTable({ rows, refs, onOpenSuscripcion, onFondoClick, moneda }) {
  const { user, favs, toggleFav } = useAuth();

  if (rows.length === 0) {
    return (
      <div className="empty-favs tight">
        <div className="empty-icon"><IconChartColumn size={32} strokeWidth={1.5} /></div>
        <p>No hay datos disponibles para {moneda}.</p>
      </div>
    );
  }

  return (
    <div className="tbl-scroll">
      <table id="main-table" className="tbl-top">
        <thead>
          <tr>
            <th className="col-rank">#</th>
            <th className="col-acciones">Acciones</th>
            <th className="col-fondo">Fondo</th>
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
            <th className="col-gerente">Sociedad Gerente</th>
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
                <td className="td-rank" style={{ color: i === 0 ? '#f59e0b' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : 'var(--text2)' }}>
                  {i + 1}
                </td>
                <td className="td-mid">
                  <div className="action-grid">
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
                        className="btn-port-action btn-susc col-span-2"
                        onClick={() => onOpenSuscripcion(r.fondo, r.moneda)}
                        title="Agregar a mi portfolio"><IconPlus size={13} /></button>
                    ) : <span />}
                  </div>
                </td>
                <td className="td-fondo">{r.fondo || '—'}</td>
                <td className="td-center">
                  <PctCell v={r.valorVarPct} decimals={3} />
                </td>
                <td className="td-center">
                  {tna !== null
                    ? <span className={`td-mono ${tna > 0 ? 'pos' : tna < 0 ? 'neg' : 'zero'}`}>
                        {tna > 0 ? '+' : ''}{tna.toFixed(2)}%
                      </span>
                    : <span className="td-mono zero">—</span>
                  }
                </td>
                <td className="td-center"><PctCell v={r.varAnio} decimals={2} /></td>
                <td className="td-center"><PctCell v={r.varAnual} decimals={2} /></td>
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
    <div className="tab-stack">

      {/* ARS */}
      <div className="table-wrap">
        <div className="block-head">
          <span className="block-title"><IconTrophy size={13} /> Top 10 — Pesos</span>
          <span className="badge badge-ars">ARS</span>
          <span className="block-sub">Ordenado por variación diaria</span>
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
        <div className="block-head">
          <span className="block-title"><IconTrophy size={13} /> Top 10 — Dólares</span>
          <span className="badge badge-usd">USD</span>
          <span className="badge badge-usb ml-4">USB</span>
          <span className="block-sub">Ordenado por variación diaria</span>
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
