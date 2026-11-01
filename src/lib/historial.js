/**
 * Historial de navegación: capas (modales, paneles, diálogos) que se cierran con el gesto Atrás.
 *
 * ── El problema ──────────────────────────────────────────────────────────────────────────────
 * En el celular, el gesto de ir para atrás (y el botón físico de Android) navega el historial del
 * navegador. Si un modal está abierto y su apertura no dejó una entrada propia, el gesto se va de
 * la app con el modal todavía en pantalla; en la PWA instalada, además, cierra la app.
 *
 * ── La solución ──────────────────────────────────────────────────────────────────────────────
 * Cada capa abierta agrega UNA entrada al historial (pushState con una marca en el estado). El
 * Atrás consume esa entrada y ahí cerramos la capa de arriba: el gesto cierra el modal en vez de
 * salir de la app. Si la capa se cierra por otra vía (✕, ESC, clic en el fondo, guardar), su
 * entrada se saca con history.back() para que el próximo Atrás del usuario no quede "gastado" en
 * una entrada fantasma que no hace nada visible.
 *
 * La pila vive en el módulo y no en cada modal porque el Atrás es uno solo: si hay dos capas
 * abiertas a la vez (HistorialModal con su diálogo de confirmación) cierra la de arriba.
 *
 * ── El guardián (después del login) ───────────────────────────────────────────────────────────
 * Volver del login de Google deja la página de Google en el historial. Sin guardián, el gesto Atrás
 * en la pantalla principal volvía al login en vez de cerrar la app. El guardián es un callback que
 * se registra mientras hay sesión y el usuario está en el celular: cuando el Atrás no lo consumió
 * ninguna capa, se le pregunta si el gesto se absorbe (se intenta cerrar la app) o si es una
 * navegación real (volver de una fecha histórica). Después de cada gesto se deja otra entrada
 * centinela en el tope, así el próximo Atrás también pasa por acá y no salta a la página de Google.
 */

// Clave que se guarda en history.state. El número identifica la capa: antes de sacar una entrada
// se comprueba que el tope siga siendo el nuestro. Si en el medio se navegó a otra fecha, el tope
// es otra entrada y hacer back() desharía esa navegación.
const CLAVE = 'cafciCapa';

const capas = [];       // [{ token, consumida, cerrar }], de abajo hacia arriba
let popsIgnorados = 0;  // popstates que vienen de un cierre nuestro, no del gesto del usuario
let tokenSeq = 0;
let escuchando = false;
// Guardián del gesto Atrás en la pantalla principal: callback registrado por App.jsx mientras hay
// sesión en el celular. Devuelve true si el gesto se absorbe acá (se intentó cerrar la app).
let guardian = null;
// Entrada centinela que deja el guardián en el tope del historial (misma forma que una capa).
let centinela = null;

/** Token de la capa que está en el tope del historial, o null si el tope no es nuestro. */
export function capaEnElTope() {
  const token = window.history.state?.[CLAVE];
  return typeof token === 'number' ? token : null;
}

/** true si la capa sigue abierta (en la pila). */
export function capaAbierta(capa) {
  return !!capa && capas.includes(capa);
}

function alVolverAtras() {
  // Un cierre programático (✕, ESC, clic en el fondo, guardar) hace history.back() para sacar su
  // entrada: ese popstate no debe cerrar otra capa ni despertar al guardián.
  if (popsIgnorados > 0) {
    popsIgnorados -= 1;
    if (capas.length === 0 && !guardian && popsIgnorados === 0) dejarDeEscuchar();
    return;
  }
  const capa = capas[capas.length - 1];
  if (capa) {
    // La entrada de esta capa la consumió el gesto: al desmontarse, su cleanup no debe hacer otro
    // back() (se iría una entrada de más).
    capa.consumida = true;
    capas.pop();
    if (capas.length === 0 && !guardian) dejarDeEscuchar();
    capa.cerrar();
    return;
  }
  if (!guardian) return;
  // El gesto no era de una capa: lo decide el guardián (App.jsx).
  //   true  → el gesto se absorbe (se intentó cerrar la app): se repone el centinela en el tope así
  //           el próximo Atrás también pasa por acá y no salta a la página de Google del login.
  //   false → era una navegación real (volver de una fecha histórica): se deja la entrada como
  //           está. Reponer el centinela acá dejaría un Atrás de más que no hace nada visible.
  if (!guardian()) return;
  const token = ++tokenSeq;
  centinela = { token, consumida: false };
  window.history.pushState({ ...(window.history.state || {}), [CLAVE]: token }, '');
}

function empezarAEscuchar() {
  if (escuchando) return;
  window.addEventListener('popstate', alVolverAtras);
  escuchando = true;
}

function dejarDeEscuchar() {
  if (!escuchando) return;
  window.removeEventListener('popstate', alVolverAtras);
  escuchando = false;
}

