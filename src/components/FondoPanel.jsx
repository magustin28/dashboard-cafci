import { REG_MAP, HOR_MAP, formatPlazoLiq } from '../lib/utils';
import { numero, porcentaje, moneda, colorVariacion, fechaCompleta } from '../lib/format';
import { useModalClose } from '../hooks/useModalClose';
import { IconX } from './Icons';

export default function FondoPanel({ fondo, refs, apiFecha, onClose }) {
  // Cierre animado (hooks/useModalClose.js): el panel se desliza hacia la derecha y el fondo se
  // desvanece antes de desmontarse.
  const { closing, requestClose } = useModalClose(onClose);

  if (!fondo) return null;


  const mon      = fondo.moneda;
  const monSym   = mon === 'ARS' ? '$' : 'U$S';
  // Formateadores compartidos (lib/format.js): las mismas reglas que el resto de las pantallas.
  // Los alias conservan las firmas que ya usaba el JSX de este panel.
  const fmtNum   = numero;
  const fmtPct   = (v) => porcentaje(v, 3, { agrupado: true });
  const fmtMon   = (v, sym) => moneda(v, sym === '$' ? 'ARS' : 'USD', { absoluto: false });
  const fmtMon4  = (v, sym) => moneda(v, sym === '$' ? 'ARS' : 'USD', { absoluto: false, dec: 4 });
  const clrPct   = colorVariacion;

  const varD  = fondo.valorVarPct;
  const var1  = fondo.varMes;
  const var2  = fondo.varAnio;
  const var3  = fondo.varAnual;

  // Fechas con año completo (lib/format.js): acepta ISO o DD/MM/AA.
  const fechaActual   = fechaCompleta(apiFecha);
  const fechaAnterior = refs?.fechaAnterior ? fechaCompleta(refs.fechaAnterior) : null;
  const fecha1        = refs?.fecha1 ? fechaCompleta(refs.fecha1) : null;
  const fecha2        = refs?.fecha2 ? fechaCompleta(refs.fecha2) : null;
  const fecha3        = refs?.fecha3 ? fechaCompleta(refs.fecha3) : null;

  return (
    <>
      <div
        onClick={requestClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 300,
          animation: closing ? 'backdropOut 0.24s ease forwards' : undefined,
          pointerEvents: closing ? 'none' : 'auto',
        }}
      />

      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 460, maxWidth: '95vw',
        background: 'var(--card)', borderLeft: '1px solid var(--border)',
        zIndex: 301, overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.25)',
        animation: closing ? 'slideOut 0.24s ease forwards' : 'slideIn 0.2s ease',
      }}>

        {/* Header */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--card)', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3, color: 'var(--text1)' }}>{fondo.fondo}</div>
            <button onClick={requestClose} aria-label="Cerrar" style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 18, padding: 4, flexShrink: 0 }}><IconX size={16} /></button>
          </div>
        </div>

        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* 1. Datos Generales — primero */}
          <Section title="Datos Generales">
            <Row label="Categoría"            value={fondo.categoria || '—'} nowrap />
            <Row label="Moneda"               value={mon} />
            <Row label="Región"               value={REG_MAP[fondo.region] || fondo.region || '—'} />
            <Row label="Horizonte"            value={HOR_MAP[fondo.horizonte] || fondo.horizonte || '—'} />
            <Row label="Plazo de liquidación" value={formatPlazoLiq(fondo.plazoLiq)} />
            <Row label="Sociedad Gerente"     value={fondo.socGerente || '—'} nowrap />
            <Row label="Sociedad Depositaria" value={fondo.socDepositaria || '—'} nowrap />
            <Row label="Mínimo de Inversión"  value={fondo.minimoInversion != null ? fmtMon(fondo.minimoInversion, monSym) : '—'} />
            <Row label="Código CAFCI"         value={fondo.cafci || '—'} />
            <Row label="Código CNV"           value={fondo.cnv || '—'} />
          </Section>

          {/* 2. Valor cuotaparte */}
          <Section title="Valor Cuotaparte">
            <Row label={`Valor al ${fechaActual}`} value={<span style={{ fontWeight: 700 }}>{fmtMon4(fondo.valor, monSym)}</span>} />
            <Row label="Variación diaria" value={<span style={{ color: clrPct(varD), fontWeight: 600 }}>{fmtPct(varD)}</span>} />
            {fondo.valorAnt != null && <Row label={`Valor al ${fechaAnterior || 'anterior'}`} value={fmtMon4(fondo.valorAnt, monSym)} />}
            {fondo.valorReexp != null && mon !== 'ARS' && <Row label="Valor reexp. ARS" value={fmtMon4(fondo.valorReexp, '$')} />}
          </Section>

          {/* 3. Variaciones históricas */}
          <Section title="Variaciones Históricas">
            {refs?.fecha1 && <Row label={`Del mes (${fecha1})`}  value={<span style={{ color: clrPct(var1), fontWeight: 600 }}>{fmtPct(var1)}</span>} />}
            {refs?.fecha2 && <Row label={`Del año (${fecha2})`}  value={<span style={{ color: clrPct(var2), fontWeight: 600 }}>{fmtPct(var2)}</span>} />}
            {refs?.fecha3 && <Row label={`Anual (${fecha3})`}    value={<span style={{ color: clrPct(var3), fontWeight: 600 }}>{fmtPct(var3)}</span>} />}
          </Section>

          {/* 4. Patrimonio */}
          <Section title="Patrimonio">
            <Row label={`Al ${fechaActual}`}           value={fmtMon(fondo.patrimonio, monSym)} />
            {fondo.patrimonioAnt != null && <Row label={`Al ${fechaAnterior || 'anterior'}`} value={fmtMon(fondo.patrimonioAnt, monSym)} />}
          </Section>

          {/* 5. Honorarios */}
          <Section title="Honorarios">
            <Row label="Adm. Sociedad Depositaria" value={fondo.honSD != null ? fmtNum(fondo.honSD, 2) + '%' : '—'} />
            <Row label="Adm. Sociedad Gerente"     value={fondo.honSG != null ? fmtNum(fondo.honSG, 2) + '%' : '—'} />
          </Section>

        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes slideOut {
          from { transform: translateX(0);    opacity: 1; }
          to   { transform: translateX(100%); opacity: 0; }
        }
        @keyframes backdropOut {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
        /* Con "reducir movimiento" activado, el panel se apaga sin desplazarse */
        @media (prefers-reduced-motion: reduce) {
          @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to   { transform: translateX(0); opacity: 0; }
          }
        }
      `}</style>
    </>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--accent2)', borderBottom: '1px solid var(--border)', paddingBottom: 5, marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {children}
      </div>
    </div>
  );
}

function Row({ label, value, nowrap }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: nowrap ? 'center' : 'flex-start', gap: 12 }}>
      <span style={{ fontSize: 12, color: 'var(--text2)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--text1)', fontVariantNumeric: 'tabular-nums', textAlign: 'right', whiteSpace: nowrap ? 'nowrap' : 'normal' }}>{value}</span>
    </div>
  );
}
