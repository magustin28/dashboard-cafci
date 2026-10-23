import { useCallback, useEffect, useRef, useState } from "react";

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
// cierre después de guardar): espera lo que dura la animación y recién ahí desmonta.
// Debe coincidir con la duración de las animaciones de salida de styles/portfolio.css.
// 240 ms: con 180 ms y un movimiento chico el cierre se veía casi igual que el corte seco.
export const MODAL_CLOSE_MS = 240;

export function useModalClose(onClose) {
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const timerRef = useRef(null);

  // Acepta argumentos a propósito: varios modales cierran con onClose(true) para avisarle al
  // padre que guardaron algo y hay que refrescar (p. ej. SuscripcionModal/RescateModal). Se
  // reenvían tal cual después de la animación, si no ese aviso se perdería.
  const requestClose = useCallback((...args) => {
    if (closingRef.current) return; // ignora el doble cierre (p. ej. ESC + clic en el fondo)
    closingRef.current = true;
    setClosing(true);
    timerRef.current = setTimeout(() => onClose(...args), MODAL_CLOSE_MS);
  }, [onClose]);

  // Si el modal se desmonta por otro motivo, no dejar el timer colgado
  useEffect(() => () => clearTimeout(timerRef.current), []);

  return { closing, requestClose };
}
