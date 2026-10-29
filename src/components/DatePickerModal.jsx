import { useEffect, useMemo, useState } from 'react';
import { useModalClose } from '../hooks/useModalClose';
import { IconCalendar, IconX } from './Icons';

// Nombres de mes para la grilla. Las fechas llegan como YYYY-MM-DD, así que el mes
// (2 dígitos, 1-12) se usa como índice: parseInt(m, 10) - 1.
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

/**
 * Modal de fechas históricas del header: agrupa las fechas disponibles por año y mes y cambia la
 * vista al día elegido EN LA MISMA pestaña (onElegir → App, que actualiza la URL y el estado).
 * Antes abría `?fecha=…` en una pestaña nueva: cada consulta dejaba una pestaña abierta.
 *
 * Vive acá y no en Header.jsx porque el header ya mezclaba marca, meta, sesión y este
 * modal. El Header sólo guarda pickerOpen y monta este componente cuando hace falta.
 *
 * El cierre (X, clic en el fondo y ESC) pasa por useModalClose igual que en el resto de
 * los modales: `closing` dispara la animación de salida y requestClose espera esos 240 ms
 * antes de llamar a onClose. El ESC se registra acá adentro, así que sólo existe mientras
 * el modal está montado.
 *
 * Props:
 *   fechas      fechas disponibles (YYYY-MM-DD), descendente: fechas[0] es la planilla más nueva,
 *               la misma que muestra la vista principal
 *   esHistorica true si se está mirando una fecha histórica (marca el chip "Actual")
 *   onElegir    recibe la fecha elegida; null = volver a los datos actuales
 *   onClose     función que desmonta el modal (la llama requestClose tras la animación)
 */
export default function DatePickerModal({ fechas, esHistorica, onElegir, onClose }) {
  const [anioElegido, setAnioElegido] = useState(null);
  // La planilla más nueva ("la actual") no sale de apiFecha: en una página histórica apiFecha es
  // ESA fecha, no la del día. El listado viene descendente, así que es la primera.
  const fechaActual = fechas[0] || null;
  const [, mesActual, diaActual] = fechaActual ? fechaActual.split('-') : [];

  const { closing, requestClose } = useModalClose(onClose);

  // Cerrar con ESC, igual que la X y el clic en el fondo.
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') requestClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [requestClose]);

  // Agrupar fechas por año y mes: { '2026': { '10': ['2026-10-18', ...], ... }, ... }
  const grouped = useMemo(() => {
    const map = {};
    fechas.forEach(f => {
      if (f === fechaActual) return; // la fecha actual la muestra el chip, no la grilla histórica
      const [y, m] = f.split('-');
      if (!map[y]) map[y] = {};
      if (!map[y][m]) map[y][m] = [];
      map[y][m].push(f);
    });
    return map;
  }, [fechas, fechaActual]);

  const anios = useMemo(() => Object.keys(grouped).sort((a, b) => b - a), [grouped]);

  // Año seleccionado: el más reciente por defecto (derivado, sin estado ni effect).
  const anioSel = anioElegido || anios[0] || null;

  const mesesDelAnio = anioSel && grouped[anioSel]
    ? Object.keys(grouped[anioSel]).sort((a, b) => b - a)
    : [];

  return (
    <div className={`modal-overlay datepicker-overlay${closing ? ' closing' : ''}`}
      onClick={e => { if (e.target === e.currentTarget) requestClose(); }}>
      <div className="modal datepicker-modal">
        <button className="modal-close" onClick={requestClose} aria-label="Cerrar"><IconX size={16} /></button>
        <h2 className="modal-title"><IconCalendar size={18} /> Fechas históricas</h2>
        <p className="modal-subtitle">Seleccioná una fecha para ver los datos de ese día</p>

        {/* Volver a los datos actuales. Va FUERA de la grilla a propósito: la grilla es histórica y
            esta entrada no navega a ?fecha= sino a la vista principal (sin parámetro). Sólo se
            muestra mirando una fecha vieja: en la vista actual no habría a dónde volver. */}
        {esHistorica && fechaActual && (
          <button className="datepicker-actual"
            onClick={() => { onElegir(null); requestClose(); }}
            title="Volver a los datos actuales">
            Actual · {diaActual}/{mesActual}
          </button>
        )}

        {/* Selector de año */}
        {anios.length > 1 && (
          <div className="datepicker-years">
            {anios.map(a => (
              <button key={a} onClick={() => setAnioElegido(a)}
                className={`datepicker-year${anioSel === a ? ' active' : ''}`}>
                {a}
              </button>
            ))}
          </div>
        )}

        {/* Grilla por mes. El botón del header se renderiza siempre, así que el modal se puede
            abrir antes de que /api/fechas responda: en ese caso se avisa en vez de mostrar una
            grilla vacía, y se completa solo cuando llegan las fechas (el listado entra por prop). */}
        {fechas.length === 0 ? (
          <p className="datepicker-empty">Cargando fechas…</p>
        ) : (
          <div className="datepicker-scroll">
            {mesesDelAnio.map(m => (
              <div key={m} className="datepicker-month">
                <div className="datepicker-month-label">{MESES[parseInt(m, 10) - 1]}</div>
                <div className="datepicker-days">
                  {grouped[anioSel][m].map(f => {
                    const [, , d] = f.split('-');
                    return (
                      <button key={f} className="datepicker-day"
                        onClick={() => { onElegir(f); requestClose(); }}>
                        {d}/{m}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
