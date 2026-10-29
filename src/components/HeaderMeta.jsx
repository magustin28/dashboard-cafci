import { formatFechaLabel, diasDesdeFecha, diasHabilesDeAtraso, estadoFrescura } from '../lib/utils';
import { IconCalendar, IconX } from './Icons';

/**
 * "2026-10-26" → "26/10/26". En el celular la fecha corta es lo que hace que la fila del meta
 * (fecha + fondos totales) entre en una sola línea: ver @media de styles/utils.css.
 */
function fechaCorta(iso) {
  const [y, m, d] = (iso || '').split('-');
  return d ? `${d}/${m}/${y.slice(2)}` : (iso || '');
}

/**
 * Info de estado del header: semáforo de frescura + fecha del dato + total de fondos.
 *
 * Muestra "Histórico: <fecha>" cuando se está mirando una fecha pasada (?fecha=YYYY-MM-DD) y
 * "Actualizado: <fecha>" cuando son los datos del día. El total de fondos se omite mientras
 * todavía no llegó (totalFondos = 0), así no aparece un "0 fondos" en el primer render.
 *
 * El semáforo compara la fecha del dato con el último día hábil esperado (diasHabilesDeAtraso +
 * estadoFrescura en lib/utils). Se cuentan días HÁBILES, no calendario: así un lunes la planilla
 * del viernes da 0 y no queda marcada como atrasada (antes el lunes siempre salía en ámbar,
 * porque el fin de semana sumaba 2 días).
 *   al-dia   → punto verde pulsando (0-1 actualización salteada)
 *   atrasado → punto ámbar + "hace N días" en el texto (2 a 9)
 *   viejo    → punto rojo, sin pulso, + "hace N días" (10 o más)
 * El "hace N días" usa días CALENDARIO (diasDesdeFecha): es la antigüedad real del dato, la que
 * coincide con la fecha que se ve al lado.
 * Cuando se mira el histórico el semáforo no aplica: la fecha elegida es vieja a propósito, así
 * que queda el punto verde neutro y el chip en ámbar de .meta-historico.
 *
 * Props:
 *   apiFecha    fecha que informa la API para los datos actuales
 *   totalFondos cantidad de fondos disponibles (0 = todavía no cargó)
 *   fechaParam  fecha histórica pedida por URL, o null si son los datos actuales
 *   onVolverHoy limpia la fecha histórica y vuelve a los datos actuales (el chip es un botón)
 */
export default function HeaderMeta({ apiFecha, totalFondos, fechaParam, onVolverHoy }) {
  // Antigüedad real del dato (calendario, para el texto) y atraso en días hábiles (semáforo).
  // Si no hay fecha (todavía cargando) ambos son null.
  const dias = diasDesdeFecha(apiFecha);
  const atraso = diasHabilesDeAtraso(apiFecha);
  const estado = fechaParam ? null : estadoFrescura(atraso);

  return (
    <>
      <div className="meta-item">
        <span className={`meta-dot${estado ? ' ' + estado : ''}`}></span>
        {fechaParam
          ? (
            /* Es un botón: es la única forma de volver a los datos actuales desde una fecha
               histórica (antes era un <span> y la salida era editar la URL o el botón Atrás). */
            <button className="meta-historico meta-volver-hoy" onClick={onVolverHoy}
              title="Volver a los datos actuales">
              <IconCalendar size={12} /> Histórico: {formatFechaLabel(fechaParam)} <IconX size={11} />
            </button>
          )
          : (
            <span>
              {/* Dos formatos de la misma fecha: en escritorio la ISO de siempre y en el celular la
                  corta, para que no se parta la fila. */}
              <span className="meta-largo">Actualizado: {apiFecha || 'Cargando…'}</span>
              <span className="meta-corto">Actualizado: {fechaCorta(apiFecha)}</span>
              {/* El "hace N días" acompaña al semáforo: sólo aparece cuando el dato dejó de estar
                  al día, así un lunes normal (verde) no muestra "hace 3 días". */}
              {estado && estado !== 'al-dia' && dias !== null && <span className="meta-dias"> · hace {dias} días</span>}
            </span>
          )
        }
      </div>
      {totalFondos > 0 && (
        <div className="meta-item">
          {/* "fondos totales" en escritorio y "fondos" en el celular: con la etiqueta larga la fila
              del meta se parte en dos líneas. */}
          <span className="meta-largo">{totalFondos.toLocaleString('es-AR')} fondos totales</span>
          <span className="meta-corto">{totalFondos.toLocaleString('es-AR')} fondos</span>
        </div>
      )}
    </>
  );
}