/**
 * Da de alta una capa: la mete en la pila y agrega su entrada al historial.
 * `cerrar` se llama cuando el Atrás del usuario toca esta capa: el modal arranca su animación de
 * salida y se desmonta solo, como si se hubiera tocado la ✕.
 *
 * `previa` es la capa del montaje anterior de la MISMA instancia. Si su entrada sigue siendo el tope
 * del historial se reusa en vez de apilar otra: en dev, StrictMode monta → desmonta → monta el mismo
 * efecto y, sin esto, cada modal dejaría dos entradas (una de ellas fantasma).
 */
export function abrirCapa(cerrar, previa) {
  if (previa && !capas.includes(previa) && capaEnElTope() === previa.token) {
    previa.cerrar = cerrar;
    previa.consumida = false;
    capas.push(previa);
    empezarAEscuchar();
    return previa;
  }
  const capa = { token: ++tokenSeq, consumida: false, cerrar };
  capas.push(capa);
  empezarAEscuchar();
  window.history.pushState({ ...(window.history.state || {}), [CLAVE]: capa.token }, '');
  return capa;
}

/** Saca la capa de la pila (al desmontarse el modal). */
export function sacarCapa(capa) {
  const i = capas.indexOf(capa);
  if (i !== -1) capas.splice(i, 1);
  if (capas.length === 0 && !guardian && popsIgnorados === 0) dejarDeEscuchar();
}

/**
 * Saca la entrada del historial de la capa, si el tope sigue siendo el suyo. Se llama cuando la
 * capa se cierra por otra vía (no por el gesto), así la entrada no queda huérfana.
 * Es idempotente: si ya se consumió, o si el tope es otra entrada, no hace nada.
 */
export function sacarEntradaDelHistorial(capa) {
  if (!capa || capa.consumida) return;
  capa.consumida = true;
  if (capaEnElTope() !== capa.token) return;
  popsIgnorados += 1;
  empezarAEscuchar(); // queda un popstate pendiente: hay que "comerlo" para no cerrar otra capa
  window.history.back();
}

/**
 * Cambia la URL de la app (navegación por fechas).
 *
 * Si el tope del historial es la entrada de una CAPA ABIERTA (p. ej. el selector de fechas o el
 * panel de detalle, que se cierran enseguida), se reemplaza esa entrada y se marca la capa como
 * consumida. Si no, apilar otra dejaría la entrada de la capa atrás y su back() de limpieza se
 * llevaría puesto el `?fecha=…` recién puesto (la URL volvería a "/" con los datos de la fecha
 * vieja). El centinela NO se reemplaza: se apila encima, así sigue abajo como guardián del Atrás.
 */
export function navegarUrl(url) {
  const capa = capas[capas.length - 1];
  if (capa && capaEnElTope() === capa.token) {
    // El replaceState pisa también el estado: la entrada deja de tener la marca de la capa. Con
    // consumida = true su limpieza no hace back(), porque ya no hay marca que sacar.
    capa.consumida = true;
    window.history.replaceState({}, '', url);
    return;
  }
  window.history.pushState({}, '', url);
}

/**
 * Activa el guardián del gesto Atrás (sólo tiene sentido en el celular con sesión iniciada).
 * `consumirGesto` se llama cuando el Atrás no lo consumió ninguna capa; si devuelve true, el gesto
 * se absorbe (App.jsx intenta cerrar la app) y si devuelve false se deja pasar la navegación real
 * (volver de una fecha histórica).
 */
export function activarGuardian(consumirGesto) {
  if (guardian === consumirGesto) return;
  guardian = consumirGesto;
  empezarAEscuchar();
  if (centinela) return;
  const token = ++tokenSeq;
  centinela = { token, consumida: false };
  window.history.pushState({ ...(window.history.state || {}), [CLAVE]: token }, '');
}

/** Desactiva el guardián (al cerrar sesión o desmontar App) y saca su entrada si sigue en el tope. */
export function desactivarGuardian() {
  guardian = null;
  const previo = centinela;
  centinela = null;
  // El back() va en un microtask, igual que en el cleanup de los modales: en dev, StrictMode
  // desmonta y vuelve a montar el mismo efecto, y si el back() quedara pendiente cuando el remontaje
  // apila su centinela, el navegador cancela la navegación y el popstate no llega nunca (el contador
  // de pops ignorados quedaría en 1 y se comería el próximo gesto real).
  // sacarEntradaDelHistorial sólo hace back() si el tope sigue siendo esta entrada; si el usuario
  // está en una fecha, no toca nada y la navegación queda como está.
  if (previo) queueMicrotask(() => sacarEntradaDelHistorial(previo));
  if (capas.length === 0 && popsIgnorados === 0) dejarDeEscuchar();
}
