import { useEffect } from 'react';
// Helpers de fecha: "27/02/26" → "27/02/2026"
const fmtFechaLarga = (f) => {
  if (!f) return f;
  const parts = f.split('/');
  if (parts.length === 3 && parts[2].length === 2) return `${parts[0]}/${parts[1]}/20${parts[2]}`;
  return f;
};

export default function FondoPanel({ fondo, refs, apiFecha, onClose }) {
  if (!fondo) return null;

  // Cerrar con ESC
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);


  const mon      = fondo[2];
  const regionMap   = { 'Arg': 'Argentina', 'Ext': 'Exterior' };
  const horizonteMap = { 'Cor': 'Corto Plazo', 'Med': 'Mediano Plazo', 'Lar': 'Largo Plazo' };
  const monSym   = mon === 'ARS' ? '$' : 'U$S';
  const fmtNum   = (v, dec = 2) => v != null ? parseFloat(v).toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : '—';
  const fmtPct   = (v) => v != null ? (parseFloat(v) > 0 ? '+' : '') + fmtNum(v, 3) + '%' : '—';
  const fmtMon   = (v, sym) => v != null ? `${sym} ${fmtNum(v)}` : '—';
  const fmtMon4  = (v, sym) => v != null ? `${sym} ${fmtNum(v, 4)}` : '—';
  const clrPct   = (v) => v == null ? '' : parseFloat(v) >= 0 ? '#16a34a' : '#dc2626';

  const varD  = fondo[15];
  const var1  = fondo[5];
  const var2  = fondo[6];
  const var3  = fondo[7];

  // Fechas con año completo
  const fechaActual   = fmtFechaLarga(apiFecha?.includes('-')
    ? (() => { const [y,m,d] = apiFecha.split('-'); return `${d}/${m}/${y.slice(2)}`; })()
    : apiFecha) || '—';
  const fechaAnterior = fmtFechaLarga(refs?.fechaAnterior);
  const fecha1        = fmtFechaLarga(refs?.fecha1);
  const fecha2        = fmtFechaLarga(refs?.fecha2);
  const fecha3        = fmtFechaLarga(refs?.fecha3);

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 300 }} onClick={onClose} />

      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 460, maxWidth: '95vw',
        background: 'var(--card)', borderLeft: '1px solid var(--border)',
        zIndex: 301, overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.25)',
        animation: 'slideIn 0.2s ease',
      }}>

        {/* Header */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--card)', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3, color: 'var(--text1)' }}>{fondo[1]}</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 18, padding: 4, flexShrink: 0 }}>✕</button>
          </div>
        </div>

        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* 1. Datos Generales — primero */}
          <Section title="Datos Generales">
            <Row label="Moneda"              value={mon} />
            <Row label="Región"              value={regionMap[fondo[3]] || fondo[3] || '—'} />
            <Row label="Horizonte"           value={horizonteMap[fondo[4]] || fondo[4] || '—'} />
            <Row label="Sociedad Gerente"    value={fondo[11] || '—'} nowrap />
            <Row label="Sociedad Depositaria" value={fondo[16] || '—'} nowrap />
            <Row label="Mínimo de Inversión" value={fondo[19] != null ? fmtMon(fondo[19], monSym) : '—'} />
            <Row label="Código CAFCI"        value={fondo[13] || '—'} />
            <Row label="Código CNV"          value={fondo[0]  || '—'} />
          </Section>

          {/* 2. Valor cuotaparte */}
          <Section title="Valor Cuotaparte">
            <Row label={`Valor al ${fechaActual}`} value={<span style={{ fontWeight: 700 }}>{fmtMon4(fondo[14], monSym)}</span>} />
            <Row label="Variación diaria" value={<span style={{ color: clrPct(varD), fontWeight: 600 }}>{fmtPct(varD)}</span>} />
            {fondo[21] != null && <Row label={`Valor al ${fechaAnterior || 'anterior'}`} value={fmtMon4(fondo[21], monSym)} />}
            {fondo[22] != null && mon !== 'ARS' && <Row label="Valor reexp. ARS" value={fmtMon4(fondo[22], '$')} />}
          </Section>

          {/* 3. Variaciones históricas */}
          <Section title="Variaciones Históricas">
            {refs?.fecha1 && <Row label={`Del mes (${fecha1})`}  value={<span style={{ color: clrPct(var1), fontWeight: 600 }}>{fmtPct(var1)}</span>} />}
            {refs?.fecha2 && <Row label={`Del año (${fecha2})`}  value={<span style={{ color: clrPct(var2), fontWeight: 600 }}>{fmtPct(var2)}</span>} />}
            {refs?.fecha3 && <Row label={`Anual (${fecha3})`}    value={<span style={{ color: clrPct(var3), fontWeight: 600 }}>{fmtPct(var3)}</span>} />}
          </Section>

          {/* 4. Patrimonio */}
          <Section title="Patrimonio">
            <Row label={`Al ${fechaActual}`}           value={fmtMon(fondo[9], monSym)} />
            {fondo[20] != null && <Row label={`Al ${fechaAnterior || 'anterior'}`} value={fmtMon(fondo[20], monSym)} />}
          </Section>

          {/* 5. Honorarios */}
          <Section title="Honorarios">
            <Row label="Adm. Sociedad Depositaria" value={fondo[17] != null ? fmtNum(fondo[17], 2) + '%' : '—'} />
            <Row label="Adm. Sociedad Gerente"     value={fondo[18] != null ? fmtNum(fondo[18], 2) + '%' : '—'} />
          </Section>

        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#16a34a', borderBottom: '1px solid var(--border)', paddingBottom: 5, marginBottom: 8 }}>
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
