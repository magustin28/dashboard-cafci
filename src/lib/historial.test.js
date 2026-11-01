// ─────────────────────────────────────────────────────────────
//  Tests del historial de capas (src/lib/historial.js).
//  Correr:  npm test        (runner de Node, sin dependencias nuevas)
//
//  El módulo toca window.history y window.addEventListener, así que cada test le instala una
//  ventana FALSA: una pila de entradas y un set de oyentes de popstate. El back() de la ventana
//  falsa saca la entrada y dispara el popstate en el acto (el navegador real lo hace async, pero
//  para probar la lógica alcanza con que el orden sea el mismo).
//
//  Todos los tests terminan sin capas ni guardián activos: el módulo guarda su estado en variables
//  propias y el siguiente test tiene que arrancar limpio. Por eso el finally de cada uno saca lo
//  que abrió, aunque las aserciones hayan fallado antes.
// ─────────────────────────────────────────────────────────────
import test from "node:test";
import assert from "node:assert/strict";
import {
  abrirCapa, capaAbierta, capaEnElTope, sacarCapa, sacarEntradaDelHistorial,
  navegarUrl, activarGuardian, desactivarGuardian,
} from "./historial.js";

// Misma clave que usa el módulo (history.state.cafciCapa).
const CLAVE = "cafciCapa";
const INICIO = "/dashboard-cafci/";

function crearVentana(urlInicial = INICIO) {
  const pila = [{ state: null, url: urlInicial }];
  const oyentes = new Set();
  globalThis.window = {
    history: {
      get state() { return pila[pila.length - 1].state; },
      get length() { return pila.length; },
      pushState(state, _titulo, url) {
        pila.push({ state, url: url ?? pila[pila.length - 1].url });
      },
      replaceState(state, _titulo, url) {
        pila[pila.length - 1] = { state, url: url ?? pila[pila.length - 1].url };
      },
      back() {
        if (pila.length > 1) {
          pila.pop();
          for (const oyente of [...oyentes]) oyente({ type: "popstate" });
        }
      },
    },
    addEventListener(tipo, fn) { if (tipo === "popstate") oyentes.add(fn); },
    removeEventListener(tipo, fn) { if (tipo === "popstate") oyentes.delete(fn); },
  };
  return { pila, oyentes };
}

test("abrirCapa apila una entrada y el Atrás cierra la capa", () => {
  const { pila, oyentes } = crearVentana();
  let cerrada = 0;
  const capa = abrirCapa(() => { cerrada += 1; });
  try {
    assert.equal(pila.length, 2);                       // entrada de la capa arriba de la de la app
    assert.equal(window.history.state[CLAVE], capa.token);
    assert.ok(capaAbierta(capa));

    window.history.back();                              // gesto del usuario
    assert.equal(cerrada, 1);                           // se llamó el cierre del modal
    assert.equal(capa.consumida, true);                 // su cleanup no va a hacer otro back()
    assert.equal(capaAbierta(capa), false);
    assert.equal(oyentes.size, 0);                      // sin capas ni guardián, deja de escuchar
  } finally {
    sacarCapa(capa);
    sacarEntradaDelHistorial(capa);
    desactivarGuardian();
  }
});

test("abrirCapa reusa la capa anterior si su entrada sigue en el tope (StrictMode)", () => {
  const { pila } = crearVentana();
  const primera = abrirCapa(() => {});
  sacarCapa(primera); // el cleanup la saca de la pila, pero su entrada sigue arriba
  const segunda = abrirCapa(() => {}, primera);
  try {
    assert.equal(segunda, primera);                     // misma capa, no una nueva
    assert.equal(pila.length, 2);                       // no se apiló una segunda entrada
    assert.ok(capaAbierta(primera));
  } finally {
    sacarCapa(primera);
    sacarEntradaDelHistorial(primera);
    desactivarGuardian();
  }
});

test("el cierre por ✕ saca la entrada del historial", () => {
  const { pila, oyentes } = crearVentana();
  const capa = abrirCapa(() => {});
  try {
    assert.equal(pila.length, 2);
    sacarCapa(capa);
    sacarEntradaDelHistorial(capa);                     // como hace requestClose
    assert.equal(pila.length, 1);                       // el back() se llevó la entrada
    assert.equal(capa.consumida, true);
    assert.equal(oyentes.size, 0);
  } finally {
    sacarCapa(capa);
    sacarEntradaDelHistorial(capa);
    desactivarGuardian();
  }
});

test("con dos capas abiertas el Atrás cierra sólo la de arriba", () => {
  const { pila } = crearVentana();
  const cerradas = [];
  const abajo = abrirCapa(() => cerradas.push("abajo"));
  const arriba = abrirCapa(() => cerradas.push("arriba"));
  try {
    assert.equal(pila.length, 3);
    window.history.back();
    assert.deepEqual(cerradas, ["arriba"]);
    assert.ok(capaAbierta(abajo));
    assert.equal(capaAbierta(arriba), false);
  } finally {
    sacarCapa(arriba);
    sacarEntradaDelHistorial(arriba);
    sacarCapa(abajo);
    sacarEntradaDelHistorial(abajo);
    desactivarGuardian();
  }
});

test("navegarUrl con una capa abierta reemplaza su entrada (no apila)", () => {
  const { pila } = crearVentana();
  const capa = abrirCapa(() => {});
  const destino = `${INICIO}?fecha=2026-10-16`;
  try {
    navegarUrl(destino);
    assert.equal(pila.length, 2);                       // sigue habiendo una sola entrada de más
    assert.equal(pila[1].url, destino);
    assert.equal(window.history.state[CLAVE], undefined); // el replaceState borró la marca
    assert.equal(capaEnElTope(), null);
    assert.equal(capa.consumida, true);                 // su limpieza ya no hace back()
  } finally {
    sacarCapa(capa);
    sacarEntradaDelHistorial(capa);
    desactivarGuardian();
  }
});

test("navegarUrl sin capa apila una entrada nueva", () => {
  const { pila } = crearVentana();
  const destino = `${INICIO}?fecha=2026-10-16`;
  navegarUrl(destino);
  assert.equal(pila.length, 2);
  assert.equal(pila[1].url, destino);
  // Sin marca: es una entrada de la app y el Atrás del navegador la trata como navegación real.
  assert.equal(pila[1].state?.[CLAVE], undefined);
});

test("el guardián consume el Atrás y repone el centinela", async () => {
  const { pila, oyentes } = crearVentana();
  let llamadas = 0;
  try {
    activarGuardian(() => { llamadas += 1; return true; });
    assert.equal(pila.length, 2);                       // centinela arriba de la app
    assert.notEqual(capaEnElTope(), null);

    window.history.back();                              // gesto en la pantalla principal
    assert.equal(llamadas, 1);
    assert.equal(pila.length, 2);                       // pop + push: sigue habiendo centinela
    assert.equal(oyentes.size, 1);
  } finally {
    desactivarGuardian();
    await Promise.resolve();                            // deja correr el back() diferido
  }
});

test("el guardián deja pasar una navegación real (volver de una fecha)", async () => {
  const { pila } = crearVentana();
  try {
    activarGuardian(() => false);
    assert.equal(pila.length, 2);
    window.history.back();
    assert.equal(pila.length, 1);                       // navegación real: no repuso el centinela
  } finally {
    desactivarGuardian();
    await Promise.resolve();
  }
});
