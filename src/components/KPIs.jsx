import { fmtPat } from '../lib/utils';

export default function KPIs({ filtered }) {
  const vd  = filtered.map(r => parseFloat(r[5])).filter(v => !isNaN(v));
  const v12 = filtered.map(r => parseFloat(r[7])).filter(v => !isNaN(v));
  const pat = filtered.map(r => parseFloat(r[9])).filter(v => !isNaN(v) && v > 0);

  const avgVd  = vd.length  ? vd.reduce((a, b)  => a + b, 0) / vd.length  : null;
  const avgV12 = v12.length ? v12.reduce((a, b) => a + b, 0) / v12.length : null;
  const sumPat = pat.length ? pat.reduce((a, b) => a + b, 0) : null;
  const posVd  = vd.filter(v => v > 0).length;

  const pct = (v, d = 2) => v === null ? '—' : (v > 0 ? '+' : '') + v.toFixed(d) + '%';
  const cls = (v) => v === null ? 'c' : v > 0 ? 'g' : v < 0 ? 'r' : 'y';

  return (
    <div className="kpis">
      <div className="kpi">
        <div className="kpi-bar c"></div>
        <div className="kpi-label">Fondos en filtro</div>
        <div className="kpi-val c">{filtered.length.toLocaleString('es-AR')}</div>
        <div className="kpi-sub">de {filtered.length.toLocaleString('es-AR')} totales</div>
      </div>
      <div className="kpi">
        <div className={`kpi-bar ${cls(avgVd)}`}></div>
        <div className="kpi-label">Var. diaria promedio</div>
        <div className={`kpi-val ${cls(avgVd)}`}>{pct(avgVd)}</div>
        <div className="kpi-sub">{posVd} fondos positivos</div>
      </div>
      <div className="kpi">
        <div className={`kpi-bar ${cls(avgV12)}`}></div>
        <div className="kpi-label">Rend. 12m promedio</div>
        <div className={`kpi-val ${cls(avgV12)}`}>{pct(avgV12, 1)}</div>
        <div className="kpi-sub">últ. 12 meses</div>
      </div>
      <div className="kpi">
        <div className="kpi-bar c"></div>
        <div className="kpi-label">Patrimonio total</div>
        <div className="kpi-val c">{fmtPat(sumPat)}</div>
        <div className="kpi-sub">ARS en el filtro</div>
      </div>
    </div>
  );
}
