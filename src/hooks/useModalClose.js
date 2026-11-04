import { useCallback, useEffect, useRef, useState } from "react";
import { abrirCapa, capaAbierta, capaSuperior, sacarCapa, sacarEntradaDelHistorial } from "../lib/historial";

// Cierre animado para los modales/paneles.
//
// Problema que resuelve: todos abrían con una animación (`.modal { animation: fadeUp }`) pero
// al cerrar desaparecían de golpe, porque el componente se desmontaba en el mismo instante en
// que se llamaba a onClose(). El efecto de salida era distinto al de entrada.
//
// Uso:
//   const { closing, requestClose } = useModalClose(onClose);
//   <div className={`modal-overlay${closing ? " closing" : ""}`} onClick={...requestClose}>
// `closing` agrega la clase que dispara la animación de salida (ver styles/portfolio.css) y
// `requestClose` reemplaza a onClose en TODOS los caminos (botón ✕, clic en el fondo, ESC,
// cierre después de guardar): espera lo que dura la animación y recién ahí desmonta. El ESC lo
// atiende el propio hook (ver más abajo), así ningún modal repite su listener.
// Debe coincidir con la duración de las animaciones de salida de styles/portfolio.css.
// 240 ms: con 180 ms y un movimiento chico el cierre se veía casi igual que el corte seco.
export const MODAL_CLOSE_MS = 240;

// El hook se usa en componentes que se montan al abrirse: montarse = estar visible. Un diálogo que
// vive adentro de otro modal y se muestra con un estado propio (ConfirmDialog) usa su propio hook,
// así no registra capas fantasma mientras no está visible.
//
// ESC se atiende acá, una sola vez por instancia: cierra la capa que está ARRIBA de la pila (la
// misma que responde al gesto Atrás), así el modal de fondo no se cierra junto con el diálogo que
// tiene encima. `alEscape` puede consumir la tecla devolviendo true: HistorialModal lo usa para
// cancelar la edición de una fila en lugar de cerrarse.
//
// Mientras dura la animación de salida se ignora el ESC. Mantener la tecla apretada dispara un
// keydown cada ~30 ms y, como la capa que se está cerrando ya salió de la pila, esas repeticiones
// cerrarían el modal que quedó abajo.
let ultimoCierreMs = 0;

export function useModalClose(onClose, { alEscape } = {}) {
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const timerRef = useRef(null);
  // Capa de esta instancia en el historial (ver lib/historial.js). Va en un ref porque la usan el
  // cierre programático y el cleanup, no el render.
  const capaRef = useRef(null);
  // Última versión de requestClose: la capa registrada en el historial la llama desde un evento del
  // navegador (el gesto Atrás), así que tiene que ver el onClose actual y no el del primer render.
  const requestCloseRef = useRef(null);
  // Última versión de alEscape: el listener de ESC se registra una sola vez y tiene que ver la
  // función del render actual (en HistorialModal depende de editSusc/editResc).
  const alEscapeRef = useRef(alEscape);

  // Acepta argumentos a propósito: varios modales cierran con onClose(true) para avisarle al
  // padre que guardaron algo y hay que refrescar (p. ej. SuscripcionModal/RescateModal). Se
  // reenvían tal cual después de la animación, si no ese aviso se perdería.
  const requestClose = useCallback((...args) => {
    if (closingRef.current) return; // ignora el doble cierre (p. ej. ESC + clic en el fondo)
    closingRef.current = true;
    ultimoCierreMs = Date.now();
    setClosing(true);
    // La capa sale de la pila AHORA y su entrada del historial se saca YA: si se dejara para el
    // desmontaje (240 ms después), el próximo Atrás del usuario gastaría un toque en una entrada
    // que no hace nada visible. sacarEntradaDelHistorial es idempotente, así que si el cierre vino
    // justamente del gesto Atrás (entrada ya consumida) no hace nada.
    const capa = capaRef.current;
    sacarCapa(capa);
    sacarEntradaDelHistorial(capa);
    timerRef.current = setTimeout(() => onClose(...args), MODAL_CLOSE_MS);
  }, [onClose]);

  useEffect(() => { requestCloseRef.current = requestClose; }, [requestClose]);

  // Alta en el historial: los modales se renderizan condicionalmente ({modal && <Modal …/>}), así
  // que montarse = estar abierto. El gesto Atrás cierra esta capa y con ella el modal.
  // abrirCapa reusa la capa del montaje anterior si su entrada sigue en el tope: en dev, StrictMode
  // monta → desmonta → monta el mismo efecto y, si no, cada modal dejaría dos entradas (una
  // fantasma). Por eso la lógica de reuso vive en el módulo y no acá.
  useEffect(() => {
    const capa = abrirCapa(() => requestCloseRef.current(), capaRef.current);
    capaRef.current = capa;

    return () => {
      // Si el modal se desmonta por otro motivo, no dejar el timer colgado.
      clearTimeout(timerRef.current);
      sacarCapa(capa);
      // El back() de la limpieza va después del commit: si el remontaje de StrictMode reusó la capa,
      // su entrada sigue sirviendo y no hay que sacarla.
      queueMicrotask(() => {
        if (!capaAbierta(capa)) sacarEntradaDelHistorial(capa);
      });
    };
  }, []);

  useEffect(() => { alEscapeRef.current = alEscape; }, [alEscape]);

  // ESC: una sola vez por instancia. Con dos capas abiertas se ejecutan los dos listeners, pero el
  // de abajo se descarta porque capaSuperior() ya no es su capa.
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== "Escape") return;
      if (Date.now() - ultimoCierreMs < MODAL_CLOSE_MS) return;
      if (capaSuperior() !== capaRef.current) return;
      if (alEscapeRef.current?.()) return;
      requestCloseRef.current?.();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return { closing, requestClose };
}
